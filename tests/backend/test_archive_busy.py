import threading
import unittest
from unittest.mock import Mock, patch
from mazi.persistence import ArchiveBusy
from mazi.sources.server import worker


class WorkerBusyContract(unittest.TestCase):
    def test_busy_archive_retries_and_keeps_worker_alive(self):
        stop = threading.Event()
        store = Mock()
        attempts = []
        def work_once():
            attempts.append(1)
            if len(attempts) == 1:
                raise ArchiveBusy('Archive is busy; retry shortly')
            stop.set()
            return True
        store.work_once.side_effect = work_once
        with patch('mazi.memories.memories.MemoryStore', return_value=store), patch.dict('os.environ', {}, clear=True), patch.object(stop, 'wait') as wait:
            worker('/synthetic', stop)
        self.assertEqual(len(attempts), 2)
        wait.assert_called_once_with(5)
        store.close.assert_called_once()

    def test_http_busy_response_is_retryable_and_recovers(self):
        import json
        from tests.backend.test_server import AppServerTests
        app = AppServerTests(methodName='runTest')
        app.setUp()
        try:
            with patch.object(app.store, 'enter_shared', side_effect=ArchiveBusy('private SQL must not escape')):
                status, headers, body = app.request('/api/entry', {'code': app.code, 'name': 'Alice'})
                self.assertEqual(status, 503)
                self.assertEqual(json.loads(body), {'error': 'Archive is busy; retry shortly'})
            self.assertEqual(app.request('/api/entry', {'code': app.code, 'name': 'Alice'})[0], 200)
        finally:
            app.tearDown()
