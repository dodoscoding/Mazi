"""Private archive bytes; remote chunks and receipts commit before availability."""
from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
import uuid
from contextlib import contextmanager
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

AREAS = ('originals', 'previews', 'uploads', 'archives', 'archive-objects', 'source-resources')
CHUNK_SIZE = 4 * 1024 * 1024
STORAGE_SCHEMA = """
CREATE TABLE IF NOT EXISTS stored_objects (
 area TEXT NOT NULL, key TEXT NOT NULL, generation TEXT NOT NULL,
 deleted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(area,key)
);
CREATE TABLE IF NOT EXISTS object_receipts (
 area TEXT NOT NULL, key TEXT NOT NULL, generation TEXT NOT NULL,
 start_offset INTEGER NOT NULL, size INTEGER NOT NULL, digest TEXT NOT NULL,
 object_key TEXT NOT NULL UNIQUE, PRIMARY KEY(area,key,generation,start_offset)
);
CREATE TABLE IF NOT EXISTS object_deletions (object_key TEXT PRIMARY KEY);
"""


class StorageConflict(ValueError):
    pass


def validate(area, key):
    if area not in AREAS or not isinstance(key, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,255}', key) or '..' in key:
        raise ValueError('Invalid archive object key')


def digest(data):
    return hashlib.sha256(data).hexdigest()


class LocalObjects:
    def __init__(self, root):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(self.root, 0o700)
        for area in AREAS:
            directory = self.root / area
            if directory.is_symlink():
                raise ValueError('Archive symlink forbidden')
            directory.mkdir(exist_ok=True, mode=0o700)
            os.chmod(directory, 0o700)

    def _path(self, area, key):
        validate(area, key)
        path = self.root / area / key
        if path.is_symlink() or path.parent.is_symlink():
            raise ValueError('Archive symlink forbidden')
        return path

    def read(self, area, key):
        return self._path(area, key).read_bytes()

    def retain(self, area, key, data):
        path = self._path(area, key)
        if path.exists():
            if path.read_bytes() != data:
                raise StorageConflict('Immutable object differs')
            return
        descriptor, temporary = tempfile.mkstemp(prefix='.retain-', dir=path.parent)
        try:
            with os.fdopen(descriptor, 'wb') as stream:
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
            try:
                os.link(temporary, path)
            except FileExistsError:
                if path.read_bytes() != data:
                    raise StorageConflict('Immutable object differs') from None
            directory = os.open(path.parent, os.O_RDONLY)
            try:
                os.fsync(directory)
            finally:
                os.close(directory)
        finally:
            Path(temporary).unlink(missing_ok=True)

    def append(self, area, key, offset, data):
        path = self._path(area, key)
        size = path.stat().st_size if path.exists() else 0
        if offset < 0 or offset > size:
            raise StorageConflict('Upload offset differs')
        if offset < size:
            with path.open('rb') as stream:
                stream.seek(offset)
                if stream.read(len(data)) != data:
                    raise StorageConflict('Repeated range differs')
            return size
        with path.open('ab') as stream:
            os.chmod(path, 0o600)
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        return size + len(data)

    def remove(self, area, key):
        self._path(area, key).unlink(missing_ok=True)

    reset = remove

    @contextmanager
    def materialize(self, area, key):
        yield self._path(area, key)

    def list(self, area):
        if area not in AREAS:
            raise ValueError('Invalid archive area')
        return [p.name for p in (self.root / area).iterdir() if p.is_file()]

    def retry_deletions(self):
        return 0


