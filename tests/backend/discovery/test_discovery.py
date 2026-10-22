import io
import json
import sys
import tempfile
import unittest
import zipfile
from unittest.mock import patch
from pathlib import Path

from PIL import Image
from mazi.identity.core import Conflict, Denied
from mazi.discovery.discovery import DiscoveryStore
from tests.backend.imports import test_engine as helpers


class DiscoveryTests(unittest.TestCase):
    submit = helpers.EngineTests.submit
    process = helpers.EngineTests.process

    def setUp(self):
        helpers.EngineTests.setUp(self)
        self.store.close()
        self.store = DiscoveryStore(self.temp.name)
        self.run = self.submit({'holiday.jpg': helpers.picture()})
        self.process(self.run)
        self.asset = self.store.gallery(self.alice, self.group)[0]['id']
        self.store.correct_asset(self.alice, self.asset, title='A bicycle beside the sea', capture_date='2020-01-02', place='Amsterdam')

    def tearDown(self):
        helpers.EngineTests.tearDown(self)

    def enable(self):
        self.store.processing(self.alice, self.group, True, group_wide=True)
        self.store.processing(self.alice, self.group, True)

    def person(self):
        person = self.store.create_person(self.alice, self.group, 'Ben')
        self.store.propose_identity(self.alice, person, self.ben)
        self.store.confirm_identity(self.ben, person)
        self.store.tag(self.alice, person, self.asset, True)
        return person

    def test_defaults_keyword_fallback_and_versioned_multimodal_index(self):
        self.assertEqual(self.store.search(self.ben, self.group, query='bicycle')['total'], 1)
        self.assertEqual(self.store.search(self.ben, self.group, query='bike')['total'], 0)
        self.enable()
        result = self.store.search(self.ben, self.group, query='bike', mode='semantic')
        self.assertEqual(result['total'], 1)
        rows = self.store.db.execute('SELECT modality,version,dimensions FROM discovery_vectors').fetchall()
        self.assertEqual({r['modality'] for r in rows}, {'text', 'visual'})
        self.assertTrue(all(r['version'] and r['dimensions'] > 0 for r in rows))
        self.assertEqual(self.store.search(self.ben, self.group, query='red', mode='semantic')['total'], 1)
        self.store.processing(self.alice, self.group, False)
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM discovery_vectors').fetchone()[0], 0)
        self.assertEqual(self.store.search(self.ben, self.group, query='bike', mode='semantic')['total'], 0)
        self.assertEqual(self.store.search(self.ben, self.group, query='bicycle', mode='semantic')['total'], 1)

    def test_person_filters_identity_and_suppression_survive_retag_restart(self):
        person = self.person()
        result = self.store.search(self.ben, self.group, person=person, place='amsterdam', object_query='bicycle', start='2020-01-01', end='2020-12-31', source='manual')
        self.assertEqual(result['total'], 1)
        with self.assertRaises(Denied):
            self.store.disassociate(self.alice, person, self.asset)
        self.store.disassociate(self.ben, person, self.asset)
        self.assertEqual(self.store.people(self.alice, self.group), [])
        self.assertEqual(self.store.search(self.alice, self.group, person=person)['total'], 0)
        with self.assertRaises(Conflict):
            self.store.tag(self.alice, person, self.asset, True)
        self.store.close()
        self.store = DiscoveryStore(self.temp.name)
        with self.assertRaises(Conflict):
            self.store.tag(self.alice, person, self.asset, True)
        self.store.restore_association(self.ben, person, self.asset)
        self.assertEqual(self.store.search(self.ben, self.group, person=person)['total'], 1)
        self.assertTrue(self.store.asset_bytes(self.alice, self.asset))

    def test_no_unilateral_or_cross_group_identity_binding(self):
        person = self.store.create_person(self.alice, self.group, 'Ben')
        with self.assertRaises(Denied):
            self.store.propose_identity(self.ben, person, self.alice)
        self.store.propose_identity(self.alice, person, self.ben)
        with self.assertRaises(Denied):
            self.store.confirm_identity(self.alice, person)
        self.store.confirm_identity(self.ben, person)
        with self.assertRaises(Conflict):
            self.store.propose_identity(self.alice, person, self.alice)
        with self.assertRaises(Denied):
            self.store.propose_identity(self.alice, person, self.outsider)

    def test_personal_hide_across_discovery_and_export_and_unhide(self):
        person = self.person()
        origin = self.store.owned_origins(self.alice, self.group)[0]['id']
        self.store.set_place(self.alice, origin, 'NL', 'Amsterdam', 52.3, 4.9, '2020-01-02')
        self.store.hide(self.ben, self.asset, True)
        self.assertEqual(self.store.search(self.ben, self.group)['total'], 0)
        self.assertEqual(self.store.timeline(self.ben, self.group)['total'], 0)
        self.assertEqual(self.store.gallery(self.ben, self.group), [])
        self.assertEqual(self.store.people(self.ben, self.group), [])
        self.assertEqual(self.store.places(self.ben, self.group)['countries'], [])
        with zipfile.ZipFile(io.BytesIO(self.store.export_archive(self.ben, self.group))) as archive:
            self.assertEqual(json.loads(archive.read('people.json')), [])
            self.assertEqual(json.loads(archive.read('manifest.json'))['assets'], [])
        self.assertEqual(self.store.search(self.alice, self.group)['total'], 1)
        self.assertTrue(self.store.asset_bytes(self.ben, self.asset))
        hidden = self.store.hidden(self.ben, self.group)
        self.assertEqual(len(hidden), 1)
        self.assertEqual(hidden[0]['title'], 'A bicycle beside the sea')
        self.store.hide(self.ben, self.asset, False)
        self.assertEqual(self.store.search(self.ben, self.group, person=person)['total'], 1)

    def test_withdrawal_member_removal_and_stale_vectors_fail_closed(self):
        self.enable()
        self.store.search(self.ben, self.group, query='bike', mode='semantic')
        with self.assertRaises(Denied):
            self.store.search(self.outsider, self.group, query='bike', mode='semantic')
        with self.assertRaises(Denied):
            self.store.processing(self.ben, self.group, False, group_wide=True)
        self.store.withdraw(self.alice, self.run)
        self.assertEqual(self.store.search(self.ben, self.group, query='bike', mode='semantic')['total'], 0)
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM discovery_vectors').fetchone()[0], 0)
        self.store.remove_member(self.alice, self.group, self.ben)
        with self.assertRaises(Denied):
            self.store.search(self.ben, self.group)

    def test_corrections_rebuild_and_unknown_versions_never_mix(self):
        self.enable()
        self.store.search(self.ben, self.group, query='bike', mode='semantic')
        self.store.db.execute("UPDATE discovery_vectors SET version='obsolete'")
        self.store.db.commit()
        self.store.correct_asset(self.alice, self.asset, title='Dog in garden', capture_date=None, place='')
        self.assertEqual(self.store.search(self.ben, self.group, query='bike', mode='semantic')['total'], 0)
        self.assertEqual(self.store.search(self.ben, self.group, query='puppy', mode='semantic')['total'], 1)
        self.assertFalse(self.store.db.execute("SELECT 1 FROM discovery_vectors WHERE version='obsolete'").fetchone())

    def test_independent_copy_does_not_keep_withdrawn_context_or_tags(self):
        person = self.person()
        other = self.submit({'independent.jpg': helpers.picture()}, user=self.ben)
        self.process(other, self.ben)
        self.store.leave_group(self.ben, self.group)
        self.assertEqual(self.store.people(self.alice, self.group), [])
        self.assertEqual(self.store.search(self.alice, self.group)['total'], 1)
        self.store.accept(self.ben, self.store.invite(self.alice, self.group))
        self.assertEqual(self.store.people(self.alice, self.group), [])

    def test_validation_and_face_recognition_stays_off(self):
        for fields in [{'mode':'face'}, {'start':'yesterday'}, {'limit':10000}, {'query':[]}, {'start':'2022-01-01','end':'2021-01-01'}]:
            with self.assertRaises(ValueError):
                self.store.search(self.alice, self.group, **fields)
        self.assertFalse(self.store.settings(self.alice, self.group)['recognition'])
        with self.assertRaises(ValueError):
            self.store.processing(self.alice, self.group, 'true')

    def test_private_nonmember_review_and_opt_back_in(self):
        person = self.store.create_person(self.alice, self.group, 'Nonmember')
        self.store.tag(self.ben, person, self.asset, True)
        with self.assertRaises(Denied):
            self.store.nonmember_review(self.ben, person, self.asset, True)
        with self.assertRaises(ValueError):
            self.store.nonmember_review(self.alice, person, self.asset, False)
        self.store.nonmember_review(self.alice, person, self.asset, True)
        with self.assertRaises(Conflict):
            self.store.tag(self.ben, person, self.asset, True)
        self.store.nonmember_review(self.alice, person, self.asset, True, restore=True)
        self.assertEqual(self.store.search(self.ben, self.group, person=person)['total'], 1)

    def test_memory_hiding_and_backup_preserve_suppression(self):
        from mazi.archive.ops import create_backup, restore_backup
        second = io.BytesIO()
        Image.new('RGB', (8, 8), 'blue').save(second, 'JPEG')
        run = self.submit({'blue.jpg':second.getvalue()})
        self.process(run)
        ids = [r['id'] for r in self.store.gallery(self.alice, self.group)]
        event = self.store.review_event(self.alice, self.group, ids, 'Our trip', 'accept')
        self.store.hide_event(self.ben, self.group, event, True)
        self.assertEqual(self.store.accepted_events(self.ben, self.group), [])
        self.assertEqual(len(self.store.accepted_events(self.alice, self.group)), 1)
        person = self.person()
        self.store.disassociate(self.ben, person, self.asset)
        with tempfile.TemporaryDirectory() as root:
            backup, restored = Path(root)/'backup', Path(root)/'restored'
            create_backup(self.temp.name, backup)
            restore_backup(backup, restored)
            copy = DiscoveryStore(restored)
            try:
                self.assertEqual(copy.accepted_events(self.ben, self.group), [])
                with self.assertRaises(Conflict):
                    copy.tag(self.alice, person, self.asset, True)
            finally:
                copy.close()
        self.store.hide_event(self.ben, self.group, event, False)
        self.assertEqual(len(self.store.accepted_events(self.ben, self.group)), 1)

    def test_similar_search_falls_back_to_keywords_when_semantic_search_is_unavailable(self):
        result = self.store.search(self.alice, self.group, query='bicycle', mode='semantic', similar=self.asset)
        self.assertEqual(result['total'], 1)
        self.assertEqual(result['mode'], 'keyword / filters')
        self.enable()
        self.store.processing(self.alice, self.group, False)
        self.assertEqual(self.store.search(self.ben, self.group, query='bicycle', mode='semantic', similar=self.asset)['total'], 1)

    def test_private_review_survives_identity_confirmation(self):
        person = self.store.create_person(self.alice, self.group, 'Later member')
        self.store.tag(self.alice, person, self.asset, True)
        self.store.nonmember_review(self.alice, person, self.asset, True)
        self.store.propose_identity(self.alice, person, self.ben)
        self.store.confirm_identity(self.ben, person)
        self.assertEqual(len(self.store.suppressed(self.ben, self.group)), 1)
        self.store.restore_association(self.ben, person, self.asset)
        self.assertEqual(self.store.search(self.ben, self.group, person=person)['total'], 1)

    def test_departed_identity_cannot_be_tagged_until_they_rejoin(self):
        person = self.person()
        self.store.leave_group(self.ben, self.group)
        with self.assertRaises(Denied):
            self.store.tag(self.alice, person, self.asset, True)
        self.store.accept(self.ben, self.store.invite(self.alice, self.group))
        self.assertEqual(self.store.people(self.alice, self.group), [])

    def test_personal_hides_do_not_count_toward_the_map_limit(self):
        origin = self.store.db.execute('SELECT * FROM archive_origins WHERE asset_id=?', (self.asset,)).fetchone()
        for index in range(1001):
            identifier = f'extra-origin-{index}'
            self.store.db.execute('INSERT INTO archive_origins VALUES(?,?,?,?,?,?,?,?,0)',
                (identifier, origin['asset_id'], origin['group_id'], origin['owner_id'], origin['run_id'], identifier, origin['fingerprint'], origin['payload']))
            self.store.db.execute('INSERT INTO shared_places VALUES(?,?,?,?,?,?)', (identifier, 'NL', 'Amsterdam', 52.3, 4.9, '2020-01-02'))
        self.store.db.commit()
        self.store.hide(self.ben, self.asset, True)
        self.assertEqual(self.store.places(self.ben, self.group)['points'], [])
        self.store.export_archive(self.ben, self.group)
        self.assertEqual(len(self.store.places(self.alice, self.group)['points']), 1001)

    def test_image_reference_consent_and_cross_group_denial(self):
        self.enable()
        other = io.BytesIO()
        Image.new('RGB', (9, 9), 'red').save(other, 'JPEG')
        run = self.submit({'second.jpg':other.getvalue()})
        self.process(run)
        # JPEG encoder may generate distinct bytes; ensure there is a second identity.
        self.assertEqual(len(self.store.gallery(self.alice, self.group)), 2)
        self.assertEqual(self.store.search(self.alice, self.group, mode='semantic', similar=self.asset)['total'], 1)
        self.store.hide(self.ben, self.asset, True)
        with self.assertRaises(Denied):
            self.store.search(self.ben, self.group, mode='semantic', similar=self.asset)
        other_group = self.store.create_group(self.outsider, 'Other')
        person = self.store.create_person(self.outsider, other_group, 'Hidden person')
        with self.assertRaises(Denied):
            self.store.tag(self.alice, person, self.asset, True)
        self.assertEqual(self.store.search(self.alice, self.group, person=person)['total'], 0)

    def test_withdraw_one_origin_invalidates_index_even_with_independent_copy(self):
        other = self.submit({'independent.jpg': helpers.picture()}, user=self.ben)
        self.process(other, self.ben)
        self.enable()
        self.store.processing(self.ben, self.group, True)
        rows = self.store.db.execute('SELECT id,payload FROM archive_origins WHERE owner_id=?', (self.alice,)).fetchall()
        for row in rows:
            payload = json.loads(row['payload'])
            payload['context'] = [{'text':'confidentialword'}]
            self.store.db.execute('UPDATE archive_origins SET payload=? WHERE id=?', (json.dumps(payload),row['id']))
        self.store.db.commit()
        self.assertEqual(self.store.search(self.ben, self.group, query='confidentialword', mode='semantic')['total'], 1)
        self.store.withdraw(self.alice, self.run)
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM discovery_vectors').fetchone()[0], 0)
        self.assertEqual(self.store.search(self.ben, self.group, query='confidentialword', mode='semantic')['total'], 0)
        self.assertEqual(self.store.search(self.ben, self.group)['total'], 1)

    def test_departure_trigger_also_applies_to_older_server_and_rejoin(self):
        from mazi.sources.sources import SourceStore
        person = self.person()
        self.enable()
        self.store.search(self.ben, self.group, query='bike', mode='semantic')
        old_server = SourceStore(self.temp.name)
        try:
            old_server.remove_member(self.alice, self.group, self.ben)
            old_server.accept(self.ben, old_server.invite(self.alice, self.group))
        finally:
            old_server.close()
        self.assertEqual(self.store.people(self.alice, self.group), [])
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM discovery_vectors').fetchone()[0], 0)

    def test_preview_authorization_queries_are_bounded_before_storage(self):
        from tests.backend.archive.test_capacity import ArchiveCapacityTests
        counts = []
        for count in (1, 1001):
            if count > 1:
                ArchiveCapacityTests.seed_projection(self, count - 1)
            statements = []
            self.store.db.set_trace_callback(statements.append)
            try:
                def read(area, key):
                    self.assertFalse(self.store.db.in_transaction, 'Storage must run outside the policy transaction')
                    self.assertEqual(statements[-1], 'COMMIT')
                    return b'synthetic preview'
                with patch.object(self.store.objects, 'read', side_effect=read):
                    self.assertEqual(self.store.rendition_bytes(self.ben, self.asset), b'synthetic preview')
            finally:
                self.store.db.set_trace_callback(None)
            counts.append(sum(query.startswith('SELECT') for query in statements))
        self.assertEqual(counts, [5, 5])

    def test_denied_preview_never_reads_storage_and_keeps_shared_group_policy(self):
        with patch.object(self.store.objects, 'read') as read:
            with self.assertRaises(Denied):
                self.store.rendition_bytes(self.outsider, self.asset)
            self.store.hide(self.ben, self.asset, True)
            with self.assertRaises(Denied):
                self.store.rendition_bytes(self.ben, self.asset)
            self.store.hide(self.ben, self.asset, False)
            other = self.store.create_group(self.alice, 'Other group')
            self.store.setup_shared(admin_name='Alice', group_id=other, mappings={'Alice': self.alice})
            self.store.shared_mode = True
            with self.assertRaises(Denied):
                self.store.rendition_bytes(self.alice, self.asset)
            read.assert_not_called()

    def selected_preview(self):
        other = io.BytesIO()
        Image.new('RGB', (9, 9), 'red').save(other, 'JPEG')
        run = self.submit({'selected.jpg': other.getvalue()}, user=self.ben)
        self.process(run, self.ben)
        second = next(row['id'] for row in self.store.gallery(self.alice, self.group) if row['id'] != self.asset)
        self.store.review_pair(self.alice, self.group, self.asset, second, 'merge')
        self.store.select_rendition(self.alice, self.group, self.asset, second)
        return run, second

    def test_withdrawn_selected_preview_falls_back_without_archive_scan(self):
        run, _ = self.selected_preview()
        self.store.withdraw(self.ben, run)
        expected = self.store.asset_bytes(self.alice, self.asset)
        with patch.object(self.store, '_visible_ids', side_effect=AssertionError('Archive-wide preview lookup')):
            self.assertEqual(self.store.rendition_bytes(self.alice, self.asset), expected)

    def test_removed_selected_owner_preview_falls_back_without_archive_scan(self):
        self.selected_preview()
        self.store.remove_member(self.alice, self.group, self.ben)
        expected = self.store.asset_bytes(self.alice, self.asset)
        with patch.object(self.store, '_visible_ids', side_effect=AssertionError('Archive-wide preview lookup')):
            self.assertEqual(self.store.rendition_bytes(self.alice, self.asset), expected)

    def test_hidden_rendition_cannot_resurface_through_visible_duplicate(self):
        other = io.BytesIO()
        Image.new('RGB', (9, 9), 'red').save(other, 'JPEG')
        run = self.submit({'second.jpg':other.getvalue()})
        self.process(run)
        second = next(r['id'] for r in self.store.gallery(self.alice, self.group) if r['id'] != self.asset)
        self.store.review_pair(self.alice, self.group, self.asset, second, 'merge')
        self.store.select_rendition(self.alice, self.group, self.asset, second)
        self.store.hide(self.ben, second, True)
        self.assertEqual(self.store.rendition_bytes(self.ben, self.asset), self.store.asset_bytes(self.ben, self.asset))
        with self.assertRaises(Denied):
            self.store.rendition_bytes(self.ben, second)

    def test_filtered_ranking_fills_page_after_hides_and_never_uses_hidden_reference(self):
        files = {}
        for index in range(15):
            output = io.BytesIO()
            Image.new('RGB', (10 + index, 8), (index * 10, 80, 120)).save(output, 'PNG')
            files[f'canal-{index}.png'] = output.getvalue()
        run = self.submit(files)
        self.process(run)
        self.enable()
        ids = [r['id'] for r in self.store.gallery(self.alice, self.group)]
        for asset in ids[:5]:
            self.store.hide(self.ben, asset, True)
        result = self.store.search(self.ben, self.group, mode='semantic', limit=10)
        self.assertEqual(result['total'], 11)
        self.assertEqual(len(result['items']), 10)
        self.assertTrue(set(ids[:5]).isdisjoint(r['id'] for r in result['items']))
        self.assertEqual(result['next_offset'], 10)
        self.assertEqual(len(self.store.search(self.ben, self.group, offset=10, limit=10)['items']), 1)

    def test_contributor_consent_and_group_switch_purge_without_resurrection(self):
        self.enable()
        self.store.search(self.ben, self.group, query='bike', mode='semantic')
        self.store.processing(self.alice, self.group, False, group_wide=True)
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM discovery_vectors').fetchone()[0], 0)
        self.assertEqual(self.store.search(self.ben, self.group, query='bike', mode='semantic')['total'], 0)
        self.store.processing(self.alice, self.group, True, group_wide=True)
        self.assertEqual(self.store.search(self.ben, self.group, query='bike', mode='semantic')['total'], 1)
        duplicate = self.submit({'new-origin.jpg':helpers.picture()}, user=self.ben)
        self.process(duplicate, self.ben)
        self.assertEqual(self.store.search(self.alice, self.group, query='bike', mode='semantic')['total'], 0)
        self.store.processing(self.ben, self.group, True)
        self.assertEqual(self.store.search(self.alice, self.group, query='bike', mode='semantic')['total'], 1)

    def test_people_and_search_use_only_current_shared_places(self):
        person = self.person()
        origin = self.store.owned_origins(self.alice, self.group)[0]['id']
        self.store.set_place(self.alice, origin, 'TR', 'Istanbul', 41.01, 28.97, '2020-01-02')
        self.assertEqual(self.store.search(self.ben, self.group, person=person, place='istanbul', country='TR')['total'], 1)
        self.assertEqual(self.store.search(self.ben, self.group, person=person, country='NL')['total'], 0)
        self.assertIn('Istanbul', self.store.people(self.ben, self.group)[0]['places'])
        self.store.set_place(self.alice, origin, '', '', None, None, None)
        self.assertEqual(self.store.search(self.ben, self.group, place='istanbul')['total'], 0)
        self.assertNotIn('Istanbul', self.store.people(self.ben, self.group)[0]['places'])
