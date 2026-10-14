import http.client
import json
import tempfile
import threading
import unittest
from http.server import HTTPServer
from pathlib import Path

from mazi.memories.memories import MemoryStore
from mazi.server import APP_PATHS, handler_for


class AppServerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.store = MemoryStore(self.root / 'data')
        self.alice = self.store.register('alice@example.test', 'correct horse battery')
        self.group = self.store.create_group(self.alice, 'Friends')
        self.token = self.store.login('alice@example.test', 'correct horse battery')
        self.dist = self.root / 'dist'
        self.dist.mkdir()
        (self.dist / 'index.html').write_text('<html>Atlas</html>')
        (self.dist / 'assets').mkdir()
        (self.dist / 'assets/app.js').write_text('export {};')
        (self.root / 'private.txt').write_text('secret')
        self.server = HTTPServer(('127.0.0.1', 0), handler_for(self.store, self.dist))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.thread.join()
        self.server.server_close()
        self.store.close()
        self.temp.cleanup()

    def request(self, path, body=None, token='', origin=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port)
        headers = {'Cookie': 'mazi_session=' + token}
        if origin:
            headers['Origin'] = origin
        if body is not None:
            headers['Content-Type'] = 'application/json'
        connection.request('GET' if body is None else 'POST', path,
                           json.dumps(body) if body is not None else None, headers)
        response = connection.getresponse()
        result = response.status, dict(response.getheaders()), response.read()
        connection.close()
        return result

    def test_all_app_routes_share_atlas_and_missing_build_is_actionable(self):
        for route in APP_PATHS:
            status, headers, body = self.request(route)
            self.assertEqual(status, 200, route)
            self.assertEqual(body, b'<html>Atlas</html>')
            self.assertEqual(headers['Cache-Control'], 'no-store')
            self.assertIn("style-src 'self' 'unsafe-inline'", headers['Content-Security-Policy'])
        (self.dist / 'index.html').unlink()
        status, _, body = self.request('/')
        self.assertEqual(status, 503)
        self.assertIn('npm run build', json.loads(body)['error'])

    def test_assets_and_traversal_never_fall_back_to_html(self):
        self.assertEqual(self.request('/assets/app.js')[0], 200)
        self.assertEqual(self.request('/land.geojson')[0], 200)
        (self.dist / 'linked.txt').symlink_to(self.root / 'private.txt')
        for path in ('/../private.txt', '/%2e%2e/private.txt', '/%00private.txt', '/linked.txt', '/missing.js', '/api/no-such-route'):
            self.assertIn(self.request(path)[0], (403, 404), path)
        self.assertEqual(self.request('/api/no-such-route', token=self.token)[0], 404)

    def test_api_authentication_origin_and_reopened_identity(self):
        self.assertEqual(self.request('/api/groups')[0], 403)
        self.assertEqual(self.request('/api/groups', token=self.token)[0], 200)
        self.assertEqual(self.request('/api/group', {'name': 'Other'}, self.token, 'https://other.test')[0], 403)
        reopened = MemoryStore(self.root / 'data')
        try:
            self.assertEqual(reopened.user_for_token(self.token), self.alice)
            self.assertEqual(reopened.groups_for(self.alice)[0]['id'], self.group)
        finally:
            reopened.close()
