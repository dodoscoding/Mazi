import unittest
from mazi.persistence import Row, bind_sql


class PersistenceContracts(unittest.TestCase):
    def test_quote_aware_binding(self):
        self.assertEqual(bind_sql("SELECT '?', \"?\", ? -- ?\n, '50%' /* ? */"), "SELECT '?', \"?\", %s -- ?\n, '50%%' /* ? */")

    def test_row_supports_sqlite_consumers(self):
        row = Row(('id', 'payload'), ('a', memoryview(b'b')))
        self.assertEqual(row[0], 'a')
        self.assertEqual(row['payload'], b'b')
        self.assertEqual(tuple(row), ('a', b'b'))
        self.assertEqual(dict(row), {'id': 'a', 'payload': b'b'})

class TransactionContracts(unittest.TestCase):
    def connection(self):
        from mazi.persistence import PostgresConnection
        from unittest.mock import Mock
        connection = PostgresConnection('synthetic')
        connection._db = Mock()
        connection._db.execute.return_value.fetchone.return_value = (1,)
        return connection

    def test_policy_read_context_uses_shared_lock_and_rolls_back_failures(self):
        db = self.connection()
        with db.read_transaction():
            self.assertTrue(db._active)
        queries = [call.args[0] for call in db._db.execute.call_args_list]
        self.assertIn('SELECT pg_advisory_xact_lock_shared(%s)', queries)
        self.assertNotIn('SELECT pg_advisory_xact_lock(%s)', queries)
        self.assertEqual(queries[-1], 'COMMIT')
        with self.assertRaises(ValueError):
            with db.read_transaction():
                raise ValueError('failed projection')
        self.assertFalse(db._active)
        self.assertEqual(db._db.execute.call_args[0], ('ROLLBACK',))

    def test_context_keeps_connection_open_and_rolls_back(self):
        db = self.connection()
        with db:
            pass
        self.assertFalse(db._active)
        db._db.close.assert_not_called()
        with self.assertRaises(ValueError):
            with db:
                raise ValueError('failed write')
        self.assertFalse(db._active)
        with db:
            pass
        self.assertEqual(db._db.execute.call_args[0], ('COMMIT',))

    def test_commit_before_conflict_remains_committed(self):
        db = self.connection()
        with self.assertRaises(ValueError):
            with db:
                db.commit()
                raise ValueError('checksum reset committed')
        calls = [call.args[0] for call in db._db.execute.call_args_list]
        self.assertEqual(calls.count('COMMIT'), 1)
        self.assertNotIn('ROLLBACK', calls)

    def test_lock_timeout_leaves_connection_reusable(self):
        db = self.connection()
        def execute(query, *args):
            if query.startswith('SELECT pg_advisory'): raise TimeoutError()
            return db._db.execute.return_value
        db._db.execute.side_effect = execute
        with self.assertRaises(TimeoutError): db._begin()
        self.assertFalse(db._active)
        self.assertEqual(db._db.execute.call_args[0], ('ROLLBACK',))

class HostedConfigurationContracts(unittest.TestCase):
    def test_incomplete_storage_never_connects_database(self):
        import os
        import tempfile
        from pathlib import Path
        from unittest.mock import patch
        from mazi.persistence import open_database
        with tempfile.NamedTemporaryFile() as certificate:
            base = {'MAZI_BACKEND': 'supabase',
                'MAZI_DATABASE_URL': 'host=example.test user=mazi_app password=synthetic sslmode=verify-full sslrootcert=' + certificate.name,
                'MAZI_SUPABASE_URL': 'https://example.supabase.co'}
            for secret in ('', 'sb_secret_short', 'sb_secret_abcdefgh...ijklmnopqrstuvwxyz'):
                with self.subTest(secret=secret), patch.dict(os.environ, {**base, 'MAZI_SUPABASE_SECRET_KEY': secret}, clear=True), patch('mazi.persistence.PostgresConnection') as connect:
                    with self.assertRaisesRegex(ValueError, 'complete server Storage secret'):
                        open_database(Path('/unused'))
                    connect.assert_not_called()

    def test_tls_schema_and_storage_origin_are_validated(self):
        import tempfile
        from mazi.persistence import hosted_configuration
        with tempfile.NamedTemporaryFile() as certificate:
            base = {'MAZI_DATABASE_URL': 'host=example.test user=mazi_app password=synthetic sslmode=verify-full sslrootcert=' + certificate.name,
                'MAZI_SUPABASE_URL': 'https://example.supabase.co', 'MAZI_SUPABASE_SECRET_KEY': 'sb_secret_' + 'a' * 32}
            self.assertEqual(hosted_configuration(base)[1], 'mazi')
            for override in ({'MAZI_DATABASE_URL': base['MAZI_DATABASE_URL'].replace('verify-full', 'require')},
                             {'MAZI_DATABASE_SCHEMA': 'mazi;public'}, {'MAZI_SUPABASE_URL': 'http://example.test'},
                             {'MAZI_STORAGE_BUCKET': '../public'}):
                with self.subTest(override=override), self.assertRaises(ValueError):
                    hosted_configuration({**base, **override})


