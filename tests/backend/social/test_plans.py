import concurrent.futures
import io
import json
import sqlite3
import tempfile
import threading
import unittest
import zipfile
from unittest.mock import patch

from mazi.identity.core import Conflict, Denied, Store
from mazi.memories.memories import MemoryStore
from mazi.social import social


class PlansFixture(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = MemoryStore(self.temp.name)
        self.alice = self.store.register('alice@example.test', 'correct horse battery')
        self.ben = self.store.register('ben@example.test', 'correct horse battery')
        self.other = self.store.register('other@example.test', 'correct horse battery')
        self.group = self.store.create_group(self.alice, 'Empty circle')
        self.store.accept(self.ben, self.store.invite(self.alice, self.group))
        self.other_group = self.store.create_group(self.other, 'Other circle')

    def tearDown(self):
        self.store.close()
        self.temp.cleanup()

    def create(self, user=None, key='first', **changes):
        data = dict(title='Saturday together', start_local='2030-06-01T18:00', timezone='Europe/Copenhagen',
                    place='Harbour', description='Bring a story')
        data.update(changes)
        return social.create_plan(self.store, user or self.alice, self.group, key, data)


class PlansTests(PlansFixture):
    def test_empty_archive_can_plan_and_two_members_can_respond(self):
        self.assertEqual(social.plans(self.store, self.ben, self.group)['items'], [])
        plan = self.create()
        self.assertEqual((plan['title'], plan['starts_at'], plan['start_offset'], plan['revision']),
                         ('Saturday together', '2030-06-01T16:00:00Z', '+02:00', 1))
        reply = social.set_attendance(self.store, self.ben, self.group, plan['id'], 'yes', 'join')
        self.assertEqual(reply['attendance'], dict(yes=1, maybe=0, no=0, mine='yes', revision=1))
        self.assertFalse(reply['editable'])
        self.assertEqual(social.get_plan(self.store, self.alice, self.group, plan['id'])['attendance']['yes'], 1)

    def test_create_replay_conflicts_and_deleted_result_cannot_resurrect(self):
        plan = self.create()
        self.assertEqual(self.create()['id'], plan['id'])
        with self.assertRaises(Conflict):
            self.create(title='Different')
        social.delete_plan(self.store, self.alice, self.group, plan['id'], 1, 'delete')
        self.assertEqual(self.create(), {'id': plan['id'], 'deleted': True})
        self.assertEqual(social.plans(self.store, self.alice, self.group, scope='all')['items'], [])
        self.assertEqual(social.delete_plan(self.store, self.alice, self.group, plan['id'], 1, 'delete'),
                         {'id': plan['id'], 'deleted': True})

    def test_edit_preserves_fields_uses_cas_and_replays_without_second_write(self):
        plan = self.create()
        edited = social.update_plan(self.store, self.alice, self.group, plan['id'], 1, 'edit', {'title': 'Sunday'})
        self.assertEqual((edited['title'], edited['place'], edited['description'], edited['revision']),
                         ('Sunday', 'Harbour', 'Bring a story', 2))
        self.assertEqual(social.update_plan(self.store, self.alice, self.group, plan['id'], 1, 'edit', {'title': 'Sunday'})['revision'], 2)
        with self.assertRaises(Conflict):
            social.update_plan(self.store, self.alice, self.group, plan['id'], 1, 'stale', {'place': 'Pier'})
        with self.assertRaises(Denied):
            social.update_plan(self.store, self.ben, self.group, plan['id'], 2, 'not-mine', {'title': 'Mine'})

    def test_attendance_is_desired_state_clearing_advances_revision_and_replay_is_safe(self):
        plan = self.create()
        first = social.set_attendance(self.store, self.ben, self.group, plan['id'], 'yes', 'yes')
        again = social.set_attendance(self.store, self.ben, self.group, plan['id'], 'yes', 'yes-again')
        self.assertEqual(again['attendance'], first['attendance'])
        cleared = social.set_attendance(self.store, self.ben, self.group, plan['id'], None, 'clear')
        self.assertEqual(cleared['attendance'], dict(yes=0, maybe=0, no=0, mine=None, revision=2))
        replay = social.set_attendance(self.store, self.ben, self.group, plan['id'], 'yes', 'yes')
        self.assertEqual(replay['attendance']['mine'], None)
        self.assertEqual(replay['attendance']['yes'], 0)

    def test_cancel_closes_attendance_and_cancel_is_versioned(self):
        plan = self.create()
        social.set_attendance(self.store, self.ben, self.group, plan['id'], 'maybe', 'maybe')
        cancelled = social.cancel_plan(self.store, self.alice, self.group, plan['id'], 1, 'cancel')
        self.assertEqual((cancelled['status'], cancelled['revision']), ('cancelled', 2))
        with self.assertRaises(Conflict):
            social.set_attendance(self.store, self.ben, self.group, plan['id'], 'yes', 'too-late')
        with self.assertRaises(Conflict):
            social.cancel_plan(self.store, self.alice, self.group, plan['id'], 1, 'old-cancel')
        self.assertEqual(social.plans(self.store, self.alice, self.group)['items'], [])

    def test_upcoming_uses_server_time_and_equal_times_page_without_duplicates(self):
        first = self.create(key='a')
        second = self.create(key='b')
        with patch.object(social.time, 'time', return_value=first['starts_epoch'] - 1):
            page = social.plans(self.store, self.alice, self.group, limit=1)
            follow = social.plans(self.store, self.alice, self.group, limit=1, cursor=page['next_cursor'])
        self.assertEqual({page['items'][0]['id'], follow['items'][0]['id']}, {first['id'], second['id']})
        self.assertIsNone(follow['next_cursor'])
        with patch.object(social.time, 'time', return_value=first['starts_epoch'] + 1):
            self.assertEqual(social.plans(self.store, self.alice, self.group)['items'], [])
            self.assertEqual(len(social.plans(self.store, self.alice, self.group, scope='all')['items']), 2)
        for limit in (0, 51, True):
            with self.assertRaises(ValueError):
                social.plans(self.store, self.alice, self.group, limit=limit)

    def test_cross_group_outsider_and_departed_users_have_no_access(self):
        plan = self.create()
        for user, group in ((self.other, self.group), (self.ben, self.other_group), (self.other, self.other_group)):
            with self.assertRaises(Denied):
                social.get_plan(self.store, user, group, plan['id'])
            with self.assertRaises(Denied):
                social.set_attendance(self.store, user, group, plan['id'], 'yes', 'denied')
        self.store.remove_member(self.alice, self.group, self.ben)
        with self.assertRaises(Denied):
            social.plans(self.store, self.ben, self.group)

    def test_membership_trigger_through_identity_store_removes_plan_and_attendance(self):
        plan = self.create(user=self.ben)
        social.set_attendance(self.store, self.alice, self.group, plan['id'], 'yes', 'join')
        older = Store(self.temp.name)
        try:
            older.remove_member(self.alice, self.group, self.ben)
        finally:
            older.close()
        self.assertEqual(social.plans(self.store, self.alice, self.group, scope='all')['items'], [])
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM social_attendance').fetchone()[0], 0)
        self.store.accept(self.ben, self.store.invite(self.alice, self.group))
        self.assertEqual(self.create(user=self.ben), {'id': plan['id'], 'deleted': True})

    def test_departed_attendee_disappears_without_affecting_plan(self):
        plan = self.create()
        social.set_attendance(self.store, self.ben, self.group, plan['id'], 'yes', 'join')
        self.store.remove_member(self.alice, self.group, self.ben)
        self.assertEqual(social.get_plan(self.store, self.alice, self.group, plan['id'])['attendance']['yes'], 0)

    def test_timezone_gaps_folds_invalid_offsets_and_end_order(self):
        for data in (
            {'timezone': 'Not/AZone'},
            {'start_local': '2030-03-31T02:30'},
            {'start_local': '2030-10-27T02:30'},
            {'start_offset': '+03:00'},
            {'end_local': '2030-06-01T17:00'},
            {'start_local': '2030-06-01T18:00Z'},
        ):
            with self.assertRaises(ValueError, msg=str(data)):
                self.create(**data)
        early = self.create(key='early', start_local='2030-10-27T02:30', start_offset='+02:00')
        late = self.create(key='late', start_local='2030-10-27T02:30', start_offset='+01:00')
        self.assertEqual(late['starts_epoch'] - early['starts_epoch'], 3600)
        self.assertEqual((early['starts_at'], late['starts_at']), ('2030-10-27T00:30:00Z', '2030-10-27T01:30:00Z'))

    def test_export_contains_only_authored_contributions_and_rechecks_edits(self):
        plan = self.create()
        other_plan = self.create(user=self.ben, key='ben', title='Ben plan')
        social.set_attendance(self.store, self.alice, self.group, other_plan['id'], 'yes', 'join')
        with zipfile.ZipFile(io.BytesIO(self.store.export_archive(self.alice, self.group))) as archive:
            data = json.loads(archive.read('social.json'))
        self.assertEqual([row['id'] for row in data['plans']], [plan['id']])
        self.assertEqual([(row['plan'], row['state']) for row in data['attendance']], [(other_plan['id'], 'yes')])
        original = self.store._build_export_archive
        def change(*args):
            original(*args)
            social.update_plan(self.store, self.alice, self.group, plan['id'], 1, 'changed', {'title': 'Changed'})
        with patch.object(self.store, '_build_export_archive', side_effect=change):
            with self.assertRaises(Conflict):
                self.store.export_archive(self.alice, self.group)

    def test_concurrent_attendance_and_cancellation_leave_no_post_cancel_write(self):
        plan = self.create()
        barrier = threading.Barrier(2)
        def run(cancel):
            store = MemoryStore(self.temp.name)
            try:
                barrier.wait()
                if cancel:
                    return social.cancel_plan(store, self.alice, self.group, plan['id'], 1, 'cancel')
                try:
                    return social.set_attendance(store, self.ben, self.group, plan['id'], 'yes', 'join')
                except Conflict:
                    return None
            finally:
                store.close()
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(run, (False, True)))
        final = social.get_plan(self.store, self.alice, self.group, plan['id'])
        self.assertEqual(final['status'], 'cancelled')
        with self.assertRaises(Conflict):
            social.set_attendance(self.store, self.ben, self.group, plan['id'], 'yes', 'later')

    def test_same_command_concurrently_creates_only_one_plan(self):
        barrier = threading.Barrier(2)
        def create(_):
            store = MemoryStore(self.temp.name)
            try:
                barrier.wait()
                return social.create_plan(store, self.alice, self.group, 'concurrent',
                    dict(title='One plan', start_local='2030-06-01T18:00', timezone='UTC'))['id']
            finally:
                store.close()
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            identities = list(pool.map(create, range(2)))
        self.assertEqual(identities[0], identities[1])
        self.assertEqual(len(social.plans(self.store, self.alice, self.group)['items']), 1)

    def test_database_rejects_cross_group_organizer_and_attendance(self):
        plan = self.create()
        with self.assertRaises(sqlite3.IntegrityError):
            with self.store.transaction():
                self.store.db.execute('UPDATE social_plans SET organizer=? WHERE id=?', (self.other, plan['id']))
        with self.assertRaises(sqlite3.IntegrityError):
            with self.store.transaction():
                self.store.db.execute('INSERT INTO social_attendance VALUES(?,?,?,?,?,?)',
                    (plan['id'], self.other, 'yes', 1, 0, self.group))
        with self.assertRaises(sqlite3.IntegrityError):
            with self.store.transaction():
                self.store.db.execute('INSERT INTO social_attendance VALUES(?,?,?,?,?,?)',
                    (plan['id'], self.other, 'yes', 1, 0, self.other_group))

    def test_invalid_patches_revisions_and_attendance_do_not_write(self):
        plan = self.create()
        for values in ({}, {'organizer': self.ben}, {'title': ''}, {'description': 'x' * 4001}, {'memory': 'missing'}):
            with self.assertRaises((ValueError, Denied)):
                social.update_plan(self.store, self.alice, self.group, plan['id'], 1, 'invalid', values)
        for revision in (0, True, '1'):
            with self.assertRaises(ValueError):
                social.delete_plan(self.store, self.alice, self.group, plan['id'], revision, 'delete')
        with self.assertRaises(ValueError):
            social.set_attendance(self.store, self.ben, self.group, plan['id'], 'attending', 'bad')
        self.assertEqual(social.get_plan(self.store, self.alice, self.group, plan['id'])['revision'], 1)
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM social_receipts').fetchone()[0], 1)