class StorageHTTP:
    def __init__(self, url, secret, bucket):
        parsed = urlparse(url)
        if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.query or parsed.fragment or parsed.path not in ('', '/'):
            raise ValueError('Storage requires an HTTPS project origin')
        if not secret or not re.fullmatch(r'[A-Za-z0-9_-]+', bucket):
            raise ValueError('Incomplete private Storage configuration')
        self.url = url.rstrip('/') + '/storage/v1'
        self.secret = secret
        self.bucket = bucket

    def _request(self, method, path, data=None, mime='application/json'):
        headers = {'apikey': self.secret, 'Content-Type': mime}
        if not self.secret.startswith('sb_secret_'):
            headers['Authorization'] = 'Bearer ' + self.secret
        request = Request(self.url + path, data=data, headers=headers, method=method)
        try:
            with urlopen(request, timeout=60) as response:
                return response.read()
        except HTTPError as error:
            # Only inspect status and error code; server payloads may contain object names.
            payload = error.read()
            try:
                code = str(json.loads(payload).get('error', ''))
            except (ValueError, AttributeError):
                code = ''
            if error.code == 404 or code in ('not_found', 'NoSuchKey'):
                raise FileNotFoundError('Private object absent') from None
            if error.code == 409 or code in ('Duplicate', 'duplicate'):
                raise StorageConflict('Remote object already exists') from None
            raise OSError('Private Storage request failed (HTTP %s)' % error.code) from None
        except URLError:
            raise OSError('Private Storage connection failed') from None

    @staticmethod
    def _validate_remote_key(key):
        if not isinstance(key, str) or any(not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]*', part) or '..' in part for part in key.split('/')):
            raise ValueError('Invalid private object key')

    def _object(self, key):
        self._validate_remote_key(key)
        return '/object/' + quote(self.bucket, safe='') + '/' + quote(key, safe='/')

    def put(self, key, data):
        self._request('POST', self._object(key), data, 'application/octet-stream')

    def get(self, key):
        return self._request('GET', self._object(key))

    def delete(self, key):
        self._validate_remote_key(key)
        self._request('DELETE', '/object/' + self.bucket, json.dumps({'prefixes': [key]}).encode())

    def list(self):
        result = []
        pending = ['']
        while pending:
            prefix = pending.pop()
            offset = 0
            while True:
                rows = json.loads(self._request('POST', '/object/list/' + self.bucket,
                    json.dumps({'prefix': prefix, 'limit': 100, 'offset': offset, 'sortBy': {'column': 'name', 'order': 'asc'}}).encode()))
                for row in rows:
                    key = prefix + row['name']
                    if row.get('id') is None:
                        pending.append(key + '/')
                    else:
                        result.append(key)
                if len(rows) < 100:
                    break
                offset += len(rows)
        return result


