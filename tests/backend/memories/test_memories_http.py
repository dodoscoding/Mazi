import http.client
import json
import threading
import unittest
from http.server import HTTPServer
from tests.backend.memories import test_memories
from mazi.memories.server import handler_for


class ApiTests(unittest.TestCase):
    setUp = test_memories.MemoryTests.setUp
    tearDown = test_memories.MemoryTests.tearDown
    submit = test_memories.MemoryTests.submit
    process = test_memories.MemoryTests.process

    def test_retired_writes_preserve_reads_ownership_and_export(self):
        # Domain seeding represents content persisted before the app retired writes.
        story = self.store.create_story(self.ben, self.group, self.event)
        story = self.store.write_story(self.ben, self.group, story['id'], story['revision'], 'Remember this')
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
            body = dict(group=self.group, event=self.event, story=story['id'], revision=story['revision'], text='Changed', target={'kind':'new'}, sections=[], title='New', unlock_at='2030-01-01T00:00:00Z')
            for operation in ['create', 'write', 'note', 'seal', 'subevents', 'video']:
                status, result, headers = request('POST', '/api/memories/' + operation, body)
                self.assertEqual(status, 410, operation)
                self.assertIn('no-store', headers['Cache-Control'])
            self.assertEqual(request('POST', '/api/memories/write', body, Origin='https://evil.test')[0], 403)
            url = '/api/memories/export?group=' + self.group + '&story=' + story['id']
            self.assertEqual(request('GET', url)[1]['contributions'][0]['text'], 'Remember this')
            self.assertEqual(request('GET', '/api/memories/frame?group='+self.group+'&story='+story['id']+'&asset='+self.assets[0])[0], 410)
            notebook_url = '/api/memories/notebook?group=' + self.group + '&event=' + self.event
            self.assertEqual(request('GET', notebook_url)[1]['sections'][0]['notes'][0]['text'], 'Remember this')
            original = '/api/archive/' + self.assets[0] + '/original'
            connection = http.client.HTTPConnection('127.0.0.1', server.server_port)
            connection.request('GET', original, headers={'Cookie':'mazi_session='+token})
            response = connection.getresponse()
            self.assertEqual(response.status, 200)
            self.assertTrue(response.read())
            connection.close()
            token = self.store.login('alice@example.test', 'correct horse battery')
            self.assertEqual(request('POST', '/api/memories/delete', body)[0], 403)
            token = self.store.login('ben@example.test', 'correct horse battery')
            self.assertEqual(request('POST', '/api/memories/delete', dict(body, revision=1))[0], 409)
            self.assertEqual(request('POST', '/api/memories/delete', body)[0], 200)
            self.assertEqual(request('GET', url)[0], 403)
            token = self.store.login('outsider@example.test', 'correct horse battery')
            self.assertEqual(request('GET', notebook_url)[0], 403)
        finally:
            server.shutdown()
            thread.join()
            server.server_close()

    def test_recollection_deletion_is_only_the_current_users_existing_record(self):
        story = self.store.create_story(self.alice, self.group, self.event)
        story = self.store.write_story(self.alice, self.group, story['id'], story['revision'], 'Alice stays')
        story = self.store.write_story(self.ben, self.group, story['id'], story['revision'], 'Ben withdraws')
        server = HTTPServer(('127.0.0.1', 0), handler_for(self.store))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        token = self.store.login('ben@example.test', 'correct horse battery')
        def remove(body):
            connection = http.client.HTTPConnection('127.0.0.1', server.server_port)
            connection.request('POST', '/api/memories/delete-recollection', json.dumps(body), {'Cookie':'mazi_session='+token, 'Content-Type':'application/json'})
            response = connection.getresponse()
            result = response.status, json.loads(response.read())
            connection.close()
            return result
        body = dict(group=self.group, story=story['id'], revision=story['revision'])
        try:
            self.assertEqual(remove(dict(body, revision=1))[0], 409)
            for extra in [{'text':'replace'}, {'author':self.alice}, {'user':self.alice}]:
                self.assertEqual(remove(dict(body, **extra))[0], 400)
            self.assertEqual(self.store.story(self.ben, self.group, story['id'])['revision'], story['revision'])
            status, result = remove(body)
            self.assertEqual(status, 200)
            self.assertEqual([(entry['author'], entry['text']) for entry in result['contributions']], [(self.alice, 'Alice stays')])
            current = dict(body, revision=result['revision'])
            self.assertEqual(remove(current)[0], 403)
            self.assertEqual(self.store.story(self.ben, self.group, story['id'])['revision'], result['revision'])
            self.assertEqual(len(self.store.stories(self.ben, self.group)), 1)
            token = self.store.login('outsider@example.test', 'correct horse battery')
            self.assertEqual(remove(current)[0], 403)
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
