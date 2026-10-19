"""Shared serialization for complete export metadata and admission comparison."""
import hashlib
import json
import os
import sys
from contextlib import contextmanager, nullcontext

from mazi.identity.core import Conflict

EXPORT_COPY_BYTES = 256 * 1024


@contextmanager
def export_cleanup(context):
    """Run every cleanup without replacing an earlier export/transfer failure."""
    value = context.__enter__()
    try:
        yield value
    except BaseException:
        error = sys.exc_info()
        try:
            context.__exit__(*error)
        except BaseException:
            pass
        raise
    else:
        context.__exit__(None, None, None)


class ExportWriter:
    """Guard the file's high-water mark, including seek-back ZIP header rewrites."""
    def __init__(self, output, check_size):
        self.output = output
        self.check_size = check_size
        self.position = output.tell()
        self.high_water = self.position
        self.failure = None

    def tell(self):
        return self.position

    def seek(self, offset, whence=0):
        self.position = self.output.seek(offset, whence)
        return self.position

    def flush(self):
        return self.output.flush()

    def write(self, data):
        if self.failure is not None:
            raise self.failure
        try:
            end = max(self.high_water, self.position + len(data))
            self.check_size(end)
            written = self.output.write(data)
            if written != len(data):
                raise OSError('Incomplete archive write')
            self.position += written
            self.high_water = end
            return written
        except BaseException as exc:
            self.failure = exc
            raise


def write_export_object(objects, identity, archive, name, conflict):
    checksum, size = hashlib.sha256(), 0
    with export_cleanup(objects.materialize(identity["namespace"], identity["key"])) as path:
        with export_cleanup(path.open("rb")) as source, export_cleanup(archive.open(name, "w")) as member:
            expected = os.fstat(source.fileno()).st_size
            while chunk := source.read(EXPORT_COPY_BYTES):
                if member.write(chunk) != len(chunk):
                    raise OSError("Incomplete archive write")
                checksum.update(chunk)
                size += len(chunk)
    if size != expected or checksum.hexdigest() != identity["sha256"]:
        raise Conflict(conflict)


class ExportFingerprint:
    """Hash framed records while optionally writing their exact public JSON bytes.

    Only public metadata consumes the existing artifact byte allowance. Internal
    identity records do not add a new per-origin limit or change the ZIP schema.
    """
    def __init__(self, check_size):
        self._hash = hashlib.sha256()
        self._check_size = check_size
        self._public_bytes = 0

    def _start(self, name):
        encoded = name.encode('utf-8')
        self._hash.update(len(encoded).to_bytes(8, 'big'))
        self._hash.update(encoded)

    def _chunk(self, chunk):
        self._hash.update(len(chunk).to_bytes(8, 'big'))
        self._hash.update(chunk)

    def identity(self, name, value):
        self._start('identity:' + name)
        for chunk in json.JSONEncoder(ensure_ascii=False).iterencode(value):
            self._chunk(chunk.encode('utf-8'))
        self._chunk(b'')

    def json_member(self, name, value, archive=None, **options):
        chunks = (chunk.encode('utf-8') for chunk in json.JSONEncoder(**options).iterencode(value))
        self.member(name, chunks, archive)

    def member(self, name, chunks, archive=None, check_write=None):
        self._start('member:' + name)
        with export_cleanup(archive.open(name, 'w') if archive is not None else nullcontext()) as member:
            pending = bytearray(EXPORT_COPY_BYTES) if member is not None else None
            pending_size = 0
            for chunk in chunks:
                self._public_bytes += len(chunk)
                self._check_size(self._public_bytes)
                if check_write is not None:
                    check_write(pending_size + len(chunk))
                self._chunk(chunk)
                if member is not None:
                    if pending_size + len(chunk) > EXPORT_COPY_BYTES:
                        if pending_size:
                            member.write(memoryview(pending)[:pending_size])
                            pending_size = 0
                        if len(chunk) > EXPORT_COPY_BYTES:
                            for start in range(0, len(chunk), EXPORT_COPY_BYTES):
                                member.write(memoryview(chunk)[start:start + EXPORT_COPY_BYTES])
                            continue
                    pending[pending_size:pending_size + len(chunk)] = chunk
                    pending_size += len(chunk)
            if pending_size:
                member.write(memoryview(pending)[:pending_size])
        self._chunk(b'')

    def digest(self):
        return self._hash.digest()
