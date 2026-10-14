import hashlib
import io
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
