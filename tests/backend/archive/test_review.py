import sys
import tempfile
from unittest.mock import patch
from pathlib import Path
import unittest
import json
import io
import zipfile
from datetime import date

from mazi.identity.core import Conflict, Denied
from mazi.archive.review import ReviewStore
from mazi.archive.ops import create_backup, restore_backup, verify_backup
from tests.backend.imports import test_engine as helpers


class ReviewTests(unittest.TestCase):
    submit = helpers.EngineTests.submit
    process = helpers.EngineTests.process

    def setUp(self):
        helpers.EngineTests.setUp(self)
        self.store.close()
        self.store = ReviewStore(self.temp.name)

    def tearDown(self):
        helpers.EngineTests.tearDown(self)

    def test_busy_preview_is_retryable_without_reading_storage(self):
        import sqlite3
        from mazi.persistence import ArchiveBusy
        run = self.submit({"photo.jpg": helpers.picture()})
        self.process(run)
        asset = self.store.gallery(self.alice, self.group)[0]["id"]
        self.store.db.execute("PRAGMA busy_timeout=1")
        other = sqlite3.connect(Path(self.temp.name) / "mazi.sqlite3")
        try:
            other.execute("BEGIN IMMEDIATE")
            with patch.object(self.store.objects, 'read') as read:
                with self.assertRaises(ArchiveBusy):
                    self.store.rendition_bytes(self.alice, asset)
                read.assert_not_called()
        finally:
            other.rollback()
            other.close()
        self.assertTrue(self.store.rendition_bytes(self.alice, asset))

    def test_review_merge_rendition_undo_and_revocation(self):
        from io import BytesIO
        from PIL import Image

        other = BytesIO()
        Image.new("RGB", (8, 8), "red").save(other, "JPEG", quality=40)
        run = self.submit({"red.jpg": helpers.picture(), "red-compressed.jpg": other.getvalue()})
        self.process(run)
        ids = [item["id"] for item in self.store.gallery(self.ben, self.group)]
        self.assertEqual(len(ids), 2)
        suggestions = self.store.duplicate_suggestions(self.ben, self.group)
        self.assertEqual(len(suggestions), 1)
        with self.assertRaises(Denied):
            self.store.duplicate_suggestions(self.outsider, self.group)
        with self.assertRaises(Conflict):
            self.store.select_rendition(self.ben, self.group, ids[0], ids[1])
        self.store.review_pair(self.ben, self.group, *ids, "merge")
        preferred = max(ids, key=lambda asset: self.store._asset(self.ben, asset)["size"])
        for asset in ids:
            self.assertEqual(self.store.rendition_bytes(self.ben, asset), self.store.asset_bytes(self.ben, preferred))
        self.store.select_rendition(self.ben, self.group, ids[0], ids[1])
        self.assertEqual(self.store.rendition_bytes(self.ben, ids[0]), self.store.asset_bytes(self.ben, ids[1]))
        self.store.review_pair(self.ben, self.group, *ids, "undo")
        self.assertEqual(self.store.rendition_bytes(self.ben, ids[0]), self.store.asset_bytes(self.ben, ids[0]))
        self.store.withdraw(self.alice, run)
        self.assertEqual(self.store.duplicate_suggestions(self.ben, self.group), [])
        with self.assertRaises(Denied):
            self.store.rendition_bytes(self.ben, ids[0])

    def test_preview_locator_finishes_policy_transaction_before_storage(self):
        run = self.submit({'preview.jpg': helpers.picture()})
        self.process(run)
        asset = self.store.gallery(self.ben, self.group)[0]['id']
        statements = []
        self.store.db.set_trace_callback(statements.append)
        try:
            def read(area, key):
                self.assertEqual(area, 'archive-objects')
                self.assertFalse(self.store.db.in_transaction)
                self.assertIn('BEGIN IMMEDIATE', statements)
                self.assertEqual(statements[-1], 'COMMIT')
                return b'preview'
            with patch.object(self.store.objects, 'read', side_effect=read):
                self.assertEqual(self.store.rendition_bytes(self.ben, asset), b'preview')
        finally:
            self.store.db.set_trace_callback(None)
        self.assertEqual(sum(query.startswith('SELECT') for query in statements), 3)

    def test_different_flat_colors_are_not_duplicate_suggestions(self):
        from PIL import Image
        other = io.BytesIO()
        Image.new("RGB", (8, 8), "blue").save(other, "JPEG")
        run = self.submit({"red.jpg": helpers.picture(), "blue.jpg": other.getvalue()})
        self.process(run)
        self.assertEqual(self.store.duplicate_suggestions(self.ben, self.group), [])

    def test_event_suggestion_requires_evidenced_time(self):
        from io import BytesIO
        from PIL import Image
        other = BytesIO()
        Image.new("RGB", (8, 8), "blue").save(other, "JPEG")
        run = self.submit({"one.jpg": helpers.picture(), "two.jpg": other.getvalue()})
        self.process(run)
        self.assertEqual(self.store.event_suggestions(self.ben, self.group), [])
        for row in self.store.db.execute("SELECT id,payload FROM archive_origins"):
            payload = json.loads(row[1])
            payload["capture_assertions"] = [{"local": "2020-05-06T12:00:00", "source": "reviewed"}]
            self.store.db.execute("UPDATE archive_origins SET payload=? WHERE id=?", (json.dumps(payload), row[0]))
        self.store.db.commit()
        events = self.store.event_suggestions(self.ben, self.group)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["date"], "2020-05-06")
        with self.assertRaises(Denied):
            self.store.event_suggestions(self.outsider, self.group)

    def test_undo_uses_the_stored_event_after_one_photo_is_withdrawn(self):
        from io import BytesIO
        from PIL import Image
        files = {}
        for name, color in (("one.jpg", "red"), ("two.jpg", "blue"), ("three.jpg", "green")):
            image = BytesIO()
            Image.new("RGB", (8, 8), color).save(image, "JPEG")
            files[name] = image.getvalue()
        run = self.submit(files)
        self.process(run)
        ids = sorted(item["id"] for item in self.store.gallery(self.alice, self.group))
        event = self.store.review_event(self.alice, self.group, ids, "Our trip", "accept")
        origin = self.store.owned_origins(self.alice, self.group)[0]["id"]
        self.store.delete_origin(self.alice, origin)
        visible = self.store.reviewed_events(self.alice, self.group)[0]["assets"]
        self.assertEqual(len(visible), 2)
        self.store.review_event(self.alice, self.group, visible, "Our trip", "undo")
        self.assertIsNone(self.store.db.execute("SELECT 1 FROM review_events WHERE id=?", (event,)).fetchone())

    def test_conflicting_source_dates_need_correction_before_event(self):
        from PIL import Image
        second = io.BytesIO()
        Image.new("RGB", (8, 8), "blue").save(second, "JPEG")
        run = self.submit({"one.jpg": helpers.picture(), "two.jpg": second.getvalue()})
        self.process(run)
        rows = self.store.db.execute("SELECT id,asset_id,payload FROM archive_origins ORDER BY rowid").fetchall()
        for row in rows:
            payload = json.loads(row["payload"])
            payload["capture_assertions"] = [{"local": "2020-05-06T12:00:00"}]
            self.store.db.execute("UPDATE archive_origins SET payload=? WHERE id=?", (json.dumps(payload), row["id"]))
        # An overlapping appearance of the same asset asserts a different day.
        payload = json.loads(rows[0]["payload"])
        payload["capture_assertions"] = [{"local": "2020-05-07T12:00:00"}]
        self.store.db.execute("INSERT INTO archive_origins VALUES(?,?,?,?,?,?,?,?,0)",
                              ("conflicting-origin", rows[0]["asset_id"], self.group, self.alice, run,
                               "conflicting-occurrence", "fingerprint", json.dumps(payload)))
        self.store.db.commit()
        self.assertEqual(self.store.event_suggestions(self.ben, self.group), [])
        self.assertIsNone(next(item for item in self.store.timeline(self.ben, self.group)["items"]
                               if item["id"] == rows[0]["asset_id"])["date"])
        self.store.correct_asset(self.alice, rows[0]["asset_id"], title="", capture_date="2020-05-06", place="", anniversary=False)
        self.assertEqual(len(self.store.event_suggestions(self.ben, self.group)), 1)

    def test_corrections_events_anniversary_and_export(self):
        from PIL import Image
        second = io.BytesIO()
        Image.new("RGB", (8, 8), "blue").save(second, "JPEG")
        run = self.submit({"one.jpg": helpers.picture(), "two.jpg": second.getvalue()})
        self.process(run)
        assets = [item["id"] for item in self.store.gallery(self.ben, self.group)]
        for asset in assets:
            self.store.correct_asset(self.ben, asset, title="Reunion", capture_date="2020-10-06",
                                     place="Amsterdam", anniversary=True)
        page = self.store.timeline(self.alice, self.group, query="reunion")
        self.assertEqual(page["total"], 2)
        self.assertEqual(page["items"][0]["date_basis"], "reviewed correction")
        self.assertEqual(len(self.store.on_this_day(self.alice, self.group, date(2026, 10, 6))), 2)
        suggestions = self.store.event_suggestions(self.alice, self.group)
        self.assertEqual(len(suggestions), 1)
        self.store.review_event(self.ben, self.group, assets, "", "reject")
        self.assertEqual(self.store.event_suggestions(self.alice, self.group), [])
        self.assertEqual(self.store.reviewed_events(self.alice, self.group)[0]["status"], "rejected")
        self.store.review_event(self.ben, self.group, assets, "", "undo")
        self.assertEqual(len(self.store.event_suggestions(self.alice, self.group)), 1)
        event = self.store.review_event(self.ben, self.group, assets, "Our reunion", "accept")
        self.assertEqual(self.store.accepted_events(self.alice, self.group)[0]["id"], event)
        self.assertEqual(self.store.event_suggestions(self.alice, self.group), [])
        with zipfile.ZipFile(io.BytesIO(self.store.export_archive(self.ben, self.group))) as archive:
            manifest = json.loads(archive.read("manifest.json"))
            self.assertEqual(len(manifest["assets"]), 2)
            for item in manifest["assets"]:
                self.assertEqual(item["annotation"]["title"], "Reunion")
                self.assertTrue(archive.read("originals/" + item["id"]))
        with self.assertRaises(Denied):
            self.store.export_archive(self.outsider, self.group)
        self.store.withdraw(self.alice, run)
        self.assertEqual(self.store.accepted_events(self.ben, self.group), [])
        self.assertEqual(self.store.timeline(self.ben, self.group)["total"], 0)
        with zipfile.ZipFile(io.BytesIO(self.store.export_archive(self.ben, self.group))) as archive:
            self.assertEqual(json.loads(archive.read("manifest.json"))["assets"], [])

    def test_delete_one_origin_keeps_independent_copy(self):
        first = self.submit({"same.jpg": helpers.picture()}, user=self.alice)
        self.process(first, self.alice)
        second = self.submit({"same.jpg": helpers.picture()}, user=self.ben)
        self.process(second, self.ben)
        asset = self.store.gallery(self.ben, self.group)[0]["id"]
        own = self.store.owned_origins(self.alice, self.group)
        self.assertEqual(len(own), 1)
        with self.assertRaises(Denied):
            self.store.delete_origin(self.ben, own[0]["id"])
        self.store.delete_origin(self.alice, own[0]["id"])
        self.assertEqual(len(self.store.gallery(self.ben, self.group)), 1)
        self.assertEqual(self.store.origins(self.ben, asset)["total"], 1)
        self.store.delete_origin(self.ben, self.store.owned_origins(self.ben, self.group)[0]["id"])
        self.assertEqual(self.store.gallery(self.alice, self.group), [])
        with self.assertRaises(Denied):
            self.store.asset_bytes(self.alice, asset)

    def test_member_departure_withdraws_owned_contributions(self):
        mine = self.submit({"mine.jpg": helpers.picture()}, user=self.ben)
        self.process(mine, self.ben)
        asset = self.store.gallery(self.alice, self.group)[0]["id"]
        with self.assertRaises(Denied):
            self.store.leave_group(self.alice, self.group)
        self.store.leave_group(self.ben, self.group)
        self.assertEqual(self.store.gallery(self.alice, self.group), [])
        with self.assertRaises(Denied):
            self.store.asset_bytes(self.ben, asset)
        with self.assertRaises(Denied):
            self.store.timeline(self.ben, self.group)

    def test_offline_restore_keeps_withdrawal_and_detects_corruption(self):
        run = self.submit({"photo.jpg": helpers.picture()})
        self.process(run)
        self.store.withdraw(self.alice, run)
        with tempfile.TemporaryDirectory() as parent:
            backup = Path(parent) / "backup"
            restored = Path(parent) / "restored"
            self.assertTrue(create_backup(self.temp.name, backup)["files"] > 1)
            self.assertTrue(verify_backup(backup)["verified"])
            restore_backup(backup, restored)
            copy = ReviewStore(restored)
            try:
                self.assertEqual(copy.gallery(self.ben, self.group), [])
                self.assertEqual(copy.report(self.alice, run)["withdrawn"], True)
            finally:
                copy.close()
            original = next((backup / "archive-objects").iterdir())
            original.write_bytes(b"corrupt")
            with self.assertRaises(ValueError):
                verify_backup(backup)


if __name__ == "__main__":
    unittest.main()
