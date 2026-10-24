import hashlib
import io
import re
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from mazi.atlas import atlas_view
from mazi.identity.core import Denied
from mazi.memories.memories import MemoryStore
from mazi.sources.backfill_places import backfill
from mazi.sources.sources import SCHEMA
from tests.backend.imports.test_adapters import zip_bytes

MIGRATION = Path(__file__).parents[3] / 'infra/hosted/supabase/migrations/20261024090000_place_removals.sql'
ISTANBUL = {'name': 'Istanbul', 'country': 'TR', 'latitude': 41.1069, 'longitude': 29.0081}


def gps_picture(color='red', latitude=(41.0, 0.0, 51.84), longitude=(28.0, 58.0, 30.0), refs='NE'):
    exif = Image.Exif()
    exif[34853] = {1: refs[0], 2: latitude, 3: refs[1], 4: longitude}
    output = io.BytesIO()
    Image.new('RGB', (8, 8), color).save(output, 'JPEG', exif=exif)
    return output.getvalue()


class GpsPlaceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.store = MemoryStore(self.temp.name)
        self.addCleanup(self.store.close)
        self.alice = self.store.register('alice@example.test', 'synthetic gps password')
        self.ben = self.store.register('ben@example.test', 'synthetic gps password')
        self.group = self.store.create_group(self.alice, 'GPS circle')
        self.store.accept(self.ben, self.store.invite(self.alice, self.group))

    def import_zip(self, files, user=None):
        user = user or self.alice
        data = zip_bytes(files)
        run = self.store.begin_import(user, self.group, 'manual', 'gps', len(data), hashlib.sha256(data).hexdigest(), {})
        self.store.write_chunk(user, run, 0, data)
        self.store.finish_transfer(user, run)
        self.store.scan(run)
        self.store.confirm(user, run)
        while self.store.work_once():
            pass
        return [dict(row) for row in self.store.db.execute('SELECT id,asset_id FROM archive_origins WHERE run_id=? ORDER BY id', (run,))]

    def place(self, asset, user=None):
        [card] = [card for card in atlas_view(self.store, user or self.ben, self.group)['memories'] if card['id'] == 'photo-' + asset]
        return card['place']

    def test_archive_import_pins_the_nearest_city_centre(self):
        [pinned] = self.import_zip({'istanbul.jpg': gps_picture()})
        [ocean] = self.import_zip({'ocean.jpg': gps_picture('blue', (30.0, 0.0, 0.0), (40.0, 0.0, 0.0), 'NW')})
        self.assertEqual(self.place(pinned['asset_id']), ISTANBUL)
        self.assertIsNone(self.place(ocean['asset_id']))
        self.assertEqual([(p['origin'], p['country'], p['city'], p['day']) for p in self.store.places(self.ben, self.group)['points']],
                         [(pinned['id'], 'TR', 'Istanbul', None)])

    def test_apple_and_discord_sources_pin_through_the_same_publish(self):
        from mazi.sources.discord import poll_source
        from tests.backend.sources.test_discord import FakeDiscord, link, message, paged
        apple = self.store.create_source(self.alice, self.group, 'apple', 'Photos', {
            'start': '2020-01-01', 'end': '2030-01-01', 'albums': [], 'types': ['image']})
        self.store.set_source(self.alice, apple, True, 'authorized')
        data = gps_picture('green')
        resource = self.store.begin_resource(self.alice, apple, {
            'item': '1', 'component': 'photo', 'version': 'original', 'filename': 'a.jpg',
            'date': '2024-05-06', 'capture_date': '2024-05-06', 'kind': 'image', 'albums': []}, len(data), hashlib.sha256(data).hexdigest())
        self.store.resource_chunk(self.alice, resource['id'], 0, data)
        self.store.finish_resource(self.alice, resource['id'])
        link(self.store, self.alice, self.group)
        discord = self.store.create_source(self.alice, self.group, 'discord', 'Lake', {
            'guild': '10', 'channels': ['20'], 'start': '2024-01-01', 'end': '2024-12-31'})
        self.store.set_source(self.alice, discord, True, 'authorized')
        client = FakeDiscord()
        client.attachment = lambda attachment: gps_picture('yellow')
        client.messages = paged([message(1, 'Look', attachments=[1])])
        self.store.discord_authorize = client.authorize
        poll_source(self.store, self.alice, discord, client)
        while self.store.work_once():
            pass
        points = self.store.places(self.ben, self.group)['points']
        self.assertEqual(sorted((p['city'], p['day'] or '') for p in points), [('Istanbul', ''), ('Istanbul', '2024-05-06')])
        self.assertEqual([self.place(p['asset_id']) for p in points], [ISTANBUL, ISTANBUL])

    def test_removed_pin_stays_removed_until_the_contributor_shares_again(self):
        [first] = self.import_zip({'istanbul.jpg': gps_picture()})
        with self.assertRaises(Denied):
            self.store.set_place(self.ben, first['id'], None, None, None, None, None)
        self.store.set_place(self.alice, first['id'], None, None, None, None, None)
        self.assertEqual(backfill(self.store), {'pinned': 0, 'existing': 0, 'removed': 1, 'no_fix': 0, 'no_city': 0})
        with self.store.transaction():
            self.assertEqual(self.store.share_gps(first['id']), 'removed')
        [again] = self.import_zip({'copy-of-istanbul.jpg': gps_picture()})
        self.assertNotEqual(again['id'], first['id'])
        self.assertEqual(again['asset_id'], first['asset_id'])
        self.assertIsNone(self.place(first['asset_id']))
        self.store.set_place(self.alice, again['id'], 'TR', 'Istanbul', 41.1069, 29.0081, None)
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM place_removals').fetchone()[0], 0)
        self.assertEqual(self.place(first['asset_id']), ISTANBUL)

    def test_backfill_pins_earlier_imports_once(self):
        origins = self.import_zip({'istanbul.jpg': gps_picture(), 'plain.jpg': self.plain()})
        self.store.db.execute('DELETE FROM shared_places')
        self.store.db.commit()
        self.assertEqual(backfill(self.store, batch=1), {'pinned': 1, 'existing': 0, 'removed': 0, 'no_fix': 1, 'no_city': 0})
        self.assertEqual(backfill(self.store), {'pinned': 0, 'existing': 1, 'removed': 0, 'no_fix': 1, 'no_city': 0})
        self.assertEqual(len(origins), 2)

    @staticmethod
    def plain():
        output = io.BytesIO()
        Image.new('RGB', (8, 8), 'white').save(output, 'JPEG')
        return output.getvalue()


class PlaceRemovalSchemaTests(unittest.TestCase):
    def test_hosted_migration_matches_local_table(self):
        table = re.compile(r'CREATE TABLE IF NOT EXISTS place_removals \(.*?\);', re.S)
        self.assertEqual(table.search(MIGRATION.read_text()).group(), table.search(SCHEMA).group())
        self.assertIn('CREATE POLICY runtime_access ON place_removals TO mazi_app', MIGRATION.read_text())