class ArchiveLockContracts(unittest.TestCase):
    def test_same_schema_has_stable_distinct_lock(self):
        from mazi.persistence import archive_lock_key
        self.assertEqual(archive_lock_key('mazi'), archive_lock_key('mazi'))
        self.assertNotEqual(archive_lock_key('mazi'), archive_lock_key('mazi_recovery_test'))
        self.assertTrue(-(2**63) <= archive_lock_key('mazi') < 2**63)


class LazyConnectionContracts(unittest.TestCase):
    def test_constructor_does_not_open_a_hosted_session(self):
        from unittest.mock import patch
        from mazi.persistence import PostgresConnection
        with patch('psycopg.connect') as connect:
            connect.return_value.execute.return_value.fetchone.return_value = (1,)
            db = PostgresConnection('synthetic')
            db.close()
        connect.assert_not_called()

    def test_disconnect_closes_once_and_next_query_reopens(self):
        from unittest.mock import Mock, patch
        from mazi.persistence import PostgresConnection
        first, second = Mock(), Mock()
        for native in (first, second):
            native.execute.return_value.fetchone.return_value = (1,)
        with patch('psycopg.connect', side_effect=[first, second]) as connect:
            db = PostgresConnection('synthetic')
            db.execute('SELECT 1')
            db.disconnect()
            db.disconnect()
            first.close.assert_called_once_with()
            db.execute('SELECT 1')
            db.close()
        self.assertEqual(connect.call_count, 2)
        self.assertIsNone(connect.call_args.kwargs['prepare_threshold'])
        second.close.assert_called_once_with()

    def test_each_transaction_configures_schema_and_standalone_writes_commit(self):
        from unittest.mock import Mock, patch
        from mazi.persistence import PostgresConnection
        native = Mock()
        native.execute.return_value.fetchone.return_value = (1,)
        with patch('psycopg.connect', return_value=native):
            db = PostgresConnection('synthetic', 'archive_test')
            db.execute('INSERT INTO example VALUES(?)', ('value',))
            db.execute('SELECT * FROM example')
            with db:
                db.execute('BEGIN IMMEDIATE')
                db.execute('UPDATE example SET value=?', ('changed',))
            statements = [entry.args[0] for entry in native.execute.call_args_list]
            setup = [query for query in statements if query.startswith('BEGIN;')]
            self.assertEqual(len(setup), 3)
            for query in setup:
                self.assertIn('SET LOCAL search_path TO "archive_test", pg_catalog', query)
                self.assertIn("SET LOCAL lock_timeout TO '5s'", query)
            self.assertEqual(statements.count('COMMIT'), 3)
            self.assertEqual(sum(query.startswith('SELECT pg_advisory') for query in statements), 1)
            native.close.assert_not_called()
            db.disconnect()

    def test_settings_failure_closes_and_reopens_without_replaying_sql(self):
        import psycopg
        from unittest.mock import Mock, patch
        from mazi.persistence import ArchiveUnavailable, PostgresConnection
        failed, healthy = Mock(), Mock()
        failed.execute.side_effect = psycopg.OperationalError('private host and credentials')
        healthy.execute.return_value.fetchone.return_value = (1,)
        with patch('psycopg.connect', side_effect=[failed, healthy]):
            db = PostgresConnection('synthetic')
            with self.assertRaisesRegex(ArchiveUnavailable, '^Hosted database unavailable; retry shortly$'):
                db.execute('INSERT INTO example VALUES(1)')
            failed.close.assert_called_once_with()
            self.assertIsNone(db._db)
            db.execute('SELECT 1')
            self.assertEqual(failed.execute.call_count, 1)
            db.disconnect()

    def test_schema_mismatch_remains_distinct_and_closes_the_client(self):
        from unittest.mock import Mock, patch
        from mazi.persistence import ArchiveSchemaMismatch, PostgresConnection
        native = Mock()
        native.execute.return_value.fetchone.return_value = (999,)
        with patch('psycopg.connect', return_value=native):
            db = PostgresConnection('synthetic')
            with self.assertRaises(ArchiveSchemaMismatch):
                db.execute('SELECT 1')
            self.assertIsNone(db._db)
        native.close.assert_called_once_with()

    def test_disconnect_releases_an_unfinished_transaction(self):
        from unittest.mock import Mock, patch
        from mazi.persistence import PostgresConnection
        native = Mock()
        native.execute.return_value.fetchone.return_value = (1,)
        with patch('psycopg.connect', return_value=native):
            db = PostgresConnection('synthetic')
            db.execute('BEGIN IMMEDIATE')
            db.disconnect()
            self.assertFalse(db._active)
            self.assertIsNone(db._db)
        native.close.assert_called_once_with()

    def test_failed_cleanup_preserves_the_setting_error(self):
        from unittest.mock import Mock, patch
        from mazi.persistence import PostgresConnection
        native = Mock()
        native.execute.side_effect = ValueError('setting failed')
        native.close.side_effect = OSError('close failed')
        with patch('psycopg.connect', return_value=native):
            db = PostgresConnection('synthetic')
            with self.assertRaisesRegex(ValueError, '^setting failed$'):
                db.execute('SELECT 1')
            self.assertIsNone(db._db)
