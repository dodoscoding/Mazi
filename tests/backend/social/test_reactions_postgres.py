import io
import json
import os
import sqlite3
import unittest
import zipfile
from unittest.mock import patch

from mazi.identity.core import Conflict, Denied, Store
from mazi.social import conversations, reactions
from tests.backend.social import test_comments_postgres


@unittest.skipUnless(os.environ.get('MAZI_TEST_POSTGRES') == '1', 'requires isolated hosted test schema')
class HostedReactionsTests(unittest.TestCase):
    setUp = test_comments_postgres.HostedCommentsTests.setUp
    tearDown = test_comments_postgres.HostedCommentsTests.tearDown
    target = test_comments_postgres.HostedCommentsTests.target

    def set_reaction(self, user=None, key='on', active=True, target=None):
        return reactions.set_reaction(self.store, user or self.alice, self.group, key, target or self.target(), '👍', active)

    def test_desired_state_fractional_timestamp_batch_and_authored_export(self):
        with patch.object(reactions.time, 'time', return_value=1792000000.1234567):
            self.set_reaction()
        self.assertEqual(self.store.db.execute('SELECT created_at FROM social_reactions WHERE group_id=?', (self.group,)).fetchone()[0], 1792000000.1234567)
        self.assertEqual(self.set_reaction(key='same-state')['total'], 1)
        comment = conversations.create_comment(self.store, self.ben, self.group, 'comment', self.target(), 'Synthetic')
        target = dict(kind='comment', id=comment['id'])
        self.set_reaction(key='comment-react', target=target)
        batch = reactions.batch_reactions(self.store, self.alice, self.group, [self.target(), target])
        self.assertEqual([row['total'] for row in batch['items']], [1, 1])
        with zipfile.ZipFile(io.BytesIO(self.store.export_archive(self.alice, self.group))) as archive:
            self.assertEqual(len(json.loads(archive.read('reactions.json'))), 2)
        self.set_reaction(key='off', active=False)
        self.assertEqual(self.set_reaction()['total'], 0)
        with self.assertRaises(Conflict):
            self.set_reaction(active=False)
        self.store.hide(self.alice, self.asset, True)
        with zipfile.ZipFile(io.BytesIO(self.store.export_archive(self.alice, self.group))) as archive:
            self.assertNotIn('reactions.json', archive.namelist())
        with self.assertRaises(Denied):
            reactions.batch_reactions(self.store, self.alice, self.group, [self.target(), target])

    def test_identity_departure_and_comment_cascade_keep_tombstones_after_stale_restore(self):
        self.set_reaction(user=self.ben)
        stale = tuple(self.store.db.execute('SELECT * FROM social_reactions WHERE member_id=? AND group_id=?', (self.ben, self.group)).fetchone())
        older = Store(self.temp.name)
        try:
            older.remove_member(self.alice, self.group, self.ben)
        finally:
            older.close()
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM social_reaction_deletions WHERE reaction_id=?', (stale[0],)).fetchone()[0], 1)
        self.store.accept(self.ben, self.store.invite(self.alice, self.group))
        with self.store.transaction():
            self.store.db.execute('INSERT INTO social_reactions VALUES(?,?,?,?,?,?,?,?,?,?)', stale)
        self.assertEqual(self.set_reaction(user=self.ben)['total'], 0)
        self.assertEqual(self.set_reaction(user=self.ben, key='new')['total'], 1)
        comment = conversations.create_comment(self.store, self.alice, self.group, 'comment', self.target(), 'Synthetic')
        target = dict(kind='comment', id=comment['id'])
        self.set_reaction(user=self.ben, key='comment-reaction', target=target)
        old_comment = tuple(self.store.db.execute('SELECT * FROM social_comments WHERE id=?', (comment['id'],)).fetchone())
        old_reaction = tuple(self.store.db.execute('SELECT * FROM social_reactions WHERE comment_id=?', (comment['id'],)).fetchone())
        conversations.delete_comment(self.store, self.alice, self.group, comment['id'], 1, 'delete-comment')
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM social_reactions WHERE comment_id=?', (comment['id'],)).fetchone()[0], 0)
        with self.store.transaction():
            self.store.db.execute('INSERT INTO social_comments VALUES(?,?,?,?,?,?,?,?,?)', old_comment)
            self.store.db.execute('INSERT INTO social_reactions VALUES(?,?,?,?,?,?,?,?,?,?)', old_reaction)
        with self.assertRaises(Denied):
            reactions.reactions(self.store, self.ben, self.group, target)
        with self.assertRaises(Denied):
            self.set_reaction(user=self.ben, key='comment-reaction', target=target)

    def test_uniqueness_group_foreign_keys_and_private_indexed_storage(self):
        self.set_reaction()
        row = tuple(self.store.db.execute('SELECT * FROM social_reactions WHERE group_id=?', (self.group,)).fetchone())
        with self.assertRaises(sqlite3.IntegrityError):
            with self.store.transaction():
                self.store.db.execute('INSERT INTO social_reactions VALUES(?,?,?,?,?,?,?,?,?,?)', ('duplicate', *row[1:]))
        with self.assertRaises(sqlite3.IntegrityError):
            with self.store.transaction():
                self.store.db.execute('UPDATE social_reactions SET member_id=? WHERE id=?', ('not-a-member', row[0]))
        with self.store.transaction():
            self.store.db.execute('SET LOCAL enable_seqscan=off')
            details = ' '.join(item[0] for item in self.store.db.execute('EXPLAIN SELECT id FROM social_reactions WHERE group_id=? AND photo_id=? AND active=1', (self.group, self.asset)))
            self.assertTrue(any(index in details for index in ('social_reactions_photo_member', 'social_reactions_activity')), details)
            self.assertIn('Index Cond:', details)
            self.assertIn('group_id', details)
            self.assertIn('photo_id', details)
        for table in ('social_reactions', 'social_reaction_deletions'):
            self.assertTrue(self.store.db.execute('SELECT relrowsecurity FROM pg_class WHERE oid=(current_schema()||\'.\'||?)::regclass', (table,)).fetchone()[0])
            for role in ('anon', 'authenticated'):
                self.assertFalse(self.store.db.execute("SELECT has_table_privilege(?,current_schema()||'.'||?,'SELECT')", (role, table)).fetchone()[0])
        self.assertFalse(self.store.db.execute("SELECT has_table_privilege(current_user,current_schema()||'.social_reaction_deletions','DELETE')").fetchone()[0])
