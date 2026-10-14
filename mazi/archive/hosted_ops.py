"""Explicit, locked database-plus-private-object exports and isolated restores."""
from __future__ import annotations
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
from mazi.persistence import PostgresConnection
from mazi.storage import open_objects


def encode_value(value):
    return {'binary': base64.b64encode(bytes(value)).decode()} if isinstance(value, (bytes, memoryview)) else value


def decode_value(value):
    return base64.b64decode(value['binary'], validate=True) if isinstance(value, dict) and set(value) == {'binary'} else value


def _digest(data):
    return hashlib.sha256(data).hexdigest()


def _canonical(snapshot):
    return json.dumps(snapshot, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()


def verify_snapshot(snapshot):
    if snapshot.get('format') != 1 or not isinstance(snapshot.get('tables'), dict) or not isinstance(snapshot.get('objects'), dict):
        raise ValueError('Invalid hosted snapshot')
    for key, item in snapshot['objects'].items():
        if not key or key.startswith('/') or '..' in key.split('/'):
            raise ValueError('Invalid object path')
        data = base64.b64decode(item['data'], validate=True)
        if _digest(data) != item['sha256']:
            raise ValueError('Snapshot object checksum mismatch')
    for table in snapshot['tables'].values():
        for row in table['rows']:
            if len(row) != len(table['columns']):
                raise ValueError('Invalid snapshot row')
            for value in row:
                decode_value(value)
    receipts = snapshot['tables'].get('object_receipts', {'columns': [], 'rows': []})
    for row in receipts['rows']:
        receipt = dict(zip(receipts['columns'], (decode_value(value) for value in row)))
        item = snapshot['objects'].get(receipt['object_key'])
        if item is None or item['sha256'] != receipt['digest'] or len(base64.b64decode(item['data'], validate=True)) != receipt['size']:
            raise ValueError('Snapshot transfer receipt has missing or corrupt payload')
    _verify_required_payloads(snapshot)
    return snapshot


def _verify_required_payloads(snapshot):
    records = {name: [dict(zip(table['columns'], (decode_value(value) for value in row))) for row in table['rows']] for name, table in snapshot['tables'].items()}
    receipts = records.get('object_receipts', [])
    states = {(row['area'], row['key']): row for row in records.get('stored_objects', []) if not row['deleted']}
    def read(area, key):
        state = states.get((area, key))
        if state is None:
            raise ValueError('Required archive payload missing')
        selected = sorted((row for row in receipts if row['area'] == area and row['key'] == key and row['generation'] == state['generation']), key=lambda row: row['start_offset'])
        data = bytearray()
        for row in selected:
            if row['start_offset'] != len(data):
                raise ValueError('Snapshot transfer receipt has a gap')
            data.extend(base64.b64decode(snapshot['objects'][row['object_key']]['data'], validate=True))
        return bytes(data)
    active = {row['asset_id'] for row in records.get('archive_origins', []) if not row['withdrawn']}
    for row in records.get('archive_assets', []):
        if row['id'] in active:
            if _digest(read('archive-objects', row['original_key'])) != row['sha256']:
                raise ValueError('Active snapshot original checksum mismatch')
            read('archive-objects', row['preview_key'])
    for row in records.get('media', []):
        if row['status'] != 'deleted':
            if _digest(read('originals', row['id'])) != row['sha256']:
                raise ValueError('Snapshot manual original checksum mismatch')
            read('previews', row['id'])
    for table, area, completed in [('upload_sessions', 'uploads', 'completed_media_id'), ('import_runs', 'archives', 'withdrawn')]:
        for row in records.get(table, []):
            if not row[completed] and row['received'] > 0:
                data = read(area, row['id'])
                size = row['expected_size'] if table == 'upload_sessions' else row['size']
                checksum = row['sha256'] if table == 'upload_sessions' else row['manifest']
                if len(data) < row['received'] or (row['received'] == size and _digest(data) != checksum):
                    raise ValueError('Snapshot transfer truncated or corrupt')
    for row in records.get('source_resources', []):
        if not row['withdrawn'] and row['received'] > 0:
            data = read('source-resources', row['id'])
            if len(data) < row['received'] or (row['received'] == row['size'] and _digest(data) != row['sha256']):
                raise ValueError('Snapshot source resource missing or corrupt')


def write_snapshot(snapshot, destination):
    verify_snapshot(snapshot)
    payload = _canonical(snapshot)
    with os.fdopen(os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'wb') as stream:
        stream.write(_canonical({'sha256': _digest(payload), 'snapshot': snapshot}))
        stream.flush()
        os.fsync(stream.fileno())


def load_snapshot(source):
    envelope = json.loads(Path(source).read_text())
    if _digest(_canonical(envelope['snapshot'])) != envelope['sha256']:
        raise ValueError('Snapshot checksum mismatch')
    return verify_snapshot(envelope['snapshot'])


def identifier(name):
    return '"' + name.replace('"', '""') + '"'


def table_names(db):
    return [row[0] for row in db._db.execute("SELECT tablename FROM pg_tables WHERE schemaname=current_schema() AND tablename <> 'runtime_schema' ORDER BY tablename")]


def capture_tables(db):
    result = {}
    for name in table_names(db):
        cursor = db._db.execute('SELECT * FROM ' + identifier(name))
        columns = [column.name for column in cursor.description]
        rows = [[encode_value(value) for value in row] for row in cursor.fetchall()]
        rows.sort(key=lambda row: _canonical(row))
        result[name] = {'columns': columns, 'rows': rows}
    return result


def insertion_tables(db, tables):
    dependencies = {name: set() for name in tables}
    for child, parent in db._db.execute("SELECT child.relname,parent.relname FROM pg_constraint c JOIN pg_class child ON c.conrelid=child.oid JOIN pg_class parent ON c.confrelid=parent.oid JOIN pg_namespace n ON child.relnamespace=n.oid WHERE c.contype='f' AND n.nspname=current_schema()"):
        if child in dependencies and parent in dependencies and child != parent:
            dependencies[child].add(parent)
    ordered = []
    while dependencies:
        ready = sorted(name for name, parents in dependencies.items() if not parents)
        if not ready:
            raise ValueError('Unsupported cyclic archive foreign keys')
        for name in ready:
            ordered.append(name)
            del dependencies[name]
        for parents in dependencies.values():
            parents.difference_update(ready)
    # Consent insert triggers create generation rows; restore their exact final values last.
    if 'discovery_generations' in ordered:
        ordered.remove('discovery_generations')
        ordered.append('discovery_generations')
    return ordered


def require_empty(db, remote):
    if any(db._db.execute('SELECT EXISTS(SELECT 1 FROM ' + identifier(name) + ')').fetchone()[0] for name in table_names(db)) or remote.list():
        raise ValueError('Hosted destination must be empty; no automatic merge or reset is permitted')


def insert_tables(db, tables):
    if set(tables) != set(table_names(db)):
        raise ValueError('Snapshot and destination table inventories differ')
    for name in insertion_tables(db, tables):
        table = tables[name]
        columns = table['columns']
        statement = 'INSERT INTO ' + identifier(name) + '(' + ','.join(map(identifier, columns)) + ') VALUES(' + ','.join(['%s'] * len(columns)) + ')'
        if name == 'discovery_generations':
            statement += ' ON CONFLICT(group_id) DO UPDATE SET revision=EXCLUDED.revision'
        for row in table['rows']:
            db._db.execute(statement, tuple(decode_value(value) for value in row))
    for name in tables:
        for column in (column for column in ('id', '_mazi_order') if column in tables[name]['columns']):
            sequence = db._db.execute('SELECT pg_get_serial_sequence(%s,%s)', (name, column)).fetchone()[0]
            if sequence:
                maximum = db._db.execute('SELECT max(' + identifier(column) + ') FROM ' + identifier(name)).fetchone()[0]
                db._db.execute('SELECT setval(%s,%s,%s)', (sequence, maximum or 1, maximum is not None))
    actual = capture_tables(db)
    if actual != tables:
        mismatches = ', '.join(name for name in tables if actual[name] != tables[name])
        raise ValueError('Restored rows differ from snapshot: ' + mismatches)


def create_backup(db, objects, destination):
    with db:
        snapshot = {'format': 1, 'tables': capture_tables(db), 'objects': {}}
        for key in sorted(objects.remote.list()):
            data = objects.remote.get(key)
            snapshot['objects'][key] = {'data': base64.b64encode(data).decode(), 'sha256': _digest(data)}
        write_snapshot(snapshot, destination)
    return {'tables': len(snapshot['tables']), 'objects': len(snapshot['objects']), 'verified': True}


def _target_identity(db, objects):
    return {'schema': db._db.execute('SELECT current_schema()').fetchone()[0],
            'bucket': objects.remote.bucket}


def restore_backup(db, objects, source, *, isolated=False):
    if not isolated:
        raise ValueError('Restore requires explicit isolated destination acknowledgement')
    snapshot = load_snapshot(source)
    with db:
        fingerprint = _digest(_canonical(snapshot))
        marker_key = 'restore-receipts/' + fingerprint + '.json'
        marker = _canonical({'format': 1, 'snapshot': fingerprint, 'destination': _target_identity(db, objects)})
        current = capture_tables(db)
        remote_keys = objects.remote.list()
        if remote_keys:
            if marker_key not in remote_keys or objects.remote.get(marker_key) != marker:
                raise ValueError('Hosted destination lacks an exact-snapshot restore receipt')
            for key in remote_keys:
                if key != marker_key:
                    item = snapshot['objects'].get(key)
                    if item is None or _digest(objects.remote.get(key)) != item['sha256']:
                        raise ValueError('Restore destination contains unrelated objects')
        nonempty = any(table['rows'] for table in current.values())
        if nonempty:
            if current != snapshot['tables'] or marker_key not in remote_keys:
                raise ValueError('Restore destination contains unrelated archive rows')
            if set(remote_keys) != set(snapshot['objects']) | {marker_key}:
                raise ValueError('Completed restore object inventory differs')
            return {'restored': True, 'already_complete': True, 'tables': len(snapshot['tables']), 'objects': len(snapshot['objects'])}
        if set(current) != set(snapshot['tables']):
            raise ValueError('Snapshot and destination table inventories differ')
        objects.remote.put(marker_key, marker)
        for key, item in snapshot['objects'].items():
            objects.remote.put(key, base64.b64decode(item['data'], validate=True))
        insert_tables(db, snapshot['tables'])
        for key, item in snapshot['objects'].items():
            if _digest(objects.remote.get(key)) != item['sha256']:
                raise ValueError('Restored object checksum mismatch')
    return {'restored': True, 'tables': len(snapshot['tables']), 'objects': len(snapshot['objects'])}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('backup', 'verify', 'restore'))
    parser.add_argument('snapshot')
    parser.add_argument('--isolated', action='store_true')
    args = parser.parse_args()
    if args.action == 'verify':
        snapshot = load_snapshot(args.snapshot)
        result = {'verified': True, 'tables': len(snapshot['tables']), 'objects': len(snapshot['objects'])}
    else:
        if os.environ.get('MAZI_BACKEND') != 'supabase':
            parser.error('Hosted backup and restore require MAZI_BACKEND=supabase')
        db = PostgresConnection(os.environ['MAZI_DATABASE_URL'], os.environ.get('MAZI_DATABASE_SCHEMA', 'mazi'))
        try:
            objects = open_objects(Path('.'), db)
            result = create_backup(db, objects, args.snapshot) if args.action == 'backup' else restore_backup(db, objects, args.snapshot, isolated=args.isolated)
        finally:
            db.close()
    print(json.dumps(result))


if __name__ == '__main__':
    main()
