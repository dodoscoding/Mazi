import concurrent.futures
import io
import json
import sqlite3
import threading
import zipfile
from unittest.mock import patch

from mazi.identity.core import Conflict, Denied, Store
from mazi.memories.memories import MemoryStore
from mazi.social import reactions
from tests.backend.social.test_comments import CommentsFixture


class ReactionsTests(CommentsFixture):
    def set_reaction(self, user=None, key='on', active=True, emoji='👍', target=None):
        return reactions.set_reaction(self.store, user or self.alice, self.group, key, target or self.target(), emoji, active)

    def item(self, value, emoji='👍'):
        return next(row for row in value['reactions'] if row['emoji'] == emoji)

    def test_desired_state_duplicate_enable_disable_and_old_replay_keep_latest_state(self):
        enabled = self.set_reaction()
        self.assertEqual(enabled['allowed_emojis'], ['👍', '❤️', '😂', '🎉'])
        self.assertEqual((enabled['total'], self.item(enabled)['count'], self.item(enabled)['mine']), (1, 1, True))
        self.assertEqual(self.set_reaction(key='again'), enabled)
        cleared = self.set_reaction(key='off', active=False)
        self.assertEqual((cleared['total'], self.item(cleared)['mine']), (0, False))
        self.assertEqual(self.set_reaction(), cleared)
        self.assertEqual(self.set_reaction(key='off', active=False), cleared)
        with self.assertRaises(Conflict):
            self.set_reaction(key='on', active=False)

    def test_photo_memory_and_comment_are_independent_targets_and_chat_evidence_is_unchanged(self):
        event = self.store.review_event(self.alice, self.group, self.assets, 'Two winters', 'accept')
        comment = self.create()
        before = self.store.origins(self.alice, self.assets[0])
        for index, target in enumerate((self.target(), dict(kind='memory', id=event), dict(kind='comment', id=comment['id']))):
            result = self.set_reaction(key=str(index), target=target)
            self.assertEqual(result['total'], 1)
            self.assertEqual(reactions.reactions(self.store, self.ben, self.group, target)['total'], 1)
        self.assertEqual(self.store.origins(self.alice, self.assets[0]), before)

    def test_current_members_names_counts_and_departure_through_identity_store(self):
        self.store.setup_shared(admin_name='Alice', group_id=self.group, mappings={'Alice': self.alice, 'Ben': self.ben})
        self.set_reaction()
        second = self.set_reaction(user=self.ben, key='ben')
        self.assertEqual(self.item(second)['count'], 2)
        self.assertEqual({row['name'] for row in self.item(second)['members']}, {'Alice', 'Ben'})
        stale = tuple(self.store.db.execute('SELECT * FROM social_reactions WHERE member_id=?', (self.ben,)).fetchone())
        older = Store(self.temp.name)
        try:
            older.remove_member(self.alice, self.group, self.ben)
        finally:
            older.close()
        self.assertEqual(reactions.reactions(self.store, self.alice, self.group, self.target())['total'], 1)
        self.store.accept(self.ben, self.store.invite(self.alice, self.group))
        with self.store.transaction():
            self.store.db.execute('INSERT INTO social_reactions VALUES(?,?,?,?,?,?,?,?,?,?)', stale)
        self.assertEqual(reactions.reactions(self.store, self.alice, self.group, self.target())['total'], 1)
        self.assertEqual(self.set_reaction(user=self.ben, key='ben')['total'], 1)
        self.assertEqual(self.set_reaction(user=self.ben, key='new-join')['total'], 2)

    def test_deleted_comment_cascades_and_stale_restore_does_not_restore_reaction(self):
        comment = self.create()
        target = dict(kind='comment', id=comment['id'])
        self.set_reaction(target=target)
        comment_row = tuple(self.store.db.execute('SELECT * FROM social_comments WHERE id=?', (comment['id'],)).fetchone())
        reaction_row = tuple(self.store.db.execute('SELECT * FROM social_reactions').fetchone())
        from mazi.social import conversations
        conversations.delete_comment(self.store, self.alice, self.group, comment['id'], 1, 'delete')
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM social_reactions').fetchone()[0], 0)
        with self.store.transaction():
            self.store.db.execute('INSERT INTO social_comments VALUES(?,?,?,?,?,?,?,?,?)', comment_row)
            self.store.db.execute('INSERT INTO social_reactions VALUES(?,?,?,?,?,?,?,?,?,?)', reaction_row)
        with self.assertRaises(Denied):
            reactions.reactions(self.store, self.ben, self.group, target)
        with self.assertRaises(Denied):
            self.set_reaction(target=target)

    def test_hidden_withdrawn_and_cross_group_targets_deny_counts_and_writes(self):
        comment = self.create()
        target = dict(kind='comment', id=comment['id'])
        self.set_reaction(target=target)
        self.store.hide(self.ben, self.assets[0], True)
        for current in (self.target(), target):
            with self.assertRaises(Denied):
                reactions.reactions(self.store, self.ben, self.group, current)
            with self.assertRaises(Denied):
                self.set_reaction(user=self.ben, key='hidden', target=current)
        other = self.store.create_group(self.outsider, 'Elsewhere')
        with self.assertRaises(Denied):
            reactions.reactions(self.store, self.outsider, other, target)
        self.store.delete_origin(self.alice, self._origin(self.assets[0]))
        with self.assertRaises(Denied):
            self.set_reaction(target=target)

    def test_hidden_overlapping_memory_children_mask_all_reaction_target_kinds(self):
        event = self.store.review_event(self.alice, self.group, self.assets, 'Two winters', 'accept')
        comment = self.create()
        targets = (self.target(), dict(kind='memory', id=event), dict(kind='comment', id=comment['id']))
        for index, target in enumerate(targets):
            self.set_reaction(key=str(index), target=target)
        with self.store.transaction():
            self.store.db.execute("INSERT INTO review_events SELECT 'overlap',group_id,asset_ids,'Hidden',status,actor_id,updated_at FROM review_events WHERE id=?", (event,))
        self.store.hide_event(self.ben, self.group, 'overlap', True)
        for target in targets:
            with self.assertRaises(Denied):
                reactions.reactions(self.store, self.ben, self.group, target)

    def test_database_uniqueness_and_group_target_constraints(self):
        self.set_reaction()
        row = tuple(self.store.db.execute('SELECT * FROM social_reactions').fetchone())
        duplicate = ('another', *row[1:])
        with self.assertRaises(sqlite3.IntegrityError):
            with self.store.transaction():
                self.store.db.execute('INSERT INTO social_reactions VALUES(?,?,?,?,?,?,?,?,?,?)', duplicate)
        other = self.store.create_group(self.outsider, 'Elsewhere')
        self.store.accept(self.alice, self.store.invite(self.outsider, other))
        with self.assertRaises(sqlite3.IntegrityError):
            with self.store.transaction():
                self.store.db.execute('UPDATE social_reactions SET group_id=?', (other,))
        with self.assertRaises(sqlite3.IntegrityError):
            with self.store.transaction():
                self.store.db.execute("UPDATE social_reactions SET emoji='not-allowed'")

    def test_invalid_emoji_state_and_notebook_targets_write_nothing(self):
        for emoji, active, target in (('🔥', True, self.target()), ('👍', 1, self.target()), ('👍', 'yes', self.target()),
            ('👍', True, dict(kind='notebook', id='story:author')), ('👍', True, dict(kind='comment', id='missing'))):
            with self.assertRaises((ValueError, Denied)):
                self.set_reaction(emoji=emoji, active=active, target=target)
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM social_reactions').fetchone()[0], 0)

    def test_authored_visible_reaction_export_and_final_admission_recheck(self):
        self.set_reaction()
        self.set_reaction(user=self.ben, key='ben', emoji='❤️')
        with zipfile.ZipFile(io.BytesIO(self.store.export_archive(self.alice, self.group))) as archive:
            result = json.loads(archive.read('reactions.json'))
        self.assertEqual([(row['target'], row['emoji']) for row in result], [(self.target(), '👍')])
        original = self.store._build_export_archive
        def change(*args):
            original(*args)
            self.set_reaction(key='off', active=False)
        with patch.object(self.store, '_build_export_archive', side_effect=change):
            with self.assertRaises(Conflict):
                self.store.export_archive(self.alice, self.group)
        self.store.hide(self.ben, self.assets[0], True)
        with zipfile.ZipFile(io.BytesIO(self.store.export_archive(self.ben, self.group))) as archive:
            self.assertNotIn('reactions.json', archive.namelist())

    def test_concurrent_duplicate_enable_has_one_member_reaction(self):
        barrier = threading.Barrier(2)
        def write(_):
            store = MemoryStore(self.temp.name)
            try:
                barrier.wait()
                return reactions.set_reaction(store, self.alice, self.group, 'same', self.target(), '👍', True)
            finally:
                store.close()
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(write, range(2)))
        self.assertEqual([value['total'] for value in results], [1, 1])
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM social_reactions').fetchone()[0], 1)

    def test_batch_is_bounded_atomic_and_matches_single_target_aggregates(self):
        comment = self.create()
        targets = [self.target(), dict(kind='comment', id=comment['id'])]
        self.set_reaction()
        self.set_reaction(key='comment', target=targets[1], emoji='❤️')
        result = reactions.batch_reactions(self.store, self.alice, self.group, targets)
        self.assertEqual(result['items'], [reactions.reactions(self.store, self.alice, self.group, target) for target in targets])
        for invalid in ([], [self.target()] * 51, [self.target(), self.target()]):
            with self.assertRaises(ValueError):
                reactions.batch_reactions(self.store, self.alice, self.group, invalid)
        self.store.hide(self.ben, self.assets[1], True)
        with self.assertRaises(Denied):
            reactions.batch_reactions(self.store, self.ben, self.group, [self.target(), self.target(1)])

    def test_member_names_are_capped_while_count_remains_exact(self):
        for number in range(51):
            user = self.store.register(f'reactor{number}@example.test', 'synthetic password')
            self.store.accept(user, self.store.invite(self.alice, self.group))
            self.set_reaction(user=user, key='react')
        result = reactions.reactions(self.store, self.alice, self.group, self.target())
        row = self.item(result)
        self.assertEqual((row['count'], len(row['members']), row['members_truncated']), (51, 50, True))
