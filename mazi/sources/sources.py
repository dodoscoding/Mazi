"""Foreground source transfers sharing the local archive's authorization boundary."""
from __future__ import annotations

import io
import hashlib
import json
import math
import os
import time
import uuid
import zipfile
from datetime import date
from pathlib import Path

from mazi.identity.core import Conflict, Denied
from mazi.imports.adapters import MAX_FILE, NormalizedImportItem, digest
from mazi.archive.review import ReviewStore

SCHEMA = """
CREATE TABLE IF NOT EXISTS continuous_sources (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, group_id TEXT NOT NULL,
 kind TEXT NOT NULL, label TEXT NOT NULL, scope TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 0, permission TEXT NOT NULL DEFAULT 'unknown',
 generation INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS source_resources (
 id TEXT PRIMARY KEY, connection TEXT NOT NULL REFERENCES continuous_sources(id),
 identity TEXT NOT NULL, metadata TEXT NOT NULL, sha256 TEXT NOT NULL,
 size INTEGER NOT NULL, received INTEGER NOT NULL DEFAULT 0,
 generation INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'UPLOADING',
 withdrawn INTEGER NOT NULL DEFAULT 0, UNIQUE(connection,identity)
);
CREATE TABLE IF NOT EXISTS shared_places (
 origin TEXT PRIMARY KEY REFERENCES archive_origins(id), country TEXT NOT NULL,
 city TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, day TEXT
);
CREATE TABLE IF NOT EXISTS source_outcomes (
 id TEXT PRIMARY KEY, connection TEXT NOT NULL, metadata TEXT NOT NULL, reason TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS discord_cursors (
 connection TEXT NOT NULL, channel TEXT NOT NULL, cursor TEXT NOT NULL,
 PRIMARY KEY(connection,channel)
);
"""


def calendar_day(value):
    if not isinstance(value, str) or len(value) != 10 or date.fromisoformat(value).isoformat() != value:
        raise ValueError('Expected YYYY-MM-DD')
    return value


def text(value, limit=200):
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise ValueError('Invalid text')
    return value.strip()


