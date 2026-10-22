"""Completed photograph copies above the ordinary browsing boundary."""
import hashlib
import json
import unittest
import zipfile

from mazi.capacity import CapacityExceeded
from mazi.memories.memories import MemoryStore
from tests.backend.imports import test_engine as helpers


class ExportCapacityTests(unittest.TestCase):
    submit = helpers.EngineTests.submit
    process = helpers.EngineTests.process

    def setUp(self):
        helpers.EngineTests.setUp(self)
        self.store.close()
        self.store = MemoryStore(self.temp.name)
        self.run = self.submit()
        self.process(self.run)
        self.asset = self.store.gallery(self.alice, self.group)[0]['id']

    def tearDown(self):
        helpers.EngineTests.tearDown(self)

    def seed(self, count):
        asset = dict(self.store.db.execute('SELECT * FROM archive_assets WHERE id=?', (self.asset,)).fetchone())
        origin = dict(self.store.db.execute('SELECT * FROM archive_origins WHERE asset_id=?', (self.asset,)).fetchone())
        for number in range(count - 1):
            identifier = f'export-{number:05d}'
            data = helpers.picture() + str(number).encode()
            self.store.objects.retain("archive-objects", identifier, data)
            values = dict(asset, id=identifier, sha256=hashlib.sha256(data).hexdigest(), original_key=identifier, size=len(data))
            self.store.db.execute('INSERT INTO archive_assets VALUES(?,?,?,?,?,?,?,?,?)', tuple(values.values()))
            values = dict(origin, id='origin-' + identifier, asset_id=identifier, occurrence=identifier)
            self.store.db.execute('INSERT INTO archive_origins VALUES(?,?,?,?,?,?,?,?,?)', tuple(values.values()))
        self.store.db.commit()

    def test_ten_thousand_originals_and_manifest_records_are_complete(self):
        self.seed(10000)
        with self.store.export_archive_file(self.ben, self.group) as output:
            with zipfile.ZipFile(output) as archive:
                assets = json.loads(archive.read('manifest.json'))['assets']
                self.assertEqual(len(assets), 10000)
                self.assertEqual(len([name for name in archive.namelist() if name.startswith('originals/')]), 10000)
                self.assertEqual(archive.read('originals/export-09998'), helpers.picture() + b'9998')
                self.assertEqual(assets[0]['origins'][0]['original_filename'], 'red.jpg')

    def test_ten_thousand_and_one_has_an_explicit_photo_boundary(self):
        self.seed(10001)
        with self.assertRaisesRegex(CapacityExceeded, '10,000 photographs'):
            with self.store.export_archive_file(self.ben, self.group):
                self.fail('Over-capacity copy admitted')


if __name__ == '__main__':
    unittest.main()
