"""Isolated sealed content, live media derivatives and local opt-in notices."""
import base64
import io
import json
import struct
import time
import uuid
from datetime import datetime
from PIL import Image, ImageOps
from mazi.identity.core import Denied, Conflict
from mazi.discovery.discovery import text

SCHEMA = '''
CREATE TABLE IF NOT EXISTS time_capsules (
 id TEXT PRIMARY KEY, group_id TEXT NOT NULL, owner TEXT NOT NULL,
 unlock_at REAL NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, photo BLOB);
CREATE TABLE IF NOT EXISTS memory_notifications (
 group_id TEXT NOT NULL, "user" TEXT NOT NULL, enabled INTEGER NOT NULL,
 PRIMARY KEY(group_id,"user"));
CREATE TABLE IF NOT EXISTS story_subevents (
 story TEXT PRIMARY KEY REFERENCES advanced_stories(id) ON DELETE CASCADE,
 actor TEXT NOT NULL, payload TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS advanced_departure AFTER DELETE ON members BEGIN
 DELETE FROM time_capsules WHERE group_id=OLD.group_id AND owner=OLD.user_id;
 DELETE FROM memory_notifications WHERE group_id=OLD.group_id AND "user"=OLD.user_id;
 UPDATE advanced_stories SET revision=revision+1 WHERE group_id=OLD.group_id AND id IN
 (SELECT story FROM story_subevents WHERE actor=OLD.user_id);
 DELETE FROM story_subevents WHERE actor=OLD.user_id AND story IN
 (SELECT id FROM advanced_stories WHERE group_id=OLD.group_id);
END;
'''


