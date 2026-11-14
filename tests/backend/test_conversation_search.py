import hashlib
import http.client
import json
import tempfile
import threading
import unittest
from http.server import HTTPServer
from urllib.parse import urlencode

from mazi.discovery.discovery import DiscoveryStore
from mazi.discovery.server import handler_for
from tests.backend.imports.test_adapters import zip_bytes
from tests.backend.imports.test_engine import picture


class ConversationHttpTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = DiscoveryStore(self.temp.name)
        self.alice = self.store.register('alice@example.test', 'correct horse battery')
        self.ben = self.store.register('ben@example.test', 'correct horse battery')
        self.outsider = self.store.register('outsider@example.test', 'correct horse battery')
        self.group = self.store.create_group(self.alice, 'Circle')
        self.store.accept(self.ben, self.store.invite(self.alice, self.group))
        self.token = self.store.login('ben@example.test', 'correct horse battery')
        self.outside_token = self.store.login('outsider@example.test', 'correct horse battery')
        archive = zip_bytes({'chat.txt': '04/01/2024, 20:00 - Lena: lantern planning\n04/01/2024, 20:01 - Omar: lantern supplies\n04/01/2024, 20:02 - Lena: photo.jpg (file attached)', 'photo.jpg': picture()})
        self.run = self.store.begin_import(self.alice, self.group, 'whatsapp', 'account', len(archive), hashlib.sha256(archive).hexdigest(), {'date_order': 'DMY'})
        self.store.write_chunk(self.alice, self.run, 0, archive)
        self.store.finish_transfer(self.alice, self.run)
        self.store.scan(self.run)
        self.store.confirm(self.alice, self.run)
        while self.store.work_once():
            pass
        self.server = HTTPServer(('127.0.0.1', 0), handler_for(self.store))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.thread.join()
        self.server.server_close()
        self.store.close()
        self.temp.cleanup()

    def get(self, route, token=None, **query):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port)
        connection.request('GET', '/api/discovery/' + route + '?' + urlencode({'group': self.group, **query}), headers={'Cookie': 'mazi_session=' + (token or self.token)})
        response = connection.getresponse()
        value = json.loads(response.read())
        connection.close()
        return response.status, value

    def test_text_only_records_have_source_context_and_continuation_without_ai_consent(self):
        status, first = self.get('conversations', query='lantern', limit=1)
        self.assertEqual(status, 200)
        self.assertEqual(len(first['items']), 1)
        self.assertFalse(first['items'][0]['hasPhoto'])
        self.assertFalse(first['complete'])
        status, second = self.get('conversations', query='lantern', limit=1, cursor=first['next_cursor'])
        self.assertEqual(status, 200)
        self.assertEqual(len(second['items']), 1)
        self.assertNotEqual(first['items'][0]['id'], second['items'][0]['id'])
        status, context = self.get('context', record=first['items'][0]['id'])
        self.assertEqual(status, 200)
        self.assertIn(context['sourceRef'], ('chat.txt#line:1', 'chat.txt#line:2'))
        self.assertEqual([message['text'] for message in context['messages']][:2], ['lantern planning', 'lantern supplies'])
        self.assertNotIn('asset', context)
