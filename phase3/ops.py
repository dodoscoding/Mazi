"""Offline local backup and restore drill for the SQLite archive.

Stop the server and worker before calling these functions. This copies the
database plus retained objects; it is not hosted backup or retention policy.
"""
from __future__ import annotations

import hashlib
import argparse
import json
import os
import shutil
import sqlite3
from pathlib import Path


DIRECTORIES = ("originals", "previews", "uploads", "archives", "archive-objects")


def _hash(path):
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def _files(root):
    entries = sorted(path for directory in DIRECTORIES for path in (root / directory).rglob("*"))
    if any(path.is_symlink() for path in entries):
        raise ValueError("Symbolic links are not allowed in the archive")
    return [path for path in entries if path.is_file()]


def _inside(path, root):
    return path.resolve().is_relative_to(root.resolve())


def create_backup(source, destination):
    source, destination = Path(source), Path(destination)
    if not (source / "mazi.sqlite3").is_file() or destination.exists() or _inside(destination, source):
        raise ValueError("Choose an existing archive and a new, separate backup directory")
    destination.mkdir(mode=0o700, parents=True)
    try:
        with sqlite3.connect(source / "mazi.sqlite3") as original, sqlite3.connect(destination / "mazi.sqlite3") as snapshot:
            original.backup(snapshot)
        os.chmod(destination / "mazi.sqlite3", 0o600)
        for path in _files(source):
            relative = path.relative_to(source)
            target = destination / relative
            target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            shutil.copy2(path, target, follow_symlinks=False)
            os.chmod(target, 0o600)
        manifest = {str(path.relative_to(destination)): _hash(path)
                    for path in [destination / "mazi.sqlite3", *_files(destination)]}
        (destination / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True))
        os.chmod(destination / "manifest.json", 0o600)
        verify_backup(destination)
        return {"files": len(manifest), "sha256": _hash(destination / "manifest.json")}
    except BaseException:
        shutil.rmtree(destination)
        raise


def verify_backup(backup):
    backup = Path(backup)
    manifest = json.loads((backup / "manifest.json").read_text())
    if not isinstance(manifest, dict) or "mazi.sqlite3" not in manifest:
        raise ValueError("Invalid backup manifest")
    expected = {"mazi.sqlite3", *(str(path.relative_to(backup)) for path in _files(backup))}
    if set(manifest) != expected:
        raise ValueError("Backup file set differs from manifest")
    for name, digest in manifest.items():
        path = backup / name
        if not _inside(path, backup) or path.is_symlink() or _hash(path) != digest:
            raise ValueError("Backup checksum mismatch")
    with sqlite3.connect(f"file:{(backup / 'mazi.sqlite3').resolve()}?mode=ro", uri=True) as db:
        if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok" or db.execute("PRAGMA foreign_key_check").fetchone():
            raise ValueError("Backup database integrity failed")
        for key, digest in db.execute("SELECT original_key,sha256 FROM archive_assets WHERE EXISTS "
                                      "(SELECT 1 FROM archive_origins o WHERE o.asset_id=archive_assets.id AND o.withdrawn=0)"):
            if Path(key).name != key or not (backup / "archive-objects" / key).is_file() or _hash(backup / "archive-objects" / key) != digest:
                raise ValueError("Active original missing or corrupt")
    return {"files": len(manifest), "verified": True}


def restore_backup(backup, destination):
    backup, destination = Path(backup), Path(destination)
    verify_backup(backup)
    if destination.exists() or _inside(destination, backup):
        raise ValueError("Restore destination must be a new, separate directory")
    destination.mkdir(mode=0o700, parents=True)
    try:
        for name in json.loads((backup / "manifest.json").read_text()):
            source = backup / name
            target = destination / name
            target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            shutil.copy2(source, target)
            os.chmod(target, 0o600)
        return {"restored": True, "files": len(_files(destination)) + 1}
    except BaseException:
        shutil.rmtree(destination)
        raise


def main():
    parser = argparse.ArgumentParser(description="Offline local archive backup and restore drill")
    parser.add_argument("action", choices=("backup", "verify", "restore"))
    parser.add_argument("source", help="Archive directory for backup, or backup directory for verify/restore")
    parser.add_argument("destination", nargs="?", help="New backup or restore directory")
    args = parser.parse_args()
    if args.action == "verify":
        if args.destination is not None:
            parser.error("verify takes only the backup directory")
        result = verify_backup(args.source)
    else:
        if not args.destination:
            parser.error("backup and restore require a new destination directory")
        result = create_backup(args.source, args.destination) if args.action == "backup" else restore_backup(args.source, args.destination)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
