import io
import sys
from pathlib import Path
import unittest

from tests.backend.discovery import test_discovery
from mazi.identity.core import Conflict, Denied
from mazi.memories.memories import MemoryStore


class MemoryTests(unittest.TestCase):
    submit = test_discovery.DiscoveryTests.submit
    process = test_discovery.DiscoveryTests.process
    tearDown = test_discovery.DiscoveryTests.tearDown

    def setUp(self):
        test_discovery.DiscoveryTests.setUp(self)
        self.store.close()
        self.store = MemoryStore(self.temp.name)
        image = io.BytesIO()
        test_discovery.Image.new('RGB', (64, 64), 'blue').save(image, 'JPEG')
        self.run2 = self.submit({'second.jpg': image.getvalue()})
        self.process(self.run2)
        self.assets = self.store._visible_ids(self.alice, self.group)
        for asset in self.assets:
            self.store.correct_asset(self.alice, asset, title='Holiday', capture_date='2020-01-02', place='Amsterdam')
        self.event = self.store.review_event(self.alice, self.group, self.assets, 'Our holiday', 'accept')

    def test_recap_approved_dated_only_and_live_corrections(self):
        self.assertEqual(len(self.store.recap(self.ben, self.group, 2020)['memories']), 1)
        self.assertEqual(self.store.recap(self.ben, self.group, 2021)['memories'], [])
        self.store.correct_asset(self.alice, self.assets[0], title='Holiday', capture_date='2021-01-02', place='')
        self.assertEqual(self.store.recap(self.ben, self.group, 2020)['memories'], [])
        self.store.review_event(self.alice, self.group, self.assets, 'Our holiday', 'reject')
        self.assertEqual(self.store.recap(self.ben, self.group, 2021)['memories'], [])
        for invalid in [True, 0, '2020', 10000]:
            with self.assertRaises(ValueError): self.store.recap(self.ben, self.group, invalid)

    def test_collaboration_conflicts_ownership_and_restart(self):
        story = self.store.create_story(self.alice, self.group, self.event)
        story = self.store.write_story(self.ben, self.group, story['id'], story['revision'], 'A lovely day')
        with self.assertRaises(Conflict):
            self.store.write_story(self.alice, self.group, story['id'], 1, 'stale')
        story = self.store.write_story(self.alice, self.group, story['id'], story['revision'], 'My recollection')
        self.assertEqual(len(story['contributions']), 2)
        story = self.store.write_story(self.ben, self.group, story['id'], story['revision'], '')
        self.assertEqual([c['text'] for c in story['contributions']], ['My recollection'])
        self.store.close()
        self.store = MemoryStore(self.temp.name)
        self.assertEqual(self.store.story(self.ben, self.group, story['id'])['revision'], story['revision'])
        with self.assertRaises(Denied): self.store.delete_story(self.ben, self.group, story['id'], story['revision'])
        self.store.delete_story(self.alice, self.group, story['id'], story['revision'])
        with self.assertRaises(Denied): self.store.story(self.alice, self.group, story['id'])

    def test_all_reads_recheck_hidden_rejected_withdrawn_and_membership(self):
        story = self.store.create_story(self.alice, self.group, self.event)
        self.store.write_story(self.alice, self.group, story['id'], 1, 'Private context')
        self.store.hide(self.ben, self.assets[0], True)
        self.assertEqual(self.store.stories(self.ben, self.group), [])
        self.assertEqual(self.store.recap(self.ben, self.group, 2020)['memories'], [])
        with self.assertRaises(Denied): self.store.story(self.ben, self.group, story['id'])
        self.store.hide(self.ben, self.assets[0], False)
        self.store.hide_event(self.ben, self.group, self.event, True)
        self.assertEqual(self.store.stories(self.ben, self.group), [])
        self.store.hide_event(self.ben, self.group, self.event, False)
        self.store.withdraw(self.alice, self.run2)
        self.assertEqual(self.store.stories(self.ben, self.group), [])
        with self.assertRaises(Denied): self.store.recap(self.outsider, self.group, 2020)
        other = self.store.create_group(self.outsider, 'Other')
        with self.assertRaises(Denied): self.store.story(self.outsider, other, story['id'])
        self.store.remove_member(self.alice, self.group, self.ben)
        with self.assertRaises(Denied): self.store.stories(self.ben, self.group)

    def test_departure_removes_contribution(self):
        story = self.store.create_story(self.alice, self.group, self.event)
        self.store.write_story(self.ben, self.group, story['id'], 1, 'My words')
        self.store.remove_member(self.alice, self.group, self.ben)
        result = self.store.story(self.alice, self.group, story['id'])
        self.assertEqual(result['contributions'], [])
        self.assertGreater(result['revision'], 2)

    def test_rejection_creator_departure_and_limits(self):
        story = self.store.create_story(self.ben, self.group, self.event)
        self.store.write_story(self.alice, self.group, story['id'], 1, 'Another perspective')
        self.store.review_event(self.alice, self.group, self.assets, 'Our holiday', 'undo')
        with self.assertRaises(Denied): self.store.story(self.ben, self.group, story['id'])
        with self.assertRaises(Denied): self.store.create_story(self.ben, self.group, self.event)
        self.store.review_event(self.alice, self.group, self.assets, 'Our holiday', 'accept')
        for content in [[], 'x' * 2001]:
            with self.assertRaises(ValueError): self.store.write_story(self.ben, self.group, story['id'], 2, content)
        self.store.remove_member(self.alice, self.group, self.ben)
        self.assertEqual(self.store.stories(self.alice, self.group), [])
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM story_contributions').fetchone()[0], 0)

    def test_event_notebook_preserves_legacy_notes_and_owns_exact_target(self):
        first = self.store.create_story(self.alice, self.group, self.event)
        first = self.store.write_story(self.alice, self.group, first['id'], 1, 'First memory')
        first = self.store.write_story(self.ben, self.group, first['id'], 2, 'Ben remembers')
        second = self.store.create_story(self.alice, self.group, self.event)
        self.store.write_story(self.alice, self.group, second['id'], 1, 'Another perspective')
        self.store.db.execute('INSERT INTO shared_profiles VALUES(?,?,?,NULL)', (self.ben, 'ben', 'Ben'))
        notebook = self.store.event_notebook(self.ben, self.group, self.event)
        self.assertEqual(notebook['eventId'], self.event)
        notes = [note for section in notebook['sections'] for note in section['notes']]
        self.assertEqual(sorted(note['text'] for note in notes), ['Another perspective', 'Ben remembers', 'First memory'])
        mine = next(note for note in notes if note['ownership']['kind'] == 'mine')
        self.assertEqual(mine['authorName'], 'Ben')
        self.assertEqual({note['authorName'] for note in notes if note is not mine}, {'Group member'})
        target = mine['ownership']['target']
        saved = self.store.write_event_note(self.ben, self.group, self.event, target, 'Changed')
        with self.assertRaises(Conflict): self.store.write_event_note(self.ben, self.group, self.event, target, 'Stale')
        mine = next(note for section in saved['sections'] for note in section['notes'] if note['ownership']['kind'] == 'mine')
        removed = self.store.write_event_note(self.ben, self.group, self.event, mine['ownership']['target'], '')
        self.assertEqual(sorted(note['text'] for section in removed['sections'] for note in section['notes']), ['Another perspective', 'First memory'])
        self.store.close()
        self.store = MemoryStore(self.temp.name)
        self.assertEqual(len(self.store.event_notebook(self.ben, self.group, self.event)['sections']), 2)

    def test_event_note_first_save_is_atomic_and_rechecks_visibility(self):
        for invalid in ['', 'x' * 2001, []]:
            with self.assertRaises(ValueError): self.store.write_event_note(self.ben, self.group, self.event, {'kind': 'new'}, invalid)
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM advanced_stories').fetchone()[0], 0)
        notebook = self.store.write_event_note(self.ben, self.group, self.event, {'kind': 'new'}, 'Remembered')
        with self.assertRaises(Conflict): self.store.write_event_note(self.ben, self.group, self.event, {'kind': 'new'}, 'Lost response retry')
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM advanced_stories').fetchone()[0], 1)
        note = notebook['sections'][0]['notes'][0]
        self.assertEqual(note['text'], 'Remembered')
        for target in [None, {}, {'kind': 'saved', 'storyId': note['ownership']['target']['storyId'], 'revision': True}]:
            with self.assertRaises(ValueError): self.store.write_event_note(self.ben, self.group, self.event, target, 'Invalid')
        self.store.hide(self.ben, self.assets[0], True)
        with self.assertRaises(Denied): self.store.event_notebook(self.ben, self.group, self.event)
        with self.assertRaises(Denied): self.store.write_event_note(self.ben, self.group, self.event, note['ownership']['target'], 'Hidden')
        with self.assertRaises(Denied): self.store.event_notebook(self.outsider, self.group, self.event)
