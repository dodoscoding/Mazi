import json
import unittest

from mazi.atlas import atlas_view
from tests.backend import test_atlas


class ChronologyTests(unittest.TestCase):
    def setUp(self):
        self.fixture = test_atlas.AtlasTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.tearDown)
        self.store = self.fixture.store
        self.asset = self.fixture.assets[0]
        for asset in self.fixture.assets:
            self.store.correct_asset(self.fixture.alice, asset, title='', capture_date=None, place='')

    def evidence(self, asset, dates, cities, origin_index=0):
        row = self.store.db.execute('SELECT id,payload FROM archive_origins WHERE asset_id=? ORDER BY id', (asset,)).fetchall()[origin_index]
        payload = json.loads(row['payload'])
        payload['capture_assertions'] = [{'local': day} for day in dates]
        payload['location_assertions'] = [{'city': city} for city in cities]
        self.store.db.execute('UPDATE archive_origins SET payload=? WHERE id=?', (json.dumps(payload), row['id']))
        self.store.db.commit()

    def item(self):
        return next(item for item in self.store.timeline(self.fixture.ben, self.fixture.group)['items'] if item['id'] == self.asset)

    def test_internal_date_conflict_is_an_approximate_atlas_range(self):
        self.evidence(self.asset, ['2020-01-02', '2021-01-02'], ['Utrecht'])
        self.assertIsNone(self.item()['date'])
        self.assertEqual(self.item()['date_basis'], 'conflicting source evidence')
        card = next(card for card in atlas_view(self.store, self.fixture.ben, self.fixture.group)['memories'] if card['id'] == 'photo-' + self.asset)
        self.assertEqual((card['date'], card['year'], card['approximate']), ('2020-01-02 to 2021-01-02', 2020, True))

    def test_invalid_first_assertion_does_not_hide_valid_evidence(self):
        self.evidence(self.asset, ['invalid', None, '2020-01-02'], [])
        self.assertEqual(self.item()['date'], '2020-01-02')

    def test_city_conflict_preserves_agreed_and_reviewed_dates(self):
        self.fixture._ben_copy_of_red()
        self.evidence(self.asset, ['2020-01-02'], ['Utrecht'], 0)
        self.evidence(self.asset, ['2020-01-02'], ['Paris'], 1)
        self.assertEqual(self.item()['date'], '2020-01-02')
        self.assertIsNone(self.item()['place'])
        self.assertEqual(self.item()['date_basis'], 'source capture evidence')
        self.store.correct_asset(self.fixture.alice, self.asset, title='', capture_date='2022-03-04', place='')
        self.assertEqual(self.item()['date'], '2022-03-04')
        self.assertEqual(self.item()['date_basis'], 'reviewed correction')

    def test_internal_conflict_survives_an_agreeing_second_origin_and_blocks_events(self):
        self.fixture._ben_copy_of_red()
        self.evidence(self.asset, ['2020-01-02', '2021-01-02'], ['Utrecht'], 0)
        self.evidence(self.asset, ['2020-01-02'], ['Utrecht'], 1)
        self.evidence(self.fixture.assets[1], ['2020-01-02'], ['Utrecht'])
        self.assertIsNone(self.item()['date'])
        self.assertEqual(self.item()['place'], 'utrecht')
        self.assertEqual(self.store.event_suggestions(self.fixture.ben, self.fixture.group), [])

    def test_missing_date_is_absence_and_internal_city_conflict_is_unknown(self):
        self.fixture._ben_copy_of_red()
        self.evidence(self.asset, [], [], 0)
        self.evidence(self.asset, ['2020-01-02'], ['Utrecht', 'Paris'], 1)
        self.assertEqual(self.item()['date'], '2020-01-02')
        self.assertIsNone(self.item()['place'])

    def test_withdrawal_removes_conflict_without_rewriting_surviving_evidence(self):
        self.fixture._ben_copy_of_red()
        self.evidence(self.asset, ['2020-01-02', '2021-01-02'], ['Utrecht', 'Paris'], 0)
        self.evidence(self.asset, ['2020-01-02'], ['Utrecht'], 1)
        self.evidence(self.fixture.assets[1], ['2020-01-02'], ['Utrecht'])
        rows = self.store.db.execute('SELECT id,owner_id,payload FROM archive_origins WHERE asset_id=? ORDER BY id', (self.asset,)).fetchall()
        self.assertEqual(self.store.event_suggestions(self.fixture.ben, self.fixture.group), [])
        self.store.delete_origin(rows[0]['owner_id'], rows[0]['id'])
        self.assertEqual(self.item()['date'], '2020-01-02')
        self.assertEqual(self.item()['place'], 'utrecht')
        self.assertEqual(len(self.store.event_suggestions(self.fixture.ben, self.fixture.group)), 1)
        surviving = self.store.db.execute('SELECT payload FROM archive_origins WHERE id=?', (rows[1]['id'],)).fetchone()[0]
        self.assertEqual(surviving, rows[1]['payload'])

    def test_reviewed_date_and_place_override_internal_conflicts_without_rewriting_them(self):
        self.evidence(self.asset, ['2020-01-02', '2021-01-02'], ['Utrecht', 'Paris'])
        self.evidence(self.fixture.assets[1], ['2022-03-04'], ['London'])
        raw = self.store.db.execute('SELECT payload FROM archive_origins WHERE asset_id=?', (self.asset,)).fetchone()[0]
        self.store.correct_asset(self.fixture.alice, self.asset, title='', capture_date='2022-03-04', place='London')
        self.assertEqual((self.item()['date'], self.item()['place']), ('2022-03-04', 'london'))
        self.assertEqual(len(self.store.event_suggestions(self.fixture.ben, self.fixture.group)), 1)
        self.assertEqual(self.store.db.execute('SELECT payload FROM archive_origins WHERE asset_id=?', (self.asset,)).fetchone()[0], raw)

    def test_search_and_answer_evidence_share_independent_date_resolution(self):
        self.fixture._ben_copy_of_red()
        self.evidence(self.asset, ['2020-01-02'], ['Utrecht'], 0)
        self.evidence(self.asset, ['2020-01-02'], ['Paris'], 1)
        for user in [self.fixture.alice, self.fixture.ben]:
            self.store.processing(user, self.fixture.group, True)
            self.store.answer_processing(user, self.fixture.group, True)
        self.store.processing(self.fixture.alice, self.fixture.group, True, group_wide=True)
        self.store.answer_processing(self.fixture.alice, self.fixture.group, True, group_wide=True)
        result = self.store.search(self.fixture.ben, self.fixture.group, start='2020-01-02', end='2020-01-02')
        self.assertIn(self.asset, [item['id'] for item in result['items']])
        evidence = self.store.evidence(self.fixture.ben, self.fixture.group, self.asset)
        self.assertEqual(evidence['date'], '2020-01-02')
        self.assertEqual(evidence['place'], '')
