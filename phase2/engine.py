"""Durable local import queue and authorized archive reads.

SQLite transactions are the local boundary; this is not Supabase RLS evidence.
Workers use separate connections and fenced, expiring leases. Object writes are
immutable and precede the availability transaction so crashed work can resume.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
import secrets
import sqlite3
import time
import uuid
import zipfile
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

from phase1.core import Conflict, Denied, Store
from .adapters import (Archive, ArchiveError, MAX_ARCHIVE, MAX_FILE, SOURCES,
                       digest, inventory)

LEASE_SECONDS = 60
MAX_ATTEMPTS = 3
TERMINAL = ("AVAILABLE_TO_GROUP", "MISSING_MEDIA", "UNSUPPORTED", "SKIPPED", "FAILED", "CANCELLED")

SCHEMA = """
CREATE TABLE IF NOT EXISTS import_runs (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
 group_id TEXT NOT NULL REFERENCES groups(id), source TEXT NOT NULL,
 namespace TEXT NOT NULL, manifest TEXT NOT NULL, options TEXT NOT NULL,
 size INTEGER NOT NULL, received INTEGER NOT NULL DEFAULT 0,
 state TEXT NOT NULL DEFAULT 'UPLOADING', checkpoint INTEGER NOT NULL DEFAULT 0,
 scan_done INTEGER NOT NULL DEFAULT 0, withdrawn INTEGER NOT NULL DEFAULT 0,
 error TEXT, created_at REAL NOT NULL,
 UNIQUE(owner_id,group_id,source,namespace,manifest,options)
);
CREATE TABLE IF NOT EXISTS import_items (
 id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES import_runs(id),
 ordinal INTEGER NOT NULL, occurrence TEXT NOT NULL, payload TEXT NOT NULL,
 outcome TEXT NOT NULL, reason TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, retry_at REAL NOT NULL DEFAULT 0,
 lease_token TEXT, lease_until REAL, asset_id TEXT,
 UNIQUE(run_id,ordinal)
);
CREATE INDEX IF NOT EXISTS import_queue ON import_items(outcome,retry_at,lease_until);
CREATE INDEX IF NOT EXISTS import_run_items ON import_items(run_id,ordinal);
CREATE INDEX IF NOT EXISTS import_run_outcomes ON import_items(run_id,outcome);
CREATE TABLE IF NOT EXISTS archive_assets (
 id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES groups(id),
 sha256 TEXT NOT NULL, original_key TEXT NOT NULL, preview_key TEXT NOT NULL,
 mime TEXT NOT NULL, size INTEGER NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
 UNIQUE(group_id,sha256)
);
CREATE TABLE IF NOT EXISTS archive_origins (
 id TEXT PRIMARY KEY, asset_id TEXT NOT NULL REFERENCES archive_assets(id),
 group_id TEXT NOT NULL REFERENCES groups(id), owner_id TEXT NOT NULL REFERENCES users(id),
 run_id TEXT NOT NULL REFERENCES import_runs(id), occurrence TEXT NOT NULL,
 fingerprint TEXT NOT NULL, payload TEXT NOT NULL, withdrawn INTEGER NOT NULL DEFAULT 0,
 UNIQUE(group_id,owner_id,occurrence)
);
CREATE INDEX IF NOT EXISTS archive_group ON archive_origins(group_id,withdrawn,asset_id);
CREATE INDEX IF NOT EXISTS archive_asset_origins ON archive_origins(asset_id,withdrawn);
"""


class ImportStore(Store):
    def __init__(self, root):
        super().__init__(root)
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("PRAGMA busy_timeout=5000")
        self.db.executescript(SCHEMA)
        self.archive_dir = self.root / "archives"
        self.object_dir = self.root / "archive-objects"
        for directory in (self.archive_dir, self.object_dir):
            directory.mkdir(mode=0o700, exist_ok=True)

    @contextmanager
    def transaction(self):
        self.db.execute("BEGIN IMMEDIATE")
        try:
            yield
            self.db.commit()
        except BaseException:
            self.db.rollback()
            raise

    def _run(self, user, run):
        row = self.db.execute("SELECT * FROM import_runs WHERE id=?", (run,)).fetchone()
        if row is None or row["owner_id"] != user:
            raise Denied("Import unavailable")
        self._member(user, row["group_id"])
        return row

    def begin_import(self, user, group, source, namespace, size, manifest, options):
        if source not in SOURCES or not isinstance(namespace, str) or not 1 <= len(namespace) <= 200:
            raise ValueError("Choose a supported source and an account namespace")
        if type(size) is not int or not 0 < size <= MAX_ARCHIVE:
            raise ValueError("ZIP must be between 1 byte and 128 MiB")
        if not isinstance(manifest, str) or len(manifest) != 64 or any(c not in "0123456789abcdef" for c in manifest):
            raise ValueError("Invalid manifest checksum")
        if not isinstance(options, dict) or set(options) - {"date_order"} or options.get("date_order") not in (None, "DMY", "MDY"):
            raise ValueError("Invalid adapter options")
        options = json.dumps(options, sort_keys=True)
        with self.transaction():
            self._member(user, group)
            prior = self.db.execute("SELECT id,size FROM import_runs WHERE owner_id=? AND group_id=? AND source=? "
                                    "AND namespace=? AND manifest=? AND options=?",
                                    (user, group, source, namespace, manifest, options)).fetchone()
            if prior:
                if prior["size"] != size:
                    raise Conflict("Manifest size conflict")
                return prior["id"]
            # Bound retained upload workspaces, including completed raw manifests.
            usage = self.db.execute("SELECT coalesce(sum(size),0) FROM import_runs WHERE group_id=?", (group,)).fetchone()[0]
            if usage + size > 2 * 1024**3:
                raise Conflict("Local group archive workspace limit is 2 GiB")
            run = str(uuid.uuid4())
            self.db.execute("INSERT INTO import_runs(id,owner_id,group_id,source,namespace,manifest,options,size,created_at) "
                            "VALUES(?,?,?,?,?,?,?,?,?)", (run, user, group, source, namespace, manifest, options, size, time.time()))
            self._audit(user, "import.begin", run)
        return run

    def write_chunk(self, user, run, offset, data):
        if type(offset) is not int or offset < 0 or not data or len(data) > 512 * 1024:
            raise ValueError("Invalid chunk")
        with self.transaction():
            row = self._run(user, run)
            if row["state"] != "UPLOADING" or offset > row["received"] or offset + len(data) > row["size"]:
                raise Conflict("Upload offset or state changed")
            path = self.archive_dir / run
            if not path.exists():
                path.touch(mode=0o600)
            with path.open("r+b") as file:
                file.seek(offset)
                if offset < row["received"]:
                    if offset + len(data) > row["received"] or file.read(len(data)) != data:
                        raise Conflict("Repeated chunk differs")
                    return row["received"]
                file.write(data)
                file.flush()
                os.fsync(file.fileno())
            self.db.execute("UPDATE import_runs SET received=? WHERE id=?", (offset + len(data), run))
            return offset + len(data)

    def finish_transfer(self, user, run):
        with self.transaction():
            row = self._run(user, run)
            if row["state"] != "UPLOADING":
                return
            if row["received"] != row["size"]:
                raise Conflict("Upload incomplete")
            with (self.archive_dir / run).open("rb") as source:
                actual = hashlib.file_digest(source, "sha256").hexdigest()
            if actual != row["manifest"]:
                # Allow the same upload to restart after corrupt bytes.
                self.db.execute("UPDATE import_runs SET received=0 WHERE id=?", (run,))
                self.db.commit()
                (self.archive_dir / run).unlink(missing_ok=True)
                raise Conflict("Archive checksum mismatch; transfer must restart")
            self.db.execute("UPDATE import_runs SET state='SCANNING' WHERE id=?", (run,))

    def scan(self, run, batch_size=50_000):
        row = self.db.execute("SELECT * FROM import_runs WHERE id=?", (run,)).fetchone()
        if row is None or row["state"] != "SCANNING":
            return False
        pending = []
        exhausted = True
        try:
            with Archive(self.archive_dir / run) as archive:
                for index, item in enumerate(inventory(archive, row["source"], row["namespace"], json.loads(row["options"]))):
                    if index < row["checkpoint"]:
                        continue
                    pending.append((index, item))
                    if len(pending) >= batch_size:
                        exhausted = False
                        break
            with self.transaction():
                current = self.db.execute("SELECT * FROM import_runs WHERE id=?", (run,)).fetchone()
                self._member(row["owner_id"], row["group_id"])
                if current["state"] != "SCANNING" or current["checkpoint"] != row["checkpoint"]:
                    return False
                for index, item in pending:
                    self.db.execute("INSERT INTO import_items(id,run_id,ordinal,occurrence,payload,outcome,reason) VALUES(?,?,?,?,?,?,?)",
                                    (str(uuid.uuid4()), run, index, item.occurrence_key, json.dumps(item.to_dict(), ensure_ascii=False),
                                     item.availability, item.reason))
                self.db.execute("UPDATE import_runs SET checkpoint=?,scan_done=?,state=? WHERE id=?",
                                (row["checkpoint"] + len(pending), int(exhausted), "INVENTORIED" if exhausted else "SCANNING", run))
            return True
        except (ArchiveError, zipfile.BadZipFile, UnicodeError, OSError, Denied, ValueError, TypeError, RecursionError) as exc:
            with self.transaction():
                message = str(exc) if isinstance(exc, ArchiveError) else "Archive unreadable or access removed"
                self.db.execute("UPDATE import_runs SET state='FAILED',error=? WHERE id=? AND state='SCANNING'", (message, run))
                self.db.execute("UPDATE import_items SET outcome='FAILED',reason='ARCHIVE_INVALID' WHERE run_id=? AND outcome='PENDING'", (run,))
            return False

    def confirm(self, user, run):
        with self.transaction():
            row = self._run(user, run)
            if row["withdrawn"] or row["state"] in ("FAILED", "CANCELLED"):
                raise Conflict("Import cannot be started")
            if row["state"] in ("PROCESSING", "COMPLETED"):
                return
            if row["state"] != "INVENTORIED":
                raise Conflict("Wait for the inventory")
            self.db.execute("UPDATE import_runs SET state='PROCESSING' WHERE id=?", (run,))
            self._audit(user, "import.confirm_group_sharing", run)
            self._reconcile_run(run)

    def _reconcile_run(self, run):
        active = self.db.execute("SELECT 1 FROM import_items WHERE run_id=? AND outcome IN ('PENDING','PROCESSING') LIMIT 1", (run,)).fetchone()
        if not active:
            self.db.execute("UPDATE import_runs SET state='COMPLETED' WHERE id=? AND state='PROCESSING'", (run,))

    def claim(self, now=None):
        now = time.time() if now is None else now
        with self.transaction():
            row = self.db.execute("SELECT i.*,r.group_id,r.owner_id FROM import_items i JOIN import_runs r ON r.id=i.run_id "
                                  "JOIN members m ON m.group_id=r.group_id AND m.user_id=r.owner_id "
                                  "WHERE r.state='PROCESSING' AND r.withdrawn=0 AND "
                                  "((i.outcome='PENDING' AND i.retry_at<=?) OR (i.outcome='PROCESSING' AND i.lease_until<=?)) "
                                  "ORDER BY r.created_at,i.ordinal LIMIT 1", (now, now)).fetchone()
            if not row:
                return None
            token = secrets.token_hex(24)
            if row["attempts"] >= MAX_ATTEMPTS:
                self.db.execute("UPDATE import_items SET outcome='FAILED',reason='RETRY_LIMIT',lease_token=NULL,lease_until=NULL WHERE id=?", (row["id"],))
                self._reconcile_run(row["run_id"])
                return {"exhausted": True}
            self.db.execute("UPDATE import_items SET outcome='PROCESSING',attempts=attempts+1,lease_token=?,lease_until=? WHERE id=?",
                            (token, now + LEASE_SECONDS, row["id"]))
            return {**dict(row), "lease_token": token, "lease_until": now + LEASE_SECONDS, "attempts": row["attempts"] + 1}

    def _fence(self, job, now):
        row = self.db.execute("SELECT i.*,r.state,r.withdrawn,r.owner_id,r.group_id FROM import_items i "
                              "JOIN import_runs r ON r.id=i.run_id WHERE i.id=?", (job["id"],)).fetchone()
        if (row is None or row["outcome"] != "PROCESSING" or row["lease_token"] != job["lease_token"] or
                row["lease_until"] <= now or row["state"] != "PROCESSING" or row["withdrawn"]):
            raise Conflict("Stale worker lease or cancelled import")
        self._member(row["owner_id"], row["group_id"])
        return row

    def _write_object(self, key, data):
        path = self.object_dir / key
        if path.exists():
            if hashlib.sha256(path.read_bytes()).digest() != hashlib.sha256(data).digest():
                raise Conflict("Retained object checksum conflict")
            return
        temp = self.object_dir / ("tmp-" + secrets.token_hex(16))
        try:
            with temp.open("xb") as target:
                os.chmod(temp, 0o600)
                target.write(data)
                target.flush()
                os.fsync(target.fileno())
            os.replace(temp, path)
        finally:
            temp.unlink(missing_ok=True)

    def prepare(self, job):
        from PIL import Image, ImageOps, UnidentifiedImageError
        payload = json.loads(job["payload"])
        try:
            with Archive(self.archive_dir / job["run_id"]) as archive:
                data = archive.read(payload["local_blob_reference"], MAX_FILE)
            with Image.open(io.BytesIO(data)) as image:
                if image.format not in ("JPEG", "PNG"):
                    return {"outcome": "UNSUPPORTED", "reason": "UNSUPPORTED_FORMAT_OR_CODEC"}
                if image.width * image.height > 24_000_000 or getattr(image, "n_frames", 1) > 1:
                    return {"outcome": "UNSUPPORTED", "reason": "PIXEL_OR_ANIMATION_LIMIT"}
                mime = Image.MIME[image.format]
                if payload["declared_media_type"] != mime:
                    return {"outcome": "UNSUPPORTED", "reason": "SIGNATURE_MISMATCH"}
                image.verify()
            with Image.open(io.BytesIO(data)) as image:
                exif = image.getexif()
                details = exif.get_ifd(34665) if 34665 in exif else {}
                capture = details.get(36867) or exif.get(36867) or exif.get(306)
                assertions = []
                locations = []
                if capture:
                    parsed = None
                    try:
                        parsed = datetime.strptime(str(capture), "%Y:%m:%d %H:%M:%S").isoformat()
                    except ValueError:
                        pass
                    assertions.append({"raw": str(capture), "source": "capture_exif", "utc": None, "local": parsed,
                                       "inferred": False, "precision": "second" if parsed else "unknown",
                                       "locator": "EXIF:DateTimeOriginal", "offset": str(details[36881]) if 36881 in details else None})
                if 34853 in exif:
                    gps = exif.get_ifd(34853)
                    locations.append({"source": "gps_exif", "raw": {str(k): str(v) for k, v in gps.items()},
                                      "inferred": False, "locator": "EXIF:GPSInfo"})
                width, height = image.size
                image = ImageOps.exif_transpose(image)
                image.thumbnail((1600, 1600))
                # Rebuild pixels to strip EXIF, ICC, GPS, and other source metadata.
                clean = Image.new("RGB", image.size)
                clean.paste(image.convert("RGB"))
                output = io.BytesIO()
                clean.save(output, format="JPEG", quality=85)
            sha = hashlib.sha256(data).hexdigest()
            # Include group in object identity: never infer or disclose cross-group reuse.
            key = digest([job["group_id"], sha])
            preview = output.getvalue()
            self._write_object(key + ".original", data)
            self._write_object(key + ".preview", preview)
            return {"outcome": "AVAILABLE_TO_GROUP", "reason": "IMPORTED", "sha256": sha,
                    "original_key": key + ".original", "preview_key": key + ".preview", "mime": mime,
                    "size": len(data) + len(preview), "width": width, "height": height,
                    "capture": assertions, "locations": locations}
        except FileNotFoundError:
            return {"outcome": "MISSING_MEDIA", "reason": "FILE_NOT_SUPPLIED"}
        except (UnidentifiedImageError, Image.DecompressionBombError, ValueError, zipfile.BadZipFile):
            return {"outcome": "FAILED", "reason": "INVALID_MEDIA"}

    def complete(self, job, prepared=None, now=None):
        clock = time.time if now is None else lambda: now
        # Check both before expensive work and at the database availability boundary.
        self._fence(job, clock())
        prepared = self.prepare(job) if prepared is None else prepared
        with self.transaction():
            row = self._fence(job, clock())
            outcome, reason, asset = prepared["outcome"], prepared["reason"], None
            if outcome == "AVAILABLE_TO_GROUP":
                payload = json.loads(row["payload"])
                payload["capture_assertions"] = prepared["capture"]
                payload["location_assertions"] = prepared["locations"]
                # Context windows and source locators can legitimately differ in overlapping exports.
                primary_context = [c for c in payload["context"] if
                                   payload["original_metadata_reference"].endswith("#" + c["locator"])]
                fingerprint = digest([prepared["sha256"], payload["sender"], payload["shared_at_assertion"],
                                      [c["text"] for c in primary_context], payload["reactions"]])
                existing = self.db.execute("SELECT * FROM archive_origins WHERE group_id=? AND owner_id=? AND occurrence=?",
                                           (row["group_id"], row["owner_id"], row["occurrence"])).fetchone()
                if existing:
                    asset = existing["asset_id"]
                    if existing["withdrawn"]:
                        outcome, reason = "SKIPPED", "PREVIOUSLY_WITHDRAWN"
                    elif existing["fingerprint"] != fingerprint:
                        outcome, reason = "FAILED", "IDENTITY_CONFLICT"
                    else:
                        reason = "ALREADY_IMPORTED"
                else:
                    retained = self.db.execute("SELECT id FROM archive_assets WHERE group_id=? AND sha256=?",
                                               (row["group_id"], prepared["sha256"])).fetchone()
                    quota = self.db.execute("SELECT coalesce(sum(size),0) FROM archive_assets WHERE group_id=?", (row["group_id"],)).fetchone()[0]
                    own_quota = self.db.execute("SELECT coalesce(sum(size),0) FROM archive_assets a WHERE a.group_id=? AND EXISTS "
                                                "(SELECT 1 FROM archive_origins o WHERE o.asset_id=a.id AND o.owner_id=?)",
                                                (row["group_id"], row["owner_id"])).fetchone()[0]
                    owned = self.db.execute("SELECT 1 FROM archive_origins o JOIN archive_assets a ON a.id=o.asset_id "
                                            "WHERE o.owner_id=? AND o.group_id=? AND a.sha256=? LIMIT 1",
                                            (row["owner_id"], row["group_id"], prepared["sha256"])).fetchone()
                    if quota + (0 if retained else prepared["size"]) > 20 * 1024**3:
                        outcome, reason = "FAILED", "GROUP_STORAGE_LIMIT"
                    elif own_quota + (0 if owned else prepared["size"]) > 5 * 1024**3:
                        outcome, reason = "FAILED", "CONTRIBUTOR_STORAGE_LIMIT"
                    else:
                        asset = str(uuid.uuid4())
                        self.db.execute("INSERT OR IGNORE INTO archive_assets VALUES(?,?,?,?,?,?,?,?,?)",
                                        (asset, row["group_id"], prepared["sha256"], prepared["original_key"], prepared["preview_key"],
                                         prepared["mime"], prepared["size"], prepared["width"], prepared["height"]))
                        asset = self.db.execute("SELECT id FROM archive_assets WHERE group_id=? AND sha256=?",
                                                (row["group_id"], prepared["sha256"])).fetchone()[0]
                        self.db.execute("INSERT INTO archive_origins VALUES(?,?,?,?,?,?,?,?,0)",
                                        (str(uuid.uuid4()), asset, row["group_id"], row["owner_id"], row["run_id"], row["occurrence"],
                                         fingerprint, json.dumps(payload, ensure_ascii=False)))
                        self._audit(row["owner_id"], "import.available_to_group", row["id"])
            self.db.execute("UPDATE import_items SET outcome=?,reason=?,asset_id=?,lease_token=NULL,lease_until=NULL WHERE id=?",
                            (outcome, reason, asset, row["id"]))
            self._reconcile_run(row["run_id"])

    def fail(self, job, now=None):
        now = time.time() if now is None else now
        with self.transaction():
            row = self._fence(job, now)
            terminal = row["attempts"] >= MAX_ATTEMPTS
            self.db.execute("UPDATE import_items SET outcome=?,reason=?,retry_at=?,lease_token=NULL,lease_until=NULL WHERE id=?",
                            ("FAILED" if terminal else "PENDING", "RETRY_LIMIT" if terminal else "RETRY_SCHEDULED",
                             now + 2 ** row["attempts"], row["id"]))
            self._reconcile_run(row["run_id"])

    def work_once(self):
        scanning = self.db.execute("SELECT id FROM import_runs WHERE state='SCANNING' ORDER BY created_at LIMIT 1").fetchone()
        if scanning:
            self.scan(scanning["id"], batch_size=500)
            return True
        job = self.claim()
        if job is None:
            return False
        if job.get("exhausted"):
            return True
        try:
            self.complete(job)
        except (Denied, Conflict):
            # Cancellation, departure, or a newer lease already owns the outcome.
            pass
        except OSError:
            try:
                self.fail(job)
            except (Denied, Conflict):
                pass
        return True

    def retry(self, user, run, item_id):
        with self.transaction():
            row = self._run(user, run)
            if row["withdrawn"] or row["state"] in ("CANCELLED", "FAILED"):
                raise Conflict("Import cannot be retried")
            changed = self.db.execute("UPDATE import_items SET outcome='PENDING',reason='RETRY_REQUESTED',attempts=0,retry_at=0 "
                                      "WHERE id=? AND run_id=? AND outcome='FAILED' AND reason IN ('RETRY_LIMIT','INVALID_MEDIA')",
                                      (item_id, run)).rowcount
            if not changed:
                raise Conflict("Item is not retryable")
            self.db.execute("UPDATE import_runs SET state='PROCESSING' WHERE id=?", (run,))

    def cancel(self, user, run):
        with self.transaction():
            self._run(user, run)
            self._cancel(run)
            self._audit(user, "import.cancel", run)

    def _cancel(self, run):
        self.db.execute("UPDATE import_runs SET state='CANCELLED' WHERE id=?", (run,))
        self.db.execute("UPDATE import_items SET outcome='CANCELLED',reason='IMPORT_CANCELLED',lease_token=NULL,lease_until=NULL "
                        "WHERE run_id=? AND outcome IN ('PENDING','PROCESSING')", (run,))

    def withdraw(self, user, run):
        with self.transaction():
            self._run(user, run)
            self._cancel(run)
            self.db.execute("UPDATE import_runs SET withdrawn=1 WHERE id=?", (run,))
            self.db.execute("UPDATE archive_origins SET withdrawn=1 WHERE run_id=?", (run,))
            self._audit(user, "import.withdraw", run)

    def remove_member(self, admin, group, user):
        # The inherited method commits this connection; all departure effects share that commit.
        self._member(admin, group, admin=True)
        if admin == user:
            raise Denied("Admin cannot remove self")
        self.db.execute("BEGIN IMMEDIATE")
        try:
            for run in self.db.execute("SELECT id FROM import_runs WHERE owner_id=? AND group_id=?", (user, group)).fetchall():
                self._cancel(run["id"])
            self.db.execute("UPDATE import_runs SET withdrawn=1 WHERE owner_id=? AND group_id=?", (user, group))
            self.db.execute("UPDATE archive_origins SET withdrawn=1 WHERE owner_id=? AND group_id=?", (user, group))
            super().remove_member(admin, group, user)
        except BaseException:
            self.db.rollback()
            raise

    def report(self, user, run, offset=0, limit=100):
        row = self._run(user, run)
        if type(offset) is not int or offset < 0 or type(limit) is not int or not 1 <= limit <= 100:
            raise ValueError("Invalid report page")
        counts = {r[0]: r[1] for r in self.db.execute("SELECT outcome,count(*) FROM import_items WHERE run_id=? GROUP BY outcome", (run,))}
        items = []
        for item in self.db.execute("SELECT * FROM import_items WHERE run_id=? ORDER BY ordinal LIMIT ? OFFSET ?", (run, limit, offset)):
            payload = json.loads(item["payload"])
            items.append({"id": item["id"], "ordinal": item["ordinal"], "outcome": item["outcome"],
                          "reason": item["reason"], "attempts": item["attempts"], "asset_id": item["asset_id"],
                          "filename": payload.get("original_filename"), "locator": payload["original_metadata_reference"],
                          "warnings": payload["warnings"], "shared_at": payload["shared_at_assertion"]})
        return {"id": run, "source": row["source"], "state": row["state"], "received": row["received"], "size": row["size"],
                "checkpoint": row["checkpoint"], "scan_complete": bool(row["scan_done"]), "withdrawn": bool(row["withdrawn"]),
                "error": row["error"], "discovered": sum(counts.values()), "counts": counts, "items": items,
                "next_offset": offset + len(items) if offset + len(items) < sum(counts.values()) else None,
                "coverage": "Only supplied records; archive coverage is incomplete.",
                "unique_assets": self.db.execute("SELECT count(DISTINCT asset_id) FROM import_items WHERE run_id=? AND outcome='AVAILABLE_TO_GROUP'", (run,)).fetchone()[0]}

    def imports_for(self, user, group):
        self._member(user, group)
        return [dict(row) for row in self.db.execute("SELECT id,source,state,withdrawn,created_at FROM import_runs WHERE owner_id=? AND group_id=? ORDER BY created_at DESC LIMIT 100", (user, group))]

    def _asset(self, user, asset):
        row = self.db.execute("SELECT a.* FROM archive_assets a JOIN members m ON m.group_id=a.group_id "
                              "WHERE a.id=? AND m.user_id=?", (asset, user)).fetchone()
        if not row:
            raise Denied("Media unavailable")
        if not self.db.execute("SELECT 1 FROM archive_origins o JOIN members m ON m.user_id=o.owner_id AND m.group_id=o.group_id "
                               "WHERE o.asset_id=? AND o.withdrawn=0 LIMIT 1", (asset,)).fetchone():
            raise Denied("Media unavailable")
        return row

    def asset_bytes(self, user, asset, original=False):
        row = self._asset(user, asset)
        return (self.object_dir / row["original_key" if original else "preview_key"]).read_bytes()

    def gallery(self, user, group, offset=0, limit=30):
        self._member(user, group)
        if type(offset) is not int or offset < 0 or type(limit) is not int or not 1 <= limit <= 100:
            raise ValueError("Invalid gallery page")
        rows = self.db.execute("SELECT a.* FROM archive_assets a WHERE a.group_id=? AND EXISTS "
                               "(SELECT 1 FROM archive_origins o JOIN members m ON m.user_id=o.owner_id AND m.group_id=o.group_id "
                               "WHERE o.asset_id=a.id AND o.withdrawn=0) ORDER BY a.rowid DESC LIMIT ? OFFSET ?", (group, limit, offset))
        results = []
        for row in rows:
            origins = self.origins(user, row["id"])
            results.append({"id": row["id"], "width": row["width"], "height": row["height"],
                            "origins": origins["items"], "origin_count": origins["total"],
                            "next_origin_offset": origins["next_offset"]})
        return results

    def origins(self, user, asset, offset=0):
        self._asset(user, asset)
        if type(offset) is not int or offset < 0:
            raise ValueError("Invalid source record page")
        clause = ("FROM archive_origins o JOIN members m ON m.user_id=o.owner_id AND m.group_id=o.group_id "
                  "WHERE o.asset_id=? AND o.withdrawn=0")
        total = self.db.execute("SELECT count(*) " + clause, (asset,)).fetchone()[0]
        rows = self.db.execute("SELECT o.payload " + clause + " ORDER BY o.rowid LIMIT 100 OFFSET ?", (asset, offset))
        items = [json.loads(row[0]) for row in rows]
        return {"items": items, "total": total, "next_offset": offset + len(items) if offset + len(items) < total else None}

    def reconcile(self):
        # Only collect old unreferenced objects while no stage can attach them.
        with self.transaction():
            if self.db.execute("SELECT 1 FROM import_items WHERE outcome='PROCESSING' LIMIT 1").fetchone():
                return
            referenced = {key for row in self.db.execute("SELECT original_key,preview_key FROM archive_assets") for key in row}
            cutoff = time.time() - 3600
            for path in self.object_dir.iterdir():
                if path.name not in referenced and path.stat().st_mtime < cutoff:
                    path.unlink()
