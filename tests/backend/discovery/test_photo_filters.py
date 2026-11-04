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

    def test_all_predicates_share_a_child_and_modes_pagination_agree(self):
        import json
        first, second = self.assets
        for asset, city in ((first, 'Paris'), (second, 'Istanbul')):
            self.store.correct_asset(self.alice, asset, title='Same words', capture_date='2020-01-02' if asset == first else '2021-01-02', place=city)
            row = self.store.db.execute('SELECT id,run_id,payload FROM archive_origins WHERE asset_id=?', (asset,)).fetchone()
            payload = json.loads(row['payload'])
            payload['sender'] = {'label': 'Doe, Ana' if asset == first else 'Ben'}
            self.store.db.execute('UPDATE archive_origins SET payload=? WHERE id=?', (json.dumps(payload), row['id']))
            self.store.db.execute('UPDATE import_runs SET source=? WHERE id=?', ('discord' if asset == first else 'apple', row['run_id']))
            self.store.db.commit()
        labels.set_labels(self.store, self.alice, self.group, 'combined', [dict(asset=second, changes={'screenshot': 'yes'}, expected={'screenshot': 0})])
        for mode in ('keyword', 'semantic'):
            self.assertEqual(self.store.search(self.alice, self.group, mode=mode, screenshot='yes', years='2020')['total'], 0)
            self.assertEqual(self.store.search(self.alice, self.group, mode=mode, screenshot='yes', places='["Paris"]')['total'], 0)
            self.assertEqual(self.store.search(self.alice, self.group, mode=mode, screenshot='yes', source='discord')['total'], 0)
            self.assertEqual(self.store.search(self.alice, self.group, mode=mode, screenshot='yes', shared_by='["Doe, Ana"]')['total'], 0)
            result = self.store.search(self.alice, self.group, mode=mode, source='discord,apple', limit=1)
            self.assertEqual((result['total'], len(result['items']), result['next_offset']), (2, 1, 1))
            self.assertEqual(self.store.search(self.alice, self.group, mode=mode, source='discord,apple', offset=1, limit=1)['next_offset'], None)
        match = self.store.photo_matches(self.alice, self.group, screenshot='yes', years='2021', places='["istanbul"]', source='apple', shared_by='Ben', start='2021-01-02', end='2021-01-02', date_basis='capture')
        self.assertEqual(match['asset_ids'], [second])
        self.assertEqual(sum(item['count'] for item in match['facets']['sources']), 2)

    def test_visibility_suppression_and_bad_inputs(self):
        first = self.assets[0]
        person = self.store.create_person(self.alice, self.group, 'Ben')
        self.store.propose_identity(self.alice, person, self.ben)
        self.store.confirm_identity(self.ben, person)
        self.store.tag(self.alice, person, first, True)
        self.assertEqual(self.store.photo_matches(self.ben, self.group, person=person)['total'], 1)
        self.store.disassociate(self.ben, person, first)
        result = self.store.photo_matches(self.ben, self.group, person=person)
        self.assertEqual((result['total'], result['photo_facets']['person']), (0, []))
        self.store.hide(self.ben, first, True)
        self.assertEqual(self.store.photo_matches(self.ben, self.group)['photo_facets']['denominator'], 1)
        origin = self.store.db.execute('SELECT id FROM archive_origins WHERE asset_id=?', (self.assets[1],)).fetchone()[0]
        self.store.delete_origin(self.alice, origin)
        self.assertEqual(self.store.photo_matches(self.ben, self.group)['total'], 0)
        for values in ({'years': 'next'}, {'screenshot': 'maybe'}, {'shared_by': '[false]'}, {'people_present': 'yes,unknown,bogus'}, {'_all_ids': True}):
            with self.subTest(values=values), self.assertRaises(ValueError):
                self.store.search(self.alice, self.group, **values)


class PhotoFilterCapacityTests(unittest.TestCase):
    from tests.backend.archive import test_capacity as capacity_helpers
    setUp = capacity_helpers.ArchiveCapacityTests.setUp
    tearDown = capacity_helpers.ArchiveCapacityTests.tearDown
    seed_projection = capacity_helpers.ArchiveCapacityTests.seed_projection

    def test_large_match_ids_keep_exact_totals_and_constant_fact_queries(self):
        self.seed_projection(1001)
        labels.set_labels(self.store, self.alice, self.group, 'large-filters', [dict(asset=asset, changes={'ai': 'generated'}, expected={'ai': 0}) for asset in ('capacity-00000', 'capacity-01000')])
        statements = []
        self.store.db.set_trace_callback(statements.append)
        try:
            result = self.store.photo_matches(self.ben, self.group, ai='generated')
        finally:
            self.store.db.set_trace_callback(None)
        self.assertEqual(result['asset_ids'], ['capacity-00000', 'capacity-01000'])
        self.assertEqual((result['total'], result['photo_facets']['denominator']), (2, 1001))
        self.assertEqual(len([query for query in statements if query.startswith('SELECT l.asset_id,l.dimension,l.value')]), 1)
        self.assertEqual(len([query for query in statements if query.startswith('SELECT DISTINCT t.asset')]), 2)
