import concurrent.futures
import io
import json
import sqlite3
import threading
import unittest
import zipfile
from unittest.mock import patch

from mazi.identity.core import Conflict, Denied, Store
from mazi.memories.memories import MemoryStore
from mazi.social import conversations
from tests.backend.test_atlas import AtlasTests


class CommentsFixture(unittest.TestCase):
    setUp, tearDown, _origin = AtlasTests.setUp, AtlasTests.tearDown, AtlasTests._origin

    def target(self, asset=0):
        return dict(kind='photo', id=self.assets[asset])

    def create(self, user=None, key='first', text='First thought', target=None):
        return conversations.create_comment(self.store, user or self.alice, self.group, key, target or self.target(), text)


class CommentsTests(CommentsFixture):
    def test_one_author_can_write_multiple_flat_comments_on_photo_and_memory(self):
        first = self.create()
        second = self.create(key='second', text='Another thought')
        event = self.store.review_event(self.alice, self.group, self.assets, 'Two winters', 'accept')
        memory = self.create(key='memory', target=dict(kind='memory', id=event))
        self.assertNotEqual(first['id'], second['id'])
        self.assertEqual([row['text'] for row in conversations.comments(self.store, self.ben, self.group, self.target())['items']], ['First thought', 'Another thought'])
        self.assertEqual(conversations.comments(self.store, self.ben, self.group, dict(kind='memory', id=event))['items'][0]['id'], memory['id'])
        self.assertEqual(first['target'], self.target())
        self.assertTrue(first['editable'])
        self.assertEqual(first['revision'], 1)
        self.assertEqual(self.store.event_notebook(self.ben, self.group, event)['story'], None)

    def test_create_retry_payload_conflict_delete_and_stale_restore_never_resurrect(self):
        first = self.create()
        self.assertEqual(self.create()['id'], first['id'])
        with self.assertRaises(Conflict):
            self.create(text='Different')
        stale = dict(self.store.db.execute('SELECT * FROM social_comments WHERE id=?', (first['id'],)).fetchone())
        self.assertEqual(conversations.delete_comment(self.store, self.alice, self.group, first['id'], 1, 'delete'), dict(id=first['id'], deleted=True))
        with self.store.transaction():
            self.store.db.execute('INSERT INTO social_comments VALUES(?,?,?,?,?,?,?,?,?)', tuple(stale.values()))
        self.assertEqual(conversations.comments(self.store, self.ben, self.group, self.target())['items'], [])
        self.assertEqual(self.create(), dict(id=first['id'], deleted=True))
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM social_comments').fetchone()[0], 1)
        with self.assertRaises(Denied):
            conversations.update_comment(self.store, self.alice, self.group, first['id'], 1, 'restore', 'Back')

    def test_author_only_cas_edit_keeps_creation_time_and_replay_returns_current_text(self):
        first = self.create()
        edited = conversations.update_comment(self.store, self.alice, self.group, first['id'], 1, 'edit', 'Changed')
        self.assertEqual((edited['text'], edited['revision'], edited['created_at']), ('Changed', 2, first['created_at']))
        self.assertEqual(self.create()['text'], 'Changed')
        self.assertEqual(conversations.update_comment(self.store, self.alice, self.group, first['id'], 1, 'edit', 'Changed')['revision'], 2)
        with self.assertRaises(Conflict):
            conversations.update_comment(self.store, self.alice, self.group, first['id'], 1, 'stale', 'Old')
        with self.assertRaises(Conflict):
            conversations.delete_comment(self.store, self.alice, self.group, first['id'], 1, 'old-delete')
        for function, args in ((conversations.update_comment, (first['id'], 2, 'not-mine', 'Mine')), (conversations.delete_comment, (first['id'], 2, 'not-mine'))):
            with self.assertRaises(Denied):
                function(self.store, self.ben, self.group, *args)

    def test_stable_pagination_same_timestamp_filters_inactive_and_tombstoned_rows_before_limit(self):
        with patch.object(conversations.time, 'time', return_value=1792000000.1234567):
            created = [self.create(key=str(index)) for index in range(5)]
            hidden = self.create(user=self.ben, key='ben')
        self.store.remove_member(self.alice, self.group, self.ben)
        conversations.delete_comment(self.store, self.alice, self.group, created[1]['id'], 1, 'delete')
        seen, cursor = [], None
        while True:
            page = conversations.comments(self.store, self.alice, self.group, self.target(), limit=1, cursor=cursor)
            self.assertEqual(page['total'], 4)
            seen.extend(row['id'] for row in page['items'])
            cursor = page['next_cursor']
            if cursor is None:
                break
        self.assertEqual(seen, sorted(row['id'] for index, row in enumerate(created) if index != 1))
        self.assertNotIn(hidden['id'], seen)
        self.assertEqual(len(seen), len(set(seen)))
        for limit in (0, 51, True):
            with self.assertRaises(ValueError):
                conversations.comments(self.store, self.alice, self.group, self.target(), limit=limit)
        with self.assertRaises(ValueError):
            conversations.comments(self.store, self.alice, self.group, self.target(), cursor='bad')

    def test_current_target_visibility_applies_to_read_write_replay_count_and_export(self):
        first = self.create(user=self.ben)
        self.store.hide(self.ben, self.assets[0], True)
        for function, args in ((conversations.comments, (self.target(),)), (conversations.create_comment, ('first', self.target(), 'First thought')),
                               (conversations.update_comment, (first['id'], 1, 'edit', 'Hidden')), (conversations.delete_comment, (first['id'], 1, 'delete'))):
            with self.assertRaises(Denied):
                function(self.store, self.ben, self.group, *args)
        with zipfile.ZipFile(io.BytesIO(self.store.export_archive(self.ben, self.group))) as archive:
            if 'comments.json' in archive.namelist():
                self.assertEqual(json.loads(archive.read('comments.json')), [])
        self.assertEqual(conversations.comments(self.store, self.alice, self.group, self.target())['items'][0]['id'], first['id'])

    def test_hidden_overlapping_event_and_withdrawn_last_origin_deny_original_targets(self):
        event = self.store.review_event(self.alice, self.group, self.assets, 'Two winters', 'accept')
        photo = self.create()
        memory = self.create(key='memory', target=dict(kind='memory', id=event))
        with self.store.transaction():
            self.store.db.execute("INSERT INTO review_events SELECT 'overlap',group_id,asset_ids,'Hidden',status,actor_id,updated_at FROM review_events WHERE id=?", (event,))
        self.store.hide_event(self.ben, self.group, 'overlap', True)
        for target in (self.target(), dict(kind='memory', id=event)):
            with self.assertRaises(Denied):
                conversations.comments(self.store, self.ben, self.group, target)
        self.store.delete_origin(self.alice, self._origin(self.assets[0]))
        for target in (self.target(), dict(kind='memory', id=event)):
            with self.assertRaises(Denied):
                conversations.comments(self.store, self.alice, self.group, target)
        for identity in (photo['id'], memory['id']):
            with self.assertRaises(Denied):
                conversations.update_comment(self.store, self.alice, self.group, identity, 1, identity, 'No')

    def test_cross_group_target_and_outsider_denied_and_database_rejects_cross_group_author(self):
        other = self.store.create_group(self.outsider, 'Elsewhere')
        first = self.create()
        for user, group in ((self.outsider, self.group), (self.outsider, other)):
            with self.assertRaises(Denied):
                conversations.comments(self.store, user, group, self.target())
            with self.assertRaises(Denied):
                conversations.create_comment(self.store, user, group, 'cross', self.target(), 'No')
        with self.assertRaises(sqlite3.IntegrityError):
            with self.store.transaction():
                self.store.db.execute('UPDATE social_comments SET author_id=? WHERE id=?', (self.outsider, first['id']))
        with self.assertRaises(sqlite3.IntegrityError):
            with self.store.transaction():
                self.store.db.execute('UPDATE social_comments SET group_id=? WHERE id=?', (other, first['id']))

    def test_identity_store_departure_tombstones_authored_comments_and_rejoin_cannot_restore(self):
        first = self.create(user=self.ben)
        stale = tuple(self.store.db.execute('SELECT * FROM social_comments WHERE id=?', (first['id'],)).fetchone())
        older = Store(self.temp.name)
        try:
            older.remove_member(self.alice, self.group, self.ben)
        finally:
            older.close()
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM social_comments').fetchone()[0], 0)
        self.store.db.execute('PRAGMA foreign_keys=OFF')
        with self.store.transaction():
            self.store.db.execute('INSERT INTO social_comments VALUES(?,?,?,?,?,?,?,?,?)', stale)
        self.store.db.execute('PRAGMA foreign_keys=ON')
        self.assertEqual(conversations.comments(self.store, self.alice, self.group, self.target())['items'], [])
        self.store.accept(self.ben, self.store.invite(self.alice, self.group))
        self.assertEqual(self.create(user=self.ben), dict(id=first['id'], deleted=True))
        self.assertEqual(conversations.comments(self.store, self.alice, self.group, self.target())['items'], [])

    def test_export_only_authored_visible_comments_and_admission_detects_edit(self):
        first = self.create()
        self.create(user=self.ben, key='ben', text='Ben text')
        with zipfile.ZipFile(io.BytesIO(self.store.export_archive(self.alice, self.group))) as archive:
            result = json.loads(archive.read('comments.json'))
        self.assertEqual([row['id'] for row in result], [first['id']])
        original = self.store._build_export_archive
        def change(*args):
            original(*args)
            conversations.update_comment(self.store, self.alice, self.group, first['id'], 1, 'edit', 'Changed')
        with patch.object(self.store, '_build_export_archive', side_effect=change):
            with self.assertRaises(Conflict):
                self.store.export_archive(self.alice, self.group)

    def test_concurrent_same_key_creates_one_comment_and_invalid_text_writes_nothing(self):
        barrier = threading.Barrier(2)
        def create(_):
            store = MemoryStore(self.temp.name)
            try:
                barrier.wait()
                return conversations.create_comment(store, self.alice, self.group, 'same', self.target(), 'Once')['id']
            finally:
                store.close()
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            identities = list(pool.map(create, range(2)))
        self.assertEqual(identities[0], identities[1])
        for text in ('', '  ', 'x' * 4001, None):
            with self.assertRaises(ValueError):
                self.create(key='invalid', text=text)
        for target in ({'kind': 'plan', 'id': 'x'}, {'kind': 'photo', 'id': self.assets[0], 'group': 'x'}):
            with self.assertRaises(ValueError):
                self.create(key='invalid-target', target=target)
