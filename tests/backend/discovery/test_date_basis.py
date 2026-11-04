"""Photo chronology filters through both keyword and related search paths."""
import json
import unittest

from tests.backend.discovery import test_shared_by as sharing_helpers
from tests.backend.archive import test_capacity as capacity_helpers


class DateBasisTests(unittest.TestCase):
    submit = sharing_helpers.SharedBySourceTests.submit
    process = sharing_helpers.SharedBySourceTests.process
    setUp = sharing_helpers.SharedBySourceTests.setUp
    tearDown = sharing_helpers.SharedBySourceTests.tearDown

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
        capacity_helpers.ArchiveCapacityTests.seed_projection(self, 1001)
        self.set_evidence('capacity-00000', share='2024-02-03T00:30:00+00:00')
        for mode in ('keyword', 'semantic'):
            result = self.store.search(self.alice, self.group, mode=mode, date_basis='chronology', start='2024-02-03', end='2024-02-03')
            self.assertEqual(sorted(item['id'] for item in result['items']), sorted(['capacity-00000', self.discord_asset()]))

    def test_invalid_date_basis_is_rejected(self):
        with self.assertRaises(ValueError):
            self.store.search(self.alice, self.group, date_basis='upload')

    def test_legacy_chat_day_order_uses_only_visible_evidence_from_the_same_import_and_conversation(self):
        rows = self.store.db.execute("SELECT id,asset_id,payload FROM archive_origins WHERE payload LIKE '%whatsapp%' ORDER BY id").fetchall()
        assets = {}
        with self.store.transaction():
            for row in rows:
                payload = json.loads(row['payload'])
                sender = payload['sender']['label']
                payload['shared_at_assertion'] = dict(raw='04/05/2024, 21:00' if sender == 'Ana' else '23/05/2024, 10:00')
                payload['conversation'] = dict(id='same-chat')
                payload['context'] = []
                assets[sender] = row['asset_id']
                self.store.db.execute('UPDATE archive_origins SET payload=? WHERE id=?', (json.dumps(payload), row['id']))
        filters = dict(shared_by='Ana', date_basis='chronology', start='2024-05-04', end='2024-05-04')
        for mode in ('keyword', 'semantic'):
            self.assertEqual(self.store.search(self.alice, self.group, mode=mode, **filters)['total'], 1)
        self.store.hide(self.alice, assets['Deniz'], True)
        self.assertEqual(self.store.search(self.alice, self.group, **filters)['total'], 0)
        item = self.store.search(self.alice, self.group, shared_by='Ana')['items'][0]
        self.assertEqual(item['evidence']['chronology']['status'], 'ambiguous')
        self.store.hide(self.alice, assets['Deniz'], False)
        with self.store.transaction():
            row = self.store.db.execute('SELECT id,payload FROM archive_origins WHERE asset_id=?', (assets['Deniz'],)).fetchone()
            payload = json.loads(row['payload'])
            payload['conversation'] = dict(id='other-chat')
            self.store.db.execute('UPDATE archive_origins SET payload=? WHERE id=?', (json.dumps(payload), row['id']))
        self.assertEqual(self.store.search(self.alice, self.group, **filters)['total'], 0)

    def test_search_and_atlas_return_the_same_photo_evidence(self):
        from mazi.memories.memories import MemoryStore
        from mazi.atlas import atlas_view
        self.set_evidence(self.discord_asset())
        reader = MemoryStore(self.temp.name)
        try:
            expected = {photo['assetId']: photo['evidence'] for card in atlas_view(reader, self.alice, self.group)['memories'] for photo in card['photos']}
        finally:
            reader.close()
        for mode in ('keyword', 'semantic'):
            items = self.store.search(self.alice, self.group, mode=mode)['items']
            self.assertEqual({item['assetId']: item['evidence'] for item in items}, expected)

    def test_hidden_memory_children_stay_out_of_results_counts_and_share_day_proofs(self):
        assets = [row[0] for row in self.store.db.execute('SELECT id FROM archive_assets ORDER BY id')]
        event = self.store.review_event(self.alice, self.group, assets[:2], 'Hidden event', 'accept')
        self.store.hide_event(self.alice, self.group, event, True)
        for mode in ('keyword', 'semantic'):
            result = self.store.search(self.alice, self.group, mode=mode, date_basis='chronology')
            self.assertEqual([item['id'] for item in result['items']], assets[2:])
            self.assertEqual(sum(option['count'] for option in result['facets']['sources']), 1)
        self.assertEqual(len(self.store.search(self.ben, self.group)['items']), 3)

    def test_lazy_order_proof_counts_toward_the_same_request_budget(self):
        from unittest.mock import patch
        from mazi.capacity import CapacityExceeded
        from mazi.discovery import discovery
        capacity_helpers.ArchiveCapacityTests.seed_projection(self, 1001)
        self.set_evidence('capacity-00000', share='04/05/2024, 21:00')
        with patch.object(discovery, 'KEYWORD_REQUEST_BYTES', 10000):
            with self.assertRaisesRegex(CapacityExceeded, 'request limit'):
                self.store.search(self.alice, self.group, date_basis='chronology', limit=1)
        self.assertFalse(self.store.db.in_transaction)
        self.assertEqual(self.store.search(self.alice, self.group, date_basis='chronology')['total'], 1004)

    def test_explicit_range_bounds_are_inclusive_without_filling_conflict_gaps(self):
        from mazi.archive.photo_metadata import matches_dates
        item = dict(basis='capture', status='range', days=[], start='2020-01-02', through='2020-01-04', timezone=None)
        evidence = dict(capture=item, chronology=item, shared=[])
        for day, expected in [('2020-01-01', False), ('2020-01-02', True), ('2020-01-03', True), ('2020-01-04', True), ('2020-01-05', False)]:
            self.assertEqual(matches_dates(evidence, 'capture', day, day), expected)
        evidence['capture'] = {**item, 'status': 'conflict', 'days': ['2020-01-02', '2020-01-04']}
        self.assertFalse(matches_dates(evidence, 'capture', '2020-01-03', '2020-01-03'))
