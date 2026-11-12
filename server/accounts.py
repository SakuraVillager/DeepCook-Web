"""Small account service: salted password hashes, revocable cookies and private data."""
import hashlib
import hmac
import io
import json
import os
import re
import secrets
import shutil
import sqlite3
import tempfile
import threading
import time
import uuid
from http.cookies import SimpleCookie, CookieError
from PIL import Image, UnidentifiedImageError
from errors import ApiError
from account_data import empty_data, validate_data, PRIVATE_PHOTO

PREFIX = '/deepcook-api/v1'
LIFETIME = 7 * 86400
ITERATIONS = 600000
DATA_LIMIT = 900 * 1024
PHOTO_LIMIT = 1024**2


class Accounts:
    def __init__(self, app, secure_cookies=True):
        self.app, self.db, self.lock = app, app.db, app.lock
        self.secure_cookies = secure_cookies
        self.cookie_name = '__Host-deepcook_session' if secure_cookies else 'deepcook_session'
        self.password_lock = threading.Lock()
        self.media = app.media.parent / 'account-media'
        self.media.mkdir(mode=0o700, exist_ok=True)
        self.db.executescript('''
            CREATE TABLE IF NOT EXISTS accounts (
                id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE,
                owner TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL,
                created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
            CREATE INDEX IF NOT EXISTS sessions_account ON sessions(account_id);
            CREATE TABLE IF NOT EXISTS account_data (
                account_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, data TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS account_media (
                owner TEXT NOT NULL, file TEXT NOT NULL, size INTEGER NOT NULL,
                created_at INTEGER NOT NULL, linked INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY(owner,file)
            );
            CREATE TABLE IF NOT EXISTS account_mutations (
                account_id TEXT NOT NULL, id TEXT NOT NULL, created_at INTEGER NOT NULL,
                PRIMARY KEY(account_id,id)
            );
        ''')

    def cookie_token(self, environ):
        cookie = SimpleCookie()
        try: cookie.load(environ.get('HTTP_COOKIE', ''))
        except CookieError: return ''
        token = cookie[self.cookie_name].value if self.cookie_name in cookie else ''
        return token if re.fullmatch(r'[a-f0-9]{64}', token) else ''

    def current(self, environ, required=False):
        token = self.cookie_token(environ)
        with self.lock:
            row = self.db.execute('SELECT accounts.*,profiles.display_name FROM sessions JOIN accounts ON sessions.account_id=accounts.id LEFT JOIN profiles ON accounts.owner=profiles.owner WHERE sessions.token_hash=? AND sessions.expires_at>?',
                                  [hashlib.sha256(token.encode()).hexdigest(), int(time.time())]).fetchone() if token else None
        if not row and required: raise ApiError(401, '登录已过期，请重新登录。')
        expected = environ.get('HTTP_X_DEEPCOOK_ACCOUNT')
        if expected and (not row or row['id'] != expected): raise ApiError(401, '登录身份已变化，请重新登录后重试。')
        return row

    @staticmethod
    def public(account):
        return {'id': account['id'], 'username': account['username'], 'name': account['display_name'] or account['username']} if account else None

    def password(self, value, stored=None):
        if not self.password_lock.acquire(blocking=False): raise ApiError(429, '登录服务正忙，请稍后重试。')
        try:
            salt = bytes.fromhex(stored.split('$')[2]) if stored else secrets.token_bytes(16)
            digest = hashlib.pbkdf2_hmac('sha256', value.encode('utf-8'), salt, ITERATIONS).hex()
            encoded = f'pbkdf2_sha256${ITERATIONS}${salt.hex()}${digest}'
            return hmac.compare_digest(encoded, stored) if stored else encoded
        finally: self.password_lock.release()

    def set_cookie(self, environ, token=''):
        environ['deepcook.response_headers'] = [('Set-Cookie', f'{self.cookie_name}={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={LIFETIME if token else 0}' + ('; Secure' if self.secure_cookies else ''))]

    def claim(self, owner, guest):
        if not guest or owner == guest: return
        self.db.execute('INSERT INTO ratings SELECT recipe,?,score FROM ratings WHERE owner=? ON CONFLICT(recipe,owner) DO NOTHING', [owner,guest])
        self.db.execute('DELETE FROM ratings WHERE owner=?', [guest])
        self.db.execute('UPDATE posts SET owner=? WHERE owner=?', [owner,guest])
        self.db.execute('UPDATE photos SET owner=? WHERE owner=?', [owner,guest])

    def dispatch(self, environ):
        path, method = environ['PATH_INFO'].removeprefix(PREFIX), environ['REQUEST_METHOD']
        if path == '/auth/session' and method == 'GET':
            return {'account': self.public(self.current(environ)), 'emailVerification': False}
        if method != 'GET' and not self.app.allowed_origin(environ.get('HTTP_ORIGIN', '')):
            raise ApiError(403, '请求来源未获允许。')
        ip = environ.get('HTTP_X_REAL_IP', environ.get('REMOTE_ADDR', 'local'))
        if path in ['/auth/register','/auth/login'] and method == 'POST':
            self.app.limit((ip,'auth'), 20, 600)
            body = self.app.body(environ, {'username','password','claimGuest'}, {'name'})
            username, password = body['username'], body['password']
            if not isinstance(username, str) or not re.fullmatch(r'[a-zA-Z0-9_]{3,24}', username): raise ApiError(400, '用户名需为 3–24 位字母、数字或下划线。')
            username = username.lower()
            if not isinstance(password, str) or not 6 <= len(password) <= 128: raise ApiError(400, '密码需为 6–128 个字符。')
            try: password.encode('utf-8')
            except UnicodeError: raise ApiError(400, '密码包含无法处理的字符。') from None
            if type(body['claimGuest']) is not bool: raise ApiError(400, '请选择是否合并访客互动。')
            self.app.limit((username,'auth'), 12, 600)
            name = body.get('name', '').strip() if isinstance(body.get('name',''), str) else None
            if name is None or len(name) > 12: raise ApiError(400, '昵称最多 12 个字。')
            try: name.encode('utf-8')
            except UnicodeError: raise ApiError(400, '昵称包含无法处理的字符。') from None
            guest = self.app.guest_identity(environ, required=body['claimGuest'])
            with self.lock: existing = self.db.execute('SELECT * FROM accounts WHERE username=?', [username]).fetchone()
            if path == '/auth/register':
                self.app.limit((ip,'register'), 5, 3600)
                if existing: raise ApiError(409, '这个用户名已被使用，请换一个。')
                encoded = self.password(password)
            else:
                dummy = f'pbkdf2_sha256${ITERATIONS}$' + '00'*16 + '$' + '00'*32
                valid = self.password(password, existing['password_hash'] if existing else dummy)
                if not existing or not valid: raise ApiError(401, '用户名或密码不正确。')
            token = secrets.token_hex(32)
            with self.lock:
                self.db.execute('BEGIN IMMEDIATE')
                try:
                    if path == '/auth/register':
                        account_id, owner = str(uuid.uuid4()), secrets.token_hex(32)
                        self.db.execute('INSERT INTO accounts VALUES(?,?,?,?,?)', [account_id,username,owner,encoded,int(time.time())])
                        self.db.execute('INSERT INTO profiles(owner,display_name) VALUES(?,?)', [owner,name or username[:12]])
                        self.db.execute('INSERT INTO account_data VALUES(?,0,?)', [account_id,json.dumps(empty_data(name or username[:12]),ensure_ascii=False)])
                    else: account_id, owner = existing['id'], existing['owner']
                    if body['claimGuest']: self.claim(owner, guest)
                    old_token = self.cookie_token(environ)
                    if old_token: self.db.execute('DELETE FROM sessions WHERE token_hash=?', [hashlib.sha256(old_token.encode()).hexdigest()])
                    self.db.execute('DELETE FROM sessions WHERE expires_at<=?', [int(time.time())])
                    self.db.execute('INSERT INTO sessions VALUES(?,?,?,?)', [hashlib.sha256(token.encode()).hexdigest(),account_id,int(time.time()),int(time.time())+LIFETIME])
                    self.db.execute('DELETE FROM sessions WHERE account_id=? AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE account_id=? ORDER BY created_at DESC,rowid DESC LIMIT 10)', [account_id,account_id])
                    self.db.execute('COMMIT')
                except sqlite3.IntegrityError:
                    self.db.execute('ROLLBACK'); raise ApiError(409, '这个用户名已被使用，请换一个。') from None
                except Exception: self.db.execute('ROLLBACK'); raise
            self.set_cookie(environ, token)
            return {'account': self.public(self.current({**environ,'HTTP_COOKIE': f'{self.cookie_name}={token}', 'HTTP_X_DEEPCOOK_ACCOUNT': ''})), 'emailVerification': False}
        if path == '/auth/logout' and method == 'POST':
            token = self.cookie_token(environ)
            with self.lock: self.db.execute('DELETE FROM sessions WHERE token_hash=?', [hashlib.sha256(token.encode()).hexdigest()])
            self.set_cookie(environ)
            return {'ok': True}
        account = self.current(environ, required=True)
        self.app.limit((ip,'account-read'), 600, 60)
        if method != 'GET': self.app.limit((account['id'],'account-write'), 120, 60)
        if path == '/account/data' and method == 'GET':
            with self.lock:
                row = self.db.execute('SELECT * FROM account_data WHERE account_id=?', [account['id']]).fetchone()
                return {'revision': row['revision'], 'data': json.loads(row['data']), 'account': self.public(account)}
        if path == '/account/data' and method == 'PUT':
            body = self.app.body(environ, {'revision','data','mutationId'}, maximum=DATA_LIMIT)
            if type(body['revision']) is not int or body['revision'] < 0: raise ApiError(400, '同步版本无效。')
            if not isinstance(body['mutationId'], str) or not re.fullmatch(r'[a-f0-9-]{36}',body['mutationId']): raise ApiError(400, '保存标识无效。')
            with self.lock:
                if self.db.execute('SELECT 1 FROM account_mutations WHERE account_id=? AND id=?',[account['id'],body['mutationId']]).fetchone():
                    row=self.db.execute('SELECT * FROM account_data WHERE account_id=?',[account['id']]).fetchone()
                    return {'revision':row['revision'],'data':json.loads(row['data']),'account':self.public(account)}
            files = validate_data(body['data'])
            raw = json.dumps(body['data'],ensure_ascii=False,separators=(',',':'))
            if len(raw.encode()) > DATA_LIMIT: raise ApiError(400, '厨房资料过多，请减少单次上传内容。')
            with self.lock:
                self.db.execute('BEGIN IMMEDIATE')
                try:
                    for name in files:
                        if not self.db.execute('SELECT 1 FROM account_media WHERE owner=? AND file=?', [account['owner'],name]).fetchone() or not (self.media/name).is_file():
                            raise ApiError(400, '图片尚未上传或不属于当前账号，请重试。')
                    cursor = self.db.execute('UPDATE account_data SET data=?,revision=revision+1 WHERE account_id=? AND revision=?', [raw,account['id'],body['revision']])
                    if cursor.rowcount != 1: raise ApiError(409, '另一台设备已更新，正在重新同步。')
                    self.db.execute('UPDATE profiles SET display_name=? WHERE owner=?', [body['data']['profile']['name'].strip() or account['username'],account['owner']])
                    previously = self.db.execute('SELECT file FROM account_media WHERE owner=? AND linked=1', [account['owner']]).fetchall()
                    self.db.executemany('DELETE FROM account_media WHERE owner=? AND file=?', [(account['owner'],r['file']) for r in previously if r['file'] not in files])
                    self.db.executemany('UPDATE account_media SET linked=1 WHERE owner=? AND file=?', [(account['owner'],name) for name in files])
                    self.db.execute('INSERT INTO account_mutations VALUES(?,?,?)',[account['id'],body['mutationId'],int(time.time())])
                    self.db.execute('DELETE FROM account_mutations WHERE account_id=? AND id NOT IN (SELECT id FROM account_mutations WHERE account_id=? ORDER BY rowid DESC LIMIT 128)',[account['id'],account['id']])
                    self.db.execute('COMMIT')
                except Exception: self.db.execute('ROLLBACK'); raise
                self.prune()
            return {'revision':body['revision']+1,'data':body['data'],'account':self.public(self.current(environ,required=True))}
        if path == '/account/media' and method == 'PUT': return self.upload(environ, account)
        raise ApiError(404, '账号接口不存在。')

    def upload(self, environ, account):
        try:
            length = int(environ.get('CONTENT_LENGTH','0'))
            if not 0 < length <= PHOTO_LIMIT or environ.get('CONTENT_TYPE','').split(';')[0] != 'image/jpeg': raise ValueError()
            raw = environ['wsgi.input'].read(length)
            if len(raw) != length: raise ValueError()
            with Image.open(io.BytesIO(raw),formats=['JPEG']) as photo:
                if not 1 <= photo.width <= 1200 or not 1 <= photo.height <= 1200: raise ValueError()
                photo.load(); photo = photo.convert('RGB')
                for quality in [82,65,50]:
                    output = io.BytesIO(); photo.save(output,'JPEG',quality=quality); normalized = output.getvalue()
                    if len(normalized) <= PHOTO_LIMIT: break
                else: raise ValueError()
        except (ValueError,OSError,UnidentifiedImageError,Image.DecompressionBombError): raise ApiError(400, '请选择 1 MB 以内、最长边不超过 1200 的 JPEG 图片。') from None
        name = hashlib.sha256(normalized).hexdigest()+'.jpg'
        with self.lock:
            self.prune()
            existing = self.db.execute('SELECT 1 FROM account_media WHERE owner=? AND file=?', [account['owner'],name]).fetchone()
            used,count = self.db.execute('SELECT COALESCE(SUM(size),0),COUNT(*) FROM account_media WHERE owner=?',[account['owner']]).fetchone()
            global_used = self.db.execute('SELECT COALESCE(SUM(size),0) FROM (SELECT MAX(size) AS size FROM account_media GROUP BY file)').fetchone()[0]
            if not existing and (count >= 2000 or used+len(normalized)>200*1024**2): raise ApiError(507, '账号图片空间不足，请先清理不用的图片。')
            target = self.media/name
            if not target.exists():
                if global_used+len(normalized)>self.app.media_limit or shutil.disk_usage(self.media).free<self.app.reserve_bytes+len(normalized): raise ApiError(507, '服务器图片空间暂时不足，请稍后重试。')
                with tempfile.NamedTemporaryFile(dir=self.media,prefix='.upload-',delete=False) as temporary:
                    temp = type(self.media)(temporary.name)
                    try:
                        temporary.write(normalized); temporary.flush(); os.fsync(temporary.fileno()); os.replace(temp,target)
                        descriptor = os.open(self.media,os.O_RDONLY)
                        try: os.fsync(descriptor)
                        finally: os.close(descriptor)
                    finally: temp.unlink(missing_ok=True)
            self.db.execute('INSERT INTO account_media VALUES(?,?,?,?,0) ON CONFLICT(owner,file) DO UPDATE SET created_at=excluded.created_at', [account['owner'],name,len(normalized),int(time.time())])
        return {'photoUrl': PREFIX+'/account/media/'+name}

    def image_response(self, environ, start_response, headers):
        account = self.current(environ,required=True)
        match = PRIVATE_PHOTO.fullmatch(environ['PATH_INFO'])
        if not match or environ['REQUEST_METHOD'] not in ['GET','HEAD']: raise ApiError(404, '图片不存在。')
        name = match[1]
        with self.lock:
            if not self.db.execute('SELECT 1 FROM account_media WHERE owner=? AND file=?', [account['owner'],name]).fetchone(): raise ApiError(404, '图片不存在。')
            try: photo = (self.media/name).open('rb')
            except FileNotFoundError: raise ApiError(404, '图片不存在。') from None
        headers = [(k,v) for k,v in headers if k not in ['Content-Type','Cache-Control']]
        headers += [('Content-Type','image/jpeg'),('Cache-Control','private, no-store'),('Content-Length',str(os.fstat(photo.fileno()).st_size))]
        start_response('200 OK',headers)
        if environ['REQUEST_METHOD']=='HEAD': photo.close(); return []
        if 'wsgi.file_wrapper' in environ: return environ['wsgi.file_wrapper'](photo,65536)
        def chunks():
            try:
                while data := photo.read(65536): yield data
            finally: photo.close()
        return chunks()

    def prune(self, orphan_scan=False):
        self.db.execute('DELETE FROM account_media WHERE linked=0 AND created_at<?', [int(time.time())-86400])
        self.db.execute('DELETE FROM sessions WHERE expires_at<=?', [int(time.time())])
        # Images are immutable. Backup hard links keep older snapshots independent.
        referenced = {r[0] for r in self.db.execute('SELECT DISTINCT file FROM account_media')}
        for path in self.media.iterdir():
            if path.name not in referenced and (re.fullmatch(r'[a-f0-9]{64}\.jpg',path.name) or (orphan_scan and path.name.startswith('.upload-'))):
                try: path.unlink(missing_ok=True)
                except OSError: pass
