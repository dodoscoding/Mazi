import hashlib
import io
import json
import os
import sqlite3
import unittest
import zipfile
from unittest.mock import patch

from mazi.identity.core import Conflict, Denied, Store
from mazi.social import conversations
from tests.backend.social import test_plans_postgres
from tests.backend.imports.test_engine import picture


@unittest.skipUnless(os.environ.get('MAZI_TEST_POSTGRES') == '1', 'requires isolated hosted test schema')
class HostedCommentsTests(unittest.TestCase):
    def setUp(self):
        test_plans_postgres.HostedPlansTests.setUp(self)
        self.asset, self.origin = self.fixture + 'asset', self.fixture + 'origin'
        data = picture()
        payload = dict(context=[], original_metadata_reference='synthetic', sender={}, shared_at_assertion={},
                       reactions=[], capture_assertions=[], location_assertions=[], source_type='manual', original_filename='synthetic.jpg')
        with self.store.transaction():
            self.store.db.execute('INSERT INTO import_runs(id,owner_id,group_id,source,namespace,manifest,options,size,state,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
                (self.fixture, self.alice, self.group, 'manual', 'synthetic-comments', self.fixture, '{}', len(data), 'COMPLETED', 0))
            self.store.db.execute('INSERT INTO archive_assets(id,group_id,sha256,original_key,preview_key,mime,size,width,height) VALUES(?,?,?,?,?,?,?,?,?)',
                (self.asset, self.group, hashlib.sha256(data).hexdigest(), self.asset, self.asset, 'image/jpeg', len(data), 8, 8))
            self.store.db.execute('INSERT INTO archive_origins(id,asset_id,group_id,owner_id,run_id,occurrence,fingerprint,payload) VALUES(?,?,?,?,?,?,?,?)',
                (self.origin, self.asset, self.group, self.alice, self.fixture, self.fixture, self.fixture, json.dumps(payload)))
        self.store.objects.retain('archive-objects', self.asset, data)

    def tearDown(self):
        self.store.objects.remove('archive-objects', self.asset)
        with self.store.transaction():
            self.store.db.execute('DELETE FROM archive_origins WHERE group_id=?', (self.group,))
            self.store.db.execute('DELETE FROM archive_assets WHERE group_id=?', (self.group,))
            self.store.db.execute('DELETE FROM import_runs WHERE group_id=?', (self.group,))
        test_plans_postgres.HostedPlansTests.tearDown(self)

    def target(self):
        return dict(kind='photo', id=self.asset)

    def create(self, user=None, key='first', text='First thought'):
        return conversations.create_comment(self.store, user or self.alice, self.group, key, self.target(), text)

    def test_replay_cas_immutable_fractional_creation_and_export_visibility(self):
        with patch.object(conversations.time, 'time', return_value=1792000000.1234567):
            first = self.create()
        self.assertEqual(first['created_at'], 1792000000.1234567)
        self.assertEqual(self.create()['id'], first['id'])
        edited = conversations.update_comment(self.store, self.alice, self.group, first['id'], 1, 'edit', 'Changed')
        self.assertEqual((edited['revision'], edited['created_at']), (2, 1792000000.1234567))
        with self.assertRaises(Conflict):
            conversations.update_comment(self.store, self.alice, self.group, first['id'], 1, 'stale', 'Old')
        self.create(user=self.ben, key='ben', text='Ben text')
        with zipfile.ZipFile(io.BytesIO(self.store.export_archive(self.alice, self.group))) as archive:
            self.assertEqual([row['text'] for row in json.loads(archive.read('comments.json'))], ['Changed'])
        self.store.hide(self.alice, self.asset, True)
        with self.assertRaises(Denied):
            conversations.comments(self.store, self.alice, self.group, self.target())
        with zipfile.ZipFile(io.BytesIO(self.store.export_archive(self.alice, self.group))) as archive:
            self.assertNotIn('comments.json', archive.namelist())

    def test_lower_level_departure_cleanup_and_restored_row_is_tombstoned_after_rejoin(self):
        first = self.create(user=self.ben)
        stale = tuple(self.store.db.execute('SELECT * FROM social_comments WHERE id=?', (first['id'],)).fetchone())
        older = Store(self.temp.name)
        try:
            older.remove_member(self.alice, self.group, self.ben)
        finally:
            older.close()
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM social_comments WHERE group_id=?', (self.group,)).fetchone()[0], 0)
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM social_comment_deletions WHERE comment_id=?', (first['id'],)).fetchone()[0], 1)
        self.store.accept(self.ben, self.store.invite(self.alice, self.group))
        with self.store.transaction():
            self.store.db.execute('INSERT INTO social_comments VALUES(?,?,?,?,?,?,?,?,?)', stale)
        self.assertEqual(conversations.comments(self.store, self.alice, self.group, self.target())['items'], [])
        self.assertEqual(self.create(user=self.ben), dict(id=first['id'], deleted=True))
        self.store.delete_origin(self.alice, self.origin)
        with self.assertRaises(Denied):
            self.create(user=self.ben)

    def test_database_group_foreign_keys_runtime_privileges_and_keyset_query_index(self):
        first = self.create()
        with self.assertRaises(sqlite3.IntegrityError):
            with self.store.transaction():
                self.store.db.execute('UPDATE social_comments SET author_id=? WHERE id=?', ('not-a-member', first['id']))
        with self.store.transaction():
            self.store.db.execute('SET LOCAL enable_seqscan=off')
            query = 'SELECT id FROM social_comments WHERE group_id=? AND photo_id=? ORDER BY created_at,id LIMIT 21'
            details = ' '.join(row[0] for row in self.store.db.execute('EXPLAIN ' + query, (self.group, self.asset)))
            self.assertTrue(any(index in details for index in ('social_comments_photo_time', 'social_comments_activity')), details)
            self.assertIn('Index Cond:', details)
            self.assertIn('group_id', details)
            self.assertIn('photo_id', details)
        self.assertFalse(self.store.db.execute("SELECT has_table_privilege(current_user,current_schema()||'.social_comment_deletions','DELETE')").fetchone()[0])
        for table in ('social_comments', 'social_comment_deletions'):
            self.assertTrue(self.store.db.execute('SELECT relrowsecurity FROM pg_class WHERE oid=(current_schema()||\'.\'||?)::regclass', (table,)).fetchone()[0])
            for role in ('anon', 'authenticated'):
                self.assertFalse(self.store.db.execute("SELECT has_table_privilege(?,current_schema()||'.'||?,'SELECT')", (role, table)).fetchone()[0])
