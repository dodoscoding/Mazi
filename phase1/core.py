"""Small local implementation of the M1 privacy and review contract.

This module deliberately keeps authorization in one place so API and tests use
the same checks. The pilot is not a substitute for database RLS in production.
"""

from __future__ import annotations

import hashlib
import hmac
import io
import os
import secrets
import sqlite3
import time
import uuid
from pathlib import Path


class Denied(Exception):
    pass


class Conflict(Exception):
    pass


SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, salt BLOB NOT NULL,
 password_hash BLOB NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash BLOB PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
 expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS groups (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, creator_id TEXT NOT NULL REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS members (
 group_id TEXT NOT NULL REFERENCES groups(id), user_id TEXT NOT NULL REFERENCES users(id),
 role TEXT NOT NULL CHECK(role IN ('admin','member')),
 PRIMARY KEY(group_id,user_id)
);
CREATE TABLE IF NOT EXISTS invitations (
 id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES groups(id),
 token_hash BLOB NOT NULL UNIQUE, expires_at INTEGER NOT NULL,
 accepted_by TEXT REFERENCES users(id), accepted_at INTEGER, revoked_at INTEGER
);
CREATE TABLE IF NOT EXISTS media (
 id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES groups(id),
 owner_id TEXT NOT NULL REFERENCES users(id), sha256 TEXT NOT NULL,
 mime TEXT NOT NULL, original_name TEXT NOT NULL, created_at INTEGER NOT NULL,
 caption TEXT NOT NULL DEFAULT '', capture_date TEXT,
 status TEXT NOT NULL DEFAULT 'staged' CHECK(status IN ('staged','published','deleted')),
 policy_version INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS media_by_group ON media(group_id, status, created_at);
CREATE TABLE IF NOT EXISTS media_grants (
 media_id TEXT NOT NULL REFERENCES media(id), component TEXT NOT NULL
 CHECK(component IN ('preview','caption','date','original')),
 audience TEXT NOT NULL CHECK(audience IN ('group','selected')),
 recipient_id TEXT REFERENCES users(id),
 CHECK((audience='group' AND recipient_id IS NULL) OR
       (audience='selected' AND recipient_id IS NOT NULL)),
 UNIQUE(media_id,component,audience,recipient_id)
);
CREATE TABLE IF NOT EXISTS memories (
 id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES groups(id),
 owner_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
 created_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'draft'
 CHECK(status IN ('draft','published','deleted')),
 policy_version INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS memory_media (
 memory_id TEXT NOT NULL REFERENCES memories(id), media_id TEXT NOT NULL REFERENCES media(id),
 PRIMARY KEY(memory_id,media_id)
);
CREATE TABLE IF NOT EXISTS memory_grants (
 memory_id TEXT NOT NULL REFERENCES memories(id), audience TEXT NOT NULL
 CHECK(audience IN ('group','selected')),
 recipient_id TEXT REFERENCES users(id),
 CHECK((audience='group' AND recipient_id IS NULL) OR
       (audience='selected' AND recipient_id IS NOT NULL)),
 UNIQUE(memory_id,audience,recipient_id)
);
CREATE TABLE IF NOT EXISTS audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT NOT NULL,
 action TEXT NOT NULL, target_id TEXT NOT NULL, at INTEGER NOT NULL
);
"""


def _id() -> str:
    return str(uuid.uuid4())


def _hash_token(token: str) -> bytes:
    return hashlib.sha256(token.encode()).digest()


class Store:
    def __init__(self, root: str | Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self.originals = self.root / "originals"
        self.previews = self.root / "previews"
        self.originals.mkdir(exist_ok=True)
        self.previews.mkdir(exist_ok=True)
        os.chmod(self.root, 0o700)
        os.chmod(self.originals, 0o700)
        os.chmod(self.previews, 0o700)
        self.db = sqlite3.connect(self.root / "mazi.sqlite3", check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)
        os.chmod(self.root / "mazi.sqlite3", 0o600)

    def close(self):
        self.db.close()

    def _audit(self, actor: str, action: str, target: str):
        self.db.execute("INSERT INTO audit(actor_id,action,target_id,at) VALUES(?,?,?,?)",
                        (actor, action, target, int(time.time())))

    def register(self, email: str, password: str) -> str:
        email = email.strip().lower()
        if not email or "@" not in email or len(password) < 12:
            raise Denied("Use an email and a password of at least 12 characters")
        salt = secrets.token_bytes(16)
        digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
        user = _id()
        try:
            with self.db:
                self.db.execute("INSERT INTO users VALUES(?,?,?,?)", (user, email, salt, digest))
        except sqlite3.IntegrityError as exc:
            raise Conflict("Account already exists") from exc
        return user

    def login(self, email: str, password: str) -> str:
        row = self.db.execute("SELECT * FROM users WHERE email=?", (email.strip().lower(),)).fetchone()
        if row is None:
            raise Denied("Invalid credentials")
        digest = hashlib.scrypt(password.encode(), salt=row["salt"], n=2**14, r=8, p=1)
        if not hmac.compare_digest(digest, row["password_hash"]):
            raise Denied("Invalid credentials")
        token = secrets.token_urlsafe(32)
        with self.db:
            self.db.execute("INSERT INTO sessions VALUES(?,?,?)",
                            (_hash_token(token), row["id"], int(time.time()) + 86400))
        return token

    def user_for_token(self, token: str | None) -> str:
        if not token:
            raise Denied("Sign in required")
        row = self.db.execute("SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?",
                              (_hash_token(token), int(time.time()))).fetchone()
        if row is None:
            raise Denied("Session expired")
        return row["user_id"]

    def logout(self, token: str):
        with self.db:
            self.db.execute("DELETE FROM sessions WHERE token_hash=?", (_hash_token(token),))

    def _member(self, user: str, group: str, admin: bool = False):
        row = self.db.execute("SELECT role FROM members WHERE user_id=? AND group_id=?",
                              (user, group)).fetchone()
        if row is None or (admin and row["role"] != "admin"):
            raise Denied("Group access denied")

    def create_group(self, user: str, name: str) -> str:
        name = name.strip()
        if not name or len(name) > 100:
            raise Denied("Invalid group name")
        group = _id()
        with self.db:
            self.db.execute("INSERT INTO groups VALUES(?,?,?)", (group, name, user))
            self.db.execute("INSERT INTO members VALUES(?,?,?)", (group, user, "admin"))
            self._audit(user, "group.create", group)
        return group

    def groups_for(self, user: str):
        return [dict(row) for row in self.db.execute(
            "SELECT g.id,g.name,m.role FROM groups g JOIN members m ON m.group_id=g.id WHERE m.user_id=?",
            (user,))]

    def invite(self, user: str, group: str, hours: int = 24) -> str:
        self._member(user, group, admin=True)
        if hours < 1 or hours > 168:
            raise Denied("Invalid expiry")
        token = secrets.token_urlsafe(32)
        with self.db:
            self.db.execute("INSERT INTO invitations(id,group_id,token_hash,expires_at) VALUES(?,?,?,?)",
                            (_id(), group, _hash_token(token), int(time.time()) + hours * 3600))
            self._audit(user, "invitation.create", group)
        return token

    def accept(self, user: str, token: str) -> str:
        # SQLite serializes these writes. The conditional UPDATE makes acceptance single use.
        with self.db:
            row = self.db.execute(
                "SELECT id,group_id FROM invitations WHERE token_hash=? AND expires_at>? "
                "AND accepted_at IS NULL AND revoked_at IS NULL",
                (_hash_token(token), int(time.time()))).fetchone()
            if row is None:
                raise Denied("Invitation is invalid or expired")
            updated = self.db.execute(
                "UPDATE invitations SET accepted_by=?, accepted_at=? WHERE id=? AND accepted_at IS NULL",
                (user, int(time.time()), row["id"])).rowcount
            if updated != 1:
                raise Denied("Invitation already used")
            self.db.execute("INSERT OR IGNORE INTO members VALUES(?,?,?)",
                            (row["group_id"], user, "member"))
            self._audit(user, "invitation.accept", row["id"])
        return row["group_id"]

    def remove_member(self, admin: str, group: str, user: str):
        self._member(admin, group, admin=True)
        if admin == user:
            raise Denied("Admin cannot remove self")
        with self.db:
            self.db.execute("DELETE FROM members WHERE group_id=? AND user_id=?", (group, user))
            self._audit(admin, "membership.remove", user)

    def upload_image(self, user: str, group: str, filename: str, data: bytes,
                     caption: str = "", capture_date: str | None = None) -> str:
        self._member(user, group)
        if len(data) > 20 * 1024 * 1024 or not data:
            raise Denied("Image must be 20 MB or smaller")
        from PIL import Image, UnidentifiedImageError
        try:
            image = Image.open(io.BytesIO(data))
            image.verify()
            image = Image.open(io.BytesIO(data))
            if image.format not in ("JPEG", "PNG") or image.width * image.height > 50_000_000:
                raise Denied("Only JPEG and PNG images up to 50 megapixels are supported")
            image.thumbnail((1600, 1600))
            preview = io.BytesIO()
            image.convert("RGB").save(preview, format="JPEG", quality=85)
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            raise Denied("Invalid image") from exc
        media = _id()
        (self.originals / media).write_bytes(data)
        (self.previews / media).write_bytes(preview.getvalue())
        os.chmod(self.originals / media, 0o600)
        os.chmod(self.previews / media, 0o600)
        try:
            with self.db:
                self.db.execute(
                    "INSERT INTO media(id,group_id,owner_id,sha256,mime,original_name,created_at,caption,capture_date) "
                    "VALUES(?,?,?,?,?,?,?,?,?)",
                    (media, group, user, hashlib.sha256(data).hexdigest(),
                     "image/jpeg" if image.format == "JPEG" else "image/png",
                     filename[:255], int(time.time()), caption[:2000], capture_date))
                self._audit(user, "media.stage", media)
        except Exception:
            (self.originals / media).unlink(missing_ok=True)
            (self.previews / media).unlink(missing_ok=True)
            raise
        return media

    def _grant_visible(self, table: str, id_column: str, item: str, component: str | None,
                       viewer: str) -> bool:
        where_component = "AND component=?" if component else ""
        args = (item, component, viewer) if component else (item, viewer)
        row = self.db.execute(
            f"SELECT 1 FROM {table} WHERE {id_column}=? {where_component} "
            "AND (audience='group' OR (audience='selected' AND recipient_id=?)) LIMIT 1", args).fetchone()
        return row is not None

    def _media(self, user: str, media: str):
        row = self.db.execute("SELECT * FROM media WHERE id=? AND status!='deleted'", (media,)).fetchone()
        if row is None:
            raise Denied("Media unavailable")
        self._member(user, row["group_id"])
        return row

    def publish_media(self, user: str, media: str, components: list[str],
                      audience: str, recipients: list[str] | None = None, version: int = 0):
        row = self._media(user, media)
        if row["owner_id"] != user or row["policy_version"] != version:
            raise Denied("Owner or policy version mismatch")
        if audience not in ("group", "selected") or "preview" not in components or not set(components) <= {"preview","caption","date","original"}:
            raise Denied("Invalid publication")
        recipients = list(dict.fromkeys(recipients or []))
        if audience == "selected" and not recipients:
            raise Denied("Select recipients")
        for recipient in recipients:
            self._member(recipient, row["group_id"])
        with self.db:
            self.db.execute("DELETE FROM media_grants WHERE media_id=?", (media,))
            for component in components:
                for recipient in (recipients if audience == "selected" else [None]):
                    self.db.execute("INSERT INTO media_grants VALUES(?,?,?,?)",
                                    (media, component, audience, recipient))
            self.db.execute("UPDATE media SET status='published', policy_version=policy_version+1 WHERE id=?", (media,))
            self._audit(user, "media.publish", media)

    def revoke_media(self, user: str, media: str):
        row = self._media(user, media)
        if row["owner_id"] != user:
            raise Denied("Only owner can revoke")
        with self.db:
            self.db.execute("DELETE FROM media_grants WHERE media_id=?", (media,))
            self.db.execute("UPDATE media SET status='staged', policy_version=policy_version+1 WHERE id=?", (media,))
            self._audit(user, "media.revoke", media)

    def media_view(self, user: str, media: str) -> dict:
        row = self._media(user, media)
        owner = row["owner_id"] == user
        if not owner and (row["status"] != "published" or not self._grant_visible(
                "media_grants", "media_id", media, "preview", user)):
            raise Denied("Media unavailable")
        result = {"id": media, "group_id": row["group_id"], "owner": owner,
                  "status": row["status"], "policy_version": row["policy_version"]}
        if owner or self._grant_visible("media_grants", "media_id", media, "caption", user):
            result["caption"] = row["caption"]
        if owner or self._grant_visible("media_grants", "media_id", media, "date", user):
            result["capture_date"] = row["capture_date"]
        if owner:
            result["original_name"] = row["original_name"]
        return result

    def owned_media(self, user: str, group: str) -> list[dict]:
        self._member(user, group)
        return [self.media_view(user, row["id"]) for row in self.db.execute(
            "SELECT id FROM media WHERE owner_id=? AND group_id=? AND status!='deleted' ORDER BY created_at DESC",
            (user, group))]

    def media_bytes(self, user: str, media: str, original: bool = False) -> bytes:
        row = self._media(user, media)
        if row["owner_id"] != user:
            component = "original" if original else "preview"
            if row["status"] != "published" or not self._grant_visible(
                    "media_grants", "media_id", media, component, user):
                raise Denied("Media unavailable")
        return ((self.originals if original else self.previews) / media).read_bytes()

    def create_memory(self, user: str, group: str, title: str, media_ids: list[str]) -> str:
        self._member(user, group)
        if not title.strip() or len(title) > 200:
            raise Denied("Invalid title")
        for media in media_ids:
            row = self._media(user, media)
            if row["group_id"] != group:
                raise Denied("Cross-group media")
        memory = _id()
        with self.db:
            self.db.execute("INSERT INTO memories(id,group_id,owner_id,title,created_at) VALUES(?,?,?,?,?)",
                            (memory, group, user, title.strip(), int(time.time())))
            for media in set(media_ids):
                self.db.execute("INSERT INTO memory_media VALUES(?,?)", (memory, media))
            self._audit(user, "memory.create", memory)
        return memory

    def publish_memory(self, user: str, memory: str, audience: str,
                       recipients: list[str] | None = None, version: int = 0):
        row = self.db.execute("SELECT * FROM memories WHERE id=?", (memory,)).fetchone()
        if row is None or row["owner_id"] != user or row["policy_version"] != version:
            raise Denied("Memory unavailable or stale")
        if audience not in ("group", "selected"):
            raise Denied("Invalid audience")
        recipients = list(dict.fromkeys(recipients or []))
        if audience == "selected" and not recipients:
            raise Denied("Select recipients")
        for recipient in recipients:
            self._member(recipient, row["group_id"])
        with self.db:
            self.db.execute("DELETE FROM memory_grants WHERE memory_id=?", (memory,))
            for recipient in (recipients if audience == "selected" else [None]):
                self.db.execute("INSERT INTO memory_grants VALUES(?,?,?)", (memory, audience, recipient))
            self.db.execute("UPDATE memories SET status='published', policy_version=policy_version+1 WHERE id=?", (memory,))
            self._audit(user, "memory.publish", memory)

    def memory_view(self, user: str, memory: str) -> dict:
        row = self.db.execute("SELECT * FROM memories WHERE id=? AND status!='deleted'", (memory,)).fetchone()
        if row is None:
            raise Denied("Memory unavailable")
        self._member(user, row["group_id"])
        if row["owner_id"] != user and (row["status"] != "published" or not self._grant_visible(
                "memory_grants", "memory_id", memory, None, user)):
            raise Denied("Memory unavailable")
        visible = []
        for link in self.db.execute("SELECT media_id FROM memory_media WHERE memory_id=?", (memory,)):
            try:
                visible.append(self.media_view(user, link["media_id"]))
            except Denied:
                pass
        return {"id": memory, "title": row["title"], "status": row["status"],
                "policy_version": row["policy_version"], "media": visible,
                "visible_media_count": len(visible)}

    def owned_memories(self, user: str, group: str) -> list[dict]:
        self._member(user, group)
        return [self.memory_view(user, row["id"]) for row in self.db.execute(
            "SELECT id FROM memories WHERE owner_id=? AND group_id=? AND status!='deleted' ORDER BY created_at DESC",
            (user, group))]

    def timeline(self, user: str, group: str, query: str = "") -> list[dict]:
        self._member(user, group)
        rows = self.db.execute(
            "SELECT id FROM memories WHERE group_id=? AND status!='deleted' ORDER BY created_at DESC LIMIT 100",
            (group,)).fetchall()
        results = []
        for row in rows:
            try:
                item = self.memory_view(user, row["id"])
            except Denied:
                continue
            if query.casefold() in item["title"].casefold():
                results.append(item)
        return results
