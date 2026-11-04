import http.client
import json
import threading
from http.server import HTTPServer

from mazi.server import handler_for
from tests.backend.social.test_comments import CommentsFixture


class CommentsHttpTests(CommentsFixture):
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

    def payload(self, key='new', text='First thought'):
        return dict(group=self.group, request_key=key, target=self.target(), text=text)

    def test_multiple_messages_plain_text_authorship_and_version_conflicts(self):
        status, first = self.request('/api/social/comments/create', self.payload(text='<b>A thought</b>'))
        self.assertEqual((status, first['text'], first['author']['name']), (200, '<b>A thought</b>', 'Alice'))
        self.assertEqual(self.request('/api/social/comments/create', self.payload(key='next'), user=self.ben)[0], 200)
        query = '/api/social/comments?group=' + self.group + '&kind=photo&target=' + self.assets[0]
        status, page = self.request(query)
        self.assertEqual((status, len(page['items']), page['total']), (200, 2, 2))
        body = dict(group=self.group, comment=first['id'], revision=1, request_key='edit', text='Changed')
        self.assertEqual(self.request('/api/social/comments/update', body, user=self.ben)[0], 403)
        self.assertEqual(self.request('/api/social/comments/update', body)[0], 200)
        self.assertEqual(self.request('/api/social/comments/update', dict(body, request_key='stale'))[0], 409)
        delete = dict(group=self.group, comment=first['id'], revision=2, request_key='delete')
        self.assertEqual(self.request('/api/social/comments/delete', delete), (200, dict(id=first['id'], deleted=True)))
        self.assertEqual(self.request('/api/social/comments/create', self.payload(text='<b>A thought</b>')), (200, dict(id=first['id'], deleted=True)))

    def test_missing_auth_wrong_origin_invalid_target_and_hidden_access(self):
        query = '/api/social/comments?group=' + self.group + '&kind=photo&target=' + self.assets[0]
        self.assertEqual(self.request(query, authenticated=False)[0], 403)
        self.assertEqual(self.request('/api/social/comments/create', self.payload(), authenticated=False)[0], 403)
        self.assertEqual(self.request('/api/social/comments/create', self.payload(), origin='https://elsewhere.test')[0], 403)
        self.assertEqual(self.request('/api/social/comments/create', self.payload(text=''))[0], 400)
        self.assertEqual(self.request(query + '&limit=51')[0], 400)
        self.assertEqual(self.request(query + '&cursor=bad')[0], 400)
        self.assertEqual(self.request('/api/social/comments/create', dict(self.payload(), target={'kind': 'comment', 'id': 'unknown'}))[0], 400)
        _, first = self.request('/api/social/comments/create', self.payload(), user=self.ben)
        self.store.hide(self.ben, self.assets[0], True)
        self.assertEqual(self.request(query, user=self.ben)[0], 403)
        self.assertEqual(self.request('/api/social/comments/create', self.payload(), user=self.ben)[0], 403)
        self.assertEqual(self.request('/api/social/comments/update', dict(group=self.group, comment=first['id'], revision=1, request_key='edit', text='No'), user=self.ben)[0], 403)
