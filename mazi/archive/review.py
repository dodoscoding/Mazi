"""Deterministic, permission-checked review on top of the Phase 2 archive.

Suggestions never change source records. A review decision changes only the
presentation grouping; every original remains accessible through its own ID.
"""
from __future__ import annotations

from mazi.persistence import ArchiveBusy, initialize_schema, insertion_order
from mazi.archive.export import ExportArray, ExportFingerprint, ExportWriter, export_cleanup, write_export_object

import io
import sqlite3
import json
import hashlib
import zipfile
import heapq
import tempfile
from contextlib import contextmanager
from datetime import date, datetime, timezone
from itertools import groupby
import time

from PIL import Image, ImageOps, ImageStat

from mazi.capacity import CapacityExceeded
from mazi.identity.core import Conflict, Denied
from mazi.imports.engine import ImportStore
from mazi.places import label, lookup

DUPLICATE_COMPARISONS = 5_000_000
DUPLICATE_PREVIEW_BYTES = 256 * 1024 * 1024
REVIEW_ITEMS = 10000
REVIEW_METADATA_BYTES = 64 * 1024 * 1024
REVIEW_SCAN_SECONDS = 15
EXPORT_BYTES = 128 * 1024 * 1024

SCHEMA = """
CREATE TABLE IF NOT EXISTS review_pairs (
 group_id TEXT NOT NULL, left_id TEXT NOT NULL, right_id TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('merged','dismissed')),
 actor_id TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY(group_id,left_id,right_id)
);
CREATE TABLE IF NOT EXISTS review_renditions (
 group_id TEXT NOT NULL, asset_id TEXT NOT NULL PRIMARY KEY,
 selected_id TEXT NOT NULL, actor_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS review_annotations (
 asset_id TEXT PRIMARY KEY, group_id TEXT NOT NULL, title TEXT NOT NULL DEFAULT '',
 capture_date TEXT, place TEXT NOT NULL DEFAULT '', anniversary INTEGER NOT NULL DEFAULT 0,
 actor_id TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS review_events (
 id TEXT PRIMARY KEY, group_id TEXT NOT NULL, asset_ids TEXT NOT NULL,
 title TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('accepted','rejected')),
 actor_id TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS review_events_group ON review_events(group_id,status);
"""


def signature(data):
    with Image.open(io.BytesIO(data)) as raw:
        image = ImageOps.exif_transpose(raw).convert("RGB")
        ratio = image.width / image.height
        mean = ImageStat.Stat(image.resize((16, 16))).mean
        gray = image.convert("L").resize((9, 8))
        pixels = list(gray.get_flattened_data())
    fingerprint = sum((pixels[y * 9 + x] > pixels[y * 9 + x + 1]) << (y * 8 + x)
                      for y in range(8) for x in range(8))
    return fingerprint, mean, ratio


