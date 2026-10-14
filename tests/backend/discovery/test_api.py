import http.client
import json
import threading
import unittest
from http.server import HTTPServer

from tests.backend.discovery import test_discovery
from mazi.discovery.server import handler_for


class HttpTests(unittest.TestCase):
    setUp = test_discovery.DiscoveryTests.setUp
    tearDown = test_discovery.DiscoveryTests.tearDown
    submit = test_discovery.DiscoveryTests.submit
    process = test_discovery.DiscoveryTests.process
    def test_http_auth_scope_json_and_inherited_hiding(self):
        server = HTTPServer(('127.0.0.1', 0), handler_for(self.store))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        token = self.store.login('alice@example.test', 'correct horse battery')

        def request(method, path, body=None, **headers):
            conn = http.client.HTTPConnection('127.0.0.1', server.server_port)
            data = json.dumps(body) if body is not None else None
            defaults = {'Cookie': 'mazi_session=' + token, 'Content-Type':'application/json'}
            defaults.update(headers)
            conn.request(method, path, data, defaults)
            response = conn.getresponse()
            result = (response.status, response.read(), dict(response.getheaders()))
            conn.close()
            return result
        try:
            status, data, headers = request('GET', '/api/discovery/search?group=' + self.group)
            self.assertEqual(status, 200)
            self.assertEqual(json.loads(data)['total'], 1)
            self.assertIn('no-store', headers['Cache-Control'])
            self.assertIn("default-src 'self'", headers['Content-Security-Policy'])
            self.assertEqual(request('POST', '/api/discovery/hide', {'asset':self.asset,'enabled':True}, Origin='https://bad.test')[0], 403)
            self.assertEqual(request('POST', '/api/discovery/hide', {'asset':self.asset,'enabled':True})[0], 200)
            self.assertEqual(json.loads(request('GET', '/api/archive?group=' + self.group)[1]), [])
            self.assertEqual(request('POST', '/api/discovery/person', [], **{'Content-Type':'application/json'})[0], 400)
            self.assertEqual(request('GET', '/api/discovery/search?group=' + self.group + '&limit=abc')[0], 400)
            self.assertEqual(request('POST', '/api/discovery/recognition', {'enabled':True})[0], 404)
            token = self.store.login('outsider@example.test', 'correct horse battery')
            status, data, _ = request('GET', '/api/discovery/state?group=' + self.group)
            self.assertEqual(status, 403)
            self.assertNotIn(b'Amsterdam', data)
        finally:
            server.shutdown()
            thread.join()
            server.server_close()
