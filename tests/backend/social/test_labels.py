import io
import json
import sqlite3
import zipfile
from unittest.mock import patch

from mazi.atlas import atlas_view
from mazi.identity.core import Conflict, Denied, Store
from mazi.social import labels
from tests.backend.social.test_comments import CommentsFixture


class LabelsTests(CommentsFixture):
    def read(self, user=None, assets=None):
        return labels.read_labels(self.store, user or self.alice, self.group, assets or [self.assets[0]])['items']

    def write(self, changes, expected, user=None, key='first', asset=None):
        return labels.set_labels(self.store, user or self.alice, self.group, key,
            [dict(asset=asset or self.assets[0], changes=changes, expected=expected)])['items'][0]

    def person(self):
        identity = self.store.create_person(self.alice, self.group, 'Ben')
        self.store.propose_identity(self.alice, identity, self.ben)
        self.store.confirm_identity(self.ben, identity)
        self.store.tag(self.alice, identity, self.assets[0], True)
        return identity

    def test_old_photos_are_unknown_and_sharer_names_are_not_depicted_people(self):
        result = self.read()[0]
        self.assertEqual(result['assetId'], self.assets[0])
        self.assertEqual(result['people'], [])
        self.assertEqual({name: value['value'] for name, value in result['labels'].items()},
                         dict(people_present='unknown', screenshot='unknown', ai='unknown'))
        self.assertTrue(all(value['revision'] == 0 and value['actor'] is None for value in result['labels'].values()))
        self.store.setup_shared(admin_name='Alice', group_id=self.group, mappings={'Alice': self.alice, 'Ben': self.ben})
        self.assertEqual(self.read()[0]['labels']['people_present']['value'], 'unknown')
        self.assertEqual(self.read()[0]['people'], [])
        self.assertEqual(len(atlas_view(self.store, self.alice, self.group)['memories']), 2)

    def test_independent_manual_dimensions_clear_versions_cas_and_exact_replay(self):
        first = self.write({'screenshot': 'yes', 'ai': 'generated'}, {'screenshot': 0, 'ai': 0})
        self.assertEqual((first['labels']['screenshot']['value'], first['labels']['ai']['value']), ('yes', 'generated'))
        self.assertEqual(first['labels']['screenshot']['method'], 'member')
        self.assertEqual(first['labels']['screenshot']['actor']['id'], self.alice)
        self.assertEqual(first['labels']['people_present']['revision'], 0)
        cleared = self.write({'screenshot': 'unknown'}, {'screenshot': 1}, key='clear')
        self.assertEqual((cleared['labels']['screenshot']['value'], cleared['labels']['screenshot']['revision']), ('unknown', 2))
        replay = self.write({'screenshot': 'yes', 'ai': 'generated'}, {'screenshot': 0, 'ai': 0})
        self.assertEqual(replay, cleared)
        with self.assertRaises(Conflict):
            self.write({'screenshot': 'no'}, {'screenshot': 0}, key='stale')
        with self.assertRaises(Conflict):
            self.write({'screenshot': 'no'}, {'screenshot': 2}, key='first')

    def test_visible_confirmed_people_derive_presence_and_manual_no_is_rejected(self):
        person = self.person()
        result = self.read()[0]
        self.assertEqual(result['people'], [dict(id=person, name='Ben', verified=True)])
        self.assertEqual((result['labels']['people_present']['value'], result['labels']['people_present']['declared'], result['labels']['people_present']['revision']), ('yes', 'unknown', 0))
        with self.assertRaises(Conflict):
            self.write({'people_present': 'no'}, {'people_present': 0})
        self.store.disassociate(self.ben, person, self.assets[0])
        self.assertEqual(self.read()[0]['people'], [])
        self.assertEqual(self.read()[0]['labels']['people_present']['value'], 'unknown')
        with self.assertRaises(Conflict):
            self.store.tag(self.alice, person, self.assets[0], True)
        self.assertEqual(self.write({'people_present': 'no'}, {'people_present': 0})['labels']['people_present']['value'], 'no')

    def test_suppressed_name_never_leaks_but_existing_approved_tag_rejects_manual_no(self):
        person = self.person()
        self.store.disassociate(self.ben, person, self.assets[0])
        with self.store.transaction():
            self.store.db.execute('INSERT INTO discovery_tags VALUES(?,?,?)', (person, self.assets[0], self.alice))
        result = self.read()[0]
        self.assertEqual(result['people'], [])
        self.assertEqual(result['labels']['people_present']['value'], 'unknown')
        self.assertNotIn('Ben', json.dumps(result))
        with self.assertRaises(Conflict):
            self.write({'people_present': 'no'}, {'people_present': 0})

    def test_bulk_is_atomic_for_version_conflict_and_mixed_access(self):
        items = [dict(asset=asset, changes={'screenshot': 'yes'}, expected={'screenshot': 0}) for asset in self.assets]
        self.write({'screenshot': 'no'}, {'screenshot': 0}, asset=self.assets[1])
        with self.assertRaises(Conflict):
            labels.set_labels(self.store, self.alice, self.group, 'bulk-stale', items)
        self.assertEqual(self.read()[0]['labels']['screenshot']['revision'], 0)
        self.store.hide(self.ben, self.assets[1], True)
        with self.assertRaises(Denied):
            labels.set_labels(self.store, self.ben, self.group, 'bulk-hidden', items)
        self.assertEqual(self.read()[0]['labels']['screenshot']['revision'], 0)
        items[1]['expected']['screenshot'] = 1
        result = labels.set_labels(self.store, self.alice, self.group, 'bulk', items)
        self.assertEqual([row['labels']['screenshot']['value'] for row in result['items']], ['yes', 'yes'])

    def test_hidden_overlapping_event_withdrawn_source_and_other_group_deny_reads_writes_and_replay(self):
        self.write({'ai': 'edited'}, {'ai': 0})
        event = self.store.review_event(self.alice, self.group, self.assets, 'Hidden winter', 'accept')
        self.store.hide_event(self.ben, self.group, event, True)
        with self.assertRaises(Denied):
            self.read(user=self.ben)
        with self.assertRaises(Denied):
            self.write({'ai': 'generated'}, {'ai': 1}, user=self.ben, key='hidden')
        other = self.store.create_group(self.outsider, 'Elsewhere')
        with self.assertRaises(Denied):
            labels.read_labels(self.store, self.outsider, other, [self.assets[0]])
        self.store.delete_origin(self.alice, self._origin(self.assets[0]))
        with self.assertRaises(Denied):
            self.write({'ai': 'edited'}, {'ai': 0})

    def test_departure_preserves_revision_and_stale_rows_do_not_resurrect_after_rejoin(self):
        self.write({'screenshot': 'yes'}, {'screenshot': 0}, user=self.ben)
        stale = tuple(self.store.db.execute('SELECT * FROM photo_labels').fetchone())
        older = Store(self.temp.name)
        try:
            older.remove_member(self.alice, self.group, self.ben)
        finally:
            older.close()
        result = self.read()[0]['labels']['screenshot']
        self.assertEqual((result['declared'], result['revision'], result['actor']), ('unknown', 2, None))
        self.store.accept(self.ben, self.store.invite(self.alice, self.group))
        with self.store.transaction():
            self.store.db.execute('DELETE FROM photo_labels WHERE asset_id=?', (self.assets[0],))
            self.store.db.execute('INSERT INTO photo_labels VALUES(?,?,?,?,?,?,?,?)', stale)
        self.assertEqual(self.read()[0]['labels']['screenshot']['value'], 'unknown')
        replay = self.write({'screenshot': 'yes'}, {'screenshot': 0}, user=self.ben)
        self.assertEqual(replay['labels']['screenshot']['revision'], 2)
        self.assertEqual(replay['labels']['screenshot']['value'], 'unknown')
        self.assertEqual(self.write({'screenshot': 'no'}, {'screenshot': 2}, user=self.ben, key='new')['labels']['screenshot']['revision'], 3)

    def test_departure_does_not_clear_another_members_later_declaration(self):
        self.write({'screenshot': 'yes'}, {'screenshot': 0}, user=self.ben)
        self.write({'screenshot': 'no'}, {'screenshot': 1}, key='later')
        self.store.remove_member(self.alice, self.group, self.ben)
        self.assertEqual(self.read()[0]['labels']['screenshot']['value'], 'no')
        self.assertEqual(self.read()[0]['labels']['screenshot']['revision'], 2)

    def test_label_and_confirmed_people_mutations_advance_discovery_generation(self):
        before = self.store._generation(self.group)
        self.write({'ai': 'none-declared'}, {'ai': 0})
        self.assertGreater(self.store._generation(self.group), before)
        before = self.store._generation(self.group)
        person = self.person()
        self.assertGreater(self.store._generation(self.group), before)
        before = self.store._generation(self.group)
        self.store.disassociate(self.ben, person, self.assets[0])
        self.assertGreater(self.store._generation(self.group), before)

    def test_authored_export_rechecks_current_scope_and_metadata_admission(self):
        self.write({'screenshot': 'yes'}, {'screenshot': 0})
        self.write({'ai': 'generated'}, {'ai': 0}, user=self.ben)
        with zipfile.ZipFile(io.BytesIO(self.store.export_archive(self.alice, self.group))) as archive:
            result = json.loads(archive.read('labels.json'))
        self.assertEqual([(row['assetId'], row['dimension'], row['declared']) for row in result], [(self.assets[0], 'screenshot', 'yes')])
        original = self.store._build_export_archive
        def change(*args):
            original(*args)
            self.write({'screenshot': 'unknown'}, {'screenshot': 1}, key='clear')
        with patch.object(self.store, '_build_export_archive', side_effect=change):
            with self.assertRaises(Conflict):
                self.store.export_archive(self.alice, self.group)
        self.store.hide(self.ben, self.assets[0], True)
        with zipfile.ZipFile(io.BytesIO(self.store.export_archive(self.ben, self.group))) as archive:
            self.assertNotIn('labels.json', archive.namelist())

    def test_input_bounds_exact_expected_fields_and_database_groups(self):
        for changes, expected in (({'screenshot': 'auto'}, {'screenshot': 0}), ({'ai': 'no'}, {'ai': 0}),
            ({'screenshot': 'yes'}, {'screenshot': True}), ({'screenshot': 'yes'}, {}), ({}, {}), ({'other': 'yes'}, {'other': 0})):
            with self.assertRaises(ValueError):
                self.write(changes, expected)
        item = dict(asset=self.assets[0], changes={'ai': 'unknown'}, expected={'ai': 0})
        for invalid in ([], [item, item], [dict(item, asset=str(index)) for index in range(51)]):
            with self.assertRaises(ValueError):
                labels.set_labels(self.store, self.alice, self.group, 'invalid', invalid)
        for invalid in ([], [self.assets[0]] * 2, [str(index) for index in range(51)]):
            with self.assertRaises(ValueError):
                labels.read_labels(self.store, self.alice, self.group, invalid)
        self.write({'ai': 'edited'}, {'ai': 0})
        other = self.store.create_group(self.outsider, 'Elsewhere')
        self.store.accept(self.alice, self.store.invite(self.outsider, other))
        with self.assertRaises(sqlite3.IntegrityError):
            with self.store.transaction():
                self.store.db.execute('UPDATE photo_labels SET group_id=?', (other,))
