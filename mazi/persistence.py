"""The archive connection boundary; hosted SQL is native PostgreSQL."""
import os
import hashlib
import re
import sqlite3
from pathlib import Path
from urllib.parse import urlparse

class ArchiveBusy(TimeoutError):
    """A bounded archive lock wait expired; the operation can be retried."""


SCHEMA_VERSION = 1
def archive_lock_key(schema):
    return int.from_bytes(hashlib.sha256(("mazi-archive:" + schema).encode()).digest()[:8], "big", signed=True)


def bind_sql(sql):
    """Convert bound qmarks, respecting SQL quotes and comments."""
    result = []
    index = 0
    state = None
    dollar = None
    while index < len(sql):
        char = sql[index]
        pair = sql[index:index + 2]
        if state == 'line':
            if char == '\n': state = None
        elif state == 'block':
            if pair == '*/':
                result.append('*/'); index += 2; state = None; continue
        elif dollar:
            if sql.startswith(dollar, index):
                result.append(dollar); index += len(dollar); dollar = None; continue
        elif state in ("'", '"'):
            if char == state:
                if index + 1 < len(sql) and sql[index + 1] == state:
                    result.append(char * 2); index += 2; continue
                state = None
        elif pair in ('--', '/*'):
            state = 'line' if pair == '--' else 'block'
            result.append(pair); index += 2; continue
        elif char in ("'", '"'):
            state = char
        elif char == '$':
            match = re.match(r'\$[A-Za-z_][A-Za-z_0-9]*\$|\$\$', sql[index:])
            if match:
                dollar = match.group(); result.append(dollar); index += len(dollar); continue
        elif char == '?':
            result.append('%s'); index += 1; continue
        result.append('%%' if char == '%' else char)
        index += 1
    return ''.join(result)


class Row:
    def __init__(self, names, values):
        pairs = [(name, bytes(value) if isinstance(value, memoryview) else value)
                 for name, value in zip(names, values) if name != '_mazi_order']
        self._names = tuple(name for name, _ in pairs)
        self._values = tuple(value for _, value in pairs)

    def keys(self): return self._names
    def __iter__(self): return iter(self._values)
    def __len__(self): return len(self._values)
    def __getitem__(self, key):
        return self._values[self._names.index(key)] if isinstance(key, str) else self._values[key]


class Cursor:
    def __init__(self, cursor): self._cursor = cursor
    @property
    def rowcount(self): return self._cursor.rowcount
    def _row(self, values):
        return None if values is None else Row([c.name for c in self._cursor.description], values)
    def fetchone(self): return self._row(self._cursor.fetchone())
    def fetchall(self): return [self._row(row) for row in self._cursor.fetchall()]
    def __iter__(self):
        for row in self._cursor: yield self._row(row)


class PostgresConnection:
    hosted = True
    def __init__(self, url, schema='mazi'):
        import psycopg
        from psycopg import sql
        if not re.fullmatch(r'[a-z][a-z0-9_]*', schema):
            raise ValueError('Invalid application database schema')
        self._db = psycopg.connect(url, autocommit=True, connect_timeout=15)
        self._db.execute(sql.SQL('SET search_path TO {}, pg_catalog').format(sql.Identifier(schema)))
        self._db.execute("SET lock_timeout TO '5s'")
        self._db.execute("SET extra_float_digits TO 3")
        try:
            version = self._db.execute('SELECT version FROM runtime_schema WHERE singleton=1').fetchone()
            if not version or version[0] != SCHEMA_VERSION:
                raise RuntimeError('Hosted archive schema version does not match this application')
        except BaseException:
            self._db.close()
            raise
        self._active = False
        self._lock_key = archive_lock_key(schema)

    def _begin(self):
        if not self._active:
            self._db.execute('BEGIN')
            self._active = True
            try:
                self._db.execute('SELECT pg_advisory_xact_lock(%s)', (self._lock_key,))
            except BaseException as error:
                self.rollback()
                from psycopg.errors import LockNotAvailable
                if isinstance(error, LockNotAvailable):
                    raise ArchiveBusy("Archive is busy; retry shortly") from None
                raise

    def execute(self, query, params=()):
        import psycopg
        if query.strip().upper() == 'BEGIN IMMEDIATE':
            self._begin()
            return Cursor(self._db.cursor())
        try:
            return Cursor(self._db.execute(bind_sql(query), params))
        except psycopg.errors.LockNotAvailable:
            raise ArchiveBusy("Archive is busy; retry shortly") from None
        except psycopg.IntegrityError as error:
            raise sqlite3.IntegrityError(str(error)) from error

    def commit(self):
        if self._active:
            self._db.execute('COMMIT'); self._active = False

    def rollback(self):
        if self._active:
            self._db.execute('ROLLBACK'); self._active = False

    def close(self): self._db.close()
    def __enter__(self):
        try: self._begin()
        except BaseException:
            self.rollback(); raise
        return self
    def __exit__(self, kind, error, trace):
        self.rollback() if kind else self.commit()


def hosted_configuration(environ=None):
    """Validate the complete server configuration before database or HTTP I/O."""
    from psycopg.conninfo import conninfo_to_dict
    env = os.environ if environ is None else environ
    url = env.get('MAZI_DATABASE_URL', '')
    schema = env.get('MAZI_DATABASE_SCHEMA', 'mazi')
    origin = env.get('MAZI_SUPABASE_URL', '')
    secret = env.get('MAZI_SUPABASE_SECRET_KEY', '')
    bucket = env.get('MAZI_STORAGE_BUCKET', 'mazi-private')
    if not url:
        raise ValueError('Hosted archive requires MAZI_DATABASE_URL')
    try:
        connection = conninfo_to_dict(url)
    except Exception:
        raise ValueError('Invalid hosted database configuration') from None
    if not connection.get('host') or not connection.get('user') or not connection.get('password'):
        raise ValueError('Incomplete hosted database configuration')
    if connection.get('sslmode') != 'verify-full' or not connection.get('sslrootcert') or not Path(connection['sslrootcert']).is_file():
        raise ValueError('Hosted database requires verified TLS and a readable root certificate')
    if not re.fullmatch(r'[a-z][a-z0-9_]*', schema):
        raise ValueError('Invalid application database schema')
    parsed = urlparse(origin)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.query or parsed.fragment or parsed.path not in ('', '/'):
        raise ValueError('Storage requires an HTTPS project origin')
    if not re.fullmatch(r'[A-Za-z0-9_-]+', bucket):
        raise ValueError('Invalid private Storage bucket')
    if len(secret) < 32 or any(c.isspace() for c in secret) or '...' in secret or '…' in secret:
        raise ValueError('Hosted archive requires a complete server Storage secret')
    if not (secret.startswith('sb_secret_') or (secret.startswith('eyJ') and len(secret.split('.')) == 3)):
        raise ValueError('Hosted archive requires a server Storage secret')
    return url, schema


def open_database(root):
    backend = os.environ.get('MAZI_BACKEND', 'local')
    if backend == 'local':
        db = sqlite3.connect(root / 'mazi.sqlite3', check_same_thread=False)
        db.row_factory = sqlite3.Row
        return db
    if backend != 'supabase': raise ValueError('Unknown archive backend')
    url, schema = hosted_configuration()
    try:
        return PostgresConnection(url, schema)
    except Exception:
        raise RuntimeError('Hosted database unavailable or application schema incompatible') from None

def initialize_schema(db, schema):
    if not getattr(db, 'hosted', False): db.executescript(schema)


def insertion_order(db, alias=''):
    return (alias + '.' if alias else '') + ('_mazi_order' if getattr(db, 'hosted', False) else 'rowid')
