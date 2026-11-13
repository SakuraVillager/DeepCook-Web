"""Public, immutable release downloads. Bounded streaming keeps account requests available."""
import hashlib
import json
import re
import threading
from email.utils import formatdate
from pathlib import Path

PREFIX = '/deepcook-api/v1/downloads/'
NAME = re.compile(r'DeepCook-[0-9]+\.[0-9]+\.[0-9]+\.apk\Z')
DIGEST = re.compile(r'[a-f0-9]{64}\Z')


class DownloadStream:
    def __init__(self, file, length, slots):
        self.file, self.remaining, self.slots, self.closed = file, length, slots, False

    def __iter__(self): return self

    def __next__(self):
        if self.closed: raise StopIteration
        try:
            data = self.file.read(min(65536, self.remaining)) if self.remaining else b''
            if not data:
                self.close()
                raise StopIteration
            self.remaining -= len(data)
            return data
        except BaseException:
            self.close()
            raise

    def close(self):
        if not self.closed:
            self.closed = True
            try: self.file.close()
            finally: self.slots.release()


class Downloads:
    def __init__(self, directory):
        self.directory = Path(directory)
        # One Gunicorn process has four threads; at most two serve APK bodies.
        self.slots = threading.BoundedSemaphore(2)

    @staticmethod
    def interval(value, size):
        match = re.fullmatch(r'bytes=(\d*)-(\d*)', value)
        if not match or not any(match.groups()): raise ValueError()
        first, last = match.groups()
        if not first:
            suffix = int(last)
            if suffix <= 0: raise ValueError()
            return max(0, size - suffix), size - 1
        start = int(first)
        end = min(size - 1, int(last)) if last else size - 1
        if not 0 <= start <= end < size: raise ValueError()
        return start, end

    def __call__(self, environ, start_response):
        method, path = environ['REQUEST_METHOD'], environ['PATH_INFO']
        headers = [('X-Content-Type-Options', 'nosniff'), ('Access-Control-Allow-Origin', '*'),
                   ('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS'),
                   ('Access-Control-Allow-Headers', 'Range, If-Range, If-None-Match'),
                   ('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Disposition, Accept-Ranges, ETag')]

        def error(status, message, extra=()):
            raw = json.dumps({'error':message},ensure_ascii=False).encode()
            labels = {404:'Not Found',405:'Method Not Allowed',416:'Range Not Satisfiable',503:'Service Unavailable'}
            start_response(f'{status} {labels[status]}', headers + [('Content-Type','application/json; charset=utf-8'),
                ('Content-Length',str(len(raw))),('Cache-Control','no-store')] + list(extra))
            return [] if method == 'HEAD' else [raw]

        if method == 'OPTIONS':
            start_response('204 No Content',headers + [('Access-Control-Max-Age','600')]); return []
        if method not in ('GET','HEAD'): return error(405,'不支持的操作。',[('Allow','GET, HEAD, OPTIONS')])
        name = path.removeprefix(PREFIX)
        checksum = name.endswith('.sha256')
        apk_name = name[:-7] if checksum else name
        if not path.startswith(PREFIX) or not NAME.fullmatch(apk_name): return error(404,'安装包不存在。')
        target = self.directory / apk_name
        metadata = self.directory / (apk_name + '.json')
        try:
            if target.is_symlink() or metadata.is_symlink() or not target.is_file() or not metadata.is_file():
                return error(404,'安装包不存在。')
            if metadata.stat().st_size > 16384: return error(503,'安装包信息暂时无法读取。')
            info = json.loads(metadata.read_text())
            stat = target.stat()
            digest, size = info['sha256'], info['sizeBytes']
            if info['fileName'] != apk_name or not isinstance(digest,str) or not DIGEST.fullmatch(digest) or type(size) is not int or size <= 0 or size != stat.st_size:
                return error(503,'安装包校验信息不一致，请稍后重试。')
        except (OSError,ValueError,KeyError,TypeError): return error(503,'安装包信息暂时无法读取。')
        if checksum:
            raw = f'{digest}  {apk_name}\n'.encode()
            etag = '"'+hashlib.sha256(raw).hexdigest()+'"'
        else:
            raw, etag = None, '"'+digest+'"'
        common = headers + [('Content-Type','text/plain; charset=utf-8' if checksum else 'application/vnd.android.package-archive'),
                            ('Content-Disposition',f'attachment; filename="{name}"'),
                            ('Cache-Control','public, max-age=86400, immutable'), ('ETag',etag),
                            ('Last-Modified',formatdate(stat.st_mtime,usegmt=True)),('Accept-Ranges','bytes')]
        if environ.get('HTTP_IF_NONE_MATCH') in (etag,'*'):
            start_response('304 Not Modified',common); return []
        length = len(raw) if checksum else size
        start, end, status = 0, length - 1, '200 OK'
        byte_range = environ.get('HTTP_RANGE')
        if byte_range and (not environ.get('HTTP_IF_RANGE') or environ['HTTP_IF_RANGE'] == etag):
            try: start, end = self.interval(byte_range,length)
            except (ValueError,OverflowError): return error(416,'下载范围无效。',[('Content-Range',f'bytes */{length}')])
            status = '206 Partial Content'
            common += [('Content-Range',f'bytes {start}-{end}/{length}')]
        remaining = end - start + 1
        common += [('Content-Length',str(remaining))]
        if method == 'HEAD':
            start_response(status,common); return []
        if checksum:
            start_response(status,common); return [raw[start:end+1]]
        if not self.slots.acquire(blocking=False): return error(503,'下载繁忙，请稍后重试。',[('Retry-After','5')])
        file = None
        try:
            file = target.open('rb'); file.seek(start)
            response = DownloadStream(file,remaining,self.slots)
            start_response(status,common)
            return response
        except OSError:
            if file: file.close()
            self.slots.release()
            return error(503,'安装包暂时无法读取，请重试。')
        except BaseException:
            if file: file.close()
            self.slots.release()
            raise
