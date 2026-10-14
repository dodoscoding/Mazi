import io
import unittest
from datetime import datetime, timezone
import test_memories
from phase1.core import Denied, Conflict


class AdvancedTests(unittest.TestCase):
    setUp = test_memories.MemoryTests.setUp
    tearDown = test_memories.MemoryTests.tearDown
    submit = test_memories.MemoryTests.submit
    process = test_memories.MemoryTests.process

    def seal(self):
        self.store._now = lambda: 1800000000
        return self.store.seal_capsule(self.alice, self.group, 'Secret title', 'Secret words', '2030-01-01T00:00:00+00:00')

    def test_capsule_server_clock_isolation_and_departure(self):
        capsule = self.seal()
        self.assertNotIn('Secret', str(capsule))
        self.assertEqual(self.store.capsules(self.ben, self.group), [])
        for user in [self.alice, self.ben, self.outsider]:
            with self.assertRaises(Denied): self.store.capsule(user, self.group, capsule['id'])
        self.assertNotIn('Secret', str(self.store.recap(self.ben, self.group, 2030)))
        self.assertEqual(self.store.search(self.ben, self.group, query='Secret')['total'], 0)
        self.assertNotIn(b'Secret', self.store.export_archive(self.ben, self.group))
        self.store._now = lambda: 2000000000
        self.assertEqual(self.store.capsule(self.ben, self.group, capsule['id'])['text'], 'Secret words')
        self.store.remove_member(self.alice, self.group, self.ben)
        with self.assertRaises(Denied): self.store.capsule(self.ben, self.group, capsule['id'])
        self.store.delete_capsule(self.alice, self.group, capsule['id'])
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM time_capsules').fetchone()[0], 0)

    def test_capsule_validation_delete_and_opt_in(self):
        capsule = self.seal()
        self.assertEqual(self.store.notifications(self.ben, self.group)['items'], [])
        self.store.notification_opt_in(self.ben, self.group, True)
        self.assertEqual(self.store.notifications(self.ben, self.group)['items'], [])
        with self.assertRaises(Denied): self.store.delete_capsule(self.ben, self.group, capsule['id'])
        for date in ['2020-01-01T00:00:00Z', '2030-01-01', 'bad']:
            with self.assertRaises(ValueError): self.store.seal_capsule(self.alice, self.group, 'x', 'y', date)
        self.store._now = lambda: 2000000000
        self.assertEqual(len(self.store.notifications(self.ben, self.group)['items']), 1)
        self.store.notification_opt_in(self.ben, self.group, False)
        self.assertEqual(self.store.notifications(self.ben, self.group)['items'], [])
        self.store.delete_capsule(self.alice, self.group, capsule['id'])
        with self.assertRaises(Denied): self.store.capsule(self.alice, self.group, capsule['id'])

    def test_subevents_frames_video_and_revocation(self):
        story = self.store.create_story(self.alice, self.group, self.event)
        story = self.store.save_subevents(self.ben, self.group, story['id'], 1, [{'title':'Morning', 'assets':[self.assets[0]]}, {'title':'Evening', 'assets':[self.assets[1]]}])
        self.assertEqual(len(story['subevents']), 2)
        with self.assertRaises(Conflict): self.store.save_subevents(self.alice, self.group, story['id'], 1, [])
        with self.assertRaises(ValueError): self.store.save_subevents(self.alice, self.group, story['id'], 2, [{'title':'Bad', 'assets':['other']}])
        self.assertTrue(self.store.story_frame(self.ben, self.group, story['id'], self.assets[0]).startswith(b'\xff\xd8'))
        video = self.store.story_video(self.ben, self.group, story['id'])
        self.assertEqual(video[:4], b'RIFF')
        self.assertEqual(video[8:12], b'AVI ')
        self.assertEqual(video.count(b'00dc'), 12)  # six frames and six index entries
        self.store.hide(self.ben, self.assets[0], True)
        with self.assertRaises(Denied): self.store.story_video(self.ben, self.group, story['id'])
        with self.assertRaises(Denied): self.store.story_frame(self.ben, self.group, story['id'], self.assets[1])

    def test_capsule_photo_and_owner_departure(self):
        import base64
        self.store._now = lambda: 1800000000
        photo = base64.b64encode(test_memories.test_discovery.helpers.picture()).decode()
        capsule = self.store.seal_capsule(self.ben, self.group, 'Hidden', 'New photograph', '2030-01-01T00:00:00Z', photo)
        with self.assertRaises(Denied): self.store.capsule_photo(self.ben, self.group, capsule['id'])
        with self.assertRaises(Denied): self.store.capsule_export(self.alice, self.group, capsule['id'])
        self.store._now = lambda: 2000000000
        self.assertTrue(self.store.capsule_photo(self.alice, self.group, capsule['id']).startswith(b'\xff\xd8'))
        self.assertTrue(self.store.capsule_export(self.alice, self.group, capsule['id'])['photo_jpeg_base64'])
        self.store.remove_member(self.alice, self.group, self.ben)
        with self.assertRaises(Denied): self.store.capsule_photo(self.alice, self.group, capsule['id'])
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM time_capsules').fetchone()[0], 0)

    def test_video_mid_render_revocation(self):
        story = self.store.create_story(self.alice, self.group, self.event)
        original = self.store.story_frame
        def revoke(*args):
            frame = original(*args)
            self.store.hide(self.ben, self.assets[0], True)
            return frame
        self.store.story_frame = revoke
        with self.assertRaises(Denied): self.store.story_video(self.ben, self.group, story['id'])

    def test_capsule_does_not_enter_ai_and_video_frames_decode(self):
        import struct
        from PIL import Image
        capsule = self.seal()
        self.store.processing(self.alice, self.group, True, group_wide=True)
        self.store.processing(self.alice, self.group, True)
        for user, group_wide in [(self.alice, True), (self.alice, False), (self.ben, False)]:
            self.store.answer_processing(user, self.group, True, group_wide=group_wide)
        self.assertEqual(self.store.answer(self.ben, self.group, 'Secret words')['evidence'], [])
        story = self.store.create_story(self.alice, self.group, self.event)
        video = self.store.story_video(self.ben, self.group, story['id'])
        self.assertEqual(struct.unpack_from('<I', video, 4)[0], len(video)-8)
        movi = video.index(b'movi')
        end = movi - 4 + struct.unpack_from('<I', video, movi-4)[0]
        cursor, count = movi+4, 0
        while cursor < end:
            self.assertEqual(video[cursor:cursor+4], b'00dc')
            size = struct.unpack_from('<I', video, cursor+4)[0]
            with Image.open(io.BytesIO(video[cursor+8:cursor+8+size])) as frame:
                frame.load()
                self.assertEqual(frame.size, (640, 480))
            count += 1
            cursor += 8+size+(size%2)
        self.assertEqual(count, 6)
