"""Fixture-scoped adapters. Untrusted archives are read in place, never extracted.

Identity is deliberately independent of parser version. Text exports without IDs
use manifest + locator, never a content fingerprint or cross-export ordinal.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import stat
import zipfile
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

MAX_ARCHIVE = 128 * 1024 * 1024
MAX_EXPANDED = 512 * 1024 * 1024
MAX_ENTRIES = 50_000
MAX_RECORDS = 50_000
MAX_METADATA = 32 * 1024 * 1024
MAX_FILE = 25 * 1024 * 1024
SOURCES = ("manual", "whatsapp", "messenger", "discord")


class ArchiveError(ValueError):
    pass


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                    separators=(",", ":")).encode()).hexdigest()


def safe_path(name):
    if (not isinstance(name, str) or not name or len(name) > 1024 or
            "\\" in name or "\x00" in name or ":" in name or name.startswith("/") or
            any(part in ("..", ".", "") for part in name.rstrip("/").split("/"))):
        raise ArchiveError("Unsafe archive path")
    return name.rstrip("/")


class Archive:
    def __init__(self, path):
        self.path = Path(path)
        if self.path.stat().st_size > MAX_ARCHIVE:
            raise ArchiveError("Archive exceeds 128 MiB")
        with self.path.open("rb") as source:
            self.manifest = hashlib.file_digest(source, "sha256").hexdigest()
        self.zip = zipfile.ZipFile(self.path)
        try:
            entries = self.zip.infolist()
            if len(entries) > MAX_ENTRIES:
                raise ArchiveError("Too many archive entries")
            self.files = {}
            names = set()
            total = 0
            for info in entries:
                name = safe_path(info.filename)
                mode = info.external_attr >> 16
                if name in names or stat.S_ISLNK(mode):
                    raise ArchiveError("Duplicate archive path or symbolic link")
                names.add(name)
                if info.flag_bits & 1 or info.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
                    raise ArchiveError("Encrypted or unsupported archive compression")
                total += info.file_size
                if total > MAX_EXPANDED or info.file_size > MAX_METADATA:
                    raise ArchiveError("Archive expansion limit exceeded")
                if info.file_size > max(1, info.compress_size) * 200:
                    raise ArchiveError("Archive expansion ratio exceeds 200:1")
                if not info.is_dir():
                    self.files[name] = info
            self.expanded_size = total
        except Exception:
            self.zip.close()
            raise

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.zip.close()

    def read(self, name, limit=MAX_METADATA):
        safe_path(name)
        info = self.files.get(name)
        if info is None:
            raise FileNotFoundError(name)
        if info.file_size > limit:
            raise ArchiveError("Entry exceeds size limit")
        with self.zip.open(info) as source:
            data = source.read(limit + 1)
        if len(data) != info.file_size or len(data) > limit:
            raise ArchiveError("Entry size mismatch")
        if data.startswith((b"PK\x03\x04", b"PK\x05\x06", b"7z\xbc\xaf", b"Rar!", b"\x1f\x8b")):
            raise ArchiveError("Nested archives are unsupported")
        return data

    def text(self, name):
        return self.read(name).decode("utf-8-sig")


@dataclass
class NormalizedImportItem:
    source_type: str
    source_account_namespace: str
    occurrence_key: str
    attachment_key: str
    original_metadata_reference: str
    source_item_id: str | None = None
    local_blob_reference: str | None = None
    external_reference: str | None = None
    original_filename: str | None = None
    declared_media_type: str | None = None
    sender: dict = field(default_factory=dict)
    conversation: dict = field(default_factory=dict)
    channel: dict = field(default_factory=dict)
    capture_assertions: list = field(default_factory=list)
    shared_at_assertion: dict = field(default_factory=dict)
    location_assertions: list = field(default_factory=list)
    context: list = field(default_factory=list)
    reactions: list = field(default_factory=list)
    warnings: list = field(default_factory=list)
    coverage: dict = field(default_factory=dict)
    availability: str = "PENDING"
    reason: str = "AWAITING_VALIDATION"
    schema_version: int = 1
    adapter_version: str = "1.0"

    def to_dict(self):
        return asdict(self)


def time_assertion(raw, date_order=None):
    result = {"raw": raw, "local": None, "utc": None, "offset": None,
              "precision": "unknown", "source": "message_share", "inferred": False}
    if raw is None:
        return result
    try:
        if isinstance(raw, (int, float)):
            parsed = datetime.fromtimestamp(raw / 1000, timezone.utc)
        else:
            value = str(raw).replace("\u202f", " ").replace("\u00a0", " ").strip()
            try:
                parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                match = re.fullmatch(r"(\d{1,2})[/.](\d{1,2})[/.](\d{2,4}),? (\d{1,2})[:.](\d{2})(?:[:.](\d{2}))? ?(AM|PM)?", value, re.I)
                if not match:
                    return result
                a, b, year, hour, minute, second, meridiem = match.groups()
                a, b = int(a), int(b)
                if not date_order and a <= 12 and b <= 12 and a != b:
                    return result
                order = date_order or ("DMY" if a > 12 else "MDY")
                day, month = (a, b) if order == "DMY" else (b, a)
                year = int(year) + (2000 if len(year) == 2 else 0)
                hour = int(hour)
                if meridiem:
                    if not 1 <= hour <= 12:
                        return result
                    hour = hour % 12 + (12 if meridiem.upper() == "PM" else 0)
                parsed = datetime(year, month, day, hour, int(minute), int(second or 0))
        result.update(local=parsed.isoformat(), precision="second")
        if parsed.tzinfo:
            result.update(utc=parsed.astimezone(timezone.utc).isoformat(),
                          offset=parsed.strftime("%z"))
    except (ValueError, OverflowError, OSError, TypeError):
        pass
    return result


NUMERIC_DATE = re.compile(r"\s*(\d{1,2})[/.](\d{1,2})[/.]\d{2,4}\b")


def date_orders(raws):
    """The day/month orders these timestamps prove: a day above 12 can only be read one way."""
    orders = set()
    for raw in raws:
        match = NUMERIC_DATE.match(raw) if isinstance(raw, str) else None
        if match:
            first, second = int(match[1]), int(match[2])
            if first > 12 >= second:
                orders.add("DMY")
            elif second > 12 >= first:
                orders.add("MDY")
    return orders


def settle_date_order(orders):
    """An export writes every date in one order, so a single proven order settles 04/05 for all of it."""
    return next(iter(orders)) if len(orders) == 1 else None


def bounded_context(messages, index):
    # Keep the attachment message first so a long neighbor cannot erase it.
    positions = [index] + [p for p in range(max(0, index - 2), min(len(messages), index + 3)) if p != index]
    remaining, result = 2000, []
    for p in positions:
        message = messages[p]
        text = message.get("text", "")[:remaining]
        if text:
            result.append((p, {"text": text, "sender": message.get("sender", {}),
                               "shared_at": message.get("time"), "locator": message["locator"]}))
            remaining -= len(text)
    return [value for _, value in sorted(result)]


def repair_meta_text(value):
    if not isinstance(value, str):
        return ""
    try:
        return value.encode("latin1").decode("utf-8")
    except (UnicodeError, ValueError):
        return value


WA_START = re.compile(r"^\u200e?(?:\[([^\]]+)\]\s*|([0-9][0-9/., :APMapm\u202f-]+) - )(.*)$")
WA_FILE = re.compile(r"<attached: ([^>]+)>|^([^\n]+?) \(file attached\)", re.M)


def whatsapp(text):
    messages = []
    for line_no, line in enumerate(text.splitlines(), 1):
        match = WA_START.match(line)
        if match:
            timestamp, android, body = match.groups()
            sender, separator, body_text = body.partition(": ")
            messages.append({"time": timestamp or android, "parts": [body_text if separator else body],
                             "sender": {"label": sender} if separator else {},
                             "locator": f"line:{line_no}"})
        elif messages:
            messages[-1]["parts"].append(line)
        elif line.strip():
            messages.append({"parts": [line], "locator": f"line:{line_no}", "warnings": ["UNPARSED_LINE"]})
    for message in messages:
        message["text"] = "\n".join(message.pop("parts"))
        message["attachments"] = [a or b for a, b in WA_FILE.findall(message["text"])]
        if not message["attachments"] and "<Media omitted>" in message["text"]:
            message["attachments"] = [None]
    return messages, {}


def messenger(text):
    value = json.loads(text)
    if not isinstance(value, dict) or not isinstance(value.get("messages"), list):
        raise ValueError("Missing messages")
    messages = []
    for index, message in enumerate(value["messages"]):
        if not isinstance(message, dict):
            raise ValueError("Invalid message")
        if message.get("timestamp_ms") is not None and not isinstance(message["timestamp_ms"], (int, float)):
            raise ValueError("Invalid timestamp")
        attachments = []
        for kind in ("photos", "videos", "audio_files", "files", "gifs"):
            for item in message.get(kind, []):
                attachments.append(item.get("uri"))
        if message.get("sticker"):
            attachments.append(message["sticker"].get("uri"))
        if any(ref is not None and not isinstance(ref, str) for ref in attachments):
            raise ValueError("Invalid attachment reference")
        if not isinstance(message.get("reactions", []), list):
            raise ValueError("Invalid reactions")
        messages.append({"id": message.get("message_id") or message.get("id"),
                         "time": message.get("timestamp_ms"), "text": repair_meta_text(message.get("content", "")),
                         "sender": {"label": repair_meta_text(message.get("sender_name", ""))},
                         "reactions": message.get("reactions", []), "attachments": attachments,
                         "locator": f"messages:{index}"})
    # Meta commonly writes newest first. Sort context without changing record locators.
    messages.sort(key=lambda m: m["time"] if isinstance(m["time"], (int, float)) else 0)
    return messages, {"label": repair_meta_text(value.get("title", "")),
                      "participants": value.get("participants", [])}


def discord(text):
    reader = csv.DictReader(io.StringIO(text))
    if not {"ID", "Timestamp", "Contents", "Attachments"} <= set(reader.fieldnames or []):
        raise ValueError("Unsupported Discord CSV columns")
    messages = []
    for index, row in enumerate(reader):
        if any(row.get(key) is None for key in ("ID", "Timestamp", "Contents", "Attachments")):
            raise ValueError("Malformed CSV row")
        references = row["Attachments"].split()
        messages.append({"id": row["ID"] or None, "time": row["Timestamp"],
                         "text": row["Contents"], "sender": {"role": "export_requester"},
                         "attachments": references, "locator": f"row:{index + 2}"})
    return messages, {}


def item_for(archive, source, namespace, path, message, attachment, position,
             conversation, context, options):
    stable_id = str(message["id"]) if message.get("id") else None
    locator = f"{path}#{message['locator']}"
    conversation_id = str(conversation.get("id") or PurePosixPath(path).parent)
    identity = ([source, namespace, conversation_id, stable_id, position] if stable_id else
                [source, namespace, archive.manifest, locator, position])
    item = NormalizedImportItem(source, namespace, digest(identity), str(position), locator,
                                source_item_id=stable_id, sender=message.get("sender", {}),
                                conversation={**conversation, "id": conversation_id}, context=context,
                                reactions=message.get("reactions", []),
                                warnings=list(message.get("warnings", [])),
                                shared_at_assertion=time_assertion(message.get("time"), options.get("date_order")),
                                coverage={"complete": False, "bounds": "supplied_records_only",
                                          "scope": "requester_sent_messages_only" if source == "discord" else "partial_export"})
    if source == "discord":
        item.channel = dict(item.conversation)
    if source != "manual" and not stable_id:
        item.warnings.append("UNCERTAIN_CROSS_EXPORT_IDENTITY")
    if message.get("time") and item.shared_at_assertion["local"] is None:
        item.warnings.append("AMBIGUOUS_DATE")
    if attachment is None:
        item.availability, item.reason = "MISSING_MEDIA", "MEDIA_OMITTED"
        return item
    item.original_filename = attachment.rsplit("/", 1)[-1]
    if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", attachment):
        item.external_reference = attachment
        item.warnings.append("REMOTE_NOT_FETCHED")
        item.availability, item.reason = "MISSING_MEDIA", "REMOTE_NOT_FETCHED"
        return item
    try:
        reference = safe_path(attachment)
    except ArchiveError:
        item.availability, item.reason = "UNSUPPORTED", "UNSAFE_REFERENCE"
        return item
    candidates = [reference]
    if source == "whatsapp":
        candidates.insert(0, str(PurePosixPath(path).parent / reference))
    found = next((p for p in candidates if p in archive.files), None)
    item.local_blob_reference = found or reference
    suffix = PurePosixPath(reference).suffix.lower()
    item.declared_media_type = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}.get(suffix)
    if found is None:
        item.availability, item.reason = "MISSING_MEDIA", "FILE_NOT_SUPPLIED"
    elif suffix not in (".jpg", ".jpeg", ".png"):
        item.availability, item.reason = "UNSUPPORTED", "UNSUPPORTED_FORMAT_OR_CODEC"
    elif archive.files[found].file_size > MAX_FILE:
        item.availability, item.reason = "UNSUPPORTED", "FILE_TOO_LARGE"
    return item


def inventory(archive, source, namespace, options):
    if source not in SOURCES or options.get("date_order") not in (None, "DMY", "MDY"):
        raise ArchiveError("Unsupported source or date order")
    paths = sorted(archive.files)
    if source == "manual" and len(paths) > 100:
        raise ArchiveError("Manual imports accept at most 100 files per run")
    metadata = [p for p in paths if (source == "whatsapp" and p.lower().endswith(".txt")) or
                (source == "messenger" and re.fullmatch(r"message_\d+\.json", PurePosixPath(p).name)) or
                (source == "discord" and PurePosixPath(p).name == "messages.csv")]
    referenced, count = set(metadata), 0
    for path in metadata:
        try:
            messages, conversation = {"whatsapp": whatsapp, "messenger": messenger, "discord": discord}[source](archive.text(path))
            conversation.setdefault("id", str(PurePosixPath(path).parent) if source != "whatsapp" else path)
            if source == "discord":
                channel_path = str(PurePosixPath(path).parent / "channel.json")
                if channel_path in archive.files:
                    channel = json.loads(archive.text(channel_path))
                    conversation.update(id=str(channel.get("id") or conversation["id"]), label=channel.get("name", ""))
                    referenced.add(channel_path)
            if len(messages) > MAX_RECORDS:
                raise ArchiveError("Too many source records")
        except ArchiveError:
            raise
        except (ValueError, TypeError, KeyError, AttributeError, RecursionError, csv.Error):
            yield NormalizedImportItem(source, namespace, digest([archive.manifest, path]), "0", path,
                                       availability="FAILED", reason="MALFORMED_SOURCE")
            continue
        for index, message in enumerate(messages):
            attachments = message.get("attachments", [])
            for position, attachment in enumerate(attachments or [None]):
                count += 1
                if count > MAX_RECORDS:
                    raise ArchiveError("Too many source records")
                item = item_for(archive, source, namespace, path, message, attachment, position,
                                conversation, bounded_context(messages, index), options)
                if not attachments:
                    item.availability, item.reason = "SKIPPED", "NO_MEDIA"
                if item.local_blob_reference:
                    referenced.add(item.local_blob_reference)
                yield item
    for path in paths:
        if path in referenced:
            continue
        # Read even unsupported entries to reject disguised nested archives and CRC errors.
        archive.read(path)
        item = item_for(archive, source, namespace, path, {"locator": "file"}, path, 0,
                        {}, [], options)
        if source != "manual":
            item.warnings.append("UNREFERENCED_FILE")
            item.availability, item.reason = "UNSUPPORTED", "UNREFERENCED_FILE"
        yield item
