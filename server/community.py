"""DeepCook text-only community API. Run with one Gunicorn worker and four threads."""
import hashlib
import json
import os
import re
import sqlite3
import threading
import time
from collections import OrderedDict
from pathlib import Path
from urllib.parse import parse_qs

PREFIX = "/deepcook-api/v1"
POST_ID = re.compile(r"post-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\Z")
TOKEN = re.compile(r"Bearer ([a-f0-9]{64})\Z")


class ApiError(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message


class CommunityApp:
    def __init__(self, database, recipe_ids, origins, rate_limits=True):
        self.recipes = frozenset(recipe_ids)
        self.origins = frozenset(origins)
        self.rate_limits = rate_limits
        self.lock = threading.RLock()
        self.buckets = OrderedDict()
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
        """)

    def allowed_origin(self, origin):
        # Public anonymous community, not a credentialed-cookie API. Other sites
        # cannot read this site's local visitor token; ownership never uses Origin.
        return origin in self.origins or ('*' in self.origins and bool(re.fullmatch(r'https?://[^/\s]+', origin)))

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
        header = environ.get("HTTP_AUTHORIZATION", "")
        match = TOKEN.fullmatch(header)
        if match:
            return hashlib.sha256(match[1].encode("ascii")).hexdigest()
        if required or header:
            raise ApiError(401, "浏览器身份无效，请刷新页面后重试。")
        return ""

    def body(self, environ, fields):
        try:
            length = int(environ.get("CONTENT_LENGTH", "0"))
            if length <= 0 or length > 12288:
                raise ValueError()
            if environ.get("CONTENT_TYPE", "").split(";")[0] != "application/json":
                raise ValueError()
            body = json.loads(environ["wsgi.input"].read(length))
            if not isinstance(body, dict) or set(body) != fields:
                raise ValueError()
            return body
        except (ValueError, UnicodeError):
            raise ApiError(400, "请求格式不正确，仅支持评分和文字记录。") from None

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
            clause = " AND (created_at, id) < (?, ?)"
            params.extend([timestamp, post_id])
        rows = self.db.execute(
            "SELECT * FROM posts WHERE recipe=? AND submission=?" + clause +
            " ORDER BY created_at DESC,id DESC LIMIT 6", params,
        ).fetchall()
        posts = [{
            "id": row["id"], "recipeId": recipe,
            "submission": bool(row["submission"]), "text": row["body"],
            "photo": None, "sample": False, "cloud": True,
            "mine": row["owner"] == owner,
            "author": "我" if row["owner"] == owner else "访客 " + row["owner"][:6],
            "createdAt": row["created_at"],
        } for row in rows[:5]]
        last = rows[4] if len(rows) > 5 else None
        return {"posts": posts, "next": f'{last["created_at"]}:{last["id"]}' if last else None}

    def dispatch(self, environ):
        method, path = environ["REQUEST_METHOD"], environ["PATH_INFO"]
        if method == "GET" and path == PREFIX + "/health":
            return {"ok": True, "storage": "sqlite", "uploads": False}
        match = re.fullmatch(re.escape(PREFIX) + r"/recipes/([a-z0-9-]{1,128})(?:/(rating|posts)(?:/(post-[a-f0-9-]+))?)?", path)
        if not match:
            raise ApiError(404, "接口不存在。")
        recipe, resource, post_id = match.groups()
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
            body = self.body(environ, {"id", "submission", "text"})
            text = body["text"]
            try:
                valid = isinstance(text, str) and bool(text.strip()) and len(text.encode("utf-16-le")) // 2 <= 2000
            except UnicodeError:
                valid = False
            if not valid or type(body["submission"]) is not bool or not isinstance(body["id"], str) or not POST_ID.fullmatch(body["id"]):
                raise ApiError(400, "内容不能为空，最多 2000 字。")
            with self.lock:
                row = self.db.execute("SELECT * FROM posts WHERE id=?", [body["id"]]).fetchone()
                if row:
                    if (row["owner"], row["recipe"], row["submission"], row["body"]) != (owner, recipe, int(body["submission"]), text.strip()):
                        raise ApiError(409, "这条记录已被使用，请重新打开编辑框。")
                else:
                    self.db.execute("INSERT INTO posts VALUES(?,?,?,?,?,?)", [body["id"], recipe, owner, int(body["submission"]), text.strip(), int(time.time() * 1000)])
            return {"ok": True, "id": body["id"]}
        if resource == "posts" and post_id and method == "DELETE":
            with self.lock:
                row = self.db.execute("SELECT owner FROM posts WHERE id=? AND recipe=?", [post_id, recipe]).fetchone()
                if row and row["owner"] != owner:
                    raise ApiError(403, "只能删除自己的评论或作业。")
                self.db.execute("DELETE FROM posts WHERE id=? AND recipe=? AND owner=?", [post_id, recipe, owner])
            return {"ok": True}
        raise ApiError(405, "不支持的操作。")

    def __call__(self, environ, start_response):
        origin = environ.get("HTTP_ORIGIN", "")
        headers = [("Content-Type", "application/json; charset=utf-8"), ("Cache-Control", "private, no-cache"),
                   ("X-Content-Type-Options", "nosniff"), ("Vary", "Origin, Authorization")]
        if self.allowed_origin(origin):
            headers += [("Access-Control-Allow-Origin", '*' if '*' in self.origins else origin), ("Access-Control-Allow-Headers", "Authorization, Content-Type"),
                        ("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS"), ("Access-Control-Max-Age", "600")]
        try:
            if origin and not self.allowed_origin(origin):
                raise ApiError(403, "请求来源未获允许。")
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
        except sqlite3.Error:
            status, payload = 503, b'{"error":"Storage temporarily unavailable"}'
        labels = {200: "OK", 204: "No Content", 304: "Not Modified", 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 405: "Method Not Allowed", 409: "Conflict", 429: "Too Many Requests", 503: "Service Unavailable"}
        if status != 304:
            headers.append(("Content-Length", str(len(payload))))
        start_response(f"{status} {labels[status]}", headers)
        return [payload]


def create_app():
    path = Path(os.environ.get("DEEPCOOK_DATABASE", "/var/lib/deepcook-community/community.sqlite3"))
    path.parent.mkdir(parents=True, exist_ok=True)
    recipes = json.loads(Path(os.environ.get("DEEPCOOK_RECIPE_IDS", str(Path(__file__).with_name("recipe-ids.json")))).read_text())
    origins = os.environ.get("DEEPCOOK_ORIGINS", "http://127.0.0.1:4173").split(",")
    return CommunityApp(path, recipes, origins)
