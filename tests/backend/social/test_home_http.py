import http.client
import json
import threading
from http.server import HTTPServer
from urllib.parse import urlencode

from mazi.server import handler_for
from tests.backend.social.test_comments import CommentsFixture


class HomeHttpTests(CommentsFixture):
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

    def request(self, path, authenticated=True):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=30)
        headers = {'Cookie': 'mazi_session=' + self.tokens[self.ben]} if authenticated else {}
        connection.request('GET', path, headers=headers)
        response = connection.getresponse()
        status, data = response.status, response.read()
        connection.close()
        return status, json.loads(data)

    def test_private_home_activity_and_selected_memory_end_to_end(self):
        self.create()
        group = urlencode(dict(group=self.group))
        status, summary = self.request('/api/social/home?' + group)
        self.assertEqual((status, summary['featured']['kind']), (200, 'conversation'))
        self.assertEqual(self.request('/api/social/activity?' + group)[1]['items'][0]['text'], 'First thought')
        status, detail = self.request('/api/atlas/memory?' + urlencode(dict(group=self.group, memory='photo-' + self.assets[0])))
        self.assertEqual((status, detail['memory']['photos'][0]['assetId']), (200, self.assets[0]))
        for path in ('/api/social/home?', '/api/social/activity?', '/api/atlas/memory?'):
            self.assertEqual(self.request(path + group, authenticated=False)[0], 403)
        self.assertEqual(self.request('/api/social/activity?' + group + '&limit=51')[0], 400)
        self.assertEqual(self.request('/api/social/activity?' + group + '&cursor=bad')[0], 400)
        self.store.hide(self.ben, self.assets[0], True)
        self.assertEqual(self.request('/api/social/activity?' + group)[1]['items'], [])
        self.assertEqual(self.request('/api/atlas/memory?' + urlencode(dict(group=self.group, memory='photo-' + self.assets[0])))[0], 403)
