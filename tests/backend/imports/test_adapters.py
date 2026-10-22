import io
import json
import tempfile
import unittest
import warnings
import zipfile
from pathlib import Path

from mazi.imports.adapters import Archive, ArchiveError, inventory


def zip_bytes(files):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        for name, data in files.items():
            archive.writestr(zipfile.ZipInfo(name, (2020, 1, 1, 0, 0, 0)), data)
    return output.getvalue()


class AdapterTests(unittest.TestCase):
    def parse(self, source, files, **options):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "export.zip"
            path.write_bytes(zip_bytes(files))
            with Archive(path) as archive:
                return list(inventory(archive, source, "synthetic-account", options))

    def test_whatsapp_platforms_multiline_context_and_ambiguous_dates(self):
        for text in (
            "03/04/2020, 13:15 - Ana: before\n03/04/2020, 13:16 - Ana: photo.jpg (file attached)\ncaption 🌊\n03/04/2020, 13:17 - Ben: after",
            "[03/04/2020, 1:15:00 PM] Ana: before\n[03/04/2020, 1:16:00 PM] Ana: <attached: photo.jpg>\ncaption 🌊\n[03/04/2020, 1:17:00 PM] Ben: after",
        ):
            items = self.parse("whatsapp", {"chat.txt": text, "photo.jpg": b"image"})
            photo = next(x for x in items if x.local_blob_reference == "photo.jpg")
            self.assertIsNone(photo.shared_at_assertion["local"])
            self.assertIn("AMBIGUOUS_DATE", photo.warnings)
            self.assertIn("after", str(photo.context))
            self.assertIn("caption 🌊", str(photo.context))
            self.assertEqual(photo.capture_assertions, [])
            explicit = self.parse("whatsapp", {"chat.txt": text, "photo.jpg": b"image"}, date_order="DMY")
            photo = next(x for x in explicit if x.local_blob_reference)
            self.assertTrue(photo.shared_at_assertion["local"].startswith("2020-04-03"))
            self.assertIsNone(photo.shared_at_assertion["utc"])
            american = self.parse("whatsapp", {"chat.txt": text, "photo.jpg": b"image"}, date_order="MDY")
            photo = next(x for x in american if x.local_blob_reference)
            self.assertTrue(photo.shared_at_assertion["local"].startswith("2020-03-04"))

    def test_whatsapp_dotted_clock_dates_photos(self):
        text = "[23/04/2024, 21.07.45] Ana: before\n[23/04/2024, 21.08.02] Ana: <attached: photo.jpg>\n[23/04/2024, 21.09.10] Ben: after"
        items = self.parse("whatsapp", {"chat.txt": text, "photo.jpg": b"image"})
        photo = next(x for x in items if x.local_blob_reference == "photo.jpg")
        self.assertEqual(photo.shared_at_assertion["local"], "2024-04-23T21:08:02")
        self.assertNotIn("AMBIGUOUS_DATE", photo.warnings)
        self.assertIn("after", str(photo.context))

    def test_messenger_reactions_unicode_and_missing_media(self):
        messages = {"title": "Friends", "participants": [{"name": "Ana"}], "messages": [
            {"sender_name": "Ana", "timestamp_ms": 1577836800000, "content": "cafÃ©",
             "photos": [{"uri": "photos/missing.jpg"}], "reactions": [{"reaction": "❤", "actor": "Ben"}]},
        ]}
        items = self.parse("messenger", {"messages/inbox/friends/message_1.json": json.dumps(messages)})
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].reactions[0]["actor"], "Ben")
        self.assertEqual(items[0].context[0]["text"], "café")
        self.assertEqual(items[0].shared_at_assertion["utc"], "2020-01-01T00:00:00+00:00")
        self.assertEqual(items[0].availability, "MISSING_MEDIA")

    def test_discord_sent_only_and_no_remote_fetch(self):
        items = self.parse("discord", {
            "messages/c123/channel.json": json.dumps({"id": "123", "name": "Trips"}),
            "messages/c123/messages.csv": 'ID,Timestamp,Contents,Attachments\n987,2020-01-01 12:00:00,hello,http://127.0.0.1/secret.jpg\n',
        })
        self.assertEqual(items[0].source_item_id, "987")
        self.assertEqual(items[0].availability, "MISSING_MEDIA")
        self.assertEqual(items[0].coverage["scope"], "requester_sent_messages_only")
        self.assertIn("REMOTE_NOT_FETCHED", items[0].warnings)

    def test_repeated_messages_and_partial_overlap_never_collapse(self):
        line = "01/01/2020, 12:00 - Ana: photo.jpg (file attached)"
        full = self.parse("whatsapp", {"chat.txt": line + "\n" + line, "photo.jpg": b"x"})
        partial = self.parse("whatsapp", {"chat.txt": line, "photo.jpg": b"x"})
        self.assertNotEqual(full[0].occurrence_key, full[1].occurrence_key)
        self.assertNotEqual(full[0].occurrence_key, partial[0].occurrence_key)
        self.assertTrue(all("UNCERTAIN_CROSS_EXPORT_IDENTITY" in x.warnings for x in full + partial))

    def test_context_bound_and_orphan_accounting(self):
        text = "\n".join(f"01/01/2020, 12:00 - Ana: {'a' * 1500}" for _ in range(6))
        text += "\n01/01/2020, 12:01 - Ana: photo.jpg (file attached)"
        items = self.parse("whatsapp", {"chat.txt": text, "photo.jpg": b"x", "orphan.mov": b"x"})
        photo = next(x for x in items if x.local_blob_reference == "photo.jpg")
        self.assertLessEqual(sum(len(x["text"]) for x in photo.context), 2000)
        self.assertEqual(items[-1].availability, "UNSUPPORTED")

    def test_archive_rejects_unsafe_names_duplicates_and_symlinks(self):
        for name in ("../escape", "/absolute", "C:/drive", "a\\..\\escape"):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as root:
                path = Path(root) / "bad.zip"
                path.write_bytes(zip_bytes({name: b"x"}))
                with self.assertRaises(ArchiveError):
                    Archive(path)
        for kind in ("duplicate", "symlink", "nested"):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as root:
                path = Path(root) / "bad.zip"
                with zipfile.ZipFile(path, "w") as archive:
                    if kind == "duplicate":
                        archive.writestr("a", b"x")
                        with warnings.catch_warnings():
                            warnings.simplefilter("ignore", UserWarning)
                            archive.writestr("a", b"y")
                    elif kind == "symlink":
                        entry = zipfile.ZipInfo("link")
                        entry.external_attr = 0o120777 << 16
                        archive.writestr(entry, "../outside")
                    else:
                        archive.writestr("hidden.bin", zip_bytes({"a": "b"}))
                with self.assertRaises(ArchiveError):
                    with Archive(path) as archive:
                        list(inventory(archive, "manual", "account", {}))

    def test_malformed_source_is_explicit_failure(self):
        items = self.parse("messenger", {"message_1.json": "not JSON", "orphan.png": b"x"})
        self.assertEqual(items[0].availability, "FAILED")
        self.assertEqual(items[0].reason, "MALFORMED_SOURCE")

    def test_expansion_bomb_and_unsafe_attachment_reference(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "bomb.zip"
            with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                archive.writestr("large.txt", b"0" * 1024 * 1024)
            with self.assertRaises(ArchiveError):
                Archive(path)
        items = self.parse("whatsapp", {"chat.txt": "01/01/2020, 12:00 - Ana: ../secret.jpg (file attached)"})
        self.assertEqual(items[0].reason, "UNSAFE_REFERENCE")

    def test_text_only_empty_and_unknown_export_formats_are_accounted(self):
        items = self.parse("whatsapp", {"chat.txt": "01/01/2020, 12:00 - Ana: just a message"})
        self.assertEqual(items[0].availability, "SKIPPED")
        self.assertEqual(self.parse("whatsapp", {"chat.txt": ""}), [])
        items = self.parse("messenger", {"messages.html": "<html>unsupported</html>"})
        self.assertEqual(items[0].availability, "UNSUPPORTED")


if __name__ == "__main__":
    unittest.main()
