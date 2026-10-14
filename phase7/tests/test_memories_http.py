import http.client
import json
import threading
import unittest
from http.server import HTTPServer
import test_memories
from phase7.server import handler_for


class ApiTests(unittest.TestCase):
    setUp = test_memories.MemoryTests.setUp
    tearDown = test_memories.MemoryTests.tearDown
    submit = test_memories.MemoryTests.submit
    process = test_memories.MemoryTests.process

    def test_access_validation_conflicts_and_export(self):
        server = HTTPServer(('127.0.0.1', 0), handler_for(self.store))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        token = self.store.login('ben@example.test', 'correct horse battery')
        def request(method, path, body=None, **headers):
            connection = http.client.HTTPConnection('127.0.0.1', server.server_port)
            defaults = {'Cookie': 'mazi_session=' + token, 'Content-Type': 'application/json'}
            defaults.update(headers)
            connection.request(method, path, json.dumps(body) if body is not None else None, defaults)
            response = connection.getresponse()
            result = response.status, json.loads(response.read()), dict(response.getheaders())
            connection.close()
            return result
        try:
            status, story, headers = request('POST', '/api/memories/create', {'group':self.group, 'event':self.event})
            self.assertEqual(status, 200)
            self.assertIn('no-store', headers['Cache-Control'])
            body = dict(group=self.group, story=story['id'], revision=1, text='Remember this')
            self.assertEqual(request('POST', '/api/memories/write', body)[0], 200)
            self.assertEqual(request('POST', '/api/memories/write', body)[0], 409)
            self.assertEqual(request('POST', '/api/memories/write', body, Origin='https://evil.test')[0], 403)
            for invalid in [[], {}, dict(body, story=[]), dict(body, text=[]), dict(body, revision=True)]:
                self.assertEqual(request('POST', '/api/memories/write', invalid)[0], 400)
            url = '/api/memories/export?group=' + self.group + '&story=' + story['id']
            self.assertEqual(request('GET', url)[0], 200)
            self.store.hide(self.ben, self.assets[0], True)
            self.assertEqual(request('GET', url)[0], 403)
            token = self.store.login('outsider@example.test', 'correct horse battery')
            self.assertEqual(request('GET', url)[0], 403)
            self.assertEqual(request('GET', '/api/memories/recap?group=' + self.group + '&year=2020')[0], 403)
        finally:
            server.shutdown()
            thread.join()
            server.server_close()

    def test_t15_capsule_direct_paths_ignore_client_time(self):
        import base64
        self.store._now = lambda: 1800000000
        photo = base64.b64encode(test_memories.test_discovery.helpers.picture()).decode()
        capsule = self.store.seal_capsule(self.ben, self.group, 'sealed-secret', 'sealed-content', '2030-01-01T00:00:00Z', photo)
        server = HTTPServer(('127.0.0.1', 0), handler_for(self.store))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        token = self.store.login('ben@example.test', 'correct horse battery')
        def get(path):
            connection = http.client.HTTPConnection('127.0.0.1', server.server_port)
            connection.request('GET', path, headers={'Cookie':'mazi_session='+token, 'Date':'Tue, 01 Jan 2035 00:00:00 GMT'})
            response = connection.getresponse()
            result = response.status, response.read(), dict(response.getheaders())
            connection.close()
            return result
        query = '?group='+self.group+'&capsule='+capsule['id']+'&now=2200000000'
        paths = ['/api/memories/capsule', '/api/memories/capsule-photo', '/api/memories/capsule-export']
        try:
            for path in paths:
                status, body, headers = get(path+query)
                self.assertEqual(status, 403)
                self.assertNotIn(b'sealed-secret', body)
                self.assertIn('no-store', headers['Cache-Control'])
            # Capsule UUIDs are never archive assets, even after unlock.
            self.assertEqual(get('/api/archive/'+capsule['id']+'/original')[0], 403)
            self.store._now = lambda: 2000000000
            for path in paths: self.assertEqual(get(path+query)[0], 200)
            self.store.remove_member(self.alice, self.group, self.ben)
            for path in paths: self.assertEqual(get(path+query)[0], 403)
        finally:
            server.shutdown()
            thread.join()
            server.server_close()
