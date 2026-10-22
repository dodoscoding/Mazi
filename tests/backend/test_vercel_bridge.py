import contextlib
import hashlib
import io
import json
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from unittest.mock import Mock, patch
from wsgiref.util import setup_testing_defaults
from wsgiref.validate import validator

from api import index
from mazi.imports import engine
from mazi.memories.memories import MemoryStore
from mazi.persistence import ArchiveBusy
from mazi.server import handler_for
from mazi.sources.server import Worker, drain
from tests.backend.imports.test_adapters import zip_bytes
from tests.backend.imports.test_engine import picture

ORIGIN = 'http://127.0.0.1'


def start(app, method, path, body=None, headers=None, query=''):
    data = b'' if body is None else json.dumps(body).encode()
    environ = {}
    setup_testing_defaults(environ)
    environ.update({'REQUEST_METHOD': method, 'PATH_INFO': path, 'QUERY_STRING': query,
                    'CONTENT_LENGTH': str(len(data)), 'wsgi.input': io.BytesIO(data)})
    if body is not None:
        environ['CONTENT_TYPE'] = 'application/json'
    for name, value in (headers or {}).items():
        environ['HTTP_' + name.upper().replace('-', '_')] = value
    response = {}

    def start_response(status, response_headers, exc_info=None):
        response.update(status=int(status[:3]), headers=response_headers)
        return lambda data: None

    return response, validator(app)(environ, start_response)


def call(app, method, path, body=None, headers=None, query=''):
    response, result = start(app, method, path, body, headers, query)
    try:
        chunks = list(result)
    finally:
        result.close()
    return response['status'], response['headers'], chunks


class VercelBridgeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temp.name) / 'data'
        cls.env = patch.dict('os.environ', {'MAZI_BACKEND': 'local', 'MAZI_IMPORT_DATA_DIR': str(cls.root)})
        cls.env.start()
        cls.store = MemoryStore(cls.root)
        cls.alice = cls.store.register('alice@example.test', 'correct horse battery')
        cls.group = cls.store.create_group(cls.alice, 'Friends')
        cls.code = cls.store.setup_shared(admin_name='Alice', group_id=cls.group, mappings={'Alice': cls.alice})
        _, cls.token = cls.store.enter_shared(code=cls.code, name='Alice')
        cls.signed_in = {'Cookie': 'mazi_session=' + cls.token, 'Origin': ORIGIN}

    @classmethod
    def tearDownClass(cls):
        if 'work' in index._state:
            index._state['work'].store.close()
        if 'handler' in index._state:
            index._state['handler']._mazi_store.close()
        index._state.clear()
        cls.store.close()
        cls.env.stop()
        cls.temp.cleanup()

    def test_health_and_unknown_api_route(self):
        status, headers, chunks = call(index.app, 'GET', '/health')
        self.assertEqual((status, json.loads(b''.join(chunks))), (200, {'status': 'ok'}))
        self.assertIn(('Cache-Control', 'no-store'), headers)
        status, _, chunks = call(index.app, 'GET', '/api/x', headers=self.signed_in)
        self.assertEqual((status, json.loads(b''.join(chunks))), (404, {'error': 'Not found'}))

    def test_json_post_sets_session_cookie(self):
        status, headers, chunks = call(index.app, 'POST', '/api/entry', {'code': self.code, 'name': 'Alice'},
                                       {'Origin': ORIGIN})
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(b''.join(chunks))['user_id'], self.alice)
        cookies = [value for name, value in headers if name == 'Set-Cookie']
        token = cookies[0].split(';')[0].removeprefix('mazi_session=')
        self.assertEqual(cookies, [f'mazi_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000'])
        self.assertEqual(self.store.user_for_token(token), self.alice)

    def test_large_body_streams_before_the_handler_finishes(self):
        size, first_write = 5 * 1024 * 1024, 3 * 1024 * 1024
        released, buffered = threading.Event(), threading.Event()

        class Large(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_GET(self):
                self.send_response(200)
                self.send_header('Content-Type', 'application/octet-stream')
                self.send_header('Content-Length', str(size))
                self.send_header('Set-Cookie', 'first=1')
                self.send_header('Set-Cookie', 'second=2')
                self.end_headers()
                self.wfile.write(b'a' * first_write)
                buffered.set()
                released.wait(10)
                self.wfile.write(b'b' * (size - first_write))

        response, result = start(index.make_app(lambda: Large), 'GET', '/large')
        try:
            chunks = [next(result)]
            self.assertFalse(buffered.is_set(), 'a bounded queue holds back a 3 MiB write until it is read')
            released.set()
            chunks.extend(result)
        finally:
            result.close()
        self.assertEqual(response['status'], 200)
        self.assertEqual([value for name, value in response['headers'] if name == 'Set-Cookie'], ['first=1', 'second=2'])
        self.assertIn(('Content-Length', '5242880'), response['headers'])
        self.assertEqual(len(chunks), 20)
        self.assertEqual(b''.join(chunks), b'a' * first_write + b'b' * (size - first_write))

    def test_unknown_method_and_handler_failure(self):
        status, _, chunks = call(index.app, 'PUT', '/health')
        self.assertEqual((status, json.loads(b''.join(chunks))), (501, {'error': 'Not Implemented'}))

        class Broken(BaseHTTPRequestHandler):
            def do_GET(self):
                raise RuntimeError('synthetic failure')

        with contextlib.redirect_stderr(io.StringIO()) as logged:
            status, _, chunks = call(index.make_app(lambda: Broken), 'GET', '/broken')
        self.assertEqual((status, json.loads(b''.join(chunks))), (500, {'error': 'Internal Server Error'}))
        self.assertIn('synthetic failure', logged.getvalue())

    def test_unexpected_failure_reconnects_the_store(self):
        self.assertEqual(call(index.app, 'GET', '/health')[0], 200)
        failed = index._state['handler']
        with patch.object(MemoryStore, 'shared_session', side_effect=RuntimeError('connection closed')), \
                contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(call(index.app, 'GET', '/api/session', headers=self.signed_in)[0], 500)
        self.assertEqual(call(index.app, 'GET', '/api/session', headers=self.signed_in)[0], 200)
        self.assertIsNot(index._state['handler'], failed)

    def test_signed_in_post_drains_a_queued_import(self):
        data = zip_bytes({'photo.jpg': picture()})
        run = self.store.begin_import(self.alice, self.group, 'manual', 'drain', len(data), hashlib.sha256(data).hexdigest(), {})
        self.store.write_chunk(self.alice, run, 0, data)
        self.store.finish_transfer(self.alice, run)
        self.assertEqual(call(index.app, 'POST', '/api/work', headers={'Origin': ORIGIN})[0], 403)
        self.assertEqual(call(index.app, 'POST', '/api/work', headers={**self.signed_in, 'Origin': 'https://evil.test'})[0], 403)
        status, _, chunks = call(index.app, 'POST', '/api/work', headers=self.signed_in)
        self.assertEqual((status, json.loads(b''.join(chunks))), (200, {'pending': False}))
        self.assertEqual(self.store.report(self.alice, run)['state'], 'INVENTORIED')
        self.store.confirm(self.alice, run)
        status, _, chunks = call(index.app, 'POST', '/api/work', headers=self.signed_in)
        self.assertEqual((status, json.loads(b''.join(chunks))), (200, {'pending': False}))
        report = self.store.report(self.alice, run)
        self.assertEqual((report['state'], report['counts']), ('COMPLETED', {'AVAILABLE_TO_GROUP': 1}))

    def test_sequential_work_requests_reuse_the_inventory_session(self):
        data = zip_bytes({'chat.txt': '\n'.join(
            f'01/01/2020, 12:00 - Ana: synthetic message {i}' for i in range(250)).encode()})
        run = self.store.begin_import(self.alice, self.group, 'whatsapp', 'warm-scan',
                                      len(data), hashlib.sha256(data).hexdigest(), {'date_order': 'DMY'})
        self.store.write_chunk(self.alice, run, 0, data)
        self.store.finish_transfer(self.alice, run)
        original_scan = engine.ImportStore.scan

        def scan_page(store, run, batch_size=500):
            return original_scan(store, run, batch_size=100)

        def one_step(work, budget):
            work.step()
            return {'pending': True}

        with patch.object(engine.ImportStore, 'scan', scan_page), \
                patch.object(engine, 'inventory', wraps=engine.inventory) as inventory, \
                patch.object(index, 'drain', side_effect=one_step):
            for _ in range(3):
                self.assertEqual(call(index.app, 'POST', '/api/work', headers=self.signed_in)[0], 200)
            self.assertEqual(inventory.call_count, 1, 'warm requests retain the parsed inventory')
        report = self.store.report(self.alice, run)
        self.assertEqual((report['state'], report['discovered']), ('INVENTORIED', 250))

    def test_cron_get_requires_the_bearer_secret(self):
        with patch.dict('os.environ', {'CRON_SECRET': 'synthetic-cron-secret'}):
            self.assertEqual(call(index.app, 'GET', '/api/work')[0], 401)
            self.assertEqual(call(index.app, 'GET', '/api/work', headers={'Authorization': 'Bearer wrong'})[0], 401)
            status, _, chunks = call(index.app, 'GET', '/api/work', headers={'Authorization': 'Bearer synthetic-cron-secret'})
            self.assertEqual((status, json.loads(b''.join(chunks))), (200, {'pending': False}))
        with patch.dict('os.environ', {'CRON_SECRET': ''}):
            self.assertEqual(call(index.app, 'GET', '/api/work', headers={'Authorization': 'Bearer '})[0], 401)

    def test_thread_worker_mode_never_drains(self):
        store = MemoryStore(self.root)
        try:
            app = index.make_app(lambda: handler_for(store))
            status, _, chunks = call(app, 'POST', '/api/work', headers=self.signed_in)
            self.assertEqual((status, json.loads(b''.join(chunks))), (200, {'pending': False, 'mode': 'thread'}))
        finally:
            store.close()


class WorkerEvictionTests(unittest.TestCase):
    def test_unexpected_failure_closes_the_evicted_worker_store_once(self):
        work = Mock()
        with patch.object(index, '_state', {'work': work}):
            index._forget('work', RuntimeError('connection closed'))
            self.assertNotIn('work', index._state)
            index._forget('work', RuntimeError('already removed'))
        work.store.close.assert_called_once_with()

    def test_store_cleanup_failure_does_not_mask_the_original_failure(self):
        work = Mock()
        work.store.close.side_effect = RuntimeError('close failed')
        with patch.object(index, '_state', {'work': work}):
            index._forget('work', RuntimeError('connection closed'))
            self.assertNotIn('work', index._state)
        work.store.close.assert_called_once_with()

    def test_expected_request_failures_keep_the_warm_worker(self):
        for error in (OSError('temporary storage failure'), NotImplementedError('method')):
            with self.subTest(error=type(error).__name__):
                work = Mock()
                with patch.object(index, '_state', {'work': work}):
                    index._forget('work', error)
                    self.assertIs(index._state['work'], work)
                work.store.close.assert_not_called()


class DrainBudgetTests(unittest.TestCase):
    def worker(self, work_once):
        store = Mock()
        store.work_once.side_effect = work_once
        with patch.dict('os.environ', {}, clear=True):
            return Worker(store), store

    def test_budget_reports_pending_work(self):
        work, store = self.worker(lambda: True)
        self.assertEqual(drain(work, 0.05), {'pending': True})
        store.reconcile.assert_not_called()

    def test_idle_queue_reconciles_once(self):
        work, store = self.worker(lambda: False)
        self.assertEqual(drain(work, 20), {'pending': False})
        store.reconcile.assert_called_once_with()

    def test_busy_archive_backs_off_without_reconciling(self):
        work, store = self.worker(Mock(side_effect=ArchiveBusy('Archive is busy; retry shortly')))
        self.assertEqual(drain(work, 20), {'pending': False})
        store.reconcile.assert_not_called()


if __name__ == '__main__':
    unittest.main()


class ConnectionLeaseTests(unittest.TestCase):
    def test_success_and_failure_disconnect_under_the_request_lock(self):
        store = Mock()
        store.db.hosted = True
        disconnected = threading.Event()

        def disconnect():
            self.assertTrue(index._request_lock.locked())
            disconnected.set()

        store.db.disconnect.side_effect = disconnect

        class Handler(BaseHTTPRequestHandler):
            _mazi_store = store

            def log_message(self, *args):
                pass

            def do_GET(self):
                if self.path == '/broken':
                    raise RuntimeError('synthetic failure')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', '0')
                self.end_headers()

        for path, expected in (('/ok', 200), ('/broken', 500)):
            with self.subTest(path=path), contextlib.redirect_stderr(io.StringIO()):
                disconnected.clear()
                status, _, _ = call(index.make_app(lambda: Handler), 'GET', path)
                self.assertEqual(status, expected)
                self.assertTrue(disconnected.wait(1))

    def test_handler_eviction_closes_its_owned_store(self):
        handler = Mock()
        with patch.object(index, '_state', {'handler': handler}):
            index._forget('handler', RuntimeError('failure'))
        handler._mazi_store.close.assert_called_once_with()

    def test_unavailable_is_sanitized_503_without_authentication_loss(self):
        from mazi.persistence import ArchiveUnavailable

        class Unavailable(BaseHTTPRequestHandler):
            def do_GET(self):
                raise ArchiveUnavailable('private database details')

        with contextlib.redirect_stderr(io.StringIO()) as logged:
            status, headers, chunks = call(index.make_app(lambda: Unavailable), 'GET', '/api/session')
        self.assertEqual(status, 503)
        self.assertEqual(json.loads(b''.join(chunks)), {'error': 'Service Unavailable'})
        self.assertIn(('Cache-Control', 'no-store'), headers)
        self.assertFalse(any(name.lower() == 'set-cookie' for name, _ in headers))
        self.assertEqual(logged.getvalue(), '')

    def test_drain_disconnects_its_store_before_releasing_worker_lock(self):
        from types import SimpleNamespace
        for failure in (None, RuntimeError('work failed')):
            with self.subTest(failure=failure):
                store = Mock()
                store.db.hosted = True
                work = SimpleNamespace(store=store)
                handler_store = Mock()
                handler_store.db.hosted = True
                state = {'work': work, 'handler': SimpleNamespace(_mazi_store=handler_store)}

                def disconnect():
                    self.assertTrue(index._drain_lock.locked())

                store.db.disconnect.side_effect = disconnect
                with patch.object(index, '_state', state), patch.object(index, 'drain') as draining:
                    draining.side_effect = failure
                    with index._request_lock:
                        if failure:
                            with self.assertRaisesRegex(RuntimeError, 'work failed'):
                                index._drain()
                        else:
                            index._drain()
                        self.assertTrue(index._request_lock.locked())
                store.db.disconnect.assert_called_once_with()
                handler_store.db.disconnect.assert_called_once_with()

    def test_old_request_cannot_evict_a_new_handler_after_a_drain(self):
        old, current = Mock(), Mock()
        with patch.object(index, '_state', {'handler': current}):
            index._forget('handler', RuntimeError('old request'), expected=old)
            self.assertIs(index._state['handler'], current)
        current._mazi_store.close.assert_not_called()

    def test_abandoned_stream_disconnects_its_store(self):
        store = Mock()
        store.db.hosted = True
        disconnected = threading.Event()
        store.db.disconnect.side_effect = disconnected.set

        class Large(BaseHTTPRequestHandler):
            _mazi_store = store

            def log_message(self, *args):
                pass

            def do_GET(self):
                self.send_response(200)
                self.send_header('Content-Type', 'application/octet-stream')
                self.end_headers()
                self.wfile.write(b'a' * (5 * 1024 * 1024))

        _, result = start(index.make_app(lambda: Large), 'GET', '/large')
        next(result)
        result.close()
        self.assertTrue(disconnected.wait(3))