class ReviewStore(ImportStore):
    def __init__(self, root):
        super().__init__(root)
        initialize_schema(self.db, SCHEMA)

    def _attach_photo_labels(self, group, photos):
        pass

    def _visible_ids(self, user, group):
        self._member(user, group)
        return [row[0] for row in self.db.execute(
            "SELECT a.id FROM archive_assets a WHERE a.group_id=? AND EXISTS "
            "(SELECT 1 FROM archive_origins o JOIN members m ON m.user_id=o.owner_id "
            "AND m.group_id=o.group_id WHERE o.asset_id=a.id AND o.withdrawn=0) "
            "ORDER BY a.id", (group,))]

    @contextmanager
    def _projection_transaction(self):
        try:
            with self.transaction():
                yield
        except sqlite3.OperationalError as error:
            if (getattr(error, 'sqlite_errorcode', 0) & 255) in (sqlite3.SQLITE_BUSY, sqlite3.SQLITE_LOCKED):
                raise ArchiveBusy('Archive is busy; retry shortly') from None
            raise

    def duplicate_suggestions(self, user, group, limit=100):
        with self._projection_transaction():
            return self._duplicate_suggestions(user, group, limit)

    def _duplicate_suggestions(self, user, group, limit):
        if type(limit) is not int or not 1 <= limit <= 100:
            raise ValueError("Invalid suggestion limit")
        ids = self._visible_ids(user, group)
        if len(ids) > REVIEW_ITEMS:
            raise CapacityExceeded('Duplicate review supports up to 10,000 visible photographs')
        large = len(ids) > 1000
        started, image_bytes = time.perf_counter(), 0
        signatures, buckets = {}, {}
        for asset in ids:
            data = self.asset_bytes(user, asset)
            image_bytes += len(data)
            if large and image_bytes > DUPLICATE_PREVIEW_BYTES:
                raise CapacityExceeded('Duplicate review exceeded its 256 MiB preview byte budget')
            signatures[asset] = signature(data)
            if large and time.perf_counter() - started > REVIEW_SCAN_SECONDS:
                raise CapacityExceeded('Duplicate review exceeded its 15 second processing budget')
            fingerprint = signatures[asset][0]
            for part in range(7):
                key = (part, (fingerprint >> (part * 9)) & (1023 if part == 6 else 511))
                buckets.setdefault(key, []).append(asset)
        result, comparisons = [], 0
        for left in ids:
            left_hash, left_color, left_ratio = signatures[left]
            candidates = set()
            for part in range(7):
                key = (part, (left_hash >> (part * 9)) & (1023 if part == 6 else 511))
                candidates.update(right for right in buckets[key] if right > left)
            for right in sorted(candidates):
                comparisons += 1
                if large and (comparisons > DUPLICATE_COMPARISONS or time.perf_counter() - started > REVIEW_SCAN_SECONDS):
                    raise CapacityExceeded('Duplicate review exceeded its comparison processing budget')
                right_hash, right_color, right_ratio = signatures[right]
                distance = (left_hash ^ right_hash).bit_count()
                if distance > 6 or max(abs(a - b) for a, b in zip(left_color, right_color)) > 24 or abs(left_ratio - right_ratio) > 0.05:
                    continue
                decision = self.db.execute(
                    "SELECT status FROM review_pairs WHERE group_id=? AND left_id=? AND right_id=?",
                    (group, left, right)).fetchone()
                if decision:
                    continue
                result.append({"left": left, "right": right, "distance": distance,
                               "reason": "similar image pixels; review both originals"})
                if len(result) == limit:
                    return result
        return result

    def review_pair(self, user, group, first, second, action):
        if action not in ("merge", "dismiss", "undo") or first == second:
            raise ValueError("Invalid review decision")
        left, right = sorted((first, second))
        with self.transaction():
            visible = set(self._visible_ids(user, group))
            if left not in visible or right not in visible:
                raise Denied("Media unavailable")
            if action == "undo":
                self.db.execute("DELETE FROM review_pairs WHERE group_id=? AND left_id=? AND right_id=?",
                                (group, left, right))
            else:
                self.db.execute("INSERT INTO review_pairs VALUES(?,?,?,?,?,?) "
                                "ON CONFLICT(group_id,left_id,right_id) DO UPDATE SET "
                                "status=excluded.status,actor_id=excluded.actor_id,updated_at=excluded.updated_at",
                                (group, left, right, "merged" if action == "merge" else "dismissed", user, datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")))
                if action == "merge":
                    choices = [self.db.execute("SELECT width,height,size FROM archive_assets WHERE id=?", (asset,)).fetchone()
                               for asset in (left, right)]
                    preferred = max(zip((left, right), choices), key=lambda item: (item[1]["width"] * item[1]["height"], item[1]["size"], item[0]))[0]
                    for asset in (left, right):
                        self.db.execute("INSERT INTO review_renditions VALUES(?,?,?,?) "
                                        "ON CONFLICT(asset_id) DO UPDATE SET selected_id=excluded.selected_id,actor_id=excluded.actor_id",
                                        (group, asset, preferred, user))
            self._audit(user, "review." + action, left + ":" + right)

    def reviewed_pairs(self, user, group):
        visible = set(self._visible_ids(user, group))
        return [{"left": row[0], "right": row[1], "status": row[2]}
                for row in self.db.execute("SELECT left_id,right_id,status FROM review_pairs WHERE group_id=? ORDER BY updated_at DESC", (group,))
                if row[0] in visible and row[1] in visible]

    def owned_origins(self, user, group):
        self._member(user, group)
        return [{"id": row["id"], "asset": row["asset_id"],
                 "filename": json.loads(row["payload"]).get("original_filename") or "Unnamed photograph"}
                for row in self.db.execute("SELECT id,asset_id,payload FROM archive_origins "
                                           'WHERE owner_id=? AND group_id=? AND withdrawn=0 ORDER BY ' + insertion_order(self.db, '') + ' DESC LIMIT 1000',
                                           (user, group))]

    def group_metrics(self, user, group):
        self._member(user, group, admin=True)
        visible = len(self._visible_ids(user, group))
        jobs = {row[0]: row[1] for row in self.db.execute(
            "SELECT i.outcome,count(*) FROM import_items i JOIN import_runs r ON r.id=i.run_id "
            "WHERE r.group_id=? AND r.withdrawn=0 GROUP BY i.outcome", (group,))}
        queued = self.db.execute("SELECT min(r.created_at) FROM import_runs r JOIN import_items i ON i.run_id=r.id "
                                 "WHERE r.group_id=? AND r.withdrawn=0 AND i.outcome IN ('PENDING','PROCESSING')", (group,)).fetchone()[0]
        bytes_used = self.db.execute("SELECT coalesce(sum(a.size),0) FROM archive_assets a WHERE a.group_id=? AND EXISTS "
                                     "(SELECT 1 FROM archive_origins o JOIN members m ON m.group_id=o.group_id "
                                     "AND m.user_id=o.owner_id WHERE o.asset_id=a.id AND o.withdrawn=0)", (group,)).fetchone()[0]
        return {"visible_assets": visible, "stored_original_bytes": bytes_used,
                "item_outcomes": jobs, "oldest_active_age_seconds": int(time.time() - queued) if queued else None}

    def delete_origin(self, user, origin):
        with self.transaction():
            row = self.db.execute("SELECT id,group_id,owner_id,run_id,occurrence,withdrawn FROM archive_origins WHERE id=?",
                                  (origin,)).fetchone()
            if not row or row["owner_id"] != user or row["withdrawn"]:
                raise Denied("Contribution unavailable")
            self._member(user, row["group_id"])
            self.db.execute("UPDATE archive_origins SET withdrawn=1 WHERE id=?", (origin,))
            self.db.execute("UPDATE import_items SET outcome='SKIPPED',reason='WITHDRAWN_BY_OWNER' "
                            "WHERE run_id=? AND occurrence=? AND outcome='AVAILABLE_TO_GROUP'",
                            (row["run_id"], row["occurrence"]))
            self._audit(user, "review.origin.delete", origin)

    def leave_group(self, user, group):
        with self.transaction():
            self._member(user, group)
            role = self.db.execute("SELECT role FROM members WHERE group_id=? AND user_id=?", (group, user)).fetchone()[0]
            if role == "admin":
                raise Denied("Administrator departure needs a group closure decision")
            for run in self.db.execute("SELECT id FROM import_runs WHERE owner_id=? AND group_id=?", (user, group)).fetchall():
                self._cancel(run["id"])
            self.db.execute("UPDATE import_runs SET withdrawn=1 WHERE owner_id=? AND group_id=?", (user, group))
            self.db.execute("UPDATE archive_origins SET withdrawn=1 WHERE owner_id=? AND group_id=?", (user, group))
            self.db.execute("DELETE FROM members WHERE group_id=? AND user_id=?", (group, user))
            self.db.execute("DELETE FROM media_grants WHERE audience='selected' AND recipient_id=? "
                            "AND media_id IN (SELECT id FROM media WHERE group_id=?)", (user, group))
            self.db.execute("DELETE FROM memory_grants WHERE audience='selected' AND recipient_id=? "
                            "AND memory_id IN (SELECT id FROM memories WHERE group_id=?)", (user, group))
            self.db.execute("DELETE FROM media_grants WHERE media_id IN (SELECT id FROM media WHERE group_id=? AND owner_id=?)", (group, user))
            self.db.execute("UPDATE media SET status='staged',policy_version=policy_version+1 "
                            "WHERE group_id=? AND owner_id=? AND status='published'", (group, user))
            self.db.execute("DELETE FROM memory_grants WHERE memory_id IN (SELECT id FROM memories WHERE group_id=? AND owner_id=?)", (group, user))
            self.db.execute("UPDATE memories SET status='draft',policy_version=policy_version+1 "
                            "WHERE group_id=? AND owner_id=? AND status='published'", (group, user))
            self._audit(user, "membership.leave", group)

    def select_rendition(self, user, group, asset, selected):
        with self.transaction():
            visible = set(self._visible_ids(user, group))
            if asset not in visible or selected not in visible:
                raise Denied("Media unavailable")
            if selected != asset:
                pair = tuple(sorted((asset, selected)))
                reviewed = self.db.execute("SELECT status FROM review_pairs WHERE group_id=? AND left_id=? AND right_id=?",
                                           (group, *pair)).fetchone()
                if not reviewed or reviewed[0] != "merged":
                    raise Conflict("Rendition must be an approved merge")
            self.db.execute("INSERT INTO review_renditions VALUES(?,?,?,?) "
                            "ON CONFLICT(asset_id) DO UPDATE SET selected_id=excluded.selected_id,actor_id=excluded.actor_id",
                            (group, asset, selected, user))
            if selected != asset:
                self.db.execute("INSERT INTO review_renditions VALUES(?,?,?,?) "
                                "ON CONFLICT(asset_id) DO UPDATE SET selected_id=excluded.selected_id,actor_id=excluded.actor_id",
                                (group, selected, selected, user))
            self._audit(user, "review.rendition", asset)

    def _rendition_locator(self, user, asset, *, original=None):
        if original is None:
            original = self._asset_locator(user, asset)
        row = original[0]
        selected = self.db.execute("SELECT selected_id FROM review_renditions WHERE asset_id=? AND group_id=?",
                                   (asset, row["group_id"])).fetchone()
        if selected and selected[0] != asset:
            pair = tuple(sorted((asset, selected[0])))
            approved = self.db.execute("SELECT 1 FROM review_pairs WHERE group_id=? AND left_id=? AND right_id=? AND status='merged'",
                                       (row["group_id"], *pair)).fetchone()
            if approved:
                try:
                    return self._asset_locator(user, selected[0])
                except Denied:
                    pass
        return original

    def rendition_bytes(self, user, asset):
        transaction = self.db.read_transaction() if getattr(self.db, "hosted", False) else self._projection_transaction()
        with transaction:
            _, namespace, key = self._rendition_locator(user, asset)
        return self.objects.read(namespace, key)

    def event_suggestions(self, user, group, limit=100):
        with self._projection_transaction():
            return self._event_suggestions(user, group, limit)

    def _event_suggestions(self, user, group, limit):
        if type(limit) is not int or not 1 <= limit <= 100:
            raise ValueError("Invalid suggestion limit")
        visible = set(self._visible_ids(user, group))
        if len(visible) > REVIEW_ITEMS:
            raise CapacityExceeded("Event review supports up to 10,000 visible photographs")
        large = len(visible) > 1000
        started, metadata_bytes = time.perf_counter(), 0
        evidence = {}
        byte_length = 'octet_length(o.payload)' if getattr(self.db, 'hosted', False) else 'length(CAST(o.payload AS BLOB))'
        payload_column = f'CASE WHEN {byte_length}<=65536 THEN o.payload ELSE NULL END' if large else 'o.payload'
        def origins():
            last_asset = last_origin = ''
            while True:
                query = f"SELECT o.asset_id,{payload_column} AS payload,o.id FROM archive_origins o "
                query += "JOIN members m ON m.group_id=o.group_id AND m.user_id=o.owner_id WHERE o.group_id=? AND o.withdrawn=0"
                params = (group,)
                if large:
                    query += ' AND (o.asset_id>? OR (o.asset_id=? AND o.id>?)) ORDER BY o.asset_id,o.id LIMIT 256'
                    params += (last_asset, last_asset, last_origin)
                batch = self.db.execute(query, params)
                if not large:
                    yield from batch
                    return
                batch = batch.fetchall()
                if not batch:
                    return
                yield from batch
                last_asset, last_origin = batch[-1][0], batch[-1][2]
                if time.perf_counter() - started > REVIEW_SCAN_SECONDS:
                    raise CapacityExceeded('Event review exceeded its 15 second processing budget')

        for row in origins():
            if row[0] not in visible:
                continue
            if row[1] is None:
                raise CapacityExceeded('Event review exceeded its 64 KiB metadata limit per origin')
            metadata_bytes += len(row[1].encode('utf-8'))
            if large and metadata_bytes > REVIEW_METADATA_BYTES:
                raise CapacityExceeded('Event review exceeded its metadata byte budget')
            if large and time.perf_counter() - started > REVIEW_SCAN_SECONDS:
                raise CapacityExceeded('Event review exceeded its 15 second processing budget')
            payload = json.loads(row[1])
            dates, cities = self._date_place_evidence(row[0], payload)
            accumulated = evidence.setdefault(row[0], (set(), set()))
            accumulated[0].update(dates)
            accumulated[1].update(cities)
        buckets = {}
        for asset, (dates, cities) in evidence.items():
            # Retain every assertion until conflicts across all origins are resolved.
            if len(dates) == 1 and len(cities) <= 1:
                key = (next(iter(dates)), next(iter(cities), ""))
                buckets.setdefault(key, set()).add(asset)
        result = []
        for (day, place), assets in sorted(buckets.items()):
            if len(assets) < 2:
                continue
            ids = sorted(assets)
            candidate = self._event_id(group, ids)
            reviewed = self.db.execute("SELECT 1 FROM review_events WHERE id=?", (candidate,)).fetchone()
            if reviewed:
                continue
            result.append({"id": candidate, "date": day, "place": place or None,
                           "assets": ids, "reason": "same evidenced calendar day" + (" and city" if place else "")})
            if len(result) == limit:
                break
        return result

    @staticmethod
    def _event_id(group, ids):
        return hashlib.sha256(json.dumps([group, sorted(ids)]).encode()).hexdigest()

    def _date_place_evidence(self, asset, payload, annotation=None):
        if annotation is None:
            annotation = self.db.execute("SELECT capture_date,place FROM review_annotations WHERE asset_id=?", (asset,)).fetchone()
        dates = set()
        for assertion in payload.get("capture_assertions") or []:
            try:
                dates.add(datetime.fromisoformat(assertion["local"].replace("Z", "+00:00")).date().isoformat())
            except (KeyError, ValueError, TypeError, AttributeError):
                pass
        cities = {str(place["city"]).strip().casefold()
                  for place in payload.get("location_assertions") or []
                  if isinstance(place, dict) and place.get("city") and str(place["city"]).strip()}
        if annotation and annotation["capture_date"]:
            dates = {annotation["capture_date"][:10]}
        if annotation and annotation["place"]:
            cities = {annotation["place"].strip().casefold()}
        return dates, cities

    def _all_origins(self, user, asset):
        result = []
        offset = 0
        while True:
            page = self.origins(user, asset, offset)
            result.extend(page["items"])
            if page["next_offset"] is None:
                return result
            offset = page["next_offset"]

    def _correction_visible_ids(self, user, group):
        return set(self._visible_ids(user, group))

    def _photo_correction(self, user, group, asset):
        if not all(isinstance(value, str) and 1 <= len(value) <= 36 for value in (group, asset)):
            raise ValueError('Invalid photograph target')
        row = self._asset(user, asset)
        if row['group_id'] != group or asset not in self._correction_visible_ids(user, group):
            raise Denied('Media unavailable')
        annotation = dict(self.db.execute(
            'SELECT title,capture_date,place,anniversary FROM review_annotations WHERE asset_id=?', (asset,)).fetchone() or
            dict(title='', capture_date=None, place='', anniversary=0))
        origins = [tuple(row) for row in self.db.execute(
            'SELECT o.id,o.fingerprint FROM archive_origins o JOIN members m ON m.group_id=o.group_id AND m.user_id=o.owner_id '
            'WHERE o.asset_id=? AND o.group_id=? AND o.withdrawn=0 ORDER BY o.id', (asset, group))]
        snapshot = hashlib.sha256(json.dumps([group, asset, annotation, origins], sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        return dict(assetId=asset, annotation=annotation, snapshot=snapshot)

    def photo_correction(self, user, group, asset):
        with self.transaction():
            return self._photo_correction(user, group, asset)

    def patch_photo(self, user, group, asset, changes, expected_snapshot):
        if not isinstance(changes, dict) or not changes or not set(changes) <= {'capture_date', 'place'}:
            raise ValueError('Only capture_date and place may be changed')
        if not isinstance(expected_snapshot, str) or len(expected_snapshot) != 64:
            raise ValueError('Expected snapshot required')
        with self.transaction():
            current = self._photo_correction(user, group, asset)
            if current['snapshot'] != expected_snapshot:
                raise Conflict('Photograph changed; refresh before retrying')
            values = {**current['annotation'], **changes}
            values['anniversary'] = bool(values['anniversary'])
            self._correct_asset(user, asset, **values)
            return self._photo_correction(user, group, asset)

    def correct_asset(self, user, asset, *, title, capture_date, place, anniversary=False):
        with self.transaction():
            return self._correct_asset(user, asset, title=title, capture_date=capture_date, place=place, anniversary=anniversary)

    def _correct_asset(self, user, asset, *, title, capture_date, place, anniversary=False):
        row = self._asset(user, asset)
        if not isinstance(title, str) or len(title) > 200 or not isinstance(place, str) or len(place) > 200:
            raise ValueError("Invalid title or place")
        if capture_date is not None:
            if not isinstance(capture_date, str) or len(capture_date) != 10:
                raise ValueError("Use a precise YYYY-MM-DD date")
            try:
                if date.fromisoformat(capture_date).isoformat() != capture_date:
                    raise ValueError()
            except ValueError:
                raise ValueError("Use a precise YYYY-MM-DD date") from None
        if type(anniversary) is not bool or (anniversary and not capture_date):
            raise ValueError("Anniversary needs an approved date")
        self.db.execute("INSERT INTO review_annotations VALUES(?,?,?,?,?,?,?,?) "
                        "ON CONFLICT(asset_id) DO UPDATE SET title=excluded.title,capture_date=excluded.capture_date,"
                        "place=excluded.place,anniversary=excluded.anniversary,actor_id=excluded.actor_id,"
                        "updated_at=excluded.updated_at",
                        (asset, row["group_id"], title.strip(), capture_date, place.strip(), int(anniversary), user, datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")))
        self._audit(user, "review.correct", asset)
        match = lookup(place)
        city = match.get("city")
        return {"place_match": match["status"], "place": city and f"{city.name}, {city.country}",
                "candidates": [label(candidate) for candidate in match.get("candidates", [])]}

    def _timeline_items(self, user, group, query=""):
        visible = set(self._visible_ids(user, group))
        rows = self.db.execute(
            "SELECT a.id,o.payload,r.title,r.capture_date,r.place,r.anniversary "
            "FROM archive_assets a JOIN archive_origins o ON o.asset_id=a.id "
            "JOIN members m ON m.group_id=o.group_id AND m.user_id=o.owner_id "
            "JOIN members reader ON reader.group_id=a.group_id AND reader.user_id=? "
            "LEFT JOIN review_annotations r ON r.asset_id=a.id "
            "WHERE a.group_id=? AND o.withdrawn=0 ORDER BY a.id," + insertion_order(self.db, "o"), (user, group))
        for asset, origins in groupby(rows, key=lambda row: row["id"]):
            if asset not in visible:
                continue
            origins = list(origins)
            annotation = origins[0]
            records = [json.loads(origin["payload"]) for origin in origins]
            dates, cities = set(), set()
            for record in records:
                source_dates, source_cities = self._date_place_evidence(asset, record, annotation)
                dates.update(source_dates)
                cities.update(source_cities)
            day = next(iter(dates)) if len(dates) == 1 else None
            place = next(iter(cities)) if len(cities) == 1 else ""
            title = annotation["title"] or ""
            searchable = " ".join([title, place, *[str(p.get("original_filename") or "") for p in records],
                                   *[str(c.get("text") or "") for p in records for c in p.get("context", [])]])
            if query.casefold() not in searchable.casefold():
                continue
            yield {"id": asset, "title": title, "date": day, "dates": sorted(dates), "place": place or None,
                   "date_basis": "reviewed correction" if annotation["capture_date"] else
                                 "conflicting source evidence" if len(dates) > 1 else
                                 "source capture evidence" if day else "undated",
                   "origin_count": len(records),
                   "anniversary": bool(annotation["anniversary"])}
        self._member(user, group)

    def timeline(self, user, group, offset=0, limit=30, query=""):
        if type(offset) is not int or offset < 0 or type(limit) is not int or not 1 <= limit <= 100 or not isinstance(query, str) or len(query) > 200:
            raise ValueError("Invalid timeline page")
        total, items = 0, []
        for item in self._timeline_items(user, group, query):
            total += 1
            entry = (item["date"] or "", item["id"], item)
            if len(items) < offset + limit:
                heapq.heappush(items, entry)
            elif entry > items[0]:
                heapq.heapreplace(items, entry)
        items.sort(reverse=True)
        return {"items": [entry[2] for entry in items[offset:]], "total": total,
                "next_offset": offset + limit if offset + limit < total else None}

    def review_event(self, user, group, assets, title, decision):
        if decision not in ("accept", "reject", "undo") or not isinstance(assets, list) or len(assets) < 2 or len(assets) > 100 or len(set(assets)) != len(assets):
            raise ValueError("Invalid event review")
        if not isinstance(title, str) or len(title.strip()) > 200:
            raise ValueError("Invalid event title")
        event_id = self._event_id(group, assets)
        with self.transaction():
            visible = set(self._visible_ids(user, group))
            if not set(assets) <= visible:
                raise Denied("Media unavailable")
            if decision == "undo":
                wanted = sorted(assets)
                matches = [row["id"] for row in self.db.execute("SELECT id, asset_ids FROM review_events WHERE group_id=?", (group,))
                           if sorted(asset for asset in json.loads(row["asset_ids"]) if asset in visible) == wanted]
                if len(matches) == 1:
                    event_id = matches[0]
                self.db.execute("DELETE FROM review_events WHERE id=? AND group_id=?", (event_id, group))
            else:
                self.db.execute("INSERT INTO review_events VALUES(?,?,?,?,?,?,?) "
                                "ON CONFLICT(id) DO UPDATE SET title=excluded.title,status=excluded.status,"
                                "actor_id=excluded.actor_id,updated_at=excluded.updated_at",
                                (event_id, group, json.dumps(sorted(assets)), title.strip(),
                                 "accepted" if decision == "accept" else "rejected", user, datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")))
            self._audit(user, "review.event." + decision, event_id)
        return event_id

    def reviewed_events(self, user, group):
        visible = set(self._visible_ids(user, group))
        result = []
        event_order = 'id' if getattr(self.db, 'hosted', False) else insertion_order(self.db)
        for row in self.db.execute("SELECT id,asset_ids,title,status FROM review_events WHERE group_id=? ORDER BY updated_at DESC,status," + event_order, (group,)):
            assets = [asset for asset in json.loads(row["asset_ids"]) if asset in visible]
            if len(assets) >= 2:
                result.append({"id": row["id"], "title": row["title"], "assets": assets, "status": row["status"]})
        return result

    def accepted_events(self, user, group):
        return [event for event in self.reviewed_events(user, group) if event["status"] == "accepted"]

    def on_this_day(self, user, group, today=None):
        today = today or date.today()
        if not isinstance(today, date):
            raise ValueError("Invalid day")
        matches = []
        offset = 0
        while True:
            page = self.timeline(user, group, offset=offset, limit=100)
            matches.extend(item for item in page["items"]
                           if item["anniversary"] and item["date"] and item["date"][5:] == today.isoformat()[5:]
                           and item["date"][:4] != today.isoformat()[:4])
            if page["next_offset"] is None:
                return matches
            offset = page["next_offset"]

    def export_archive(self, user, group):
        """Compatibility API; returning bytes materializes the complete ZIP in memory."""
        with self.export_archive_file(user, group) as output:
            return output.read()

    @contextmanager
    def export_archive_file(self, user, group):
        """Own a private completed ZIP, exposing it only after policy admission."""
        ids = self._visible_ids(user, group)
        if len(ids) > 10000:
            raise CapacityExceeded("Export supports up to 10,000 photographs")
        for asset in ids:
            self._asset(user, asset)
        captured = ExportFingerprint(self._check_export_size)
        with export_cleanup(tempfile.TemporaryFile(mode='w+b')) as output:
            self._build_export_archive(user, group, ids, captured, output)
            self._check_export_size(output.seek(0, 2))
            try:
                # Admission compares one current metadata projection. Object reads and
                # delivery stay outside this transaction; later commits cannot recall bytes.
                with self.transaction():
                    self._member(user, group)
                    current_ids = self._visible_ids(user, group)
                    if ids != current_ids:
                        raise Conflict("Archive changed while preparing export; retry")
                    current = ExportFingerprint(self._check_export_size)
                    self._capture_export_metadata(user, group, current_ids, current)
                    if captured.digest() != current.digest():
                        raise Conflict("Archive changed while preparing export; retry")
            except sqlite3.OperationalError as exc:
                if (getattr(exc, 'sqlite_errorcode', 0) & 255) in (sqlite3.SQLITE_BUSY, sqlite3.SQLITE_LOCKED):
                    raise ArchiveBusy('Archive is busy; retry shortly') from None
                raise
            output.seek(0)
            yield output

    def _check_export_size(self, size):
        if size > EXPORT_BYTES:
            raise CapacityExceeded('Export exceeds the local 128 MiB archive limit')

    def _export_rows(self, query, params, order, page_size=128):
        after = None
        ordering = ','.join(expression + (' DESC' if descending else ' ASC')
                            for expression, _, descending in order)
        while True:
            predicates, values = [], []
            if after is not None:
                for index, (expression, _, descending) in enumerate(order):
                    equal = [prior[0] + '=?' for prior in order[:index]]
                    comparison = expression + ('<?' if descending else '>?')
                    predicates.append('(' + ' AND '.join([*equal, comparison]) + ')')
                    values.extend(after[:index + 1])
            clause = ' AND (' + ' OR '.join(predicates) + ')' if predicates else ''
            rows = self.db.execute(query + clause + ' ORDER BY ' + ordering + ' LIMIT ?',
                                   (*params, *values, page_size)).fetchall()
            if not rows:
                return
            for row in rows:
                yield row
            after = tuple(rows[-1][key] for _, key, _ in order)

    def _export_origins(self, user, asset, identity=False):
        self._asset(user, asset)
        order = insertion_order(self.db, 'o')
        after = 0
        columns = ('o.id,o.asset_id,o.group_id,o.owner_id,o.run_id,o.occurrence,o.fingerprint'
                   if identity else 'o.payload')
        while True:
            origin = self.db.execute("SELECT " + columns + ", " + order + " AS export_order FROM archive_origins o "
                                     "JOIN members m ON m.user_id=o.owner_id AND m.group_id=o.group_id "
                                     "WHERE o.asset_id=? AND o.withdrawn=0 AND " + order + ">? ORDER BY " + order + " LIMIT 1",
                                     (asset, after)).fetchone()
            if origin is None:
                break
            after = origin['export_order']
            if identity:
                yield {key: origin[key] for key in
                       ('id', 'asset_id', 'group_id', 'owner_id', 'run_id', 'occurrence', 'fingerprint')}
            else:
                yield json.loads(origin['payload'])

    def _export_manifest(self, user, group, ids, fingerprint, archive=None, output=None):
        fingerprint.identity('visible-assets', ids)
        def records():
            for asset in ids:
                row, namespace, key = self._asset_locator(user, asset, original=True)
                identity = dict(asset=asset, group=row['group_id'], namespace=namespace,
                                key=key, sha256=row['sha256'], size=row['size'],
                                origins=ExportArray(self._export_origins(user, asset, identity=True)))
                if archive is not None:
                    write_export_object(self.objects, identity, archive, output, "originals/" + asset,
                                        "Stored original changed while preparing export; retry")
                fingerprint.identity('original', identity)
                yield {"id": asset, "sha256": row['sha256'], "mime": row['mime'],
                       "origins": ExportArray(self._export_origins(user, asset)),
                       "annotation": dict(self.db.execute("SELECT title,capture_date,place,anniversary FROM review_annotations WHERE asset_id=?", (asset,)).fetchone() or {})}
        fingerprint.json_member('manifest.json', {"group": group, "assets": ExportArray(records())}, archive, ensure_ascii=False)

    def _capture_export_metadata(self, user, group, ids, fingerprint):
        self._export_manifest(user, group, ids, fingerprint)

    def _build_export_archive(self, user, group, ids, fingerprint, output):
        output = ExportWriter(output, self._check_export_size)
        with export_cleanup(zipfile.ZipFile(output, "w", compression=zipfile.ZIP_STORED)) as archive:
            self._write_export_archive(user, group, ids, fingerprint, archive, output)

    def _write_export_archive(self, user, group, ids, fingerprint, archive, output):
        self._export_manifest(user, group, ids, fingerprint, archive, output)
