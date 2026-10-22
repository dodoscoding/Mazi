import hashlib
import io
import json
import tempfile
import unittest
from contextlib import contextmanager
from unittest.mock import patch

from PIL import Image

from mazi.identity.core import Conflict, Denied
from mazi.imports.engine import ImportStore
from tests.backend.imports.test_adapters import zip_bytes


def picture():
    output = io.BytesIO()
    Image.new("RGB", (8, 8), "red").save(output, "JPEG")
    return output.getvalue()


class EngineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = ImportStore(self.temp.name)
        self.alice = self.store.register("alice@example.test", "correct horse battery")
        self.ben = self.store.register("ben@example.test", "correct horse battery")
        self.outsider = self.store.register("outsider@example.test", "correct horse battery")
        self.group = self.store.create_group(self.alice, "Friends")
        self.store.accept(self.ben, self.store.invite(self.alice, self.group))

    def tearDown(self):
        self.store.close()
        self.temp.cleanup()

    def submit(self, files=None, source="manual", user=None, group=None, data=None):
        data = data or zip_bytes(files or {"photo.jpg": picture()})
        user, group = user or self.alice, group or self.group
        run = self.store.begin_import(user, group, source, "synthetic-account", len(data), hashlib.sha256(data).hexdigest(), {})
        status = self.store.report(user, run)
        if status["state"] == "UPLOADING":
            for offset in range(0, len(data), 512 * 1024):
                self.store.write_chunk(user, run, offset, data[offset:offset + 512 * 1024])
            self.store.finish_transfer(user, run)
        self.store.scan(run)
        return run

    def process(self, run, user=None):
        self.store.confirm(user or self.alice, run)
        while self.store.work_once():
            pass

    def tracked_archives(self):
        materialize = self.store.objects.materialize
        state = {"opens": 0, "active": 0, "peak": 0}
        @contextmanager
        def tracked(area, key):
            with materialize(area, key) as path:
                if area == "archives":
                    state["opens"] += 1
                    state["active"] += 1
                    state["peak"] = max(state["peak"], state["active"])
                try:
                    yield path
                finally:
                    if area == "archives":
                        state["active"] -= 1
        return state, patch.object(self.store.objects, "materialize", tracked)

    def scanning_run(self, records=1201, namespace="scan"):
        text = "\n".join(f"01/01/2024, 12:00 - Alice: synthetic {i}" for i in range(records))
        data = zip_bytes({"_chat.txt": text.encode()})
        run = self.store.begin_import(self.alice, self.group, "whatsapp", namespace, len(data), hashlib.sha256(data).hexdigest(), {"date_order": "DMY"})
        self.store.write_chunk(self.alice, run, 0, data)
        self.store.finish_transfer(self.alice, run)
        return run

    def test_scan_reuses_inventory_and_workspace_with_bounded_checkpoints(self):
        from mazi.imports import engine
        run = self.scanning_run()
        state, tracking = self.tracked_archives()
        statements = []
        self.store.db.set_trace_callback(statements.append)
        with tracking, patch.object(engine, "inventory", wraps=engine.inventory) as parse:
            self.store.scan(run, 500)
            self.assertEqual(self.store.report(self.alice, run)["checkpoint"], 500)
            self.assertEqual(state["active"], 1)
            self.store.scan(run, 500)
            self.store.scan(run, 500)
            self.assertEqual(parse.call_count, 1)
        self.assertEqual(state, {"opens": 1, "active": 0, "peak": 1})
        self.assertEqual(self.store.report(self.alice, run)["no_media"], 1201)
        inserts = [sql for sql in statements if sql.startswith("INSERT INTO import_items")]
        self.assertLessEqual(len(inserts), 10)

    def test_scan_external_cancel_releases_workspace_without_more_rows(self):
        run = self.scanning_run()
        state, tracking = self.tracked_archives()
        with tracking:
            self.store.scan(run, 500)
            other = ImportStore(self.temp.name)
            try:
                other.cancel(self.alice, run)
            finally:
                other.close()
            self.store.work_once()
            self.assertEqual(state["active"], 0)
        self.assertEqual(self.store.report(self.alice, run)["checkpoint"], 500)

    def test_scan_restart_reconstructs_once_and_keeps_ordinals(self):
        from mazi.imports import engine
        run = self.scanning_run()
        self.store.scan(run, 500)
        self.store.close()
        self.store = ImportStore(self.temp.name)
        with patch.object(engine, "inventory", wraps=engine.inventory) as parse:
            self.store.scan(run, 500)
            self.store.scan(run, 500)
            self.assertEqual(parse.call_count, 1)
        report = self.store.report(self.alice, run)
        self.assertEqual(report["discovered"], 1201)
        self.assertEqual(report["state"], "INVENTORIED")

    def test_scan_discards_consumed_batch_after_transaction_failure(self):
        run = self.scanning_run()
        self.store.scan(run, 500)
        transaction = self.store.transaction
        @contextmanager
        def broken():
            with transaction():
                yield
                raise RuntimeError("synthetic transaction failure")
        with patch.object(self.store, "transaction", broken):
            with self.assertRaises(RuntimeError):
                self.store.scan(run, 500)
        self.assertIsNone(self.store._scan_session)
        self.assertEqual(self.store.report(self.alice, run)["checkpoint"], 500)
        self.store.scan(run, 500)
        self.store.scan(run, 500)
        self.assertEqual(self.store.report(self.alice, run)["discovered"], 1201)

    def test_scan_fails_if_saved_checkpoint_exceeds_rebuilt_inventory(self):
        run = self.scanning_run(records=2)
        self.store.db.execute("UPDATE import_runs SET checkpoint=3 WHERE id=?", (run,))
        self.store.db.commit()
        self.assertFalse(self.store.scan(run, 500))
        report = self.store.report(self.alice, run)
        self.assertEqual(report["state"], "FAILED")
        self.assertEqual(report["error"], "Inventory shorter than saved checkpoint")
        self.assertIsNone(self.store._scan_session)

    def test_scan_checkpoint_race_reconstructs_without_duplicate_rows(self):
        run = self.scanning_run()
        self.store.scan(run, 500)
        other = ImportStore(self.temp.name)
        transaction = self.store.transaction
        @contextmanager
        def raced():
            other.scan(run, 500)
            with transaction():
                yield
        try:
            with patch.object(self.store, "transaction", raced):
                self.assertFalse(self.store.scan(run, 500))
            self.assertIsNone(self.store._scan_session)
            self.store.scan(run, 500)
            self.assertEqual(self.store.report(self.alice, run)["discovered"], 1201)
        finally:
            other.close()

    def test_scan_workspace_releases_on_withdraw_departure_and_close(self):
        for action in ("withdraw", "departure", "close"):
            with self.subTest(action=action):
                run = self.scanning_run(namespace=action)
                state, tracking = self.tracked_archives()
                with tracking:
                    self.store.scan(run, 500)
                    self.assertEqual(state["active"], 1)
                    if action == "withdraw":
                        self.store.withdraw(self.alice, run)
                    elif action == "departure":
                        self.store.db.execute("DELETE FROM members WHERE user_id=? AND group_id=?", (self.alice, self.group))
                        self.store.db.commit()
                        self.store.work_once()
                        self.store.db.execute("INSERT INTO members(group_id,user_id,role) VALUES(?,?,'admin')", (self.group, self.alice))
                        self.store.db.commit()
                    else:
                        self.store.close()
                        self.store = ImportStore(self.temp.name)
                    self.assertEqual(state["active"], 0)

    def test_finish_hashes_materialized_file_without_reading_archive_bytes(self):
        data = zip_bytes({"a.jpg": picture()})
        run = self.store.begin_import(self.alice, self.group, "manual", "stream", len(data), hashlib.sha256(data).hexdigest(), {})
        self.store.write_chunk(self.alice, run, 0, data)
        with patch.object(self.store.objects, "read", side_effect=AssertionError("full archive read")):
            self.store.finish_transfer(self.alice, run)
        self.assertEqual(self.store.report(self.alice, run)["state"], "SCANNING")

    def test_processing_reuses_one_archive_and_releases_at_completion(self):
        run = self.submit({"a.jpg": picture(), "b.jpg": picture(), "invalid.jpg": b"bad"})
        state, tracking = self.tracked_archives()
        with tracking:
            self.process(run)
        self.assertEqual(state, {"opens": 1, "active": 0, "peak": 1})
        self.assertEqual(self.store.report(self.alice, run)["counts"], {"AVAILABLE_TO_GROUP": 2, "FAILED": 1})
        asset = self.store.gallery(self.ben, self.group)[0]["id"]
        self.assertEqual(self.store.asset_bytes(self.ben, asset, True), picture())

    def test_processing_workspace_closes_on_cancel_and_store_close(self):
        run = self.submit({"a.jpg": picture(), "b.jpg": picture()})
        self.store.confirm(self.alice, run)
        state, tracking = self.tracked_archives()
        with tracking:
            self.store.work_once()
            self.assertEqual(state["active"], 1)
            self.store.cancel(self.alice, run)
            self.assertEqual(state["active"], 0)
        run = self.submit({"c.jpg": picture(), "d.jpg": picture()})
        self.store.confirm(self.alice, run)
        state, tracking = self.tracked_archives()
        with tracking:
            self.store.work_once()
            self.assertEqual(state["active"], 1)
            self.store.close()
            self.assertEqual(state["active"], 0)
        self.store = ImportStore(self.temp.name)
        while self.store.work_once():
            pass
        self.assertEqual(self.store.report(self.alice, run)["state"], "COMPLETED")

    def test_processing_workspace_replaces_run_and_observes_external_cancel(self):
        first = self.submit({"a.jpg": picture(), "b.jpg": picture()})
        second_group = self.store.create_group(self.alice, "Other circle")
        second = self.submit({"c.jpg": picture(), "d.jpg": picture()}, group=second_group)
        self.store.confirm(self.alice, first)
        self.store.confirm(self.alice, second)
        state, tracking = self.tracked_archives()
        with tracking:
            self.store.work_once()
            other = ImportStore(self.temp.name)
            try:
                other.cancel(self.alice, first)
                self.store.work_once()
                self.assertEqual(state, {"opens": 2, "active": 1, "peak": 1})
                other.cancel(self.alice, second)
                self.assertFalse(self.store.work_once())
                self.assertEqual(state["active"], 0)
            finally:
                other.close()
        self.assertEqual(len(self.store.gallery(self.alice, self.group)), 1)
        self.assertEqual(len(self.store.gallery(self.alice, second_group)), 1)

    def test_processing_rejects_replaced_archive_and_releases_workspace(self):
        run = self.submit({"a.jpg": picture()})
        self.store.objects.remove("archives", run)
        self.store.objects.retain("archives", run, zip_bytes({"a.jpg": b"replaced bytes"}))
        self.store.confirm(self.alice, run)
        state, tracking = self.tracked_archives()
        with tracking:
            self.store.work_once()
        self.assertEqual(state["active"], 0)
        self.assertEqual(self.store.report(self.alice, run)["items"][0]["reason"], "ARCHIVE_INVALID")
        self.assertEqual(self.store.gallery(self.ben, self.group), [])

    def test_upload_resume_scan_restart_and_manual_shared_pipeline(self):
        data = zip_bytes({"a.jpg": picture(), "bad.jpg": b"bad", "movie.mp4": b"video"})
        run = self.store.begin_import(self.alice, self.group, "manual", "account", len(data), hashlib.sha256(data).hexdigest(), {})
        midpoint = len(data) // 2
        self.store.write_chunk(self.alice, run, 0, data[:midpoint])
        self.store.close()
        self.store = ImportStore(self.temp.name)
        self.assertEqual(self.store.report(self.alice, run)["received"], midpoint)
        self.store.write_chunk(self.alice, run, 0, data[:midpoint])
        self.store.write_chunk(self.alice, run, midpoint, data[midpoint:])
        self.store.finish_transfer(self.alice, run)
        self.store.scan(run, batch_size=1)
        self.assertEqual(self.store.report(self.alice, run)["checkpoint"], 1)
        self.store.close()
        self.store = ImportStore(self.temp.name)
        self.store.scan(run)
        self.assertEqual(self.store.report(self.alice, run)["discovered"], 3)
        self.assertFalse(self.store.work_once())
        self.process(run)
        report = self.store.report(self.alice, run)
        self.assertEqual(report["state"], "COMPLETED")
        self.assertEqual(report["counts"], {"AVAILABLE_TO_GROUP": 1, "FAILED": 1, "UNSUPPORTED": 1})
        gallery = self.store.gallery(self.ben, self.group)
        self.assertEqual(len(gallery), 1)
        self.assertEqual(self.store.asset_bytes(self.ben, gallery[0]["id"], True), picture())
        with self.assertRaises(Denied):
            self.store.asset_bytes(self.outsider, gallery[0]["id"], True)

    def test_truncated_jpeg_fails_once_as_invalid_media(self):
        output = io.BytesIO()
        Image.effect_noise((640, 640), 64).convert("RGB").save(output, "JPEG", progressive=True)
        run = self.submit({"cut.jpg": output.getvalue()[:len(output.getvalue()) * 3 // 5]})
        self.process(run)
        item = self.store.report(self.alice, run)["items"][0]
        self.assertEqual((item["outcome"], item["reason"], item["attempts"]), ("FAILED", "INVALID_MEDIA", 1))

    def test_duplicate_bytes_keep_distinct_origins_and_same_manifest_replays(self):
        text = "01/01/2020, 12:00 - Ana: a.jpg (file attached)\n02/01/2020, 12:00 - Ana: a.jpg (file attached)"
        files = {"chat.txt": text, "a.jpg": picture()}
        run = self.submit(files, "whatsapp")
        self.process(run)
        self.assertEqual(self.submit(files, "whatsapp"), run)
        self.assertEqual(len(self.store.gallery(self.ben, self.group)), 1)
        self.assertEqual(len(self.store.gallery(self.ben, self.group)[0]["origins"]), 2)
        partial = self.submit({"chat.txt": text.splitlines()[1], "a.jpg": picture()}, "whatsapp")
        self.process(partial)
        self.assertEqual(len(self.store.gallery(self.ben, self.group)[0]["origins"]), 3)

    def test_slow_preparation_completes_with_unreclaimed_token(self):
        run = self.submit()
        self.store.confirm(self.alice, run)
        job = self.store.claim(now=100)
        clock = [101]
        prepare = self.store.prepare
        def slow_prepare(current):
            result = prepare(current)
            clock[0] = 161
            return result
        with patch("mazi.imports.engine.time.time", lambda: clock[0]), patch.object(self.store, "prepare", slow_prepare):
            self.store.complete(job)
        self.assertEqual(self.store.report(self.alice, run)["counts"], {"AVAILABLE_TO_GROUP": 1})
        asset = self.store.gallery(self.ben, self.group)[0]["id"]
        self.assertEqual(self.store.asset_bytes(self.ben, asset, True), picture())

    def test_replacement_claim_during_preparation_fences_old_token(self):
        run = self.submit()
        self.store.confirm(self.alice, run)
        job = self.store.claim(now=100)
        clock = [101]
        prepare = self.store.prepare
        other = ImportStore(self.temp.name)
        replacement = []
        def reclaimed_prepare(current):
            result = prepare(current)
            clock[0] = 161
            replacement.append(other.claim(now=161))
            return result
        try:
            with patch("mazi.imports.engine.time.time", lambda: clock[0]), patch.object(self.store, "prepare", reclaimed_prepare):
                with self.assertRaises(Conflict):
                    self.store.complete(job)
            self.assertEqual(self.store.gallery(self.ben, self.group), [])
            other.complete(replacement[0], now=162)
            self.assertEqual(len(self.store.gallery(self.ben, self.group)), 1)
        finally:
            other.close()

    def test_slow_preparation_observes_cancel_withdrawal_and_departure(self):
        for action in ("cancel", "withdraw", "remove"):
            with self.subTest(action=action):
                run = self.submit({f"slow-{action}.jpg": picture()}, user=self.ben)
                self.store.confirm(self.ben, run)
                job = self.store.claim(now=100)
                prepare = self.store.prepare
                clock = [101]
                def revoked_prepare(current):
                    result = prepare(current)
                    if action == "remove":
                        self.store.remove_member(self.alice, self.group, self.ben)
                    else:
                        getattr(self.store, action)(self.ben, run)
                    clock[0] = 161
                    return result
                with patch("mazi.imports.engine.time.time", lambda: clock[0]), patch.object(self.store, "prepare", revoked_prepare):
                    with self.assertRaises((Denied, Conflict)):
                        self.store.complete(job)
                self.assertEqual(self.store.gallery(self.alice, self.group), [])

    def test_expired_job_cannot_start_preparation(self):
        run = self.submit()
        self.store.confirm(self.alice, run)
        job = self.store.claim(now=100)
        with patch.object(self.store, "prepare") as prepare:
            with self.assertRaises(Conflict):
                self.store.complete(job, now=161)
            prepare.assert_not_called()

    def test_late_failure_keeps_retry_backoff_and_attempt_limit(self):
        run = self.submit()
        self.store.confirm(self.alice, run)
        now = 100
        for attempt in range(1, 4):
            job = self.store.claim(now=now)
            self.assertEqual(job["attempts"], attempt)
            self.store.fail(job, now=now + 61)
            item = self.store.report(self.alice, run)["items"][0]
            self.assertEqual(item["reason"], "RETRY_LIMIT" if attempt == 3 else "RETRY_SCHEDULED")
            self.assertIsNone(self.store.claim(now=now + 61))
            now += 61 + 2 ** attempt
        self.assertEqual(self.store.report(self.alice, run)["counts"], {"FAILED": 1})
        self.assertEqual(self.store.gallery(self.ben, self.group), [])

    def test_late_failure_cannot_replace_newer_claim(self):
        run = self.submit()
        self.store.confirm(self.alice, run)
        old = self.store.claim(now=100)
        current = self.store.claim(now=161)
        with self.assertRaises(Conflict):
            self.store.fail(old, now=162)
        self.store.complete(current, now=162)
        self.assertEqual(self.store.report(self.alice, run)["counts"], {"AVAILABLE_TO_GROUP": 1})

    def test_lease_fencing_cancel_and_membership_revocation(self):
        run = self.submit({"a.jpg": picture(), "b.jpg": picture()}, user=self.ben)
        self.store.confirm(self.ben, run)
        old = self.store.claim(now=100)
        replacement = self.store.claim(now=200)
        with self.assertRaises(Conflict):
            self.store.complete(old, now=201)
        self.store.complete(replacement, now=201)
        self.store.cancel(self.ben, run)
        report = self.store.report(self.ben, run)
        self.assertEqual(report["counts"], {"AVAILABLE_TO_GROUP": 1, "CANCELLED": 1})
        self.assertEqual(len(self.store.gallery(self.alice, self.group)), 1)
        self.store.remove_member(self.alice, self.group, self.ben)
        self.assertEqual(self.store.gallery(self.alice, self.group), [])
        self.store.accept(self.ben, self.store.invite(self.alice, self.group))
        self.assertEqual(self.store.gallery(self.alice, self.group), [])

    def test_late_completion_after_cancel_and_departure_denied(self):
        for action in ("cancel", "remove"):
            run = self.submit({f"{action}.jpg": picture()}, user=self.ben)
            self.store.confirm(self.ben, run)
            job = self.store.claim()
            if action == "cancel":
                self.store.cancel(self.ben, run)
            else:
                self.store.remove_member(self.alice, self.group, self.ben)
            with self.assertRaises((Conflict, Denied)):
                self.store.complete(job)
        self.assertEqual(self.store.gallery(self.alice, self.group), [])

    def test_recovery_after_object_write_and_retry_backoff(self):
        run = self.submit()
        self.store.confirm(self.alice, run)
        job = self.store.claim(now=100)
        prepared = self.store.prepare(job)
        self.store.close()
        self.store = ImportStore(self.temp.name)
        recovered = self.store.claim(now=200)
        self.store.complete(recovered, now=201)
        self.assertEqual(len(self.store.gallery(self.ben, self.group)), 1)
        with self.assertRaises(Conflict):
            self.store.complete(job, prepared, now=201)
        self.store.reconcile()
        self.assertEqual(self.store.asset_bytes(self.ben, self.store.gallery(self.ben, self.group)[0]["id"], True), picture())

    def test_withdraw_independent_contributions_and_owner_only_report(self):
        first = self.submit()
        self.process(first)
        second = self.submit(user=self.ben)
        self.process(second, self.ben)
        with self.assertRaises(Denied):
            self.store.report(self.ben, first)
        with self.assertRaises(Denied):
            self.store.cancel(self.ben, first)
        self.store.withdraw(self.alice, first)
        self.assertEqual(len(self.store.gallery(self.ben, self.group)[0]["origins"]), 1)
        self.store.withdraw(self.ben, second)
        self.assertEqual(self.store.gallery(self.alice, self.group), [])
        self.assertEqual(self.submit(), first)
        with self.assertRaises(Conflict):
            self.store.confirm(self.alice, first)

    def test_stable_ids_replay_and_conflicting_payload(self):
        def files(content, extra=""):
            return {"messages/c1/messages.csv": f'ID,Timestamp,Contents,Attachments\n1,2020-01-01 12:00:00,{content},a.jpg\n',
                    "a.jpg": picture(), "extra.txt": extra}
        first = self.submit(files("hello"), "discord")
        self.process(first)
        repeated = self.submit(files("hello", "different manifest"), "discord")
        self.process(repeated)
        self.assertEqual(len(self.store.gallery(self.ben, self.group)[0]["origins"]), 1)
        changed = self.submit(files("changed", "third manifest"), "discord")
        self.process(changed)
        report = self.store.report(self.alice, changed)
        self.assertEqual(report["items"][0]["reason"], "IDENTITY_CONFLICT")

    def test_twenty_thousand_manifest_replay_accounts_for_every_item(self):
        text = "ID,Timestamp,Contents,Attachments\n" + "".join(
            f"{i},2020-01-01 12:00:00,message {i},https://example.test/{i}.jpg\n" for i in range(20_000))
        files = {"messages/c1/messages.csv": text}
        run = self.submit(files, "discord")
        self.process(run)
        self.assertEqual(self.store.report(self.alice, run)["counts"], {"MISSING_MEDIA": 20_000})
        self.assertEqual(self.submit(files, "discord"), run)
        self.assertEqual(self.store.db.execute("SELECT count(*) FROM import_items").fetchone()[0], 20_000)
        self.assertEqual(self.store.db.execute("SELECT count(*) FROM archive_origins").fetchone()[0], 0)

    def test_retry_backoff_attempt_cap_and_explicit_retry(self):
        run = self.submit()
        self.store.confirm(self.alice, run)
        job = self.store.claim(now=100)
        self.store.fail(job, now=101)
        self.assertIsNone(self.store.claim(now=102))
        second = self.store.claim(now=103)
        self.store.fail(second, now=104)
        third = self.store.claim(now=108)
        self.store.fail(third, now=109)
        self.assertEqual(self.store.report(self.alice, run)["items"][0]["reason"], "RETRY_LIMIT")
        self.store.retry(self.alice, run, job["id"])
        self.store.work_once()
        self.assertEqual(self.store.report(self.alice, run)["counts"], {"AVAILABLE_TO_GROUP": 1})

    def test_two_workers_claim_once_and_reject_post_commit_replay(self):
        run = self.submit()
        self.store.confirm(self.alice, run)
        other = ImportStore(self.temp.name)
        try:
            job = self.store.claim()
            self.assertIsNone(other.claim())
            other.complete(job)
            with self.assertRaises(Conflict):
                self.store.complete(job)
        finally:
            other.close()
        self.assertEqual(self.store.db.execute("SELECT count(*) FROM archive_origins").fetchone()[0], 1)

    def test_concurrent_scanners_commit_each_batch_once(self):
        data = zip_bytes({"a.jpg": picture(), "b.jpg": picture()})
        run = self.store.begin_import(self.alice, self.group, "manual", "account", len(data), hashlib.sha256(data).hexdigest(), {})
        self.store.write_chunk(self.alice, run, 0, data)
        self.store.finish_transfer(self.alice, run)
        other = ImportStore(self.temp.name)
        inventory_read = other.transaction

        def first_scanner_commits(*args):
            self.store.scan(run, batch_size=1)
            return inventory_read(*args)

        other.transaction = first_scanner_commits
        try:
            self.assertFalse(other.scan(run, batch_size=1))
        finally:
            other.close()
        report = self.store.report(self.alice, run)
        self.assertEqual((report["checkpoint"], report["discovered"], report["state"]), (1, 1, "SCANNING"))
        self.store.scan(run)
        self.assertEqual(self.store.report(self.alice, run)["discovered"], 2)

    def test_other_group_has_independent_asset_and_no_foreign_metadata(self):
        run = self.submit()
        self.process(run)
        other_group = self.store.create_group(self.outsider, "Other")
        other = self.submit(user=self.outsider, group=other_group)
        self.process(other, self.outsider)
        first_asset = self.store.gallery(self.alice, self.group)[0]["id"]
        other_asset = self.store.gallery(self.outsider, other_group)[0]["id"]
        self.assertNotEqual(first_asset, other_asset)
        with self.assertRaises(Denied):
            self.store.asset_bytes(self.alice, other_asset)
        with self.assertRaises(Denied):
            self.store.gallery(self.outsider, self.group)

    def test_exif_capture_time_preserved_separately_and_preview_stripped(self):
        output = io.BytesIO()
        exif = Image.Exif()
        exif[306] = "2010:02:03 04:05:06"
        Image.new("RGB", (8, 8), "blue").save(output, "JPEG", exif=exif)
        run = self.submit({"chat.txt": "01/01/2020, 12:00 - Ana: a.jpg (file attached)", "a.jpg": output.getvalue()}, "whatsapp")
        self.process(run)
        asset = self.store.gallery(self.ben, self.group)[0]
        origin = asset["origins"][0]
        self.assertEqual(origin["capture_assertions"][0]["local"], "2010-02-03T04:05:06")
        self.assertEqual(origin["shared_at_assertion"]["local"], "2020-01-01T12:00:00")
        with Image.open(io.BytesIO(self.store.asset_bytes(self.ben, asset["id"]))) as preview:
            self.assertFalse(preview.getexif())

    def test_cancel_twenty_thousand_record_run_preserves_finished_prefix(self):
        text = "ID,Timestamp,Contents,Attachments\n" + "".join(
            f"{i},2020-01-01 12:00:00,message {i},a.jpg\n" for i in range(20_000))
        run = self.submit({"messages/c1/messages.csv": text, "a.jpg": picture()}, "discord")
        self.store.confirm(self.alice, run)
        self.store.work_once()
        self.store.cancel(self.alice, run)
        self.assertEqual(self.store.report(self.alice, run)["counts"], {"AVAILABLE_TO_GROUP": 1, "CANCELLED": 19_999})
        self.assertEqual(len(self.store.gallery(self.ben, self.group)), 1)

    def test_checksum_mismatch_can_restart_and_unsafe_archive_fails_closed(self):
        data = zip_bytes({"a.jpg": picture()})
        run = self.store.begin_import(self.alice, self.group, "manual", "account", len(data), hashlib.sha256(data).hexdigest(), {})
        self.store.write_chunk(self.alice, run, 0, b"x" * len(data))
        with self.assertRaises(Conflict):
            self.store.finish_transfer(self.alice, run)
        self.assertEqual(self.store.report(self.alice, run)["received"], 0)
        self.store.write_chunk(self.alice, run, 0, data)
        self.store.finish_transfer(self.alice, run)
        self.store.scan(run)
        bad = self.submit({"../outside.jpg": picture()})
        self.assertEqual(self.store.report(self.alice, bad)["state"], "FAILED")
        self.assertIn("Unsafe", self.store.report(self.alice, bad)["error"])
        with self.assertRaises(Conflict):
            self.store.confirm(self.alice, bad)

    def test_all_source_records_remain_accessible_through_pages(self):
        line = "01/01/2020, 12:00 - Ana: a.jpg (file attached)"
        run = self.submit({"chat.txt": "\n".join([line] * 102), "a.jpg": picture()}, "whatsapp")
        self.process(run)
        asset = self.store.gallery(self.ben, self.group)[0]
        self.assertEqual(asset["origin_count"], 102)
        self.assertEqual(len(asset["origins"]), 100)
        rest = self.store.origins(self.ben, asset["id"], asset["next_origin_offset"])
        self.assertEqual(len(rest["items"]), 2)
        self.assertIsNone(rest["next_offset"])
        with self.assertRaises(Denied):
            self.store.origins(self.outsider, asset["id"])


if __name__ == "__main__":
    unittest.main()