def jpeg(data):
    with Image.open(io.BytesIO(data)) as source:
        if source.format not in ('JPEG', 'PNG') or source.width * source.height > 24000000:
            raise ValueError('Use a JPEG/PNG up to 24 megapixels')
        image = ImageOps.exif_transpose(source).convert('RGB')
        image.thumbnail((640, 480))
        canvas = Image.new('RGB', (640, 480), 'black')
        canvas.paste(image, ((640-image.width)//2, (480-image.height)//2))
        output = io.BytesIO()
        canvas.save(output, 'JPEG', quality=85)
        return output.getvalue()


def chunk(kind, data):
    return kind + struct.pack('<I', len(data)) + data + (b'\0' if len(data) % 2 else b'')


def avi(frames):
    """Minimal indexed MJPEG AVI: one video stream, one frame per second."""
    maximum = max(map(len, frames))
    avih = struct.pack('<14I', 1000000, maximum, 0, 16, len(frames), 0, 1, maximum, 640, 480, 0, 0, 0, 0)
    strh = struct.pack('<4s4sIHH8I4h', b'vids', b'MJPG', 0, 0, 0, 0, 1, 1, 0, len(frames), maximum, 0xffffffff, 0, 0, 0, 640, 480)
    strf = struct.pack('<IiiHH4sIiiII', 40, 640, 480, 1, 24, b'MJPG', 640*480*3, 0, 0, 0, 0)
    header = chunk(b'LIST', b'hdrl' + chunk(b'avih', avih) + chunk(b'LIST', b'strl' + chunk(b'strh', strh) + chunk(b'strf', strf)))
    body, index, offset = [], [], 4
    for frame in frames:
        packet = chunk(b'00dc', frame)
        body.append(packet)
        index.append(struct.pack('<4sIII', b'00dc', 16, offset, len(frame)))
        offset += len(packet)
    return chunk(b'RIFF', b'AVI ' + header + chunk(b'LIST', b'movi' + b''.join(body)) + chunk(b'idx1', b''.join(index)))


class AdvancedMixin:
    def _now(self):
        return time.time()

    def seal_capsule(self, user, group, title, content, unlock_at, photo=''):
        title, content = text(title, 200), text(content, 4000)
        if not title or not content: raise ValueError('Title and note required')
        value = datetime.fromisoformat(text(unlock_at, 80).replace('Z', '+00:00'))
        if value.tzinfo is None: raise ValueError('Timezone required')
        unlock = value.timestamp()
        if not self._now() < unlock <= self._now() + 366*86400*10:
            raise ValueError('Choose a future time within ten years')
        if not isinstance(photo, str) or len(photo) > 2800000: raise ValueError('Photo limit is 2 MiB')
        image = None
        if photo:
            try:
                raw = base64.b64decode(photo, validate=True)
                if len(raw) > 2*1024*1024: raise ValueError('Photo limit is 2 MiB')
                image = jpeg(raw)
            except (OSError, Image.DecompressionBombError) as exc:
                raise ValueError('Invalid photograph') from exc
        with self.transaction():
            self._member(user, group)
            if self.db.execute('SELECT count(*) FROM time_capsules WHERE group_id=?', (group,)).fetchone()[0] >= 100:
                raise Conflict('Local limit of 100 capsules reached')
            identity = str(uuid.uuid4())
            self.db.execute('INSERT INTO time_capsules VALUES(?,?,?,?,?,?,?)', (identity, group, user, unlock, title, content, image))
            self._audit(user, 'capsule.seal', identity)
            return dict(id=identity, unlock_at=unlock, locked=True, can_delete=True)

    def _capsule(self, user, group, identity, deletion=False):
        self._member(user, group)
        row = self.db.execute('SELECT * FROM time_capsules WHERE id=? AND group_id=?', (text(identity, 100), group)).fetchone()
        if row is None or (deletion and row['owner'] != user) or (not deletion and row['unlock_at'] > self._now()):
            raise Denied('Capsule unavailable')
        return row

    def capsule(self, user, group, identity):
        with self.transaction():
            row = self._capsule(user, group, identity)
            return dict(id=row['id'], title=row['title'], text=row['content'], unlock_at=row['unlock_at'], has_photo=bool(row['photo']), can_delete=row['owner'] == user, locked=False)

    def capsule_export(self, user, group, identity):
        with self.transaction():
            row = self._capsule(user, group, identity)
            return dict(title=row['title'], text=row['content'], unlock_at=row['unlock_at'],
                        photo_jpeg_base64=base64.b64encode(row['photo']).decode() if row['photo'] else None)

    def capsule_photo(self, user, group, identity):
        with self.transaction():
            row = self._capsule(user, group, identity)
            if row['photo'] is None: raise Denied('Photograph unavailable')
            return bytes(row['photo'])

    def capsules(self, user, group):
        with self.transaction():
            self._member(user, group)
            return [dict(id=r['id'], unlock_at=r['unlock_at'], locked=r['unlock_at'] > self._now(), can_delete=r['owner'] == user)
                    for r in self.db.execute('SELECT id,owner,unlock_at FROM time_capsules WHERE group_id=? AND (owner=? OR unlock_at<=?) ORDER BY unlock_at,id', (group, user, self._now()))]

    def delete_capsule(self, user, group, identity):
        with self.transaction():
            self._capsule(user, group, identity, deletion=True)
            self.db.execute('DELETE FROM time_capsules WHERE id=?', (identity,))
            self._audit(user, 'capsule.delete', identity)

    def notification_opt_in(self, user, group, enabled):
        if type(enabled) is not bool: raise ValueError('Boolean required')
        with self.transaction():
            self._member(user, group)
            self.db.execute('INSERT INTO memory_notifications VALUES(?,?,?) ON CONFLICT(group_id,"user") DO UPDATE SET enabled=excluded.enabled', (group, user, int(enabled)))

    def notifications(self, user, group):
        with self.transaction():
            self._member(user, group)
            row = self.db.execute('SELECT enabled FROM memory_notifications WHERE group_id=? AND "user"=?', (group, user)).fetchone()
            enabled = bool(row and row[0])
            items = [dict(id=r[0], message='A time capsule is ready to open.') for r in self.db.execute('SELECT id FROM time_capsules WHERE group_id=? AND unlock_at<=? ORDER BY unlock_at,id', (group, self._now()))] if enabled else []
            return dict(enabled=enabled, items=items)

    def save_subevents(self, user, group, story, revision, sections):
        if not isinstance(sections, list) or len(sections) > 20: raise ValueError('Up to 20 sub-events')
        with self.transaction():
            row, event = self._story(user, group, story)
            self._revision(row, revision)
            normalized, used = [], set()
            for section in sections:
                if not isinstance(section, dict): raise ValueError('Invalid sub-event')
                title, assets = text(section.get('title'), 200), section.get('assets')
                if not title or not isinstance(assets, list) or not assets or any(not isinstance(a, str) for a in assets): raise ValueError('Title and photos required')
                if len(set(assets)) != len(assets) or not set(assets) <= set(event['assets']) or set(assets) & used: raise ValueError('Choose distinct photos from this memory')
                used.update(assets)
                normalized.append(dict(title=title, assets=assets))
            self.db.execute('INSERT INTO story_subevents VALUES(?,?,?) ON CONFLICT(story) DO UPDATE SET actor=excluded.actor,payload=excluded.payload', (story, user, json.dumps(normalized)))
            self.db.execute('UPDATE advanced_stories SET revision=revision+1 WHERE id=?', (story,))
            self._audit(user, 'story.subevents', story)
            return self._story_view(user, group, story)

    def story_frame(self, user, group, story, asset):
        with self.transaction():
            _, event = self._story(user, group, story)
            if asset not in event['assets']: raise Denied('Photograph unavailable')
            return jpeg(self.asset_bytes(user, asset, original=True))

    def story_video(self, user, group, story):
        before = self.story(user, group, story)
        sections = before['subevents']
        ordered = [a for s in sections for a in s['assets']]
        ordered += [a for a in before['event']['assets'] if a not in ordered]
        if len(ordered) > 20: raise ValueError('Video supports at most 20 photos')
        frames = []
        for asset in ordered:
            frames.extend([self.story_frame(user, group, story, asset)] * 3)
        result = avi(frames)
        if len(result) > 32*1024*1024: raise ValueError('Video exceeds 32 MiB')
        if self.story(user, group, story) != before: raise Conflict('Memory changed; generate again')
        return result