class HostedObjects:
    """Mutations run inside the domain transaction, including receipt writes.

    The connection serializes writers. Retry deletions only after committing
    tombstones, so a rolled back deletion never destroys live bytes.
    """
    def __init__(self, db, url, secret, bucket='mazi-private', transport=None):
        self.db = db
        self.remote = transport or StorageHTTP(url, secret, bucket)

    def _state(self, area, key, create=False):
        validate(area, key)
        row = self.db.execute('SELECT * FROM stored_objects WHERE area=? AND key=?', (area, key)).fetchone()
        if row is None and create:
            self.db.execute('INSERT INTO stored_objects(area,key,generation) VALUES(?,?,?)', (area, key, uuid.uuid4().hex))
            row = self.db.execute('SELECT * FROM stored_objects WHERE area=? AND key=?', (area, key)).fetchone()
        if row is None or row['deleted']:
            raise FileNotFoundError('Archive object absent')
        return row

    def _receipts(self, area, key, generation):
        return self.db.execute('SELECT * FROM object_receipts WHERE area=? AND key=? AND generation=? ORDER BY start_offset', (area, key, generation)).fetchall()

    def _verified(self, receipt):
        data = self.remote.get(receipt['object_key'])
        if len(data) != receipt['size'] or digest(data) != receipt['digest']:
            raise OSError('Remote chunk checksum differs')
        return data

    def read(self, area, key):
        with self.materialize(area, key) as path:
            return path.read_bytes()

    def append(self, area, key, offset, data):
        if not isinstance(offset, int) or offset < 0 or not isinstance(data, bytes):
            raise ValueError('Invalid upload range')
        state = self._state(area, key, True)
        receipts = self._receipts(area, key, state['generation'])
        size = sum(row['size'] for row in receipts)
        if offset > size:
            raise StorageConflict('Upload offset differs')
        if offset < size:
            if offset + len(data) > size:
                raise StorageConflict('Repeated range exceeds accepted bytes')
            existing = bytearray()
            for row in receipts:
                start, end = row['start_offset'], row['start_offset'] + row['size']
                if start < offset + len(data) and end > offset:
                    existing.extend(self._verified(row)[max(0, offset-start):min(row['size'], offset+len(data)-start)])
            if bytes(existing) != data:
                raise StorageConflict('Repeated range differs')
            return size
        for start in range(0, len(data), CHUNK_SIZE):
            chunk = data[start:start+CHUNK_SIZE]
            checksum = digest(chunk)
            object_key = f"{area}/{key}/{state['generation']}/{offset+start}-{checksum}"
            conflict = False
            try:
                self.remote.put(object_key, chunk)
            except StorageConflict:
                conflict = True
            if self.remote.get(object_key) != chunk:
                if conflict:
                    raise StorageConflict('Immutable remote object differs')
                raise OSError('Remote upload verification failed')
            self.db.execute('INSERT INTO object_receipts(area,key,generation,start_offset,size,digest,object_key) VALUES(?,?,?,?,?,?,?)',
                (area, key, state['generation'], offset+start, len(chunk), checksum, object_key))
        return size + len(data)

    def retain(self, area, key, data):
        try:
            state = self._state(area, key)
        except FileNotFoundError:
            self.append(area, key, 0, data)
            return
        if self._receipts(area, key, state['generation']):
            if self.read(area, key) != data:
                raise StorageConflict('Immutable object differs')
        else:
            self.append(area, key, 0, data)

    def _queue(self, area, key):
        self.db.execute('INSERT INTO object_deletions(object_key) SELECT object_key FROM object_receipts WHERE area=? AND key=? ON CONFLICT DO NOTHING', (area, key))

    def remove(self, area, key):
        validate(area, key)
        self._queue(area, key)
        self.db.execute('UPDATE stored_objects SET deleted=1 WHERE area=? AND key=?', (area, key))

    def reset(self, area, key):
        validate(area, key)
        self._queue(area, key)
        self.db.execute('INSERT INTO stored_objects(area,key,generation,deleted) VALUES(?,?,?,0) ON CONFLICT(area,key) DO UPDATE SET generation=excluded.generation,deleted=0',
            (area, key, uuid.uuid4().hex))

    @contextmanager
    def materialize(self, area, key):
        state = self._state(area, key)
        with tempfile.TemporaryDirectory(prefix='mazi-private-') as directory:
            path = Path(directory) / 'object'
            with path.open('xb') as stream:
                os.chmod(path, 0o600)
                expected = 0
                for row in self._receipts(area, key, state['generation']):
                    if row['start_offset'] != expected:
                        raise OSError('Remote chunk receipt gap')
                    stream.write(self._verified(row))
                    expected += row['size']
            yield path

    def list(self, area):
        if area not in AREAS:
            raise ValueError('Invalid archive area')
        return [row['key'] for row in self.db.execute('SELECT key FROM stored_objects WHERE area=? AND deleted=0', (area,))]

    def retry_deletions(self):
        count = 0
        for row in self.db.execute('SELECT object_key FROM object_deletions').fetchall():
            try:
                with self.db:
                    pending = self.db.execute('SELECT object_key FROM object_deletions WHERE object_key=?', (row['object_key'],)).fetchone()
                    if pending is None:
                        continue
                    self.remote.delete(row['object_key'])
                    self.db.execute('DELETE FROM object_deletions WHERE object_key=?', (row['object_key'],))
                    self.db.execute('DELETE FROM object_receipts WHERE object_key=?', (row['object_key'],))
                count += 1
            except OSError:
                continue
        return count

    def unreferenced(self):
        referenced = {row['object_key'] for row in self.db.execute('SELECT object_key FROM object_receipts')}
        return [key for key in self.remote.list() if key not in referenced]


def open_objects(root, db):
    backend = os.environ.get('MAZI_BACKEND', 'local')
    if backend == 'local':
        return LocalObjects(root)
    if backend != 'supabase':
        raise ValueError('Unsupported archive backend')
    url = os.environ.get('MAZI_SUPABASE_URL', '')
    secret = os.environ.get('MAZI_SUPABASE_STORAGE_KEY') or os.environ.get('MAZI_SUPABASE_SECRET_KEY', '')
    bucket = os.environ.get('MAZI_STORAGE_BUCKET', 'mazi-private')
    return HostedObjects(db, url, secret, bucket)
