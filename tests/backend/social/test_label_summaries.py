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

    def test_presence_suppression_and_actor_departure_are_current(self):
        first = self.assets[0]
        person = self.store.create_person(self.alice, self.group, 'Ben')
        self.store.propose_identity(self.alice, person, self.ben)
        self.store.confirm_identity(self.ben, person)
        self.store.tag(self.alice, person, first, True)
        def summary():
            return next(photo for card in atlas_view(self.store, self.alice, self.group)['memories'] for photo in card['photos'] if photo['assetId'] == first).get('labels', {})
        self.assertEqual(summary(), {'people_present': 'yes'})
        self.store.disassociate(self.ben, person, first)
        self.assertEqual(summary(), {})
        labels.set_labels(self.store, self.ben, self.group, 'actor-label', [dict(asset=first, changes={'screenshot': 'yes'}, expected={'screenshot': 0})])
        self.assertEqual(summary(), {'screenshot': 'yes'})
        self.store.remove_member(self.alice, self.group, self.ben)
        self.assertEqual(summary(), {})

    def test_hidden_and_withdrawn_photos_never_project_labels(self):
        first = self.assets[0]
        labels.set_labels(self.store, self.alice, self.group, 'visible-label', [dict(asset=first, changes={'ai': 'generated'}, expected={'ai': 0})])
        self.store.hide(self.ben, first, True)
        self.assertNotIn(first, {photo['assetId'] for card in atlas_view(self.store, self.ben, self.group)['memories'] for photo in card['photos']})
        origin = self.store.db.execute('SELECT id FROM archive_origins WHERE asset_id=?', (first,)).fetchone()[0]
        self.store.delete_origin(self.alice, origin)
        self.assertNotIn(first, {item['assetId'] for item in self.store.search(self.alice, self.group)['items']})
