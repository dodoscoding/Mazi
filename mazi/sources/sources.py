"""Foreground source transfers sharing the local archive's authorization boundary."""
from __future__ import annotations

from mazi.persistence import ArchiveBusy, initialize_schema, insertion_order

import io
import hashlib
import json
import math
import os
import sqlite3
import time
import uuid
import zipfile
from datetime import date
from pathlib import Path

from mazi.capacity import CapacityExceeded
from mazi.identity.core import Conflict, Denied
from mazi.imports.adapters import MAX_FILE, NormalizedImportItem, digest
from mazi.archive.export import write_export_object
from mazi.archive.review import ReviewStore

PLACES_EXPORT_ROW_BYTES = 2 * 1024
PLACES_EXPORT_SCAN_SECONDS = 3

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
        initialize_schema(self.db, SCHEMA)
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
            'SELECT * FROM continuous_sources WHERE owner_id=? AND group_id=? ORDER BY ' + insertion_order(self.db, '') + '', (user, group))]

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
            received = self._append_object("source-resources", resource, offset, data)
            self.db.execute('UPDATE source_resources SET received=? WHERE id=?', (received, resource))
            return received

    def finish_resource(self, user, resource):
        with self.transaction():
            row, source = self._resource(user, resource, True)
            if row['state'] in ('AVAILABLE_TO_GROUP', 'RETAINED_NO_PREVIEW'):
                return
            if row['received'] != row['size']:
                raise Conflict('Transfer incomplete')
            data = self.objects.read("source-resources", resource)
            if hashlib.sha256(data).hexdigest() != row['sha256']:
                self.db.execute('UPDATE source_resources SET received=0 WHERE id=?', (resource,))
                self.objects.reset('source-resources', resource)
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
            output = io.BytesIO()
            with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_STORED) as archive:
                archive.writestr(blob, data)
            self.objects.retain("archives", resource, output.getvalue())
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
            self.db.execute('DELETE FROM source_outcomes WHERE id=?', (key,))
            self.db.execute('INSERT INTO source_outcomes(id,connection,metadata,reason) VALUES(?,?,?,?)', (key, connection, json.dumps(metadata), reason))

    def resources(self, user, connection):
        self._source(user, connection)
        transfers = [{**dict(row), 'metadata': json.loads(row['metadata']), 'state': row['outcome'] or row['state']}
                for row in self.db.execute('SELECT r.*,i.outcome,i.reason,i.asset_id FROM source_resources r LEFT JOIN import_items i ON i.id=r.id WHERE connection=? ORDER BY ' + insertion_order(self.db, 'r') + ' LIMIT 1000', (connection,))]
        rejected = [{**dict(row), 'metadata': json.loads(row['metadata']), 'state': row['reason'], 'withdrawn': True, 'size': 0, 'received': 0}
                    for row in self.db.execute('SELECT * FROM source_outcomes WHERE connection=? ORDER BY ' + insertion_order(self.db, '') + ' LIMIT 1000', (connection,))]
        return (transfers + rejected)[:1000]

    def _resource_locator(self, user, resource):
        row = self.db.execute('SELECT r.*,s.owner_id,s.group_id FROM source_resources r JOIN continuous_sources s ON s.id=r.connection WHERE r.id=?', (resource,)).fetchone()
        if not row or row['withdrawn']:
            raise Denied('Resource unavailable')
        run = self.db.execute('SELECT withdrawn FROM import_runs WHERE id=?', (resource,)).fetchone()
        if run and run['withdrawn']:
            raise Denied('Contribution was withdrawn')
        self._member(user, row['group_id'])
        self._member(row['owner_id'], row['group_id'])
        if row['state'] == 'RETAINED_NO_PREVIEW':
            return "source-resources", resource
        origin = self.db.execute('SELECT asset_id FROM archive_origins WHERE run_id=? AND withdrawn=0', (resource,)).fetchone()
        if not origin:
            raise Denied('Resource unavailable')
        _, namespace, key = self._asset_locator(user, origin[0], original=True)
        return namespace, key

    def resource_bytes(self, user, resource):
        return self.objects.read(*self._resource_locator(user, resource))

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

    def _places_query(self, user, group):
        return (' FROM shared_places p JOIN archive_origins o ON o.id=p.origin '
                'JOIN members m ON m.group_id=o.group_id AND m.user_id=o.owner_id '
                'WHERE o.group_id=? AND o.withdrawn=0', (group,))

    def places(self, user, group, country='', city='', paths=False):
        self._member(user, group)
        if not isinstance(country, str) or not isinstance(city, str) or type(paths) is not bool:
            raise ValueError('Invalid filters')
        clause, params = self._places_query(user, group)
        byte_length = (lambda column: f'octet_length({column})') if getattr(self.db, 'hosted', False) else (lambda column: f'length(CAST({column} AS BLOB))')
        text_bytes = ' + '.join(f'COALESCE({byte_length(column)},0)' for column in ('p.origin', 'p.country', 'p.city', 'p.day', 'o.asset_id'))
        rows, request_bytes = [], 0
        last_day = last_origin = ''
        started = time.perf_counter()
        while True:
            if time.perf_counter() - started > 15:
                raise CapacityExceeded('Local map exceeded its 15 second processing budget')
            batch = self.db.execute(f'SELECT p.origin,CASE WHEN {text_bytes}<=8192 THEN p.country END AS country,'
                                    f'CASE WHEN {text_bytes}<=8192 THEN p.city END AS city,p.latitude,p.longitude,'
                                    f'CASE WHEN {text_bytes}<=8192 THEN p.day END AS day,o.asset_id,{text_bytes} AS text_bytes'
                                    + clause + " AND (COALESCE(p.day,'')>? OR (COALESCE(p.day,'')=? AND p.origin>?))"
                                    + " ORDER BY COALESCE(p.day,''),p.origin LIMIT 128", (*params, last_day, last_day, last_origin)).fetchall()
            if not batch:
                break
            for row in batch:
                if row['text_bytes'] > 8192:
                    raise CapacityExceeded('Local map exceeded its 8 KiB location record budget')
                point = {key: row[key] for key in ('origin', 'country', 'city', 'latitude', 'longitude', 'day', 'asset_id')}
                request_bytes += len(json.dumps(point).encode('utf-8'))
                if len(rows) == 20000 or request_bytes > 8 * 1024 * 1024:
                    raise CapacityExceeded('Local map supports up to 20,000 location records within an 8 MiB response budget')
                rows.append(point)
            last_day, last_origin = batch[-1]['day'] or '', batch[-1]['origin']
        countries = sorted({r['country'] for r in rows})
        narrowed = [r for r in rows if not country or r['country'] == country.upper()]
        cities = sorted({r['city'] for r in narrowed})
        points = [r for r in narrowed if not city or r['city'].casefold() == city.casefold()]
        dated = [r for r in points if r['day']]
        return {'points': points, 'countries': countries, 'cities': cities,
                'paths': [[a['origin'], b['origin']] for a, b in zip(dated, dated[1:]) if a['day'] != b['day']] if paths else []}

    def _export_resources(self, user, group, fingerprint, archive=None, output=None):
        self._member(user, group)
        resources = self.db.execute("SELECT r.*,s.owner_id,s.group_id FROM source_resources r JOIN continuous_sources s ON s.id=r.connection JOIN members m ON m.group_id=s.group_id AND m.user_id=s.owner_id JOIN import_runs i ON i.id=r.id WHERE s.group_id=? AND r.withdrawn=0 AND i.withdrawn=0 AND r.state='RETAINED_NO_PREVIEW'", (group,)).fetchall()
        self._check_export_size(sum(row['size'] for row in resources) + (output.tell() if output is not None else 0))
        manifest = []
        for row in resources:
            identity = {key: row[key] for key in ('id', 'connection', 'identity', 'owner_id', 'group_id', 'sha256', 'size')}
            identity.update(namespace='source-resources', key=row['id'])
            if archive is not None:
                namespace, key = self._resource_locator(user, row['id'])
                if (namespace, key) != (identity['namespace'], identity['key']):
                    raise Conflict('Stored resource changed while preparing export; retry')
                write_export_object(self.objects, identity, archive, output, 'resources/' + row['id'],
                                    'Stored resource changed while preparing export; retry')
            fingerprint.identity('resource', identity)
            manifest.append({'id': row['id'], 'sha256': row['sha256'], 'metadata': json.loads(row['metadata'])})
        fingerprint.json_member('resources.json', manifest, archive)

    def _capture_export_metadata(self, user, group, ids, fingerprint):
        super()._capture_export_metadata(user, group, ids, fingerprint)
        self._export_resources(user, group, fingerprint)
        fingerprint.member('places.json', self._scan_export_places(user, group, ids))

    def _write_export_archive(self, user, group, ids, fingerprint, archive, output):
        super()._write_export_archive(user, group, ids, fingerprint, archive, output)
        self._export_resources(user, group, fingerprint, archive, output)
        self._write_export_places(user, group, ids, archive, output, fingerprint)

    def _write_export_places(self, user, group, ids, archive, output, fingerprint):
        started = time.perf_counter()
        try:
            # Build stabilizes only the location scan. Final validation owns its
            # surrounding metadata transaction and calls the scan directly.
            with self.transaction():
                fingerprint.member('places.json', self._scan_export_places(user, group, ids, started), archive,
                                   lambda size: self._check_export_size(output.tell() + size))
        except sqlite3.OperationalError as exc:
            if (getattr(exc, 'sqlite_errorcode', 0) & 255) in (sqlite3.SQLITE_BUSY, sqlite3.SQLITE_LOCKED):
                raise ArchiveBusy('Archive is busy; retry shortly') from None
            raise
        if time.perf_counter() - started > PLACES_EXPORT_SCAN_SECONDS:
            raise CapacityExceeded('Export exceeded the local location scan time budget')

    def _scan_export_places(self, user, group, ids, started=None):
        """Yield the exact location JSON under the caller's metadata transaction."""
        started = time.perf_counter() if started is None else started

        def check_time():
            if time.perf_counter() - started > PLACES_EXPORT_SCAN_SECONDS:
                raise CapacityExceeded('Export exceeded the local location scan time budget')

        clause, params = self._places_query(user, group)
        clause += ' AND o.asset_id IN (' + ','.join('?' for _ in ids) + ')'
        params += tuple(ids)
        day_key = "COALESCE(p.day,'')"
        fields = (('p.origin', 'origin', 36, 144), ('p.country', 'country', 2, 8),
                  ('p.city', 'city', 200, 800), ('p.latitude', 'latitude', None, 32),
                  ('p.longitude', 'longitude', None, 32), ('p.day', 'day', 10, 40),
                  ('o.asset_id', 'asset_id', 36, 144))
        projected, guards = [], []
        for field, name, characters, byte_limit in fields:
            byte_length = (f'octet_length(CAST({field} AS TEXT))' if getattr(self.db, 'hosted', False)
                           else f'length(CAST({field} AS BLOB))')
            guard = f'{byte_length}<={byte_limit}'
            if characters is not None:
                guard += f' AND length({field})<={characters}'
            projected.append(f'CASE WHEN {guard} THEN {field} ELSE NULL END AS {name}')
            guards.append(f'COALESCE(NOT ({guard}),FALSE)')
        columns = ','.join([*projected, '(' + ' OR '.join(guards) + ') AS oversized'])
        cursor = None
        first = True
        yield b'['
        while ids:
            check_time()
            self._member(user, group)
            seek = '' if cursor is None else f' AND ({day_key}>? OR ({day_key}=? AND p.origin>?))'
            values = params if cursor is None else (*params, cursor[0], cursor[0], cursor[1])
            page = self.db.execute('SELECT ' + columns + clause + seek +
                                   f' ORDER BY {day_key},p.origin LIMIT 128', values).fetchall()
            check_time()
            for row in page:
                check_time()
                encoded = self._serialize_export_place(row)
                check_time()
                if not first:
                    yield b','
                yield encoded
                first = False
            if len(page) < 128:
                break
            cursor = (page[-1]['day'] or '', page[-1]['origin'])
            del page
        self._member(user, group)
        check_time()
        yield b']'
        check_time()

    def _serialize_export_place(self, row):
        if row['oversized']:
            raise CapacityExceeded('Export location record exceeds its metadata limit')
        point = {key: row[key] for key in ('origin', 'country', 'city', 'latitude', 'longitude', 'day', 'asset_id')}
        for name in ('origin', 'asset_id'):
            if not isinstance(point[name], str) or not 1 <= len(point[name]) <= 36:
                raise ValueError('Invalid stored location identifier')
        if text(point['country'], 2) != point['country'] or not point['country'].isascii() or not point['country'].isalpha() or len(point['country']) != 2:
            raise ValueError('Invalid stored location country')
        if text(point['city']) != point['city']:
            raise ValueError('Invalid stored location city')
        for name, limit in (('latitude', 90), ('longitude', 180)):
            value = point[name]
            if type(value) not in (int, float) or not math.isfinite(value) or not -limit <= value <= limit:
                raise ValueError('Invalid stored coordinates')
        if point['day'] is not None:
            calendar_day(point['day'])
        encoded = json.dumps(point, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode('utf-8')
        if len(encoded) > PLACES_EXPORT_ROW_BYTES:
            raise CapacityExceeded('Export location record exceeds its 2 KiB serialized limit')
        return encoded
