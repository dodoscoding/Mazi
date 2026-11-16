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
        self.admin = self.store.register('admin@example.test', 'correct horse battery')
        self.group = self.store.create_group(self.admin, 'Circle')
        self.store.accept(self.alice, self.store.invite(self.admin, self.group))
        self.store.accept(self.ben, self.store.invite(self.admin, self.group))
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

    def test_membership_run_withdrawal_and_personal_photo_hides_apply_to_reads(self):
        status, results = self.get('conversations', query='lantern')
        self.assertEqual(status, 200)
        record = results['items'][0]['id']
        self.assertEqual(self.get('conversations', token=self.outside_token, query='lantern')[0], 403)
        self.assertEqual(self.get('context', token=self.outside_token, record=record)[0], 403)
        other_group = self.store.create_group(self.ben, 'Other circle')
        self.assertEqual(self.get('context', group=other_group, record=record)[0], 404)
        status, photos = self.get('conversations', query='photo')
        self.assertEqual(status, 200)
        photo_record = photos['items'][0]['id']
        self.assertTrue(photos['items'][0]['hasPhoto'])
        asset = self.store.gallery(self.alice, self.group)[0]['id']
        self.store.hide(self.ben, asset, True)
        self.assertEqual(self.get('conversations', query='photo')[1]['items'], [])
        self.assertEqual(self.get('context', record=photo_record)[0], 404)
        # Hiding one photograph does not turn the source's standalone text into a photograph.
        self.assertEqual(len(self.get('conversations', query='lantern')[1]['items']), 2)
        self.store.withdraw(self.alice, self.run)
        self.assertEqual(self.get('conversations', query='lantern')[1]['items'], [])
        self.assertEqual(self.get('context', record=record)[0], 404)

    def test_a_removed_contributor_or_reader_cannot_supply_source_context(self):
        data = zip_bytes({'departure.txt': '04/01/2024, 20:00 - Lena: departure only'})
        run = self.store.begin_import(self.alice, self.group, 'whatsapp', 'departure', len(data), hashlib.sha256(data).hexdigest(), {'date_order': 'DMY'})
        self.store.write_chunk(self.alice, run, 0, data)
        self.store.finish_transfer(self.alice, run)
        self.store.scan(run)
        self.store.confirm(self.alice, run)
        record = self.get('conversations', query='departure')[1]['items'][0]['id']
        self.store.remove_member(self.admin, self.group, self.ben)
        self.assertEqual(self.get('context', record=record)[0], 403)
        # Removing the source contributor also removes their text-only source records.
        self.store.accept(self.ben, self.store.invite(self.admin, self.group))
        self.store.remove_member(self.admin, self.group, self.alice)
        self.assertEqual(self.get('conversations', query='lantern')[1]['items'], [])
        self.assertEqual(self.get('context', record=record)[0], 404)

    def test_inventory_is_private_until_import_sharing_is_confirmed(self):
        data = zip_bytes({'private.txt': '04/01/2024, 20:00 - Lena: inventory secret'})
        run = self.store.begin_import(self.alice, self.group, 'whatsapp', 'private', len(data), hashlib.sha256(data).hexdigest(), {'date_order': 'DMY'})
        self.store.write_chunk(self.alice, run, 0, data)
        self.store.finish_transfer(self.alice, run)
        self.store.scan(run)
        self.assertEqual(self.get('conversations', query='inventory')[1]['items'], [])
        self.store.confirm(self.alice, run)
        records = self.get('conversations', query='inventory')[1]['items']
        self.assertEqual(len(records), 1)
        self.assertFalse(records[0]['hasPhoto'])
        self.store.withdraw(self.alice, run)
        self.assertEqual(self.get('conversations', query='inventory')[1]['items'], [])
        self.assertEqual(self.get('context', record=records[0]['id'])[0], 404)

    def test_scan_continuation_never_reports_an_unsearched_tail_as_no_matches(self):
        data = zip_bytes({'many.txt': '\n'.join(f'04/01/2024, 20:00 - Lena: needle item {index}' for index in range(300))})
        run = self.store.begin_import(self.alice, self.group, 'whatsapp', 'many', len(data), hashlib.sha256(data).hexdigest(), {'date_order': 'DMY'})
        self.store.write_chunk(self.alice, run, 0, data)
        self.store.finish_transfer(self.alice, run)
        self.store.scan(run)
        self.store.confirm(self.alice, run)
        empty = self.get('conversations', query='nonexistent')[1]
        self.assertEqual(empty['items'], [])
        self.assertFalse(empty['complete'])
        self.assertIsNotNone(empty['next_cursor'])
        ids, cursor = [], ''
        while True:
            status, page = self.get('conversations', query='needle', cursor=cursor)
            self.assertEqual(status, 200)
            ids.extend(item['id'] for item in page['items'])
            if page['complete']:
                self.assertIsNone(page['next_cursor'])
                break
            self.assertNotEqual(cursor, page['next_cursor'])
            cursor = page['next_cursor']
        self.assertEqual(len(ids), 300)
        self.assertEqual(len(set(ids)), 300)

    def test_source_and_sender_filters_are_source_metadata_without_photo_guesses(self):
        self.assertEqual(len(self.get('conversations', query='lantern', source='whatsapp', shared_by='Lena')[1]['items']), 1)
        self.assertEqual(self.get('conversations', query='lantern', source='apple')[1]['items'], [])
        self.assertEqual(self.get('conversations', query='lantern', shared_by='Missing participant')[1]['items'], [])
        self.assertEqual(self.get('conversations', query='lantern', limit=0)[0], 400)
        self.assertEqual(self.get('conversations', query='lantern', years='2025')[0], 400)
