"""Photo chronology filters through both keyword and related search paths."""
import json
import unittest

from tests.backend.discovery.test_shared_by import SharedBySourceTests
from tests.backend.archive.test_capacity import ArchiveCapacityTests


class DateBasisTests(unittest.TestCase):
    submit = SharedBySourceTests.submit
    process = SharedBySourceTests.process
    setUp = SharedBySourceTests.setUp
    tearDown = SharedBySourceTests.tearDown

    def discord_asset(self):
        return self.store.search(self.alice, self.group, source='discord')['items'][0]['id']

    def set_evidence(self, asset, captures=(), share='2024-02-03T00:30:00+00:00'):
        with self.store.transaction():
            for row in self.store.db.execute('SELECT id,payload FROM archive_origins WHERE asset_id=?', (asset,)).fetchall():
                payload = json.loads(row['payload'])
                payload['capture_assertions'] = [dict(local=day) for day in captures]
                payload['shared_at_assertion'] = dict(raw=share, source='discord_message')
                self.store.db.execute('UPDATE archive_origins SET payload=? WHERE id=?', (json.dumps(payload), row['id']))

    def test_explicit_sharing_and_chronology_find_a_sharing_only_discord_photo(self):
        asset = self.discord_asset()
        self.set_evidence(asset)
        before = [tuple(row) for row in self.store.db.execute('SELECT id,fingerprint,payload FROM archive_origins ORDER BY id')]
        for mode in ('keyword', 'semantic'):
            with self.subTest(mode=mode):
                filters = dict(mode=mode, source='discord', start='2024-02-03', end='2024-02-03')
                self.assertEqual(self.store.search(self.alice, self.group, **filters)['total'], 0)
                for basis in ('shared', 'chronology'):
                    result = self.store.search(self.alice, self.group, date_basis=basis, **filters)
                    self.assertEqual([item['id'] for item in result['items']], [asset])
                    self.assertEqual(result['items'][0]['evidence']['chronology']['start'], '2024-02-03')
        self.assertEqual(before, [tuple(row) for row in self.store.db.execute('SELECT id,fingerprint,payload FROM archive_origins ORDER BY id')])

    def test_conflicting_capture_evidence_matches_real_days_but_not_the_gap(self):
        asset = self.discord_asset()
        self.set_evidence(asset, ['2020-01-02T23:30:00-03:00', '2020-01-04T00:30:00+03:00'])
        for mode in ('keyword', 'semantic'):
            for basis in ('capture', 'chronology'):
                for day, expected in [('2020-01-02', 1), ('2020-01-03', 0), ('2020-01-04', 1)]:
                    with self.subTest(mode=mode, basis=basis, day=day):
                        result = self.store.search(self.alice, self.group, mode=mode, source='discord', date_basis=basis, start=day, end=day)
                        self.assertEqual(result['total'], expected)

    def test_shared_basis_matches_any_reliable_origin_but_chronology_uses_the_earliest(self):
        asset = self.discord_asset()
        self.set_evidence(asset, share='2024-02-03T23:30:00-03:00')
        row = self.store.db.execute('SELECT * FROM archive_origins WHERE asset_id=?', (asset,)).fetchone()
        payload = json.loads(row['payload'])
        payload['shared_at_assertion'] = dict(raw='2024-02-08T00:30:00+03:00')
        with self.store.transaction():
            self.store.db.execute('INSERT INTO archive_origins VALUES(?,?,?,?,?,?,?,?,0)', ('later-sharing-origin', asset, self.group, self.ben, row['run_id'], 'later', 'synthetic-later', json.dumps(payload)))
        for mode in ('keyword', 'semantic'):
            filters = dict(mode=mode, source='discord', start='2024-02-08', end='2024-02-08')
            self.assertEqual(self.store.search(self.alice, self.group, date_basis='shared', **filters)['total'], 1)
            self.assertEqual(self.store.search(self.alice, self.group, date_basis='chronology', **filters)['total'], 0)

    def test_streamed_search_applies_the_same_photo_evidence_without_loading_atlas(self):
        ArchiveCapacityTests.seed_projection(self, 1001)
        self.set_evidence('capacity-00000', share='2024-02-03T00:30:00+00:00')
        for mode in ('keyword', 'semantic'):
            result = self.store.search(self.alice, self.group, mode=mode, date_basis='chronology', start='2024-02-03', end='2024-02-03')
            self.assertEqual([item['id'] for item in result['items']], ['capacity-00000', self.discord_asset()])

    def test_invalid_date_basis_is_rejected(self):
        with self.assertRaises(ValueError):
            self.store.search(self.alice, self.group, date_basis='upload')
