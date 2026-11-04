import io
import json
import os
import sqlite3
import unittest
import zipfile
from unittest.mock import patch

from mazi.identity.core import Conflict, Denied, Store
from mazi.social import labels
from tests.backend.social import test_comments_postgres


@unittest.skipUnless(os.environ.get('MAZI_TEST_POSTGRES') == '1', 'requires isolated hosted test schema')
class HostedLabelsTests(unittest.TestCase):
    setUp = test_comments_postgres.HostedCommentsTests.setUp
    tearDown = test_comments_postgres.HostedCommentsTests.tearDown

    def write(self, value='yes', revision=0, user=None, key='first'):
        return labels.set_labels(self.store, user or self.alice, self.group, key,
            [dict(asset=self.asset, changes={'screenshot': value}, expected={'screenshot': revision})])['items'][0]

    def read(self):
        return labels.read_labels(self.store, self.alice, self.group, [self.asset])['items'][0]

    def test_unknown_cas_clear_epoch_precision_export_and_current_scope(self):
        self.assertEqual(self.read()['labels']['screenshot']['revision'], 0)
        before = self.store._generation(self.group)
        with patch.object(labels.time, 'time', return_value=1792000000.1234567):
            first = self.write()
        self.assertEqual(first['labels']['screenshot']['updated_at'], 1792000000.1234567)
        self.assertGreater(self.store._generation(self.group), before)
        self.assertEqual(self.write(), first)
        with self.assertRaises(Conflict):
            self.write('no', 0, key='stale')
        cleared = self.write('unknown', 1, key='clear')
        self.assertEqual((cleared['labels']['screenshot']['value'], cleared['labels']['screenshot']['revision']), ('unknown', 2))
        self.assertEqual(self.write(), cleared)
        with zipfile.ZipFile(io.BytesIO(self.store.export_archive(self.alice, self.group))) as archive:
            self.assertEqual(json.loads(archive.read('labels.json'))[0]['declared'], 'unknown')
        self.store.hide(self.alice, self.asset, True)
        with self.assertRaises(Denied):
            self.write()
        with zipfile.ZipFile(io.BytesIO(self.store.export_archive(self.alice, self.group))) as archive:
            self.assertNotIn('labels.json', archive.namelist())

    def test_identity_departure_preserves_monotonic_version_and_stale_rows_stay_unknown(self):
        self.write(user=self.ben)
        stale = tuple(self.store.db.execute('SELECT * FROM photo_labels WHERE group_id=?', (self.group,)).fetchone())
        older = Store(self.temp.name)
        try:
            older.remove_member(self.alice, self.group, self.ben)
        finally:
            older.close()
        value = self.read()['labels']['screenshot']
        self.assertEqual((value['value'], value['revision'], value['actor']), ('unknown', 2, None))
        self.assertIsNotNone(value['updated_at'])
        self.store.accept(self.ben, self.store.invite(self.alice, self.group))
        with self.store.transaction():
            self.store.db.execute('DELETE FROM photo_labels WHERE group_id=?', (self.group,))
            self.store.db.execute('INSERT INTO photo_labels VALUES(?,?,?,?,?,?,?,?)', stale)
        self.assertEqual(self.read()['labels']['screenshot']['value'], 'unknown')
        self.assertEqual(self.write(user=self.ben)['labels']['screenshot']['value'], 'unknown')
        self.assertEqual(self.write('no', 2, user=self.ben, key='new')['labels']['screenshot']['revision'], 3)
        with self.assertRaises(sqlite3.IntegrityError):
            with self.store.transaction():
                self.store.db.execute('UPDATE photo_label_versions SET revision=1 WHERE group_id=?', (self.group,))

    def test_approved_person_suppression_generation_and_private_group_storage(self):
        person = self.store.create_person(self.alice, self.group, 'Synthetic Ben')
        self.store.propose_identity(self.alice, person, self.ben)
        self.store.confirm_identity(self.ben, person)
        before = self.store._generation(self.group)
        self.store.tag(self.alice, person, self.asset, True)
        self.assertGreater(self.store._generation(self.group), before)
        self.assertEqual(self.read()['labels']['people_present']['value'], 'yes')
        with self.assertRaises(Conflict):
            labels.set_labels(self.store, self.alice, self.group, 'no', [dict(asset=self.asset, changes={'people_present': 'no'}, expected={'people_present': 0})])
        self.store.disassociate(self.ben, person, self.asset)
        self.assertEqual(self.read()['people'], [])
        self.assertEqual(self.read()['labels']['people_present']['value'], 'unknown')
        self.write()
        with self.assertRaises(sqlite3.IntegrityError):
            with self.store.transaction():
                self.store.db.execute('UPDATE photo_labels SET actor_id=? WHERE group_id=?', ('not-a-member', self.group))
        with self.store.transaction():
            self.store.db.execute('SET LOCAL enable_seqscan=off')
            details = ' '.join(row[0] for row in self.store.db.execute('EXPLAIN SELECT * FROM photo_labels WHERE group_id=? AND actor_id=?', (self.group, self.alice)))
            self.assertIn('photo_labels_actor', details)
        for table in ('photo_labels', 'photo_label_versions'):
            self.assertTrue(self.store.db.execute('SELECT relrowsecurity FROM pg_class WHERE oid=(current_schema()||\'.\'||?)::regclass', (table,)).fetchone()[0])
            for role in ('anon', 'authenticated'):
                self.assertFalse(self.store.db.execute("SELECT has_table_privilege(?,current_schema()||'.'||?,'SELECT')", (role, table)).fetchone()[0])
        self.assertFalse(self.store.db.execute("SELECT has_table_privilege(current_user,current_schema()||'.photo_label_versions','DELETE')").fetchone()[0])
