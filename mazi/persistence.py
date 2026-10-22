"""The archive connection boundary; hosted SQL is native PostgreSQL."""
from contextlib import contextmanager
import os
import hashlib
import re
import sqlite3
from pathlib import Path
from urllib.parse import urlparse

class ArchiveBusy(TimeoutError):
    """A bounded archive lock wait expired; the operation can be retried."""


class ArchiveUnavailable(RuntimeError):
    """The hosted database cannot serve this operation; retry explicitly."""


class ArchiveSchemaMismatch(RuntimeError):
    """The configured database schema is incompatible with this application."""


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
    def __init__(self, url, schema='mazi', *, lock_timeout='5s'):
        if not re.fullmatch(r'[a-z][a-z0-9_]*', schema):
            raise ValueError('Invalid application database schema')
        if not re.fullmatch(r'[0-9]+(?:ms|s)', lock_timeout):
            raise ValueError('Invalid database lock timeout')
        self._url = url
        self._schema = schema
        self._lock_timeout = lock_timeout
        self._db = None
        self._active = False
        self._checked = False
        self._lock_key = archive_lock_key(schema)

    def _start(self):
        import psycopg
        try:
            if self._db is None:
                self._db = psycopg.connect(self._url, autocommit=True,
                                          connect_timeout=15, prepare_threshold=None)
            # One simple-query exchange; all settings belong to this transaction.
            self._db.execute(
                f'BEGIN; SET LOCAL search_path TO "{self._schema}", pg_catalog; '
                f"SET LOCAL lock_timeout TO '{self._lock_timeout}'; SET LOCAL extra_float_digits TO 3")
            self._active = True
            if not self._checked:
                try:
                    version = self._db.execute('SELECT version FROM runtime_schema WHERE singleton=1').fetchone()
                except psycopg.errors.UndefinedTable:
                    raise ArchiveSchemaMismatch('Hosted archive schema is not initialized') from None
                if not version or version[0] != SCHEMA_VERSION:
                    raise ArchiveSchemaMismatch('Hosted archive schema version does not match this application')
                self._checked = True
        except (psycopg.OperationalError, psycopg.InterfaceError):
            self._discard()
            raise ArchiveUnavailable('Hosted database unavailable; retry shortly') from None
        except BaseException:
            self._discard()
            raise

    def _begin(self, *, shared=False):
        if not self._active:
            self._start()
            try:
                lock = 'pg_advisory_xact_lock_shared' if shared else 'pg_advisory_xact_lock'
                self._db.execute(f'SELECT {lock}(%s)', (self._lock_key,))
            except BaseException as error:
                try:
                    self.rollback()
                except Exception:
                    self._discard()
                from psycopg.errors import LockNotAvailable
                if isinstance(error, LockNotAvailable):
                    raise ArchiveBusy("Archive is busy; retry shortly") from None
                import psycopg
                if isinstance(error, (psycopg.OperationalError, psycopg.InterfaceError)):
                    self._discard()
                    raise ArchiveUnavailable('Hosted database unavailable; retry shortly') from None
                raise

    @contextmanager
    def read_transaction(self):
        """Share a policy snapshot with readers while fencing exclusive writers."""
        self._begin(shared=True)
        try:
            yield self
        except BaseException:
            try:
                self.rollback()
            except Exception:
                self._discard()
            raise
        else:
            self.commit()

    def execute(self, query, params=()):
        import psycopg
        if query.strip().upper() == 'BEGIN IMMEDIATE':
            self._begin()
            return Cursor(self._db.cursor())
        standalone = not self._active
        try:
            if standalone:
                self._start()
            result = Cursor(self._db.execute(bind_sql(query), params))
            if standalone:
                self.commit()
            return result
        except psycopg.errors.LockNotAvailable:
            if standalone:
                self.rollback()
            raise ArchiveBusy("Archive is busy; retry shortly") from None
        except (psycopg.OperationalError, psycopg.InterfaceError):
            self._discard()
            raise ArchiveUnavailable('Hosted database unavailable; retry shortly') from None
        except BaseException as error:
            if standalone:
                try:
                    self.rollback()
                except Exception:
                    self._discard()
            if isinstance(error, psycopg.IntegrityError):
                raise sqlite3.IntegrityError(str(error)) from error
            raise

    def _finish(self, command):
        import psycopg
        if self._active:
            try:
                self._db.execute(command)
            except (psycopg.OperationalError, psycopg.InterfaceError):
                self._discard()
                raise ArchiveUnavailable('Hosted database unavailable; retry shortly') from None
            except BaseException:
                self._discard()
                raise
            finally:
                self._active = False

    def commit(self): self._finish('COMMIT')
    def rollback(self): self._finish('ROLLBACK')

    def disconnect(self):
        db, self._db = self._db, None
        self._active = False
        self._checked = False
        if db is not None:
            db.close()

    def _discard(self):
        try:
            self.disconnect()
        except Exception:
            pass  # Preserve the operation failure if native cleanup also fails.

    def close(self): self.disconnect()
    def __enter__(self):
        self._begin()
        return self
    def __exit__(self, kind, error, trace):
        if not kind:
            self.commit()
            return
        try:
            self.rollback()
        except Exception:
            self._discard()


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
    return PostgresConnection(url, schema)

def initialize_schema(db, schema):
    if not getattr(db, 'hosted', False): db.executescript(schema)


def insertion_order(db, alias=''):
    return (alias + '.' if alias else '') + ('_mazi_order' if getattr(db, 'hosted', False) else 'rowid')
