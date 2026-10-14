import hashlib
import io
import json
import tempfile
import unittest
from PIL import Image
from mazi.identity.core import Denied
from mazi.memories.memories import MemoryStore
from mazi.atlas import atlas_view


class AtlasTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = MemoryStore(self.temp.name)
        self.alice = self.store.register('alice@example.test', 'correct horse battery')
        self.ben = self.store.register('ben@example.test', 'correct horse battery')
        self.outsider = self.store.register('outsider@example.test', 'correct horse battery')
        self.group = self.store.create_group(self.alice, 'Our circle')
        self.store.accept(self.ben, self.store.invite(self.alice, self.group))
        source = self.store.create_source(self.alice, self.group, 'apple', 'Photos', {
            'start': '2020-01-01', 'end': '2030-01-01', 'albums': [], 'types': ['image']})
        self.store.set_source(self.alice, source, True, 'authorized')
        self.assets = []
        for index, color in enumerate(('red', 'blue')):
            image = io.BytesIO()
            Image.new('RGB', (20, 20), color).save(image, 'JPEG')
            data = image.getvalue()
            resource = self.store.begin_resource(self.alice, source, {
                'item': str(index), 'component': 'photo', 'version': 'original',
                'filename': f'{color}.jpg', 'date': f'202{index}-01-02', 'kind': 'image', 'albums': []
            }, len(data), hashlib.sha256(data).hexdigest())
            self.store.resource_chunk(self.alice, resource['id'], 0, data)
            self.store.finish_resource(self.alice, resource['id'])
            while self.store.work_once():
                pass
            asset = self.store.db.execute('SELECT asset_id FROM archive_origins WHERE run_id=?', (resource['id'],)).fetchone()[0]
            self.assets.append(asset)
            self.store.correct_asset(self.alice, asset, title=color.title(), capture_date=f'202{index}-01-02', place='Harbour')

    def tearDown(self):
        self.store.close()
        self.temp.cleanup()

    def test_real_photos_and_cross_year_approved_memory(self):
        cards = atlas_view(self.store, self.ben, self.group)['memories']
        self.assertEqual({card['title'] for card in cards}, {'Red', 'Blue'})
        self.assertEqual({card['kind'] for card in cards}, {'photo'})
        event = self.store.review_event(self.alice, self.group, self.assets, 'Two winters', 'accept')
        cards = atlas_view(self.store, self.ben, self.group)['memories']
        self.assertEqual(len(cards), 1)
        self.assertEqual(cards[0]['id'], event)
        self.assertEqual(cards[0]['date'], '2020-01-02 to 2021-01-02')
        self.assertEqual(len(cards[0]['photos']), 2)
        self.assertEqual(cards[0]['messages'], [])
        self.assertTrue(cards[0]['photos'][0]['src'].startswith('/api/review/rendition/'))

    def test_hidden_photo_suppresses_event_title_and_membership_denies(self):
        self.store.review_event(self.alice, self.group, self.assets, 'Private event title', 'accept')
        self.store.hide(self.ben, self.assets[0], True)
        cards = atlas_view(self.store, self.ben, self.group)['memories']
        self.assertNotIn('Private event title', str(cards))
        self.assertEqual([card['title'] for card in cards], ['Blue'])
        with self.assertRaises(Denied):
            atlas_view(self.store, self.outsider, self.group)
        self.store.remove_member(self.alice, self.group, self.ben)
        with self.assertRaises(Denied):
            atlas_view(self.store, self.ben, self.group)

    def test_hiding_an_event_does_not_restore_it_as_photographs(self):
        event = self.store.review_event(self.alice, self.group, self.assets, 'Hidden winter', 'accept')
        self.store.hide_event(self.ben, self.group, event, True)
        self.assertEqual(atlas_view(self.store, self.ben, self.group)['memories'], [])

    def _origin(self, asset):
        return self.store.db.execute('SELECT id FROM archive_origins WHERE asset_id=?', (asset,)).fetchone()[0]

    def _memory(self):
        self.store.review_event(self.alice, self.group, self.assets, 'Island week', 'accept')
        return atlas_view(self.store, self.ben, self.group)['memories'][0]

    def test_assets_sharing_one_city_give_that_place(self):
        self.store.set_place(self.alice, self._origin(self.assets[0]), 'GR', 'Naxos', 37.25, 25.5, None)
        self.store.set_place(self.alice, self._origin(self.assets[1]), 'GR', 'Naxos', 37.75, 25.0, None)
        self.assertEqual(self._memory()['place'],
                         {'name': 'Naxos', 'country': 'GR', 'latitude': 37.5, 'longitude': 25.25})

    def test_unplaced_asset_does_not_block_agreeing_place(self):
        self.store.set_place(self.alice, self._origin(self.assets[0]), 'GR', 'Naxos', 37.1, 25.4, None)
        self.assertEqual(self._memory()['place'],
                         {'name': 'Naxos', 'country': 'GR', 'latitude': 37.1, 'longitude': 25.4})

    def test_assets_in_different_cities_give_no_place(self):
        self.store.set_place(self.alice, self._origin(self.assets[0]), 'GR', 'Naxos', 37.1, 25.4, None)
        self.store.set_place(self.alice, self._origin(self.assets[1]), 'GR', 'Paros', 37.1, 25.2, None)
        cards = atlas_view(self.store, self.ben, self.group)['memories']
        self.assertEqual({card['title']: card['place']['name'] for card in cards}, {'Red': 'Naxos', 'Blue': 'Paros'})
        self.assertIsNone(self._memory()['place'])

    def test_no_shared_place_rows_give_no_place_despite_annotation(self):
        cards = atlas_view(self.store, self.ben, self.group)['memories']
        self.assertEqual([card['place'] for card in cards], [None, None])
        self.assertIsNone(self._memory()['place'])

    def test_shared_people_are_visible_contributor_names(self):
        self.assertEqual(self._memory()['people']['shared'], [])
        self.store.setup_shared(admin_name='Alice', group_id=self.group, mappings={'Alice': self.alice, 'Ben': self.ben})
        self.assertEqual(atlas_view(self.store, self.ben, self.group)['memories'][0]['people'],
                         {'shared': ['Alice'], 'conversation': []})
        with self.assertRaises(Denied):
            atlas_view(self.store, self.outsider, self.group)

    def test_conversation_people_exclude_fallback_label(self):
        context = [{'text': 'Ferry?', 'sender': {'label': 'Maya'}, 'shared_at': '21:14'},
                   {'text': 'We live here now.', 'sender': {'label': 'Deniz'}, 'shared_at': '21:16'},
                   {'text': 'Still here.', 'sender': {'label': 'Maya'}, 'shared_at': '21:20'},
                   {'text': 'Unlabelled', 'sender': {}, 'shared_at': '21:22'}]
        for asset in self.assets:
            row = self.store.db.execute('SELECT id,payload FROM archive_origins WHERE asset_id=?', (asset,)).fetchone()
            payload = json.loads(row['payload'])
            payload['context'] = context
            self.store.db.execute('UPDATE archive_origins SET payload=? WHERE id=?', (json.dumps(payload), row['id']))
        self.store.db.commit()
        card = self._memory()
        self.assertIn('Source participant', [message['name'] for message in card['messages']])
        self.assertEqual(card['people']['conversation'], ['Deniz', 'Maya'])

    def test_city_spelling_case_still_agrees(self):
        self.store.set_place(self.alice, self._origin(self.assets[0]), 'GR', 'Naxos', 37.25, 25.5, None)
        self.store.set_place(self.alice, self._origin(self.assets[1]), 'GR', 'naxos', 37.75, 25.0, None)
        self.assertEqual(self._memory()['place'],
                         {'name': 'Naxos', 'country': 'GR', 'latitude': 37.5, 'longitude': 25.25})

    def test_same_name_far_apart_gives_no_place(self):
        self.store.set_place(self.alice, self._origin(self.assets[0]), 'US', 'Springfield', 39.8, -89.6, None)
        self.store.set_place(self.alice, self._origin(self.assets[1]), 'US', 'Springfield', 37.2, -93.3, None)
        self.assertIsNone(self._memory()['place'])

    def _ben_copy_of_red(self):
        source = self.store.create_source(self.ben, self.group, 'apple', 'Photos', {
            'start': '2020-01-01', 'end': '2030-01-01', 'albums': [], 'types': ['image']})
        self.store.set_source(self.ben, source, True, 'authorized')
        image = io.BytesIO()
        Image.new('RGB', (20, 20), 'red').save(image, 'JPEG')
        data = image.getvalue()
        resource = self.store.begin_resource(self.ben, source, {
            'item': 'ben-red', 'component': 'photo', 'version': 'original',
            'filename': 'red.jpg', 'date': '2020-01-02', 'kind': 'image', 'albums': []
        }, len(data), hashlib.sha256(data).hexdigest())
        self.store.resource_chunk(self.ben, resource['id'], 0, data)
        self.store.finish_resource(self.ben, resource['id'])
        while self.store.work_once():
            pass
        origin = self.store.db.execute('SELECT id,asset_id FROM archive_origins WHERE run_id=?', (resource['id'],)).fetchone()
        self.assertEqual(origin['asset_id'], self.assets[0])
        self.store.setup_shared(admin_name='Alice', group_id=self.group, mappings={'Alice': self.alice, 'Ben': self.ben})
        return resource['id'], origin['id']

    def _red_card(self):
        return next(card for card in atlas_view(self.store, self.alice, self.group)['memories'] if card['title'] == 'Red')

    def test_withdrawn_origin_hides_its_place_and_contributor(self):
        resource, origin = self._ben_copy_of_red()
        self.store.set_place(self.ben, origin, 'GR', 'Naxos', 37.1, 25.4, None)
        self.assertEqual(self._red_card()['place']['name'], 'Naxos')
        self.assertEqual(self._red_card()['people']['shared'], ['Alice', 'Ben'])
        self.store.withdraw_resource(self.ben, resource)
        self.assertIsNone(self._red_card()['place'])
        self.assertEqual(self._red_card()['people']['shared'], ['Alice'])

    def test_removed_member_place_and_name_leave_the_card(self):
        _, origin = self._ben_copy_of_red()
        self.store.set_place(self.ben, origin, 'GR', 'Naxos', 37.1, 25.4, None)
        self.store.remove_member(self.alice, self.group, self.ben)
        self.assertIsNone(self._red_card()['place'])
        self.assertEqual(self._red_card()['people']['shared'], ['Alice'])
