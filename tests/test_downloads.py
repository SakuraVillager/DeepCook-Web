import hashlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / 'server'))
from community import CommunityApp
from downloads import Downloads, PREFIX


class DownloadTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.directory = Path(self.temp.name) / 'releases'
        self.directory.mkdir()
        self.name = 'DeepCook-0.6.1.apk'
        self.raw = bytes(range(256)) * 1024
        self.target = self.directory / self.name
        self.target.write_bytes(self.raw)
        self.info = {'fileName': self.name, 'sizeBytes': len(self.raw),
                     'sha256': hashlib.sha256(self.raw).hexdigest()}
        self.metadata = self.directory / (self.name + '.json')
        self.metadata.write_text(json.dumps(self.info))
        self.app = Downloads(self.directory)

    def tearDown(self):
        self.temp.cleanup()

    def request(self, suffix='', method='GET', extra=None, consume=True, app=None, path=None):
        env = {'PATH_INFO': path or PREFIX + self.name + suffix, 'REQUEST_METHOD': method,
               'HTTP_ORIGIN': 'https://unrelated.example', 'QUERY_STRING': '',
               'wsgi.input': io.BytesIO(), 'REMOTE_ADDR': '127.0.0.1'}
        env.update(extra or {})
        result = {}
        def start(status, headers):
            result.update(status=int(status.split()[0]), headers=dict(headers))
        response = (app or self.app)(env, start)
        if consume:
            try:
                result['chunks'] = list(response)
                result['body'] = b''.join(result['chunks'])
            finally:
                if hasattr(response, 'close'): response.close()
        else:
            result['stream'] = response
        return result

    def test_public_download_stream_head_and_revalidation(self):
        result = self.request()
        self.assertEqual(result['status'], 200)
        self.assertEqual(result['body'], self.raw)
        self.assertLessEqual(max(map(len, result['chunks'])), 65536)
        headers = result['headers']
        self.assertEqual(headers['Content-Length'], str(len(self.raw)))
        self.assertEqual(headers['Content-Type'], 'application/vnd.android.package-archive')
        self.assertEqual(headers['Access-Control-Allow-Origin'], '*')
        self.assertNotIn('Access-Control-Allow-Credentials', headers)
        self.assertIn(self.name, headers['Content-Disposition'])
        head = self.request(method='HEAD')
        self.assertEqual(head['body'], b'')
        self.assertEqual(head['headers']['Content-Length'], str(len(self.raw)))
        cached = self.request(extra={'HTTP_IF_NONE_MATCH': headers['ETag']})
        self.assertEqual((cached['status'], cached['body']), (304, b''))

    def test_ranges_allow_resuming_and_reject_invalid_requests(self):
        for value, start, end in [('bytes=123-456', 123, 456), ('bytes=200000-', 200000, len(self.raw)-1),
                                  ('bytes=-100', len(self.raw)-100, len(self.raw)-1),
                                  ('bytes=0-999999', 0, len(self.raw)-1)]:
            with self.subTest(value=value):
                result = self.request(extra={'HTTP_RANGE': value})
                self.assertEqual(result['status'], 206)
                self.assertEqual(result['body'], self.raw[start:end+1])
                self.assertEqual(result['headers']['Content-Range'], f'bytes {start}-{end}/{len(self.raw)}')
        for value in ['bytes=999999-', 'bytes=4-2', 'bytes=-0', 'bytes=0-1,4-6', 'bytes=-', 'invalid']:
            result = self.request(extra={'HTTP_RANGE': value})
            self.assertEqual(result['status'], 416, value)
            self.assertEqual(result['headers']['Content-Range'], f'bytes */{len(self.raw)}')
        result = self.request(extra={'HTTP_RANGE': 'bytes=10-20', 'HTTP_IF_RANGE': '"old-release"'})
        self.assertEqual((result['status'], result['body']), (200, self.raw))

    def test_bounded_streams_release_slots_on_disconnect_and_completion(self):
        first = self.request(consume=False)['stream']
        second = self.request(consume=False)['stream']
        try:
            busy = self.request()
            self.assertEqual(busy['status'], 503)
            self.assertEqual(busy['headers']['Retry-After'], '5')
            self.assertEqual(self.request(method='HEAD')['status'], 200)
            self.assertEqual(self.request(suffix='.sha256')['status'], 200)
            first.close()
            first.close()  # Disconnect cleanup may be called again by the WSGI server.
            for _ in range(3): self.assertEqual(self.request()['status'], 200)
        finally:
            first.close()
            second.close()

    def test_checksum_and_methods(self):
        result = self.request(suffix='.sha256')
        self.assertEqual(result['body'], f"{self.info['sha256']}  {self.name}\n".encode())
        self.assertEqual(self.request(method='POST')['status'], 405)
        self.assertEqual(self.request(method='OPTIONS')['status'], 204)

    def test_only_published_regular_files_with_valid_metadata_are_served(self):
        for path in [PREFIX+'../community.sqlite3', PREFIX+'DeepCook-0.6.1.apk.json',
                     PREFIX+'DeepCook-0.6.1.apk/secret', '/unrelated/'+self.name]:
            self.assertEqual(self.request(path=path)['status'], 404)
        for field, value in [('sha256', 'broken'), ('sizeBytes', 1), ('fileName', 'other.apk')]:
            self.metadata.write_text(json.dumps({**self.info, field: value}))
            self.assertEqual(self.request()['status'], 503)
        self.metadata.unlink()
        self.assertEqual(self.request()['status'], 404)
        self.metadata.write_text(json.dumps(self.info))
        original = self.directory / 'private-file'
        self.target.rename(original)
        self.target.symlink_to(original)
        self.assertEqual(self.request()['status'], 404)

    def test_public_download_route_preserves_private_api_origin_restrictions(self):
        app = CommunityApp(Path(self.temp.name) / 'test.sqlite3', ['r'],
                           ['https://cook.example.com'], rate_limits=False, reserve_bytes=0)
        try:
            self.assertEqual(self.request(app=app)['body'], self.raw)
            private = self.request(app=app, path='/deepcook-api/v1/account/data')
            self.assertEqual(private['status'], 403)
            self.assertNotIn('Access-Control-Allow-Origin', private['headers'])
        finally:
            app.db.close()


if __name__ == '__main__':
    unittest.main()
