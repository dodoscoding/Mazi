import unittest
from tests.backend import test_atlas
from mazi.identity.core import Conflict, Denied


class PhotoCorrectionTests(unittest.TestCase):
    setUp = test_atlas.AtlasTests.setUp
    tearDown = test_atlas.AtlasTests.tearDown

    def test_patch_preserves_other_fields_and_sibling(self):
        first, sibling = self.assets
        self.store.correct_asset(self.alice, first, title='Keep', capture_date='2020-01-02', place='Harbour', anniversary=True)
        before = dict(self.store.db.execute('SELECT * FROM review_annotations WHERE asset_id=?', (sibling,)).fetchone())
        state = self.store.photo_correction(self.ben, self.group, first)
        self.store.patch_photo(self.ben, self.group, first, {'place': 'A private garden'}, state['snapshot'])
        row = self.store.db.execute('SELECT * FROM review_annotations WHERE asset_id=?', (first,)).fetchone()
        self.assertEqual((row['title'], row['capture_date'], row['anniversary'], row['place']), ('Keep', '2020-01-02', 1, 'A private garden'))
        self.assertEqual(before, dict(self.store.db.execute('SELECT * FROM review_annotations WHERE asset_id=?', (sibling,)).fetchone()))
        with self.assertRaises(Conflict):
            self.store.patch_photo(self.ben, self.group, first, {'place': ''}, state['snapshot'])
        fresh = self.store.photo_correction(self.ben, self.group, first)
        with self.assertRaises(ValueError):
            self.store.patch_photo(self.ben, self.group, first, {'capture_date': None}, fresh['snapshot'])

    def test_origin_change_and_access_are_checked(self):
        asset = self.assets[0]
        state = self.store.photo_correction(self.ben, self.group, asset)
        self.store.db.execute("UPDATE archive_origins SET fingerprint='changed' WHERE asset_id=?", (asset,))
        with self.assertRaises(Conflict):
            self.store.patch_photo(self.ben, self.group, asset, {'place': 'Paris'}, state['snapshot'])
        with self.assertRaises(Denied):
            self.store.photo_correction(self.outsider, self.group, asset)
        with self.assertRaises(ValueError):
            self.store.patch_photo(self.ben, self.group, asset, {'title': 'No'}, state['snapshot'])
