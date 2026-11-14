import http.client
import json
import threading
from http.server import HTTPServer
from urllib.parse import urlencode

from mazi.server import handler_for
from tests.backend.social.test_comments import CommentsFixture


class ReactionsHttpTests(CommentsFixture):
    def setUp(self):
        super().setUp()
        code = self.store.setup_shared(admin_name='Alice', group_id=self.group, mappings={'Alice': self.alice, 'Ben': self.ben})
        self.tokens = {user: self.store.enter_shared(code=code, name=name)[1]
                       for user, name in ((self.alice, 'Alice'), (self.ben, 'Ben'))}
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

    def payload(self, key='on', active=True):
        return dict(group=self.group, request_key=key, target=self.target(), emoji='👍', active=active)

    def test_real_http_desired_state_names_and_bounded_batch(self):
        status, enabled = self.request('/api/social/reactions/set', self.payload(), user=self.ben)
        self.assertEqual((status, enabled['total'], enabled['reactions'][0]['mine']), (200, 1, True))
        query = '/api/social/reactions?' + urlencode(dict(group=self.group, kind='photo', target=self.assets[0]))
        status, visible = self.request(query)
        self.assertEqual((status, visible['reactions'][0]['members']), (200, [dict(id=self.ben, name='Ben')]))
        batch = '/api/social/reactions/batch?' + urlencode(dict(group=self.group, targets=json.dumps([self.target()])))
        self.assertEqual(self.request(batch), (200, dict(items=[visible])))
        self.assertEqual(self.request('/api/social/reactions/set', self.payload('off', False), user=self.ben)[1]['total'], 0)
        self.assertEqual(self.request('/api/social/reactions/set', self.payload(), user=self.ben)[1]['total'], 0)
        self.assertEqual(self.request('/api/social/reactions/set', self.payload(active=False), user=self.ben)[0], 409)

    def test_origin_auth_invalid_state_and_target_access_denial(self):
        query = '/api/social/reactions?' + urlencode(dict(group=self.group, kind='photo', target=self.assets[0]))
        self.assertEqual(self.request(query, authenticated=False)[0], 403)
        self.assertEqual(self.request('/api/social/reactions/set', self.payload(), authenticated=False)[0], 403)
        self.assertEqual(self.request('/api/social/reactions/set', self.payload(), origin='https://elsewhere.test')[0], 403)
        self.assertEqual(self.request('/api/social/reactions/set', dict(self.payload(), active=1))[0], 400)
        self.assertEqual(self.request('/api/social/reactions/set', dict(self.payload(), emoji='🔥'))[0], 400)
        self.assertEqual(self.request('/api/social/reactions/set', dict(self.payload(), target={'kind': 'notebook', 'id': 'x'}))[0], 400)
        self.store.hide(self.ben, self.assets[0], True)
        self.assertEqual(self.request(query, user=self.ben)[0], 403)
        self.assertEqual(self.request('/api/social/reactions/set', self.payload(), user=self.ben)[0], 403)
        batch = '/api/social/reactions/batch?' + urlencode(dict(group=self.group, targets=json.dumps([self.target(1), self.target()])))
        self.assertEqual(self.request(batch, user=self.ben)[0], 403)
