"""DeepCook community API. SQLite metadata plus bounded, immutable JPEG files."""
import hashlib
import hmac
import io
import json
import os
import re
import sqlite3
import threading
import time
import shutil
import tempfile
import secrets
from collections import OrderedDict
from pathlib import Path
from urllib.parse import parse_qs
from datetime import datetime, timezone
from PIL import Image, UnidentifiedImageError
from errors import ApiError
from accounts import Accounts

PREFIX = "/deepcook-api/v1"
POST_ID = re.compile(r"post-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\Z")
TOKEN = re.compile(r"Bearer ([a-f0-9]{64})\Z")
PHOTO_FILE = re.compile(r"[a-f0-9]{64}\.jpg\Z")
PHOTO_LIMIT = 1024 * 1024


class CommunityApp:
    def __init__(self, database, recipe_ids, origins, rate_limits=True, media_limit=5 * 1024**3, reserve_bytes=2 * 1024**3, backup_token=None, secure_cookies=True):
        self.recipes = frozenset(recipe_ids)
        self.origins = frozenset(origins)
        self.rate_limits = rate_limits
        self.lock = threading.RLock()
        self.buckets = OrderedDict()
        self.media = Path(database).parent / 'media'
        self.media.mkdir(mode=0o700, exist_ok=True)
        self.backups = Path(database).parent / 'backups'
        self.media_limit, self.reserve_bytes = media_limit, reserve_bytes
        self.backup_token = backup_token or secrets.token_hex(32)
        # A single connection serializes tiny indexed operations, including checkpoints.
        # Do not increase Gunicorn workers: each process would own another connection.
        self.db = sqlite3.connect(database, check_same_thread=False, isolation_level=None)
        self.db.row_factory = sqlite3.Row
        self.db.executescript("""
            PRAGMA journal_mode=WAL;
            PRAGMA synchronous=FULL;
            PRAGMA busy_timeout=3000;
            PRAGMA cache_size=-1024;
            PRAGMA wal_autocheckpoint=128;
            CREATE TABLE IF NOT EXISTS ratings (
                recipe TEXT NOT NULL, owner TEXT NOT NULL,
                score INTEGER NOT NULL CHECK(score BETWEEN 1 AND 10),
                PRIMARY KEY(recipe, owner)
            ) WITHOUT ROWID;
            CREATE INDEX IF NOT EXISTS ratings_summary ON ratings(recipe, score);
            CREATE TABLE IF NOT EXISTS posts (
                id TEXT PRIMARY KEY, recipe TEXT NOT NULL, owner TEXT NOT NULL,
                submission INTEGER NOT NULL CHECK(submission IN (0, 1)),
                body TEXT NOT NULL, created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS posts_page ON posts(recipe, submission, created_at DESC, id DESC);
            CREATE TABLE IF NOT EXISTS profiles (
                owner TEXT PRIMARY KEY, display_name TEXT NOT NULL,
                import_key TEXT UNIQUE
            );
            CREATE TABLE IF NOT EXISTS community_imports (
                key TEXT PRIMARY KEY, applied_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS photos (
                post_id TEXT PRIMARY KEY, recipe TEXT NOT NULL, owner TEXT NOT NULL,
                file TEXT NOT NULL, source_hash TEXT NOT NULL, size INTEGER NOT NULL,
                created_at INTEGER NOT NULL, published INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS photos_file ON photos(file, published);
            CREATE INDEX IF NOT EXISTS photos_pending ON photos(published, created_at);
            CREATE TABLE IF NOT EXISTS photo_garbage(file TEXT PRIMARY KEY);
        """)
        self.accounts = Accounts(self, secure_cookies=secure_cookies)
        with self.lock: self.prune(orphan_scan=True)

    def prune(self, orphan_scan=False):
        """Called under the database lock. Retain failed uploads for up to one day."""
        cutoff = int(time.time() * 1000) - 86400000
        self.db.execute('INSERT OR IGNORE INTO photo_garbage SELECT file FROM photos WHERE published=0 AND created_at<?', [cutoff])
        self.db.execute('DELETE FROM photos WHERE published=0 AND created_at<?', [cutoff])
        for row in self.db.execute('SELECT file FROM photo_garbage').fetchall():
            name = row['file']
            if self.db.execute('SELECT 1 FROM photos WHERE file=? LIMIT 1', [name]).fetchone():
                self.db.execute('DELETE FROM photo_garbage WHERE file=?', [name])
                continue
            try:
                if PHOTO_FILE.fullmatch(name): (self.media / name).unlink(missing_ok=True)
                self.db.execute('DELETE FROM photo_garbage WHERE file=?', [name])
            except OSError:
                pass  # Retry on the next upload, delete or daily backup.
        if orphan_scan:
            referenced = {row['file'] for row in self.db.execute('SELECT DISTINCT file FROM photos')}
            for path in self.media.iterdir():
                if path.name not in referenced and (PHOTO_FILE.fullmatch(path.name) or path.name.startswith('.upload-')):
                    path.unlink(missing_ok=True)
            self.accounts.prune(orphan_scan=True)

    def upload(self, environ, recipe, post_id, owner, attach=False):
        if not POST_ID.fullmatch(post_id): raise ApiError(400, '图片标识无效。')
        with self.lock:
            post = self.db.execute('SELECT * FROM posts WHERE id=?', [post_id]).fetchone()
            previous = self.db.execute('SELECT * FROM photos WHERE post_id=?', [post_id]).fetchone()
            if post and (post['owner'] != owner or post['recipe'] != recipe): raise ApiError(403, '只能上传自己作业的图片。')
            if previous and (previous['owner'] != owner or previous['recipe'] != recipe): raise ApiError(403, '图片不属于当前访客。')
            if attach and not post: raise ApiError(404, '作业不存在。')
            if post and not post['submission']: raise ApiError(400, '评论不支持附图。')
        try:
            length = int(environ.get('CONTENT_LENGTH', '0'))
            if length <= 0 or length > PHOTO_LIMIT: raise ValueError()
            if environ.get('CONTENT_TYPE', '').split(';')[0] != 'image/jpeg': raise ValueError()
            raw = environ['wsgi.input'].read(length)
            if len(raw) != length: raise ValueError()
        except (ValueError, OSError): raise ApiError(400, '请选择 1 MB 以内的压缩 JPEG 照片。') from None
        source_hash = hashlib.sha256(raw).hexdigest()
        with self.lock:
            if previous and previous['source_hash'] == source_hash and (self.media / previous['file']).is_file():
                if attach: self.db.execute('UPDATE photos SET published=1 WHERE post_id=?', [post_id])
                elif not previous['published']: self.db.execute('UPDATE photos SET created_at=? WHERE post_id=?', [int(time.time()*1000), post_id])
                return {'ok': True, 'photoUrl': f'{PREFIX}/photos/{previous["file"]}'}
            if previous and previous['published']: raise ApiError(409, '这份作业已经发布了另一张照片。')
            if post and not attach: raise ApiError(409, '作业已发布，请重新打开编辑框。')
        # Decode only a bounded image, then re-encode to remove metadata and trailing payloads.
        try:
            with Image.open(io.BytesIO(raw), formats=['JPEG']) as image:
                if image.size != (1200, 900): raise ValueError()
                image.load()
                image = image.convert('RGB')
                for quality in [82, 65, 50]:
                    output = io.BytesIO()
                    image.save(output, 'JPEG', quality=quality)
                    normalized = output.getvalue()
                    if len(normalized) <= PHOTO_LIMIT: break
                else: raise ValueError()
        except (ValueError, OSError, UnidentifiedImageError, Image.DecompressionBombError):
            raise ApiError(400, '照片无法读取，请重新选择。') from None
        name = hashlib.sha256(normalized).hexdigest() + '.jpg'
        with self.lock:
            # Recheck ownership after decoding, which runs outside the database lock.
            post = self.db.execute('SELECT * FROM posts WHERE id=?', [post_id]).fetchone()
            previous = self.db.execute('SELECT * FROM photos WHERE post_id=?', [post_id]).fetchone()
            if post and (post['owner'] != owner or post['recipe'] != recipe): raise ApiError(403, '作业不属于当前访客。')
            if previous and (previous['owner'] != owner or previous['recipe'] != recipe): raise ApiError(403, '图片不属于当前访客。')
            if attach and not post: raise ApiError(404, '作业不存在。')
            if post and not post['submission']: raise ApiError(400, '评论不支持附图。')
            if previous and previous['published'] and previous['source_hash'] != source_hash: raise ApiError(409, '作业照片已发布。')
            if post and not attach and not (previous and previous['published'] and previous['source_hash'] == source_hash): raise ApiError(409, '作业已发布。')
            self.prune()
            if not previous and self.db.execute('SELECT COUNT(*) FROM photos WHERE owner=? AND published=0', [owner]).fetchone()[0] >= 8:
                raise ApiError(429, '未发布的附图过多，请先完成或取消现有作业。')
            used = self.db.execute('SELECT COALESCE(SUM(size),0) FROM (SELECT MAX(size) AS size FROM photos GROUP BY file)').fetchone()[0]
            target = self.media / name
            if not target.exists() and (used + len(normalized) > self.media_limit or shutil.disk_usage(self.media).free < self.reserve_bytes + len(normalized)):
                raise ApiError(507, '服务器图片空间暂时不足，草稿已保留。')
            if not target.exists():
                with tempfile.NamedTemporaryFile(dir=self.media, prefix='.upload-', delete=False) as temporary:
                    temp = Path(temporary.name)
                    try:
                        temporary.write(normalized); temporary.flush(); os.fsync(temporary.fileno())
                        os.replace(temp, target)
                        descriptor = os.open(self.media, os.O_RDONLY)
                        try: os.fsync(descriptor)
                        finally: os.close(descriptor)
                    finally: temp.unlink(missing_ok=True)
            self.db.execute('BEGIN IMMEDIATE')
            try:
                if previous: self.db.execute('INSERT OR IGNORE INTO photo_garbage VALUES(?)', [previous['file']])
                self.db.execute('INSERT INTO photos VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(post_id) DO UPDATE SET file=excluded.file,source_hash=excluded.source_hash,size=excluded.size,created_at=excluded.created_at,published=MAX(photos.published,excluded.published)',
                    [post_id, recipe, owner, name, source_hash, len(normalized), int(time.time()*1000), int(attach)])
                self.db.execute('COMMIT')
            except Exception:
                self.db.execute('ROLLBACK')
                if not self.db.execute('SELECT 1 FROM photos WHERE file=?', [name]).fetchone(): target.unlink(missing_ok=True)
                raise
            self.prune()
            return {'ok': True, 'photoUrl': f'{PREFIX}/photos/{name}'}

    def backup(self):
        """Snapshot the database and immutable media under the same application lock."""
        with self.lock:
            self.prune(orphan_scan=True)
            self.backups.mkdir(mode=0o700, exist_ok=True)
            target = Path(tempfile.mkdtemp(prefix=datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S-'), dir=self.backups))
            try:
                with sqlite3.connect(target / 'community.sqlite3') as backup:
                    self.db.backup(backup)
                    if backup.execute('PRAGMA quick_check').fetchone()[0] != 'ok': raise OSError('Backup verification failed')
                    (target / 'media').mkdir(mode=0o700)
                    for row in backup.execute('SELECT DISTINCT file FROM photos'):
                        os.link(self.media / row[0], target / 'media' / row[0])
                    (target / 'account-media').mkdir(mode=0o700)
                    for row in backup.execute('SELECT DISTINCT file FROM account_media'):
                        os.link(self.accounts.media / row[0], target / 'account-media' / row[0])
                (target / 'complete').write_text('ok\n')
            except Exception:
                shutil.rmtree(target)
                raise
            for old in sorted((p for p in self.backups.iterdir() if p.is_dir() and (p/'complete').is_file()), reverse=True)[7:]:
                shutil.rmtree(old)
            return {'ok': True, 'snapshot': target.name}

    def image_response(self, environ, start_response, headers):
        match = re.fullmatch(re.escape(PREFIX) + r'/photos/([a-f0-9]{64}\.jpg)', environ['PATH_INFO'])
        if not match: raise ApiError(404, '图片不存在。')
        if environ['REQUEST_METHOD'] not in ('GET', 'HEAD'): raise ApiError(405, '不支持的操作。')
        name = match[1]
        with self.lock:
            if not self.db.execute('SELECT 1 FROM photos WHERE file=? AND published=1 LIMIT 1', [name]).fetchone(): raise ApiError(404, '图片不存在。')
            try: photo = (self.media / name).open('rb')
            except FileNotFoundError: raise ApiError(404, '图片不存在。') from None
        etag = '"' + name[:-4] + '"'
        headers = [(key,value) for key,value in headers if key not in ('Content-Type','Cache-Control')]
        headers += [('Content-Type','image/jpeg'),('Cache-Control','public, max-age=86400, immutable'),('ETag',etag)]
        if environ.get('HTTP_IF_NONE_MATCH') == etag:
            photo.close(); start_response('304 Not Modified', headers); return []
        headers.append(('Content-Length',str(os.fstat(photo.fileno()).st_size)))
        start_response('200 OK', headers)
        if environ['REQUEST_METHOD'] == 'HEAD': photo.close(); return []
        if 'wsgi.file_wrapper' in environ: return environ['wsgi.file_wrapper'](photo, 65536)
        def chunks():
            try:
                while data := photo.read(65536): yield data
            finally: photo.close()
        return chunks()

    def allowed_origin(self, origin):
        # Cookie-authenticated requests require an exact source allowlist.
        # Ownership is checked independently through the session or visitor token.
        return bool(origin) and origin != '*' and origin in self.origins

    def limit(self, key, limit, period):
        if not self.rate_limits:
            return
        now = time.monotonic()
        with self.lock:
            started, count = self.buckets.pop(key, (now, 0))
            if now - started >= period:
                started, count = now, 0
            self.buckets[key] = (started, count + 1)
            while len(self.buckets) > 2048:
                self.buckets.popitem(last=False)
            if count >= limit:
                raise ApiError(429, "操作太频繁，请稍后再试。")

    def identity(self, environ, required=False):
        account = self.accounts.current(environ)
        if account: return account['owner']
        return self.guest_identity(environ, required)

    def guest_identity(self, environ, required=False):
        header = environ.get("HTTP_AUTHORIZATION", "")
        match = TOKEN.fullmatch(header)
        if match:
            return hashlib.sha256(match[1].encode("ascii")).hexdigest()
        if required or header:
            raise ApiError(401, "浏览器身份无效，请刷新页面后重试。")
        return ""

    def body(self, environ, fields, optional=frozenset(), maximum=12288):
        try:
            length = int(environ.get("CONTENT_LENGTH", "0"))
            if length <= 0 or length > maximum:
                raise ValueError()
            if environ.get("CONTENT_TYPE", "").split(";")[0] != "application/json":
                raise ValueError()
            body = json.loads(environ["wsgi.input"].read(length))
            if not isinstance(body, dict) or not fields <= set(body) or not set(body) <= fields | optional:
                raise ValueError()
            return body
        except (ValueError, UnicodeError):
            raise ApiError(400, "请求格式不正确，请检查输入后重试。") from None

    def page(self, recipe, submission, owner, cursor=""):
        params = [recipe, int(submission)]
        clause = ""
        if cursor:
            try:
                timestamp, post_id = cursor.split(":", 1)
                timestamp = int(timestamp)
                if not 0 <= timestamp <= 8640000000000000 or not POST_ID.fullmatch(post_id):
                    raise ValueError()
            except ValueError:
                raise ApiError(400, "分页位置无效，请重新读取。") from None
            clause = " AND (posts.created_at, posts.id) < (?, ?)"
            params.extend([timestamp, post_id])
        rows = self.db.execute(
            "SELECT posts.*,photos.file AS photo_file,profiles.display_name FROM posts LEFT JOIN photos ON posts.id=photos.post_id AND photos.published=1 LEFT JOIN profiles ON posts.owner=profiles.owner WHERE posts.recipe=? AND posts.submission=?" + clause +
            " ORDER BY posts.created_at DESC,posts.id DESC LIMIT 6", params,
        ).fetchall()
        posts = [{
            "id": row["id"], "recipeId": recipe,
            "submission": bool(row["submission"]), "text": row["body"],
            "photo": None, "photoUrl": f'{PREFIX}/photos/{row["photo_file"]}' if row['photo_file'] else None,
            "sample": False, "cloud": True,
            "mine": row["owner"] == owner,
            "author": "我" if row["owner"] == owner else row['display_name'] or "访客 " + row["owner"][:6],
            "createdAt": row["created_at"],
        } for row in rows[:5]]
        last = rows[4] if len(rows) > 5 else None
        return {"posts": posts, "next": f'{last["created_at"]}:{last["id"]}' if last else None}

    def dispatch(self, environ):
        method, path = environ["REQUEST_METHOD"], environ["PATH_INFO"]
        if method == "GET" and path == PREFIX + "/health":
            return {"ok": True, "storage": "sqlite", "uploads": True, "accounts": True}
        if path.startswith(PREFIX+'/auth/') or path.startswith(PREFIX+'/account/'):
            return self.accounts.dispatch(environ)
        if path == '/internal/backup' and method == 'POST' and environ.get('REMOTE_ADDR') == '127.0.0.1' and not environ.get('HTTP_X_REAL_IP') and hmac.compare_digest(environ.get('HTTP_AUTHORIZATION', ''), 'Bearer '+self.backup_token):
            return self.backup()
        match = re.fullmatch(re.escape(PREFIX) + r"/recipes/([a-z0-9-]{1,128})(?:/(rating|posts|uploads)(?:/(post-[a-f0-9-]+))?(?:/(photo))?)?", path)
        if not match:
            raise ApiError(404, "接口不存在。")
        recipe, resource, post_id, attachment = match.groups()
        if recipe not in self.recipes:
            raise ApiError(404, "这道菜谱暂不支持公开交流。")
        writing = method != "GET"
        owner = self.identity(environ, required=writing)
        # The service binds only to loopback. OpenResty replaces this header.
        ip = environ.get("HTTP_X_REAL_IP", environ.get("REMOTE_ADDR", "local"))
        self.limit((ip, "read"), 600, 60)
        if writing:
            if not self.allowed_origin(environ.get("HTTP_ORIGIN", '')):
                raise ApiError(403, "请求来源未获允许。")
            self.limit((ip, "write"), 30, 60)
            self.limit((owner, "write"), 15, 60)
            self.limit((ip, "hour"), 120, 3600)
        if resource == 'uploads' and post_id and method == 'PUT' and not attachment:
            return self.upload(environ, recipe, post_id, owner)
        if resource == 'posts' and post_id and attachment == 'photo' and method == 'PUT':
            return self.upload(environ, recipe, post_id, owner, attach=True)
        if resource == 'uploads' and post_id and method == 'DELETE' and not attachment:
            with self.lock:
                row = self.db.execute('SELECT * FROM photos WHERE post_id=?', [post_id]).fetchone()
                if row and (row['owner'] != owner or row['recipe'] != recipe): raise ApiError(403, '图片不属于当前访客。')
                if row and not row['published']:
                    self.db.execute('BEGIN IMMEDIATE')
                    try:
                        self.db.execute('INSERT OR IGNORE INTO photo_garbage VALUES(?)', [row['file']])
                        self.db.execute('DELETE FROM photos WHERE post_id=?', [post_id])
                        self.db.execute('COMMIT')
                    except Exception: self.db.execute('ROLLBACK'); raise
                self.prune()
            return {'ok': True}
        if attachment: raise ApiError(405, '不支持的操作。')
        if method == "GET" and resource is None:
            with self.lock:
                counts = [0] * 10
                for row in self.db.execute("SELECT score,COUNT(*) AS n FROM ratings WHERE recipe=? GROUP BY score", [recipe]):
                    counts[row["score"] - 1] = row["n"]
                own = self.db.execute("SELECT score FROM ratings WHERE recipe=? AND owner=?", [recipe, owner]).fetchone()
                totals = {"comment": 0, "submission": 0}
                for row in self.db.execute("SELECT submission,COUNT(*) AS n FROM posts WHERE recipe=? GROUP BY submission", [recipe]):
                    totals["submission" if row["submission"] else "comment"] = row["n"]
                comments = self.page(recipe, False, owner)
                works = self.page(recipe, True, owner)
                return {"schema": 1, "recipeId": recipe, "ownRating": own[0] if own else None,
                        "ratingCounts": counts, "posts": works["posts"] + comments["posts"],
                        "postCounts": totals, "cursors": {"comment": comments["next"], "submission": works["next"]}}
        if method == "GET" and resource == "posts" and post_id is None:
            query = parse_qs(environ.get("QUERY_STRING", ""))
            kind = query.get("kind", [""])[0]
            if kind not in ("comment", "submission"):
                raise ApiError(400, "记录类型无效。")
            with self.lock:
                return self.page(recipe, kind == "submission", owner, query.get("cursor", [""])[0])
        if resource == "rating" and post_id is None and method in ("PUT", "DELETE"):
            score = self.body(environ, {"score"})["score"] if method == "PUT" else None
            if method == "PUT" and (type(score) is not int or not 1 <= score <= 10):
                raise ApiError(400, "评分必须为 1–10 分的整数。")
            with self.lock:
                if method == "PUT":
                    self.db.execute("INSERT INTO ratings VALUES(?,?,?) ON CONFLICT(recipe,owner) DO UPDATE SET score=excluded.score", [recipe, owner, score])
                else:
                    self.db.execute("DELETE FROM ratings WHERE recipe=? AND owner=?", [recipe, owner])
            return {"ok": True}
        if resource == "posts" and post_id is None and method == "POST":
            body = self.body(environ, {"id", "submission", "text"}, {'photo'})
            text = body["text"]
            try:
                valid = isinstance(text, str) and bool(text.strip()) and len(text.encode("utf-16-le")) // 2 <= 2000
            except UnicodeError:
                valid = False
            wants_photo = body.get('photo', False)
            if not valid or type(body["submission"]) is not bool or type(wants_photo) is not bool or (wants_photo and not body['submission']) or not isinstance(body["id"], str) or not POST_ID.fullmatch(body["id"]):
                raise ApiError(400, "内容不能为空，最多 2000 字。")
            with self.lock:
                row = self.db.execute("SELECT * FROM posts WHERE id=?", [body["id"]]).fetchone()
                photo = self.db.execute('SELECT * FROM photos WHERE post_id=?', [body['id']]).fetchone()
                if row:
                    if (row["owner"], row["recipe"], row["submission"], row["body"]) != (owner, recipe, int(body["submission"]), text.strip()):
                        raise ApiError(409, "这条记录已被使用，请重新打开编辑框。")
                    if wants_photo != bool(photo and photo['published']): raise ApiError(409, '已发布的作业附图与草稿不同。')
                else:
                    if wants_photo and (not photo or photo['owner'] != owner or photo['recipe'] != recipe or not (self.media/photo['file']).is_file()):
                        raise ApiError(409, '请先完成附图上传，草稿已保留。')
                    if photo and (photo['owner'] != owner or photo['recipe'] != recipe): raise ApiError(409, '图片标识已使用。')
                    self.db.execute('BEGIN IMMEDIATE')
                    try:
                        self.db.execute("INSERT INTO posts VALUES(?,?,?,?,?,?)", [body["id"], recipe, owner, int(body["submission"]), text.strip(), int(time.time() * 1000)])
                        if wants_photo: self.db.execute('UPDATE photos SET published=1 WHERE post_id=?', [body['id']])
                        elif photo:
                            self.db.execute('INSERT OR IGNORE INTO photo_garbage VALUES(?)', [photo['file']])
                            self.db.execute('DELETE FROM photos WHERE post_id=?', [body['id']])
                        self.db.execute('COMMIT')
                    except Exception: self.db.execute('ROLLBACK'); raise
                    self.prune()
            return {"ok": True, "id": body["id"]}
        if resource == "posts" and post_id and method == "DELETE":
            with self.lock:
                row = self.db.execute("SELECT owner FROM posts WHERE id=? AND recipe=?", [post_id, recipe]).fetchone()
                if row and row["owner"] != owner:
                    raise ApiError(403, "只能删除自己的评论或作业。")
                self.db.execute('BEGIN IMMEDIATE')
                try:
                    photo = self.db.execute('SELECT * FROM photos WHERE post_id=? AND recipe=? AND owner=?', [post_id,recipe,owner]).fetchone()
                    if photo:
                        self.db.execute('INSERT OR IGNORE INTO photo_garbage VALUES(?)', [photo['file']])
                        self.db.execute('DELETE FROM photos WHERE post_id=?', [post_id])
                    self.db.execute("DELETE FROM posts WHERE id=? AND recipe=? AND owner=?", [post_id, recipe, owner])
                    self.db.execute('COMMIT')
                except Exception: self.db.execute('ROLLBACK'); raise
                self.prune()
            return {"ok": True}
        raise ApiError(405, "不支持的操作。")

    def __call__(self, environ, start_response):
        origin = environ.get("HTTP_ORIGIN", "")
        headers = [("Content-Type", "application/json; charset=utf-8"), ("Cache-Control", "private, no-cache"),
                   ("X-Content-Type-Options", "nosniff"), ("Vary", "Origin, Authorization, Cookie, X-DeepCook-Account")]
        if environ['PATH_INFO'].startswith((PREFIX+'/auth/', PREFIX+'/account/')):
            headers = [(key, 'private, no-store' if key == 'Cache-Control' else value) for key,value in headers]
        if self.allowed_origin(origin):
            headers += [("Access-Control-Allow-Origin", origin), ("Access-Control-Allow-Credentials", "true"), ("Access-Control-Allow-Headers", "Authorization, Content-Type, X-DeepCook-Account"),
                        ("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS"), ("Access-Control-Max-Age", "600")]
        try:
            if origin and not self.allowed_origin(origin):
                raise ApiError(403, "请求来源未获允许。")
            if environ['PATH_INFO'].startswith(PREFIX+'/account/media/'):
                return self.accounts.image_response(environ, start_response, headers)
            if environ['PATH_INFO'].startswith(PREFIX+'/photos/'):
                return self.image_response(environ, start_response, headers)
            if environ["REQUEST_METHOD"] == "OPTIONS":
                status, payload = 204, b""
            else:
                result = self.dispatch(environ)
                status, payload = 200, json.dumps(result, ensure_ascii=False, separators=(",", ":")).encode()
                if environ["REQUEST_METHOD"] == "GET":
                    etag = '"' + hashlib.sha256(payload).hexdigest()[:24] + '"'
                    headers.append(("ETag", etag))
                    if environ.get("HTTP_IF_NONE_MATCH") == etag:
                        status, payload = 304, b""
        except ApiError as error:
            status, payload = error.status, json.dumps({"error": error.message}, ensure_ascii=False).encode()
        except (sqlite3.Error, OSError):
            status, payload = 503, b'{"error":"Storage temporarily unavailable"}'
        labels = {200: "OK", 204: "No Content", 304: "Not Modified", 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 405: "Method Not Allowed", 409: "Conflict", 429: "Too Many Requests", 503: "Service Unavailable", 507: 'Insufficient Storage'}
        headers += environ.get('deepcook.response_headers', [])
        if status != 304:
            headers.append(("Content-Length", str(len(payload))))
        start_response(f"{status} {labels[status]}", headers)
        return [payload]


def create_app():
    path = Path(os.environ.get("DEEPCOOK_DATABASE", "/var/lib/deepcook-community/community.sqlite3"))
    path.parent.mkdir(parents=True, exist_ok=True)
    recipes = json.loads(Path(os.environ.get("DEEPCOOK_RECIPE_IDS", str(Path(__file__).with_name("recipe-ids.json")))).read_text())
    origins = os.environ.get("DEEPCOOK_ORIGINS", "http://127.0.0.1:4173").split(",")
    return CommunityApp(path, recipes, origins, backup_token=os.environ['DEEPCOOK_BACKUP_TOKEN'])
