"""Explicit read-only SQLite archive transfer to an empty hosted destination.

Stop the source API and worker first. This command never runs during startup.
A durable exact-source receipt permits retry after database rollback. Unrelated
rows or objects always block migration; this command never deletes remote bytes.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import sqlite3
from contextlib import closing
from pathlib import Path
from mazi.archive.ops import _files
from mazi.archive.hosted_ops import capture_tables, encode_value, insert_tables, _canonical
from mazi.persistence import PostgresConnection
from mazi.storage import AREAS, CHUNK_SIZE, open_objects

ORDERED = {'archive_assets', 'archive_origins', 'continuous_sources', 'source_resources', 'source_outcomes'}


def read_source(source, destination_tables):
    source = Path(source)
    path = source / 'mazi.sqlite3'
    if not path.is_file() or path.is_symlink():
        raise ValueError('Explicit source must contain a regular SQLite archive')
    with closing(sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)) as db:
        db.execute('BEGIN')
        if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or db.execute('PRAGMA foreign_key_check').fetchone():
            raise ValueError('Source archive integrity failed')
        names = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")}
        if names != set(destination_tables) - {'stored_objects', 'object_receipts', 'object_deletions'}:
            raise ValueError('Source archive schema differs from hosted domain inventory')
        tables = {}
        for name, target in destination_tables.items():
            if name not in names:
                tables[name] = {'columns': target['columns'], 'rows': []}
                continue
            quoted = '"' + name.replace('"', '""') + '"'
            cursor = db.execute('SELECT ' + ('rowid AS _mazi_order,' if name in ORDERED else '') + '* FROM ' + quoted)
            columns = [column[0] for column in cursor.description]
            if set(columns) != set(target['columns']):
                raise ValueError('Source columns differ from hosted schema')
            rows = [[encode_value(row[columns.index(column)]) for column in target['columns']] for row in cursor]
            tables[name] = {'columns': target['columns'], 'rows': rows}
        for table in tables.values():
            table['rows'].sort(key=lambda row: json.dumps(row, sort_keys=True, separators=(',', ':')).encode())
        return tables


def validate_source_payloads(tables, payloads):
    records = {name: [dict(zip(table['columns'], row)) for row in table['rows']] for name, table in tables.items()}
    retained = {(area, key): data for area, key, data in payloads}
    active = {row['asset_id'] for row in records['archive_origins'] if not row['withdrawn']}
    for asset in records['archive_assets']:
        if asset['id'] in active:
            data = retained.get(('archive-objects', asset['original_key']))
            if data is None or hashlib.sha256(data).hexdigest() != asset['sha256']:
                raise ValueError('Active source original missing or corrupt')
            if ('archive-objects', asset['preview_key']) not in retained:
                raise ValueError('Active source preview missing')

    for media in records.get('media', []):
        if media['status'] != 'deleted':
            data = retained.get(('originals', media['id']))
            if data is None or hashlib.sha256(data).hexdigest() != media['sha256'] or ('previews', media['id']) not in retained:
                raise ValueError('Active source manual original or preview missing or corrupt')
    for table, area, completed in [('upload_sessions', 'uploads', 'completed_media_id'), ('import_runs', 'archives', 'withdrawn')]:
        for transfer in records.get(table, []):
            if not transfer[completed] and transfer['received'] > 0:
                data = retained.get((area, transfer['id']))
                size = transfer['expected_size'] if table == 'upload_sessions' else transfer['size']
                checksum = transfer['sha256'] if table == 'upload_sessions' else transfer['manifest']
                if data is None or len(data) < transfer['received'] or (transfer['received'] == size and hashlib.sha256(data).hexdigest() != checksum):
                    raise ValueError('Source transfer missing, truncated or corrupt')
    for resource in records['source_resources']:
        if not resource['withdrawn'] and resource['received'] > 0:
            data = retained.get(('source-resources', resource['id']))
            if data is None or len(data) < resource['received'] or (resource['received'] == resource['size'] and hashlib.sha256(data).hexdigest() != resource['sha256']):
                raise ValueError('Source resource missing or corrupt')


def migrate_archive(source, db, objects):
    source = Path(source)
    if source.is_symlink() or any((source / area).is_symlink() for area in AREAS):
        raise ValueError('Archive source symlinks are forbidden')
    files = _files(source)
    payloads = []
    for path in files:
        relative = path.relative_to(source)
        if len(relative.parts) != 2 or relative.parts[0] not in AREAS:
            raise ValueError('Unsupported source object path')
        payloads.append((relative.parts[0], relative.parts[1], path.read_bytes()))
    with db:
        current = capture_tables(db)
        tables = read_source(source, current)
        validate_source_payloads(tables, payloads)
        fingerprint = hashlib.sha256(_canonical({'tables': tables, 'objects': [[area, key, hashlib.sha256(data).hexdigest()] for area, key, data in payloads]})).hexdigest()
        marker_key = 'migration-receipts/' + fingerprint + '.json'
        marker = _canonical({'format': 1, 'source': fingerprint})
        remote_keys = objects.remote.list()
        nonempty = any(table['rows'] for table in current.values())
        if nonempty:
            domain = {name: table for name, table in current.items() if name not in {'stored_objects', 'object_receipts', 'object_deletions'}}
            expected = {name: table for name, table in tables.items() if name in domain}
            if marker_key not in remote_keys or objects.remote.get(marker_key) != marker or domain != expected:
                raise ValueError('Hosted destination contains unrelated archive rows')
            for area in AREAS:
                if set(objects.list(area)) != {key for item_area, key, _ in payloads if item_area == area}:
                    raise ValueError('Completed migration object inventory differs')
            allowed = {hashlib.sha256(data[start:start + CHUNK_SIZE]).hexdigest() for _, _, data in payloads for start in range(0, len(data), CHUNK_SIZE)}
            for key in remote_keys:
                if key != marker_key and (key.split('/', 1)[0] not in AREAS or hashlib.sha256(objects.remote.get(key)).hexdigest() not in allowed):
                    raise ValueError('Completed migration contains unrelated objects')
            for area, key, data in payloads:
                if objects.read(area, key) != data:
                    raise ValueError('Completed migration bytes differ')
            return {'migrated': True, 'already_complete': True, 'tables': len(tables) - 3, 'files': len(payloads)}
        if remote_keys:
            if marker_key not in remote_keys or objects.remote.get(marker_key) != marker:
                raise ValueError('Hosted destination lacks an exact-source migration receipt')
            allowed = {hashlib.sha256(data[start:start + CHUNK_SIZE]).hexdigest() for _, _, data in payloads for start in range(0, len(data), CHUNK_SIZE)}
            for key in remote_keys:
                if key != marker_key and (key.split('/', 1)[0] not in AREAS or hashlib.sha256(objects.remote.get(key)).hexdigest() not in allowed):
                    raise ValueError('Hosted destination contains unrelated objects')
        objects.remote.put(marker_key, marker)
        insert_tables(db, tables)
        for area, key, data in payloads:
            objects.retain(area, key, data)
            if objects.read(area, key) != data:
                raise ValueError('Migrated object bytes differ')
        for area in AREAS:
            if set(objects.list(area)) != {key for item_area, key, _ in payloads if item_area == area}:
                raise ValueError('Migrated object inventory differs')
    return {'migrated': True, 'tables': len(tables) - 3, 'files': len(payloads)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, help='Stopped local synthetic archive directory; never inferred')
    args = parser.parse_args()
    if os.environ.get('MAZI_BACKEND') != 'supabase':
        parser.error('Hosted migration requires MAZI_BACKEND=supabase')
    db = PostgresConnection(os.environ['MAZI_DATABASE_URL'], os.environ.get('MAZI_DATABASE_SCHEMA', 'mazi'))
    try:
        print(json.dumps(migrate_archive(args.source, db, open_objects(Path('.'), db))))
    finally:
        db.close()


if __name__ == '__main__':
    main()