class PlanMemoryTests(unittest.TestCase):
    from tests.backend.test_atlas import AtlasTests as _Fixture
    setUp, tearDown, _origin = _Fixture.setUp, _Fixture.tearDown, _Fixture._origin

    def test_memory_link_rechecks_visibility_without_changing_archive_dates(self):
        event = self.store.review_event(self.alice, self.group, self.assets, 'Two winters', 'accept')
        data = dict(title='Meet again', start_local='2030-06-01T18:00', timezone='UTC', memory=event)
        plan = social.create_plan(self.store, self.alice, self.group, 'create', data)
        self.assertEqual(plan['memory'], dict(id=event, title='Two winters'))
        self.store.hide_event(self.ben, self.group, event, True)
        self.assertIsNone(social.get_plan(self.store, self.ben, self.group, plan['id'])['memory'])
        with self.assertRaises(Denied):
            social.create_plan(self.store, self.ben, self.group, 'hidden', data)
        self.store.delete_origin(self.alice, self._origin(self.assets[0]))
        self.assertIsNone(social.get_plan(self.store, self.alice, self.group, plan['id'])['memory'])
        changed = social.update_plan(self.store, self.alice, self.group, plan['id'], 1, 'edit', {'title': 'Still meet'})
        self.assertEqual((changed['title'], changed['memory']), ('Still meet', None))
        annotation = self.store.db.execute('SELECT capture_date FROM review_annotations WHERE asset_id=?', (self.assets[1],)).fetchone()
        self.assertEqual(annotation[0], '2021-01-02')
        with zipfile.ZipFile(io.BytesIO(self.store.export_archive(self.alice, self.group))) as archive:
            exported = json.loads(archive.read('social.json'))
        self.assertIsNone(exported['plans'][0]['memory'])

    def test_hidden_event_children_do_not_leak_through_a_different_memory_link(self):
        event = self.store.review_event(self.alice, self.group, self.assets, 'Visible winter', 'accept')
        with self.store.transaction():
            self.store.db.execute("INSERT INTO review_events SELECT 'overlapping-event',group_id,asset_ids,'Hidden winter',status,actor_id,updated_at FROM review_events WHERE id=?", (event,))
        self.store.hide_event(self.ben, self.group, 'overlapping-event', True)
        data = dict(title='Meet again', start_local='2030-06-01T18:00', timezone='UTC', memory=event)
        plan = social.create_plan(self.store, self.alice, self.group, 'create', data)
        self.assertIsNone(social.get_plan(self.store, self.ben, self.group, plan['id'])['memory'])
