"""Disposable PostgreSQL17 adapter proof; local objects, no provider credentials."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import subprocess
import shutil
import sys
import tempfile
import time
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]


def child(repo, dsn):
    sys.path.insert(0, str(repo))
    import psycopg
    from psycopg.conninfo import conninfo_to_dict
    target = conninfo_to_dict(dsn)
    if (target.get('host'), target.get('port'), target.get('dbname'), target.get('user')) != ('127.0.0.1', '15590', 'postgres', 'postgres'):
        raise ValueError('This proof only accepts its disposable localhost cluster')
    from mazi.persistence import PostgresConnection
    from mazi.imports.engine import ImportStore
    from mazi.storage import LocalObjects
    from tests.backend.imports.test_adapters import zip_bytes
    from tests.backend.imports.test_engine import picture
    migrations = ROOT / 'infra/hosted/supabase/migrations'
    with psycopg.connect(dsn, autocommit=True) as admin:
        admin.execute('DROP SCHEMA IF EXISTS mazi CASCADE')
        admin.execute('CREATE SCHEMA mazi')
        admin.execute('GRANT USAGE ON SCHEMA mazi TO mazi_app')
        admin.execute((migrations / '20261014172936_application_archive.sql').read_text())
        indexes = (migrations / '20261014173956_hosted_privileges_and_indexes.sql').read_text()
        # Provider-only RPC revocation has no matching function in vanilla PostgreSQL.
        admin.execute('\n'.join(line for line in indexes.splitlines() if 'public.rls_auto_enable()' not in line))
    connection = PostgresConnection(dsn.replace('user=postgres', 'user=mazi_app'))
    statements = []
    execute = connection.execute
    def observed(sql, params=()):
        if sql.startswith('INSERT INTO import_items'):
            statements.append(len(params))
        return execute(sql, params)
    connection.execute = observed
    with tempfile.TemporaryDirectory(prefix='mazi-pg-objects-') as root:
        with patch('mazi.persistence.open_database', return_value=connection), patch('mazi.storage.open_objects', side_effect=lambda root, db: LocalObjects(root)):
            store = ImportStore(root)
        user = store.register('synthetic@example.test', 'correct horse battery')
        group = store.create_group(user, 'Synthetic PostgreSQL')
        text = '\n'.join('01/01/2024, 12:00 - Alice: ' + (f'photo{i}.jpg (file attached)' if i < 223 else f'synthetic {i}') for i in range(7500))
        data = zip_bytes({'_chat.txt': text.encode(), **{f'photo{i}.jpg': picture() for i in range(223)}})
        run = store.begin_import(user, group, 'whatsapp', 'synthetic', len(data), hashlib.sha256(data).hexdigest(), {'date_order': 'DMY'})
        for offset in range(0, len(data), 512 * 1024):
            store.write_chunk(user, run, offset, data[offset:offset + 512 * 1024])
        store.finish_transfer(user, run)
        started = time.perf_counter()
        ticks = 0
        while connection.execute('SELECT state FROM import_runs WHERE id=?', (run,)).fetchone()[0] == 'SCANNING':
            store.scan(run, 500)
            ticks += 1
        scan = time.perf_counter() - started
        before = store.report(user, run)
        assert before['counts'] == {'PENDING': 223, 'SKIPPED': 7277}, before
        store.confirm(user, run)
        started = time.perf_counter()
        while store.work_once():
            pass
        processing = time.perf_counter() - started
        final = store.report(user, run)
        assert final['counts'] == {'AVAILABLE_TO_GROUP': 223, 'SKIPPED': 7277}, final
        assert final['unique_assets'] == 1
        assert final['state'] == 'COMPLETED'
        result = {'repo': str(repo), 'postgres': '17', 'database_driver': 'PostgresConnection/psycopg', 'object_storage': 'LocalObjects; no provider network', 'scan_seconds': round(scan, 4), 'processing_seconds': round(processing, 4), 'scan_calls': ticks, 'insert_statements': len(statements), 'max_insert_bind_parameters': max(statements), 'counts': final['counts'], 'unique_assets': final['unique_assets'], 'no_media': final.get('no_media'), 'state': final['state']}
        store.close()
        print(json.dumps(result))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--baseline', type=Path, help='Checkout of the baseline revision')
    parser.add_argument('--pg-bin', type=Path, help='Directory containing PostgreSQL initdb and pg_ctl')
    parser.add_argument('--child', type=Path)
    parser.add_argument('--dsn')
    args = parser.parse_args()
    if args.child:
        child(args.child, args.dsn)
        return
    if args.baseline is None:
        parser.error('--baseline is required')
    pg_ctl = shutil.which('pg_ctl')
    if args.pg_bin is None and pg_ctl is None:
        parser.error('--pg-bin is required when pg_ctl is not on PATH')
    pg = args.pg_bin or Path(pg_ctl).resolve().parent
    with tempfile.TemporaryDirectory(prefix='mazi-postgres-proof-') as cluster:
        path = Path(cluster)
        subprocess.run([str(pg/'initdb'), '-D', str(path/'data'), '-U', 'postgres', '-A', 'trust', '--no-locale', '--encoding=UTF8'], check=True, capture_output=True)
        subprocess.run([str(pg/'pg_ctl'), '-D', str(path/'data'), '-l', str(path/'postgres.log'), '-o', f'-h 127.0.0.1 -p 15590 -k {cluster}', 'start', '-w'], check=True, capture_output=True)
        try:
            dsn = 'host=127.0.0.1 port=15590 user=postgres dbname=postgres sslmode=disable'
            import psycopg
            with psycopg.connect(dsn, autocommit=True) as db:
                db.execute('CREATE ROLE anon NOLOGIN')
                db.execute('CREATE ROLE authenticated NOLOGIN')
                db.execute('CREATE ROLE mazi_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS')
            results = []
            for repo in (args.baseline.resolve(), ROOT):
                process = subprocess.run([sys.executable, str(Path(__file__).resolve()), '--child', str(repo), '--dsn', dsn], capture_output=True, text=True)
                if process.returncode:
                    raise RuntimeError(process.stderr)
                results.append(json.loads(process.stdout))
            print(json.dumps({'isolation': 'Disposable localhost:15590 PostgreSQL17 cluster; local trust auth; removed after stop; no production credentials', 'results': results}, indent=2))
        finally:
            subprocess.run([str(pg/'pg_ctl'), '-D', str(path/'data'), 'stop', '-m', 'fast', '-w'], check=True, capture_output=True)

if __name__ == '__main__':
    main()
