"""Vercel Function entrypoint: serves the stdlib Mazi handler through WSGI."""
import json
import os
import queue
import sys
import threading
import traceback
from http.client import HTTPMessage
from io import BytesIO
from pathlib import Path
from urllib.parse import quote
from wsgiref.util import is_hop_by_hop

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from mazi.memories.memories import MemoryStore  # noqa: E402
from mazi.server import handler_for  # noqa: E402
from mazi.sources.server import Worker, drain  # noqa: E402

CHUNK_BYTES = 256 * 1024
DRAIN_SECONDS = 20
_DONE = object()
# The store holds one database connection, so requests in one instance take turns.
_request_lock = threading.Lock()
_drain_lock = threading.Lock()
_state = {}


def _root():
    return Path(os.environ.get('MAZI_IMPORT_DATA_DIR', '/tmp/mazi'))


def _drain():
    # Work on a second connection and let this instance's other requests proceed meanwhile.
    _request_lock.release()
    try:
        if not _drain_lock.acquire(blocking=False):
            # Another request in this instance is already draining the shared queue.
            return {'pending': False}
        try:
            if 'work' not in _state:
                _state['work'] = Worker(MemoryStore(_root()))
            try:
                return drain(_state['work'], DRAIN_SECONDS)
            except Exception as error:
                _forget('work', error)
                raise
        finally:
            _drain_lock.release()
    finally:
        _request_lock.acquire()


def _forget(key, error):
    # A thawed instance may hold a dropped database connection; reconnect on the next request.
    if not isinstance(error, (OSError, NotImplementedError)):
        _state.pop(key, None)


def _handler():
    if 'handler' not in _state:
        _state['handler'] = handler_for(MemoryStore(_root()), drain=_drain)
    return _state['handler']


class _Sink:
    """The handler's wfile. A bounded queue keeps large bodies streaming instead of buffered."""

    def __init__(self):
        self.chunks = queue.Queue(maxsize=8)
        self.abandoned = False

    def put(self, item):
        while not self.abandoned:
            try:
                return self.chunks.put(item, timeout=1)
            except queue.Full:
                pass
        raise BrokenPipeError('Client disconnected')

    def write(self, data):
        view = memoryview(data)
        for start in range(0, len(view), CHUNK_BYTES):
            self.put(bytes(view[start:start + CHUNK_BYTES]))
        return len(view)

    def flush(self):
        pass


def _serve(handler_class, environ, body, sink):
    # BaseHTTPRequestHandler.__init__ expects a socket; set what the request methods read instead.
    handler = handler_class.__new__(handler_class)
    headers = HTTPMessage()
    for key, value in environ.items():
        if key.startswith('HTTP_') and key not in ('HTTP_CONTENT_TYPE', 'HTTP_CONTENT_LENGTH'):
            headers[key[5:].replace('_', '-')] = value
    for key in ('CONTENT_TYPE', 'CONTENT_LENGTH'):
        if environ.get(key):
            headers[key.replace('_', '-')] = environ[key]
    # wsgiref decodes PATH_INFO while Vercel passes it raw; keeping % unescaped serves both.
    path = quote(environ.get('PATH_INFO', '/').encode('latin-1'), safe="/%:@!$&'()*+,;=~")
    if environ.get('QUERY_STRING'):
        path += '?' + environ['QUERY_STRING']
    handler.command = environ['REQUEST_METHOD']
    handler.path = path
    handler.request_version = 'HTTP/1.1'
    handler.requestline = f'{handler.command} {path} HTTP/1.1'
    handler.headers = headers
    handler.rfile = BytesIO(body)
    handler.wfile = sink
    handler.client_address = (environ.get('REMOTE_ADDR') or '', 0)
    handler.server = None
    handler.close_connection = False
    action = getattr(handler, 'do_' + handler.command, None)
    if action is None:
        raise NotImplementedError(handler.command)
    action()
    if handler.close_connection:
        raise ConnectionAbortedError('Handler abandoned a partial response')


def _parse_head(head):
    lines = head.decode('latin-1').split('\r\n')
    headers = []
    for line in lines[1:]:
        name, value = line.split(':', 1)
        # The hosting server adds its own Server and Date headers.
        if not is_hop_by_hop(name) and name.lower() not in ('server', 'date'):
            headers.append((name, value.strip()))
    return lines[0].split(' ', 1)[1], headers


def _respond(sink, errors, start_response):
    head = b''
    try:
        while (chunk := sink.chunks.get()) is not _DONE:
            if head is not None:
                head += chunk
                if b'\r\n\r\n' not in head:
                    continue
                head, chunk = head.split(b'\r\n\r\n', 1)
                start_response(*_parse_head(head))
                head = None
            if chunk:
                yield chunk
        if head is not None:
            unsupported = bool(errors) and isinstance(errors[0], NotImplementedError)
            if errors and not unsupported:
                traceback.print_exception(errors[0])
            status = '501 Not Implemented' if unsupported else '500 Internal Server Error'
            body = json.dumps({'error': status[4:]}).encode()
            start_response(status, [('Content-Type', 'application/json'), ('Content-Length', str(len(body))),
                                    ('Cache-Control', 'no-store')])
            yield body
        elif errors:
            # Headers are already sent; failing the stream keeps the truncation visible.
            raise errors[0]
    finally:
        sink.abandoned = True


def make_app(get_handler):
    def app(environ, start_response):
        length = int(environ.get('CONTENT_LENGTH') or 0)
        body = environ['wsgi.input'].read(length) if length > 0 else b''
        sink = _Sink()
        errors = []

        def run():
            try:
                with _request_lock:
                    _serve(get_handler(), environ, body, sink)
            except BaseException as error:
                errors.append(error)
                _forget('handler', error)
            finally:
                try:
                    sink.put(_DONE)
                except BrokenPipeError:
                    pass

        threading.Thread(target=run, daemon=True).start()
        return _respond(sink, errors, start_response)

    return app


app = make_app(_handler)
