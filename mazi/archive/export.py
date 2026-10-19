"""Shared serialization for complete export metadata and admission comparison."""
import hashlib
import json
from contextlib import nullcontext


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
        with archive.open(name, 'w') if archive is not None else nullcontext() as member:
            for chunk in chunks:
                self._public_bytes += len(chunk)
                self._check_size(self._public_bytes)
                if check_write is not None:
                    check_write(len(chunk))
                self._chunk(chunk)
                if member is not None:
                    member.write(chunk)
        self._chunk(b'')

    def digest(self):
        return self._hash.digest()
