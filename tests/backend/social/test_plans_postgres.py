import concurrent.futures
import io
import json
import os
import sqlite3
import tempfile
import threading
import unittest
import uuid
import zipfile

from mazi.identity.core import Conflict, Store
from mazi.memories.memories import MemoryStore
from mazi.social import social
from tests.backend.test_postgres import require_synthetic_schema


@unittest.skipUnless(os.environ.get('MAZI_TEST_POSTGRES') == '1', 'requires isolated hosted test schema')
class HostedPlansTests(unittest.TestCase):
    def setUp(self):
        require_synthetic_schema()
        self.temp = tempfile.TemporaryDirectory()
        self.store = MemoryStore(self.temp.name)
        self.assertTrue(getattr(self.store.db, 'hosted', False))
        self.fixture = uuid.uuid4().hex
        self.alice = self.store.register(self.fixture + '@example.test', 'synthetic password')
        self.ben = self.store.register(self.fixture + '.ben@example.test', 'synthetic password')
        self.group = self.store.create_group(self.alice, 'Synthetic plans')
        self.store.accept(self.ben, self.store.invite(self.alice, self.group))

    def tearDown(self):
        with self.store.db:
            self.store.db.execute('DELETE FROM members WHERE group_id=?', (self.group,))
            self.store.db.execute('DELETE FROM social_receipts WHERE group_id=?', (self.group,))
            self.store.db.execute('DELETE FROM invitations WHERE group_id=?', (self.group,))
            self.store.db.execute('DELETE FROM groups WHERE id=?', (self.group,))
            self.store.db.execute('DELETE FROM audit WHERE actor_id IN (?,?)', (self.alice, self.ben))
            self.store.db.execute('DELETE FROM users WHERE id IN (?,?)', (self.alice, self.ben))
        self.store.close()
        self.temp.cleanup()

    def create(self, user=None):
        return social.create_plan(self.store, user or self.alice, self.group, 'create',
            dict(title='Synthetic plans', start_local='2030-06-01T18:00', timezone='Europe/Copenhagen'))

    def test_replay_cas_departure_and_export_match_sqlite(self):
        plan = self.create(user=self.ben)
        self.assertEqual(self.create(user=self.ben)['id'], plan['id'])
        self.assertEqual(plan['starts_at'], '2030-06-01T16:00:00Z')
        with self.store.transaction():
            self.store.db.execute('UPDATE social_plans SET updated_at=? WHERE id=?', (1792000000.1234567, plan['id']))
        self.assertEqual(social.get_plan(self.store, self.ben, self.group, plan['id'])['updated_at'], 1792000000.1234567)
        joined = social.set_attendance(self.store, self.alice, self.group, plan['id'], 'yes', 'join')
        self.assertEqual(joined['attendance']['yes'], 1)
        with self.assertRaises(sqlite3.IntegrityError):
            with self.store.transaction():
                self.store.db.execute('UPDATE social_plans SET organizer=? WHERE id=?', ('not-a-member', plan['id']))
        changed = social.update_plan(self.store, self.ben, self.group, plan['id'], 1, 'edit', {'title': 'Changed'})
        self.assertEqual(changed['revision'], 2)
        with self.assertRaises(Conflict):
            social.update_plan(self.store, self.ben, self.group, plan['id'], 1, 'old-edit', {'title': 'Old'})
        with zipfile.ZipFile(io.BytesIO(self.store.export_archive(self.ben, self.group))) as archive:
            self.assertEqual(json.loads(archive.read('social.json'))['plans'][0]['title'], 'Changed')
        older = Store(self.temp.name)
        try:
            older.remove_member(self.alice, self.group, self.ben)
        finally:
            older.close()
        self.assertEqual(social.plans(self.store, self.alice, self.group, scope='all')['items'], [])
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM social_attendance WHERE plan_id=?', (plan['id'],)).fetchone()[0], 0)
        self.store.accept(self.ben, self.store.invite(self.alice, self.group))
        self.assertEqual(self.create(user=self.ben), dict(id=plan['id'], deleted=True))

    def test_cancel_and_attendance_serialize_across_connections(self):
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
        self.assertEqual(social.get_plan(self.store, self.ben, self.group, plan['id'])['status'], 'cancelled')
        with self.assertRaises(Conflict):
            social.set_attendance(self.store, self.ben, self.group, plan['id'], 'no', 'after')

    def test_private_schema_and_group_time_query_index(self):
        plan = self.create()
        with self.store.transaction():
            self.store.db.execute('SET LOCAL enable_seqscan=off')
            query = "SELECT id FROM social_plans WHERE group_id=? AND status='active' AND starts_at>=? ORDER BY starts_at,id LIMIT 21"
            details = ' '.join(row[0] for row in self.store.db.execute('EXPLAIN ' + query, (self.group, 0)))
            self.assertIn('social_plans_group_time', details)
        tables = self.store.db.execute("SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=current_schema() AND c.relname IN ('social_plans','social_attendance','social_receipts')").fetchall()
        self.assertEqual({row[0] for row in tables}, {'social_plans','social_attendance','social_receipts'})
        self.assertTrue(all(row[1] for row in tables))
        for role in ('anon', 'authenticated'):
            self.assertFalse(self.store.db.execute("SELECT has_table_privilege(?,current_schema()||'.social_plans','SELECT')", (role,)).fetchone()[0])
