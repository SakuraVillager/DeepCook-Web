import importlib.util
import io
import json
import tempfile
import unittest
import uuid
from pathlib import Path

spec = importlib.util.spec_from_file_location('community_server', Path(__file__).parents[1] / 'server/community.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
ORIGIN = 'https://cook.example.com'

class CommunityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'data.sqlite3'
        self.app = module.CommunityApp(self.path, ['r', 'other'], [ORIGIN], rate_limits=False)

    def tearDown(self):
        self.app.db.close()
        self.temp.cleanup()

    def request(self, path='/recipes/r', method='GET', data=None, token='a' * 64, origin=ORIGIN, extra=None):
        raw = json.dumps(data, ensure_ascii=False).encode() if data is not None else b''
        path, _, query = path.partition('?')
        env = {'PATH_INFO': module.PREFIX + path, 'QUERY_STRING': query, 'REQUEST_METHOD': method,
               'CONTENT_TYPE': 'application/json', 'CONTENT_LENGTH': str(len(raw)), 'wsgi.input': io.BytesIO(raw),
               'HTTP_ORIGIN': origin, 'HTTP_AUTHORIZATION': 'Bearer ' + token if token else '', 'REMOTE_ADDR': '127.0.0.1'}
        env.update(extra or {})
        result = {}
        def start(status, headers):
            result['status'] = int(status.split()[0])
            result['headers'] = dict(headers)
        body = b''.join(self.app(env, start))
        result['body'] = json.loads(body) if body else None
        return result

    def post(self, text='记录一下。', submission=False, token='a' * 64, post_id=None):
        post_id = post_id or 'post-' + str(uuid.uuid4())
        return self.request('/recipes/r/posts', 'POST', {'id': post_id, 'submission': submission, 'text': text}, token), post_id

    def test_rating_replacement_identity_and_recipe_isolation(self):
        self.assertEqual(self.request('/recipes/r/rating', 'PUT', {'score': 9}, token='')['status'], 401)
        for score in [8, 10]:
            self.assertEqual(self.request('/recipes/r/rating', 'PUT', {'score': score})['status'], 200)
        self.request('/recipes/r/rating', 'PUT', {'score': 6}, token='b' * 64)
        value = self.request()['body']
        self.assertEqual(sum(value['ratingCounts']), 2)
        self.assertEqual(value['ownRating'], 10)
        self.assertEqual(sum(self.request('/recipes/other')['body']['ratingCounts']), 0)
        self.request('/recipes/r/rating', 'DELETE')
        self.assertEqual(sum(self.request()['body']['ratingCounts']), 1)

    def test_public_posts_only_allow_their_owner_to_delete(self):
        result, post_id = self.post()
        self.assertEqual(result['status'], 200)
        self.assertTrue(self.request()['body']['posts'][0]['mine'])
        other = self.request(token='b' * 64)['body']['posts'][0]
        self.assertFalse(other['mine'])
        self.assertTrue(other['author'].startswith('访客 '))
        self.assertEqual(self.request(f'/recipes/r/posts/{post_id}', 'DELETE', token='b' * 64)['status'], 403)
        for _ in range(2):
            self.assertEqual(self.request(f'/recipes/r/posts/{post_id}', 'DELETE')['status'], 200)
        self.assertEqual(self.request()['body']['posts'], [])

    def test_idempotent_retry_cannot_overwrite_changed_or_foreign_posts(self):
        _, post_id = self.post('重试测试')
        self.assertEqual(self.post('重试测试', post_id=post_id)[0]['status'], 200)
        self.assertEqual(self.post('改过的正文', post_id=post_id)[0]['status'], 409)
        self.assertEqual(self.post('重试测试', token='b' * 64, post_id=post_id)[0]['status'], 409)
        self.assertEqual(self.request()['body']['postCounts']['comment'], 1)

    def test_cursor_pages_separate_comments_and_submissions(self):
        ids = {self.post(str(n))[1] for n in range(13)}
        for n in range(4): self.post(f'作业 {n}', submission=True)
        data = self.request()['body']
        self.assertEqual(data['postCounts'], {'comment': 13, 'submission': 4})
        seen = {p['id'] for p in data['posts'] if not p['submission']}
        cursor = data['cursors']['comment']
        while cursor:
            page = self.request('/recipes/r/posts?kind=comment&cursor=' + cursor)['body']
            self.assertLessEqual(len(page['posts']), 5)
            self.assertTrue(all(not p['submission'] for p in page['posts']))
            seen.update(p['id'] for p in page['posts'])
            cursor = page['next']
        self.assertEqual(seen, ids)

    def test_validation_rejects_images_forged_authors_and_invalid_content(self):
        for text in ['  ', '字' * 2001, '😀' * 1001]: self.assertEqual(self.post(text)[0]['status'], 400)
        self.assertEqual(self.post('😀' * 1000)[0]['status'], 200)
        for score in [0, 11, True, 8.5, '8']:
            self.assertEqual(self.request('/recipes/r/rating', 'PUT', {'score': score})['status'], 400)
        for field in ['photo', 'author', 'owner']:
            body = {'id': 'post-' + str(uuid.uuid4()), 'submission': True, 'text': 'test', field: 'data'}
            self.assertEqual(self.request('/recipes/r/posts', 'POST', body)['status'], 400)
        self.assertEqual(self.request('/recipes/user-private')['status'], 404)
        self.assertEqual(self.request('/uploads', 'POST', {'photo': 'x'})['status'], 404)

    def test_etag_origin_and_index_usage(self):
        cursor = '9' * 100 + ':post-' + str(uuid.uuid4())
        self.assertEqual(self.request('/recipes/r/posts?kind=comment&cursor=' + cursor)['status'], 400)
        data = self.request()
        self.assertEqual(data['headers']['Access-Control-Allow-Origin'], ORIGIN)
        self.assertIn('Authorization', data['headers']['Vary'])
        self.assertEqual(self.request(extra={'HTTP_IF_NONE_MATCH': data['headers']['ETag']})['status'], 304)
        self.request('/recipes/r/rating', 'PUT', {'score': 8})
        self.assertEqual(self.request(extra={'HTTP_IF_NONE_MATCH': data['headers']['ETag']})['status'], 200)
        for method in ['GET', 'PUT', 'OPTIONS']:
            self.assertEqual(self.request(method=method, origin='https://evil.example')['status'], 403)
        plan = self.app.db.execute('EXPLAIN QUERY PLAN SELECT * FROM posts WHERE recipe=? AND submission=? ORDER BY created_at DESC,id DESC LIMIT 6', ['r', 0]).fetchall()
        self.assertIn('posts_page', str([tuple(row) for row in plan]))

    def test_persistence_and_rate_limit(self):
        self.post('持久化')
        self.app.db.close()
        self.app = module.CommunityApp(self.path, ['r', 'other'], [ORIGIN], rate_limits=True)
        self.assertEqual(self.request()['body']['postCounts']['comment'], 1)
        statuses = [self.request('/recipes/r/rating', 'PUT', {'score': 8})['status'] for _ in range(20)]
        self.assertIn(429, statuses)

if __name__ == '__main__': unittest.main()
