import unittest
from tests.backend import test_atlas
from mazi.social import labels


class PhotoFilterTests(unittest.TestCase):
    setUp = test_atlas.AtlasTests.setUp
    tearDown = test_atlas.AtlasTests.tearDown

    def test_same_photo_and_or_unknown_and_full_visible_denominator(self):
        first, second = self.assets
        person = self.store.create_person(self.alice, self.group, 'Ayşe')
        self.store.tag(self.alice, person, first, True)
        labels.set_labels(self.store, self.alice, self.group, 'filters', [dict(asset=second, changes={'screenshot': 'yes', 'ai': 'generated'}, expected={'screenshot': 0, 'ai': 0})])
        self.store.review_event(self.alice, self.group, self.assets, 'Together', 'accept')
        self.assertEqual(self.store.search(self.alice, self.group, person=person, screenshot='yes')['total'], 0)
        result = self.store.search(self.alice, self.group, screenshot='yes,no', ai='generated')
        self.assertEqual([item['assetId'] for item in result['items']], [second])
        self.assertEqual(result['photo_facets']['denominator'], 2)
        self.assertEqual(self.store.search(self.alice, self.group, screenshot='unknown')['total'], 1)
        self.assertEqual(self.store.photo_matches(self.alice, self.group, person=person, screenshot='yes')['asset_ids'], [])
        with self.assertRaises(ValueError):
            self.store.search(self.alice, self.group, ai='probably')
