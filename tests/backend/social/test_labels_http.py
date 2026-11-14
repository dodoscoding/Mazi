import http.client
import json
import threading
from http.server import HTTPServer
from urllib.parse import urlencode

from mazi.server import handler_for
from tests.backend.social.test_comments import CommentsFixture


class LabelsHttpTests(CommentsFixture):
    def setUp(self):
        super().setUp()
        code = self.store.setup_shared(admin_name='Alice', group_id=self.group, mappings={'Alice': self.alice, 'Ben': self.ben})
        self.tokens = {user: self.store.enter_shared(code=code, name=name)[1] for user, name in ((self.alice, 'Alice'), (self.ben, 'Ben'))}
        self.server = HTTPServer(('127.0.0.1', 0), handler_for(self.store))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.stop_server)

    def stop_server(self):
        self.server.shutdown()
        self.thread.join()
        self.server.server_close()

    def request(self, path, body=None, user=None, authenticated=True, origin=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=30)
        headers = {'Cookie': 'mazi_session=' + self.tokens[user or self.alice]} if authenticated else {}
        if body is not None:
            headers['Content-Type'] = 'application/json'
        if origin:
            headers['Origin'] = origin
        connection.request('GET' if body is None else 'POST', path, None if body is None else json.dumps(body), headers)
        response = connection.getresponse()
        status, data = response.status, response.read()
        connection.close()
        return status, json.loads(data)

    def payload(self, key='first', value='yes', revision=0):
        return dict(group=self.group, request_key=key, items=[dict(asset=self.assets[0], changes={'screenshot': value}, expected={'screenshot': revision})])

    def test_bounded_read_manual_labels_actor_and_retry_conflict(self):
        query = '/api/social/labels?' + urlencode(dict(group=self.group, assets=json.dumps([self.assets[0]])))
        status, before = self.request(query)
        self.assertEqual((status, before['items'][0]['labels']['screenshot']['revision']), (200, 0))
        status, created = self.request('/api/social/labels/set', self.payload(), user=self.ben)
        self.assertEqual((status, created['items'][0]['labels']['screenshot']['actor']['name']), (200, 'Ben'))
        self.assertEqual(self.request('/api/social/labels/set', self.payload(), user=self.ben), (200, created))
        self.assertEqual(self.request('/api/social/labels/set', self.payload('stale'), user=self.alice)[0], 409)
        status, cleared = self.request('/api/social/labels/set', self.payload('clear', 'unknown', 1))
        self.assertEqual((status, cleared['items'][0]['labels']['screenshot']['revision']), (200, 2))
        self.assertEqual(self.request('/api/social/labels/set', self.payload(), user=self.ben)[1]['items'][0]['labels']['screenshot']['value'], 'unknown')

    def test_origin_session_shape_and_hidden_photo_denial(self):
        query = '/api/social/labels?' + urlencode(dict(group=self.group, assets=json.dumps([self.assets[0]])))
        self.assertEqual(self.request(query, authenticated=False)[0], 403)
        self.assertEqual(self.request('/api/social/labels/set', self.payload(), authenticated=False)[0], 403)
        self.assertEqual(self.request('/api/social/labels/set', self.payload(), origin='https://elsewhere.test')[0], 403)
        self.assertEqual(self.request('/api/social/labels/set', self.payload(value='auto'))[0], 400)
        self.assertEqual(self.request('/api/social/labels/set', dict(self.payload(), items=[]))[0], 400)
        self.store.hide(self.ben, self.assets[0], True)
        self.assertEqual(self.request(query, user=self.ben)[0], 403)
        self.assertEqual(self.request('/api/social/labels/set', self.payload(), user=self.ben)[0], 403)