class SourceStore(ReviewStore):
    def __init__(self, root):
        super().__init__(root)
        self.db.executescript(SCHEMA)
        self.discord_authorize = None
        self.discord_sources = set()
        self.resource_dir = self.root / 'source-resources'
        self.resource_dir.mkdir(mode=0o700, exist_ok=True)

    def create_source(self, user, group, kind, label, scope):
        if kind not in ('apple', 'discord') or not isinstance(scope, dict):
            raise ValueError('Invalid source')
        label = text(label)
        start, end = calendar_day(scope.get('start')), calendar_day(scope.get('end'))
        if start > end:
            raise ValueError('Date range reversed')
        allowed = {'start', 'end', 'albums', 'types'} if kind == 'apple' else {'start', 'end', 'guild', 'channels'}
        if set(scope) - allowed:
            raise ValueError('Unknown scope field')
        if kind == 'apple':
            if not isinstance(scope.get('albums'), list) or len(scope['albums']) > 100:
                raise ValueError('Invalid albums')
            for album in scope['albums']:
                text(album)
            if not isinstance(scope.get('types'), list) or not scope['types'] or not set(scope['types']) <= {'image', 'video'}:
                raise ValueError('Invalid media types')
        else:
            if not isinstance(scope.get('channels'), list) or not 1 <= len(scope['channels']) <= 20:
                raise ValueError('Select 1–20 channels')
            for snowflake in [scope.get('guild'), *scope['channels']]:
                if not isinstance(snowflake, str) or not snowflake.isascii() or not snowflake.isdigit() or len(snowflake) > 20:
                    raise ValueError('Invalid Discord ID')
        with self.transaction():
            self._member(user, group)
            connection = str(uuid.uuid4())
            self.db.execute('INSERT INTO continuous_sources(id,owner_id,group_id,kind,label,scope) VALUES(?,?,?,?,?,?)',
                            (connection, user, group, kind, label, json.dumps(scope, sort_keys=True)))
            self._audit(user, 'source.create', connection)
        return connection

    def _source(self, user, connection, active=False):
        row = self.db.execute('SELECT * FROM continuous_sources WHERE id=?', (connection,)).fetchone()
        if not row or row['owner_id'] != user:
            raise Denied('Source unavailable')
        self._member(user, row['group_id'])
        if active and (not row['enabled'] or row['permission'] not in ('authorized', 'limited')):
            raise Denied('Source paused or permission unavailable')
        return row

    def sources(self, user, group):
        self._member(user, group)
        return [{**dict(row), 'scope': json.loads(row['scope'])} for row in self.db.execute(
            'SELECT * FROM continuous_sources WHERE owner_id=? AND group_id=? ORDER BY rowid', (user, group))]

    def set_source(self, user, connection, enabled, permission):
        if type(enabled) is not bool or permission not in ('unknown', 'authorized', 'limited', 'denied', 'revoked'):
            raise ValueError('Invalid source state')
        with self.transaction():
            self._source(user, connection)
            self.db.execute('UPDATE continuous_sources SET enabled=?,permission=?,generation=generation+1 WHERE id=?',
                            (int(enabled and permission in ('authorized', 'limited')), permission, connection))
            # Fence already-claimed work as well as future transfers. Retained media stays available.
            runs = self.db.execute("SELECT id FROM source_resources WHERE connection=? AND state IN ('UPLOADING','QUEUED')", (connection,)).fetchall()
            for run in runs:
                self._cancel(run['id'])
            current = self._source(user, connection)
            if current['kind'] == 'discord' and current['enabled']:
                # The durable message cursor may already be beyond an image waiting for its preview.
                # Resume its existing job; the worker rechecks provider permissions at completion.
                for resource in self.db.execute("SELECT id FROM source_resources WHERE connection=? AND state='QUEUED' AND withdrawn=0", (connection,)).fetchall():
                    run = self.db.execute('SELECT withdrawn FROM import_runs WHERE id=?', (resource['id'],)).fetchone()
                    if run and not run['withdrawn']:
                        self.db.execute('UPDATE source_resources SET generation=? WHERE id=?', (current['generation'], resource['id']))
                        self.db.execute("UPDATE import_items SET outcome='PENDING',reason='SOURCE_RESUMED',attempts=0,retry_at=0,lease_token=NULL,lease_until=NULL WHERE id=? AND outcome='CANCELLED'", (resource['id'],))
                        self.db.execute("UPDATE import_runs SET state='PROCESSING' WHERE id=?", (resource['id'],))
            self._audit(user, 'source.state', connection)

    def _scope_check(self, source, metadata):
        scope = json.loads(source['scope'])
        day = calendar_day(metadata.get('date'))
        if not scope['start'] <= day <= scope['end']:
            raise Denied('Outside selected date range')
        if source['kind'] == 'apple':
            albums = metadata.get('albums', [])
            if not isinstance(albums, list) or any(not isinstance(a, str) for a in albums):
                raise ValueError('Invalid albums')
            if metadata.get('kind') not in scope['types'] or (scope['albums'] and not set(albums) & set(scope['albums'])):
                raise Denied('Outside selected albums or media types')
        elif metadata.get('channel') not in scope['channels'] or metadata.get('guild') != scope['guild']:
            raise Denied('Outside selected server or channels')

    def begin_resource(self, user, connection, metadata, size, sha256):
        if not isinstance(metadata, dict) or len(json.dumps(metadata)) > 12000:
            raise ValueError('Invalid resource metadata')
        for field in ('item', 'component', 'version', 'filename'):
            text(metadata.get(field))
        if '/' in metadata['filename'] or '\\' in metadata['filename'] or '\x00' in metadata['filename']:
            raise ValueError('Invalid filename')
        if type(size) is not int or not 0 < size <= MAX_FILE:
            raise ValueError('Resource exceeds 25 MiB; no bytes accepted')
        if not isinstance(sha256, str) or len(sha256) != 64 or any(c not in '0123456789abcdef' for c in sha256):
            raise ValueError('Invalid checksum')
        identity = digest([metadata['item'], metadata['component'], metadata['version']])
        with self.transaction():
            source = self._source(user, connection, active=True)
            self._scope_check(source, metadata)
            old = self.db.execute('SELECT * FROM source_resources WHERE connection=? AND identity=?', (connection, identity)).fetchone()
            if old:
                self._resource(user, old['id'])
                if old['withdrawn']:
                    raise Denied('Resource was withdrawn')
                if old['sha256'] != sha256 or old['size'] != size or json.loads(old['metadata']) != metadata:
                    raise Conflict('Resource version changed; supply its new version')
                self.db.execute('UPDATE source_resources SET generation=? WHERE id=?', (source['generation'], old['id']))
                return dict(old)
            used = self.db.execute('SELECT coalesce(sum(r.size),0) FROM source_resources r JOIN continuous_sources s ON s.id=r.connection WHERE s.group_id=?', (source['group_id'],)).fetchone()[0]
            if used + size > 2 * 1024**3:
                raise Conflict('Local source storage limit is 2 GiB')
            resource = str(uuid.uuid4())
            self.db.execute('INSERT INTO source_resources(id,connection,identity,metadata,sha256,size,generation) VALUES(?,?,?,?,?,?,?)',
                            (resource, connection, identity, json.dumps(metadata, sort_keys=True), sha256, size, source['generation']))
            # A run per component preserves originals, edits and Live Photo parts separately.
            self.db.execute('INSERT INTO import_runs(id,owner_id,group_id,source,namespace,manifest,options,size,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
                            (resource, user, source['group_id'], source['kind'], connection, identity, '{}', size, time.time()))
            self._audit(user, 'source.resource.begin', resource)
            return dict(self.db.execute('SELECT * FROM source_resources WHERE id=?', (resource,)).fetchone())

    def _resource(self, user, resource, active=False):
        row = self.db.execute('SELECT * FROM source_resources WHERE id=?', (resource,)).fetchone()
        if not row or row['withdrawn']:
            raise Denied('Resource unavailable')
        run = self.db.execute('SELECT withdrawn FROM import_runs WHERE id=?', (resource,)).fetchone()
        if run and run['withdrawn']:
            raise Denied('Contribution was withdrawn')
        source = self._source(user, row['connection'], active=active)
        if active and row['generation'] != source['generation']:
            raise Conflict('Source state changed; resume with a fresh permission check')
        return row, source

    def resource_chunk(self, user, resource, offset, data):
        if type(offset) is not int or offset < 0 or not isinstance(data, bytes) or not 0 < len(data) <= 512 * 1024:
            raise ValueError('Invalid chunk')
        with self.transaction():
            row, _ = self._resource(user, resource, True)
            if row['state'] != 'UPLOADING' or offset > row['received'] or offset + len(data) > row['size']:
                raise Conflict('Transfer state or offset changed')
            path = self.resource_dir / resource
            if not path.exists():
                path.touch(mode=0o600)
            with path.open('r+b') as stream:
                stream.seek(offset)
                if offset < row['received']:
                    if offset + len(data) > row['received'] or stream.read(len(data)) != data:
                        raise Conflict('Repeated chunk differs')
                    return row['received']
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
            self.db.execute('UPDATE source_resources SET received=? WHERE id=?', (offset + len(data), resource))
            return offset + len(data)

    def finish_resource(self, user, resource):
        with self.transaction():
            row, source = self._resource(user, resource, True)
            if row['state'] in ('AVAILABLE_TO_GROUP', 'RETAINED_NO_PREVIEW'):
                return
            if row['received'] != row['size']:
                raise Conflict('Transfer incomplete')
            data = (self.resource_dir / resource).read_bytes()
            if hashlib.sha256(data).hexdigest() != row['sha256']:
                self.db.execute('UPDATE source_resources SET received=0 WHERE id=?', (resource,))
                self.db.commit()
                raise Conflict('Checksum mismatch; restart transfer')
            metadata = json.loads(row['metadata'])
            suffix = Path(metadata['filename']).suffix.lower()
            mime = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png'}.get(suffix)
            if not mime:
                self.db.execute("UPDATE source_resources SET state='RETAINED_NO_PREVIEW' WHERE id=?", (resource,))
                self.db.execute("UPDATE import_runs SET state='COMPLETED' WHERE id=?", (resource,))
                self._audit(user, 'source.retained_without_preview', resource)
                return
            blob = 'resource' + suffix
            target = self.archive_dir / resource
            with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_STORED) as archive:
                archive.writestr(blob, data)
            os.chmod(target, 0o600)
            item = NormalizedImportItem(source['kind'], source['id'], digest([source['id'], row['identity']]),
                metadata['component'], 'source:#' + metadata['item'], source_item_id=metadata['item'],
                local_blob_reference=blob, original_filename=metadata['filename'], declared_media_type=mime,
                coverage={'complete': False, 'scope': json.loads(source['scope']), 'resource': metadata},
                sender={'id': metadata.get('sender', '')},
                channel={'id': metadata.get('channel', '')},
                shared_at_assertion={'raw': metadata.get('shared_at'), 'source': 'discord_message'},
                context=[{'text': metadata.get('text', ''), 'locator': metadata['item']}] if metadata.get('text') else [])
            # Parent completion retains EXIF; source date is additional evidence in prepare().
            self.db.execute('INSERT INTO import_items(id,run_id,ordinal,occurrence,payload,outcome,reason) VALUES(?,?,0,?,?,?,?) '
                "ON CONFLICT(id) DO UPDATE SET outcome='PENDING',reason='RESUMED',attempts=0,lease_token=NULL,lease_until=NULL,retry_at=0",
                (resource, resource, item.occurrence_key, json.dumps(item.to_dict()), 'PENDING', 'SOURCE_TRANSFERRED'))
            self.db.execute("UPDATE import_runs SET state='PROCESSING',scan_done=1,checkpoint=1 WHERE id=?", (resource,))
            self.db.execute("UPDATE source_resources SET state='QUEUED' WHERE id=?", (resource,))

    def _fence(self, job, now):
        row = super()._fence(job, now)
        resource = self.db.execute('SELECT id FROM source_resources WHERE id=?', (job['run_id'],)).fetchone()
        if resource:
            _, source = self._resource(row['owner_id'], resource['id'], True)
            if source['kind'] == 'discord' and (self.discord_authorize is None or source['id'] not in self.discord_sources):
                raise Denied('Discord permission verification unavailable')
        return row

    def _authorize_discord(self, job):
        resource = self.db.execute('SELECT id FROM source_resources WHERE id=?', (job['run_id'],)).fetchone()
        if not resource:
            return
        transfer, source = self._resource(job['owner_id'], resource['id'], True)
        if source['kind'] != 'discord':
            return
        if self.discord_authorize is None or source['id'] not in self.discord_sources:
            raise Denied('Discord permission verification unavailable')
        metadata = json.loads(transfer['metadata'])
        self.discord_authorize(metadata['guild'], metadata['channel'])

    def prepare(self, job):
        prepared = super().prepare(job)
        source = self.db.execute('SELECT metadata FROM source_resources WHERE id=?', (job['run_id'],)).fetchone()
        if source and prepared['outcome'] == 'AVAILABLE_TO_GROUP':
            metadata = json.loads(source['metadata'])
            if not prepared['capture'] and metadata.get('capture_date'):
                prepared['capture'] = [{'local': calendar_day(metadata['capture_date']), 'source': 'selected_source', 'inferred': False}]
        return prepared

    def complete(self, job, prepared=None, now=None):
        self._authorize_discord(job)
        super().complete(job, prepared, now)
        with self.transaction():
            self.db.execute("UPDATE source_resources SET state=(SELECT outcome FROM import_items WHERE id=?) WHERE id=?", (job['id'], job['run_id']))

    def record_source_outcome(self, user, connection, metadata, reason):
        with self.transaction():
            self._source(user, connection, True)
            key = digest([connection, metadata])
            self.db.execute("INSERT OR REPLACE INTO source_outcomes VALUES(?,?,?,?)", (key, connection, json.dumps(metadata), reason))

    def resources(self, user, connection):
        self._source(user, connection)
        transfers = [{**dict(row), 'metadata': json.loads(row['metadata']), 'state': row['outcome'] or row['state']}
                for row in self.db.execute('SELECT r.*,i.outcome,i.reason,i.asset_id FROM source_resources r LEFT JOIN import_items i ON i.id=r.id WHERE connection=? ORDER BY r.rowid LIMIT 1000', (connection,))]
        rejected = [{**dict(row), 'metadata': json.loads(row['metadata']), 'state': row['reason'], 'withdrawn': True, 'size': 0, 'received': 0}
                    for row in self.db.execute('SELECT * FROM source_outcomes WHERE connection=? ORDER BY rowid LIMIT 1000', (connection,))]
        return (transfers + rejected)[:1000]

    def resource_bytes(self, user, resource):
        row = self.db.execute('SELECT r.*,s.owner_id,s.group_id FROM source_resources r JOIN continuous_sources s ON s.id=r.connection WHERE r.id=?', (resource,)).fetchone()
        if not row or row['withdrawn']:
            raise Denied('Resource unavailable')
        run = self.db.execute('SELECT withdrawn FROM import_runs WHERE id=?', (resource,)).fetchone()
        if run and run['withdrawn']:
            raise Denied('Contribution was withdrawn')
        self._member(user, row['group_id'])
        self._member(row['owner_id'], row['group_id'])
        if row['state'] == 'RETAINED_NO_PREVIEW':
            return (self.resource_dir / resource).read_bytes()
        origin = self.db.execute('SELECT asset_id FROM archive_origins WHERE run_id=? AND withdrawn=0', (resource,)).fetchone()
        if not origin:
            raise Denied('Resource unavailable')
        return self.asset_bytes(user, origin[0], original=True)

    def withdraw_resource(self, user, resource):
        with self.transaction():
            self._resource(user, resource)
            self._cancel(resource)
            self.db.execute('UPDATE source_resources SET withdrawn=1 WHERE id=?', (resource,))
            self.db.execute('UPDATE import_runs SET withdrawn=1 WHERE id=?', (resource,))
            self.db.execute('UPDATE archive_origins SET withdrawn=1 WHERE run_id=?', (resource,))
            self._audit(user, 'source.withdraw', resource)

    def set_place(self, user, origin, country, city, latitude, longitude, day):
        with self.transaction():
            row = self.db.execute('SELECT * FROM archive_origins WHERE id=? AND withdrawn=0', (origin,)).fetchone()
            if not row or row['owner_id'] != user:
                raise Denied('Only the contributor may share this location')
            self._asset(user, row['asset_id'])
            if latitude is None and longitude is None:
                self.db.execute('DELETE FROM shared_places WHERE origin=?', (origin,))
            else:
                if type(latitude) not in (float, int) or type(longitude) not in (float, int) or not math.isfinite(latitude) or not math.isfinite(longitude) or not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
                    raise ValueError('Invalid coordinates')
                country, city = text(country, 2).upper(), text(city)
                if len(country) != 2 or not country.isascii() or not country.isalpha():
                    raise ValueError('Use two-letter country code')
                if day is not None:
                    calendar_day(day)
                self.db.execute('INSERT INTO shared_places VALUES(?,?,?,?,?,?) ON CONFLICT(origin) DO UPDATE SET country=excluded.country,city=excluded.city,latitude=excluded.latitude,longitude=excluded.longitude,day=excluded.day',
                    (origin, country, city, latitude, longitude, day))
            self._audit(user, 'place.update', origin)

    def places(self, user, group, country='', city='', paths=False):
        self._member(user, group)
        if not isinstance(country, str) or not isinstance(city, str) or type(paths) is not bool:
            raise ValueError('Invalid filters')
        rows = [dict(row) for row in self.db.execute('SELECT p.*,o.asset_id FROM shared_places p JOIN archive_origins o ON o.id=p.origin JOIN members m ON m.group_id=o.group_id AND m.user_id=o.owner_id WHERE o.group_id=? AND o.withdrawn=0 ORDER BY p.day,p.origin LIMIT 1001', (group,))]
        if len(rows) > 1000:
            raise ValueError('Local map limit is 1,000 shared locations')
        countries = sorted({r['country'] for r in rows})
        narrowed = [r for r in rows if not country or r['country'] == country.upper()]
        cities = sorted({r['city'] for r in narrowed})
        points = [r for r in narrowed if not city or r['city'].casefold() == city.casefold()]
        dated = [r for r in points if r['day']]
        return {'points': points, 'countries': countries, 'cities': cities,
                'paths': [[a['origin'], b['origin']] for a, b in zip(dated, dated[1:]) if a['day'] != b['day']] if paths else []}

    def export_archive(self, user, group):
        self._member(user, group)
        resources = self.db.execute("SELECT r.* FROM source_resources r JOIN continuous_sources s ON s.id=r.connection JOIN members m ON m.group_id=s.group_id AND m.user_id=s.owner_id JOIN import_runs i ON i.id=r.id WHERE s.group_id=? AND r.withdrawn=0 AND i.withdrawn=0 AND r.state='RETAINED_NO_PREVIEW'", (group,)).fetchall()
        size = sum(row['size'] for row in resources)
        output = io.BytesIO(super().export_archive(user, group))
        if size + output.getbuffer().nbytes > 128 * 1024 * 1024:
            raise ValueError('Export exceeds local 128 MiB limit')
        with zipfile.ZipFile(output, 'a', compression=zipfile.ZIP_STORED) as archive:
            manifest = []
            for row in resources:
                archive.writestr('resources/' + row['id'], self.resource_bytes(user, row['id']))
                manifest.append({'id': row['id'], 'sha256': row['sha256'], 'metadata': json.loads(row['metadata'])})
            archive.writestr('resources.json', json.dumps(manifest))
            archive.writestr('places.json', json.dumps(self.places(user, group)['points']))
        return output.getvalue()
