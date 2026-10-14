"""Opt-in contracts against an explicitly configured synthetic hosted archive."""
import concurrent.futures
import os
import tempfile
import threading
import unittest
import uuid
from mazi.identity.core import Conflict
from mazi.memories.memories import MemoryStore


def require_synthetic_schema(environ=None):
    env = os.environ if environ is None else environ
    schema = env.get('MAZI_DATABASE_SCHEMA', 'mazi')
    if not schema.endswith('_test'):
        raise RuntimeError('Postgres mutation tests require a separately provisioned isolated schema ending in _test; never target the live mazi archive')
    return schema


@unittest.skipUnless(os.environ.get('MAZI_TEST_POSTGRES') == '1', 'requires explicit hosted test configuration')
class PostgresContracts(unittest.TestCase):
    def setUp(self):
        require_synthetic_schema()
        self.temp = tempfile.TemporaryDirectory()
        self.store = MemoryStore(self.temp.name)
        self.assertTrue(getattr(self.store.db, "hosted", False), "Postgres contracts require hosted backend")
        self.fixture = uuid.uuid4().hex
        self.user = self.store.register(self.fixture + '@example.test', 'synthetic password')
        self.group = self.store.create_group(self.user, 'Synthetic postgres ' + self.fixture)

    def tearDown(self):
        with self.store.db:
            self.store.db.execute('DELETE FROM archive_origins WHERE group_id=?', (self.group,))
            self.store.db.execute('DELETE FROM archive_assets WHERE group_id=?', (self.group,))
            self.store.db.execute('DELETE FROM import_items WHERE run_id=?', (self.fixture,))
            self.store.db.execute('DELETE FROM import_runs WHERE id=?', (self.fixture,))
            self.store.db.execute('DELETE FROM members WHERE group_id=?', (self.group,))
            self.store.db.execute('DELETE FROM memory_notifications WHERE group_id=?', (self.group,))
            self.store.db.execute('DELETE FROM discovery_processing WHERE group_id=?', (self.group,))
            self.store.db.execute('DELETE FROM answer_processing WHERE group_id=?', (self.group,))
            self.store.db.execute('DELETE FROM discovery_generations WHERE group_id=?', (self.group,))
            self.store.db.execute('DELETE FROM audit WHERE actor_id=?', (self.user,))
            self.store.db.execute('DELETE FROM groups WHERE id=?', (self.group,))
            self.store.db.execute('DELETE FROM users WHERE id=?', (self.user,))
        self.store.close()
        self.temp.cleanup()

    def test_trigger_generation_uniqueness_and_reusable_connection(self):
        self.store.processing(self.user, self.group, True, True)
        self.store.processing(self.user, self.group, True)
        self.store.answer_processing(self.user, self.group, True, True)
        self.store.answer_processing(self.user, self.group, True)
        row = self.store.db.execute('SELECT revision FROM discovery_generations WHERE group_id=?', (self.group,)).fetchone()
        self.assertEqual(row[0], 4)
        self.assertEqual(dict(row), {'revision': 4})
        with self.assertRaises(Conflict):
            self.store.register(self.fixture + '@example.test', 'synthetic password')
        self.assertEqual(self.store.groups_for(self.user)[0]['id'], self.group)
        timestamp = 1792000000.1234567
        self.assertEqual(self.store.db.execute('SELECT ?::double precision AS epoch', (timestamp,)).fetchone()[0], timestamp)
        self.assertEqual(tuple(self.store.db.execute("SELECT '?' AS literal, ? AS bound, '50%' AS percentage", ('ok',)).fetchone()), ('?', 'ok', '50%'))

    def test_simultaneous_workers_claim_distinct_items(self):
        with self.store.db:
            self.store.db.execute('INSERT INTO import_runs(id,owner_id,group_id,source,namespace,manifest,options,size,state,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
                (self.fixture, self.user, self.group, 'manual', 'synthetic', self.fixture, '{}', 1, 'PROCESSING', 0))
            for index in range(2):
                self.store.db.execute('INSERT INTO import_items(id,run_id,ordinal,occurrence,payload,outcome,reason) VALUES(?,?,?,?,?,?,?)',
                    (self.fixture + str(index), self.fixture, index, str(index), '{}', 'PENDING', 'test'))
        barrier = threading.Barrier(2)
        def claim(_):
            store = MemoryStore(self.temp.name)
            try:
                barrier.wait()
                return store.claim()
            finally:
                store.close()
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            jobs = list(pool.map(claim, range(2)))
        self.assertEqual(len({job['id'] for job in jobs}), 2)

    def test_departure_triggers_run_through_identity_store(self):
        from mazi.identity.core import Store
        member = self.store.register(self.fixture + '.member@example.test', 'synthetic password')
        self.store.accept(member, self.store.invite(self.user, self.group))
        person, asset, story = self.fixture + 'person', self.fixture + 'asset', self.fixture + 'story'
        with self.store.db:
            self.store.db.execute('INSERT INTO discovery_people VALUES(?,?,?,?,?,?)', (person, self.group, 'Test', member, member, member))
            self.store.db.execute('INSERT INTO discovery_tags VALUES(?,?,?)', (person, asset, member))
            self.store.db.execute('INSERT INTO discovery_processing VALUES(?,?,?)', (self.group, member, 1))
            self.store.db.execute('INSERT INTO answer_processing VALUES(?,?,?)', (self.group, member, 1))
            self.store.db.execute('INSERT INTO advanced_stories VALUES(?,?,?,?,?)', (story, self.group, 'event', member, 1))
            self.store.db.execute('INSERT INTO story_contributions VALUES(?,?,?)', (story, member, 'Synthetic'))
            self.store.db.execute('INSERT INTO story_subevents VALUES(?,?,?)', (story, member, '[]'))
            self.store.db.execute('INSERT INTO time_capsules VALUES(?,?,?,?,?,?,?)', (self.fixture, self.group, member, 0, 'Test', 'Synthetic', b'private'))
            self.store.db.execute('INSERT INTO memory_notifications VALUES(?,?,?)', (self.group, member, 1))
        older = Store(self.temp.name)
        try:
            older.remove_member(self.user, self.group, member)
        finally:
            older.close()
        for table in ('discovery_tags', 'advanced_stories', 'story_contributions', 'story_subevents', 'time_capsules'):
            column = {'discovery_tags':'person','advanced_stories':'id','story_contributions':'story','story_subevents':'story','time_capsules':'id'}[table]
            key = person if table == 'discovery_tags' else self.fixture if table == 'time_capsules' else story
            self.assertIsNone(self.store.db.execute(f'SELECT 1 FROM {table} WHERE {column}=?', (key,)).fetchone())
        self.assertIsNone(self.store.db.execute('SELECT 1 FROM memory_notifications WHERE group_id=? AND "user"=?', (self.group, member)).fetchone())
        with self.store.db:
            self.store.db.execute('DELETE FROM discovery_people WHERE id=?', (person,))
            self.store.db.execute('DELETE FROM invitations WHERE group_id=?', (self.group,))
            self.store.db.execute('DELETE FROM audit WHERE actor_id=? OR target_id=?', (member, member))
            self.store.db.execute('DELETE FROM users WHERE id=?', (member,))

    def test_parallel_quota_admission_preserves_group_limit(self):
        import json
        payload = json.dumps(dict(context=[], original_metadata_reference='', sender={}, shared_at_assertion={}, reactions=[]))
        with self.store.db:
            self.store.db.execute('INSERT INTO archive_assets(id,group_id,sha256,original_key,preview_key,mime,size,width,height) VALUES(?,?,?,?,?,?,?,?,?)',
                (self.fixture + 'seed', self.group, 'seed', 'synthetic', 'synthetic', 'image/jpeg', 17 * 1024**3, 8, 8))
            self.store.db.execute('INSERT INTO import_runs(id,owner_id,group_id,source,namespace,manifest,options,size,state,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
                (self.fixture, self.user, self.group, 'manual', 'synthetic', self.fixture, '{}', 1, 'PROCESSING', 0))
            for index in range(2):
                self.store.db.execute('INSERT INTO import_items(id,run_id,ordinal,occurrence,payload,outcome,reason) VALUES(?,?,?,?,?,?,?)',
                    (self.fixture + str(index), self.fixture, index, str(index), payload, 'PENDING', 'test'))
        jobs = [self.store.claim(), self.store.claim()]
        barrier = threading.Barrier(2)
        def complete(job):
            store = MemoryStore(self.temp.name)
            try:
                prepared = dict(outcome='AVAILABLE_TO_GROUP', reason='IMPORTED', capture=[], locations=[],
                    sha256=job['id'], size=2 * 1024**3, original_key='synthetic', preview_key='synthetic', mime='image/jpeg', width=8, height=8)
                barrier.wait()
                store.complete(job, prepared)
            finally:
                store.close()
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(complete, jobs))
        outcomes = {row['outcome']: row['reason'] for row in self.store.db.execute('SELECT outcome,reason FROM import_items WHERE run_id=?', (self.fixture,))}
        self.assertEqual(outcomes, {'AVAILABLE_TO_GROUP': 'IMPORTED', 'FAILED': 'GROUP_STORAGE_LIMIT'})
        self.assertEqual(self.store.db.execute('SELECT sum(size) FROM archive_assets WHERE group_id=?', (self.group,)).fetchone()[0], 19 * 1024**3)

    def test_notification_boolean_round_trip(self):
        for enabled in (True, False, True):
            self.store.notification_opt_in(self.user, self.group, enabled)
            self.assertEqual(self.store.notifications(self.user, self.group)['enabled'], enabled)
            self.assertEqual(self.store.db.execute('SELECT enabled FROM memory_notifications WHERE group_id=? AND "user"=?', (self.group, self.user)).fetchone()[0], int(enabled))

    def test_held_lock_timeout_rolls_back_and_recovers(self):
        from mazi.persistence import ArchiveBusy
        other = MemoryStore(self.temp.name)
        other.db._db.execute("SET lock_timeout TO '50ms'")
        try:
            with self.store.db:
                with self.assertRaises(ArchiveBusy):
                    other.notification_opt_in(self.user, self.group, True)
                self.assertFalse(other.db._active)
            other.notification_opt_in(self.user, self.group, True)
            self.assertTrue(other.notifications(self.user, self.group)['enabled'])
        finally:
            other.close()


class PostgresGuardContracts(unittest.TestCase):
    def test_only_explicit_synthetic_schema_is_allowed(self):
        self.assertEqual(require_synthetic_schema({'MAZI_DATABASE_SCHEMA': 'mazi_contract_test'}), 'mazi_contract_test')
        for schema in ('mazi', 'mazi_backup', ''):
            with self.subTest(schema=schema), self.assertRaisesRegex(RuntimeError, 'isolated schema ending in _test'):
                require_synthetic_schema({'MAZI_DATABASE_SCHEMA': schema})
        with self.assertRaises(RuntimeError):
            require_synthetic_schema({})

    def test_live_schema_is_rejected_before_store_creation(self):
        from unittest.mock import patch
        case = PostgresContracts(methodName='test_notification_boolean_round_trip')
        with patch.dict(os.environ, {'MAZI_DATABASE_SCHEMA': 'mazi'}, clear=True), patch(__name__ + '.MemoryStore') as store:
            with self.assertRaisesRegex(RuntimeError, 'never target the live mazi archive'):
                case.setUp()
            store.assert_not_called()
