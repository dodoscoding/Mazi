import io
import tempfile
import unittest

from PIL import Image

from phase1.core import Denied, Store


def picture():
    image = Image.new("RGB", (8, 8), "red")
    output = io.BytesIO()
    image.save(output, "JPEG", exif=b"GPS secret metadata")
    return output.getvalue()


class PilotTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(self.temp.name)
        self.alice = self.store.register("alice@example.test", "correct horse battery")
        self.ben = self.store.register("ben@example.test", "correct horse battery")
        self.cara = self.store.register("cara@example.test", "correct horse battery")
        self.group = self.store.create_group(self.alice, "Friends")

    def tearDown(self):
        self.store.close()
        self.temp.cleanup()

    def join(self, user):
        self.store.accept(user, self.store.invite(self.alice, self.group))

    def assert_denied(self, fn, *args):
        with self.assertRaises(Denied):
            fn(*args)

    def test_invite_single_use_and_membership_removal(self):
        token = self.store.invite(self.alice, self.group)
        self.assertEqual(self.store.accept(self.ben, token), self.group)
        self.assert_denied(self.store.accept, self.cara, token)
        self.store.remove_member(self.alice, self.group, self.ben)
        self.assert_denied(self.store.timeline, self.ben, self.group)

    def test_private_staging_selected_sharing_and_revocation(self):
        self.join(self.ben)
        self.join(self.cara)
        data = picture()
        media = self.store.upload_image(self.alice, self.group, "secret.jpg", data,
                                        "Private caption", "2020-01-02")
        self.assert_denied(self.store.media_view, self.ben, media)
        self.store.publish_media(self.alice, media, ["preview"], "selected", [self.ben])
        view = self.store.media_view(self.ben, media)
        self.assertNotIn("caption", view)
        self.assertNotIn("capture_date", view)
        self.assertNotIn("original_name", view)
        self.assert_denied(self.store.media_view, self.cara, media)
        self.assert_denied(self.store.media_bytes, self.ben, media, True)
        self.assertNotIn(b"GPS secret metadata", self.store.media_bytes(self.ben, media))
        self.store.revoke_media(self.alice, media)
        self.assert_denied(self.store.media_bytes, self.ben, media)

    def test_memory_does_not_grant_private_children(self):
        self.join(self.ben)
        media = self.store.upload_image(self.alice, self.group, "a.jpg", picture())
        memory = self.store.create_memory(self.alice, self.group, "Trip", [media])
        self.store.publish_memory(self.alice, memory, "group")
        self.assertEqual(self.store.memory_view(self.ben, memory)["visible_media_count"], 0)
        self.store.publish_media(self.alice, media, ["preview"], "group")
        self.assertEqual(self.store.memory_view(self.ben, memory)["visible_media_count"], 1)
        self.assertEqual(len(self.store.timeline(self.ben, self.group, "trip")), 1)

    def test_cross_group_and_admin_cannot_read_private_stage(self):
        self.join(self.ben)
        private = self.store.upload_image(self.ben, self.group, "a.jpg", picture())
        self.assert_denied(self.store.media_view, self.alice, private)
        other = self.store.create_group(self.alice, "Other")
        self.assert_denied(self.store.create_memory, self.alice, other, "Wrong", [private])

    def test_removed_member_cannot_publish_a_draft_memory(self):
        self.join(self.ben)
        self.join(self.cara)
        memory = self.store.create_memory(self.ben, self.group, "Ben private title", [])
        self.store.remove_member(self.alice, self.group, self.ben)
        self.assert_denied(self.store.publish_memory, self.ben, memory, "group", None, 0)
        self.assert_denied(self.store.memory_view, self.cara, memory)

    def test_deleted_memory_cannot_be_published(self):
        self.join(self.ben)
        memory = self.store.create_memory(self.alice, self.group, "Gone", [])
        self.store.db.execute("UPDATE memories SET status='deleted' WHERE id=?", (memory,))
        self.store.db.commit()
        self.assert_denied(self.store.publish_memory, self.alice, memory, "group")
        self.assert_denied(self.store.memory_view, self.ben, memory)

    def test_session_expiry_and_wrong_password(self):
        self.assert_denied(self.store.login, "alice@example.test", "wrong")
        token = self.store.login("alice@example.test", "correct horse battery")
        self.assertEqual(self.store.user_for_token(token), self.alice)
        self.store.logout(token)
        self.assert_denied(self.store.user_for_token, token)


if __name__ == "__main__":
    unittest.main()
