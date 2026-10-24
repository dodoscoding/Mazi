import io
import json
import unittest

from PIL import Image

from mazi.atlas import atlas_view
from mazi.identity.core import Denied
from mazi.memories.memories import MemoryStore
from tests.backend.imports import test_engine as helpers


class ArchiveCapacityTests(unittest.TestCase):
    submit = helpers.EngineTests.submit
    process = helpers.EngineTests.process

    def setUp(self):
        helpers.EngineTests.setUp(self)
        self.store.close()
        self.store = MemoryStore(self.temp.name)

    def tearDown(self):
        helpers.EngineTests.tearDown(self)

    def test_completed_imports_remain_browsable_after_one_thousand_photos(self):
        for start in range(0, 1001, 100):
            files = {}
            for number in range(start, min(start + 100, 1001)):
                data = io.BytesIO()
                Image.new('RGB', (8, 8), (number % 256, number // 256, 100)).save(data, 'PNG')
                files[f'photo-{number:04d}.png'] = data.getvalue()
            run = self.submit(files)
            self.process(run)
            self.assertEqual(self.store.report(self.alice, run)['state'], 'COMPLETED')
            if start == 900:
                self.assertEqual(self.store.timeline(self.ben, self.group)['total'], 1000)

        page = self.store.timeline(self.ben, self.group)
        self.assertEqual((page['total'], len(page['items']), page['next_offset']), (1001, 30, 30))
        identifiers = []
        offset = 0
        while True:
            page = self.store.timeline(self.ben, self.group, offset=offset, limit=100)
            identifiers.extend(item['id'] for item in page['items'])
            if page['next_offset'] is None:
                break
            offset = page['next_offset']
        self.assertEqual(len(identifiers), 1001)
        self.assertEqual(len(set(identifiers)), 1001)
        self.assertEqual(identifiers, sorted(identifiers, reverse=True))
        self.assertEqual(self.store.timeline(self.ben, self.group, offset=1001),
                         {'items': [], 'total': 1001, 'next_offset': None})
        match = self.store.timeline(self.ben, self.group, query='PHOTO-1000.PNG')
        self.assertEqual(match['total'], 1)
        self.assertEqual(self.store.asset_bytes(self.ben, match['items'][0]['id'], original=True),
                         files['photo-1000.png'])
        self.assertEqual(len(atlas_view(self.store, self.ben, self.group)['memories']), 1001)
        with self.assertRaises(Denied):
            self.store.timeline(self.outsider, self.group)
        with self.assertRaises(Denied):
            atlas_view(self.store, self.outsider, self.group)

    def test_projection_preserves_hiding_withdrawal_and_independent_origins(self):
        blue = io.BytesIO()
        Image.new('RGB', (8, 8), 'blue').save(blue, 'PNG')
        run = self.submit({'red.jpg': helpers.picture(), 'blue.png': blue.getvalue()})
        self.process(run)
        red = self.store.timeline(self.alice, self.group, query='red.jpg')['items'][0]['id']
        blue = self.store.timeline(self.alice, self.group, query='blue.png')['items'][0]['id']
        copy = self.submit({'ben-only-filename.jpg': helpers.picture()}, user=self.ben)
        self.process(copy, self.ben)
        self.assertEqual(self.store.timeline(self.alice, self.group, query='ben-only')['items'][0]['origin_count'], 2)
        event = self.store.review_event(self.alice, self.group, [red, blue], 'Together', 'accept')

        self.store.hide(self.ben, red, True)
        self.assertEqual(self.store.timeline(self.ben, self.group)['total'], 1)
        self.assertEqual(self.store.timeline(self.ben, self.group, query='ben-only'),
                         {'items': [], 'total': 0, 'next_offset': None})
        self.assertEqual([card['id'] for card in atlas_view(self.store, self.ben, self.group)['memories']],
                         ['photo-' + blue])
        self.assertEqual(self.store.timeline(self.alice, self.group)['total'], 2)
        self.store.hide(self.ben, red, False)
        self.assertEqual(self.store.timeline(self.ben, self.group)['total'], 2)
        self.store.hide_event(self.ben, self.group, event, True)
        self.assertEqual(atlas_view(self.store, self.ben, self.group)['memories'], [])
        self.store.hide_event(self.ben, self.group, event, False)
        self.assertEqual(atlas_view(self.store, self.ben, self.group)['memories'][0]['id'], event)

        self.store.remove_member(self.alice, self.group, self.ben)
        self.assertEqual(self.store.timeline(self.alice, self.group, query='ben-only'),
                         {'items': [], 'total': 0, 'next_offset': None})
        self.assertEqual(self.store.timeline(self.alice, self.group, query='red.jpg')['items'][0]['origin_count'], 1)
        with self.assertRaises(Denied):
            self.store.timeline(self.ben, self.group)
        self.store.withdraw(self.alice, run)
        self.assertEqual(self.store.timeline(self.alice, self.group)['total'], 0)
        self.assertEqual(atlas_view(self.store, self.alice, self.group)['memories'], [])

    def test_projection_keeps_all_origins_and_filters_before_chronological_paging(self):
        run = self.submit({f'copy-{number:03d}.jpg': helpers.picture() for number in range(100)})
        self.process(run)
        self.process(self.submit({'last-copy.jpg': helpers.picture()}))
        red = self.store.timeline(self.alice, self.group, query='last-copy')['items'][0]['id']
        self.assertEqual(self.store.timeline(self.ben, self.group, query='copy-099.jpg last-copy.jpg')['total'], 1)
        self.assertEqual(self.store.timeline(self.ben, self.group)['items'][0]['origin_count'], 101)
        self.store.correct_asset(self.alice, red, title='Match old', capture_date='2020-01-02',
                                 place='Harbour', anniversary=True)
        for number, color in enumerate(('blue', 'green')):
            data = io.BytesIO()
            Image.new('RGB', (8, 8), color).save(data, 'PNG')
            self.process(self.submit({color + '.png': data.getvalue()}))
            asset = self.store.timeline(self.alice, self.group, query=color + '.png')['items'][0]['id']
            self.store.correct_asset(self.alice, asset, title='Match new' if number == 0 else 'Other',
                                     capture_date='2022-01-02', place='')
        page = self.store.timeline(self.ben, self.group, limit=1, query='MATCH')
        self.assertEqual((page['items'][0]['title'], page['total'], page['next_offset']), ('Match new', 2, 1))
        page = self.store.timeline(self.ben, self.group, offset=1, limit=1, query='match')
        self.assertEqual(page, {'items': [{'id': red, 'title': 'Match old', 'date': '2020-01-02', 'dates': ['2020-01-02'],
                                         'place': 'harbour', 'date_basis': 'reviewed correction',
                                         'origin_count': 101, 'anniversary': True}],
                                'total': 2, 'next_offset': None})
        self.assertEqual(self.store.timeline(self.ben, self.group, query='HARBOUR')['total'], 1)
        for limit in (0, 101, True):
            with self.subTest(limit=limit), self.assertRaises(ValueError):
                self.store.timeline(self.alice, self.group, limit=limit)

    def test_two_circles_keep_query_counts_and_atlas_context_isolated(self):
        self.process(self.submit({'first-circle.jpg': helpers.picture()}))
        other_group = self.store.create_group(self.alice, 'Another circle')
        self.store.accept(self.ben, self.store.invite(self.alice, other_group))
        run = self.submit({'chat.txt': '01/01/2020, 12:00 - Ana: Other circle conversation\n'
                                     '01/01/2020, 12:01 - Ana: other-circle.jpg (file attached)',
                           'other-circle.jpg': helpers.picture()}, source='whatsapp', group=other_group)
        self.process(run)
        other = self.store.timeline(self.ben, other_group, query='Other circle conversation')
        self.assertEqual(other['total'], 1)
        self.assertEqual(self.store.timeline(self.ben, self.group)['total'], 1)
        for query in ('other-circle.jpg', 'Other circle conversation'):
            with self.subTest(query=query):
                self.assertEqual(self.store.timeline(self.ben, self.group, query=query),
                                 {'items': [], 'total': 0, 'next_offset': None})
        first_cards = atlas_view(self.store, self.ben, self.group)['memories']
        other_cards = atlas_view(self.store, self.ben, other_group)['memories']
        self.assertEqual(len(first_cards), 1)
        self.assertEqual(first_cards[0]['messages'], [])
        self.assertIn('Other circle conversation', str(other_cards[0]['messages']))
        self.assertNotEqual(first_cards[0]['id'], other_cards[0]['id'])

    def seed_projection(self, count):
        run = self.submit({'seed.jpg': helpers.picture()})
        payload = {'source': 'manual', 'original_filename': 'synthetic.jpg',
                   'capture_assertions': [{'local': '2020-01-02T12:00:00'}], 'context': []}
        for number in range(count):
            asset = f'capacity-{number:05d}'
            self.store.db.execute('INSERT INTO archive_assets VALUES(?,?,?,?,?,?,?,?,?)',
                                  (asset, self.group, asset, 'synthetic', 'synthetic', 'image/jpeg', 1, 8, 8))
            self.store.db.execute('INSERT INTO archive_origins VALUES(?,?,?,?,?,?,?,?,0)',
                                  ('origin-' + asset, asset, self.group, self.alice, run,
                                   asset, asset, json.dumps(payload)))
        self.store.db.commit()

    def test_ten_thousand_and_one_photos_keep_readable_boundary_pages(self):
        self.seed_projection(10001)
        page = self.store.timeline(self.ben, self.group, offset=9900, limit=100)
        self.assertEqual((page['total'], len(page['items']), page['next_offset']), (10001, 100, 10000))
        self.assertEqual((page['items'][0]['id'], page['items'][-1]['id']),
                         ('capacity-00100', 'capacity-00001'))
        page = self.store.timeline(self.ben, self.group, offset=10000, limit=100)
        self.assertEqual(([item['id'] for item in page['items']], page['total'], page['next_offset']),
                         (['capacity-00000'], 10001, None))
        cards = atlas_view(self.store, self.ben, self.group)['memories']
        self.assertEqual(len(cards), 10001)
        self.assertEqual((cards[0]['id'], cards[-1]['id']),
                         ('photo-capacity-10000', 'photo-capacity-00000'))


if __name__ == '__main__':
    unittest.main()
