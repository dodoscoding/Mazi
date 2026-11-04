import unittest
from tests.backend import test_atlas
from mazi.atlas import atlas_view
from mazi.social import labels


class LabelSummaryTests(unittest.TestCase):
    setUp = test_atlas.AtlasTests.setUp
    tearDown = test_atlas.AtlasTests.tearDown

    def test_atlas_and_search_use_known_labels_without_unknown_payloads(self):
        first, second = self.assets
        labels.set_labels(self.store, self.ben, self.group, 'summary-first', [dict(asset=first, changes={'screenshot': 'yes', 'ai': 'edited'}, expected={'screenshot': 0, 'ai': 0})])
        photos = {photo['assetId']: photo for card in atlas_view(self.store, self.alice, self.group)['memories'] for photo in card['photos']}
        self.assertEqual(photos[first]['labels'], {'screenshot': 'yes', 'ai': 'edited'})
        self.assertNotIn('labels', photos[second])
        results = self.store.search(self.alice, self.group)
        self.assertEqual(next(item for item in results['items'] if item['assetId'] == first)['labels'], photos[first]['labels'])
