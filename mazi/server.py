"""One loopback app origin for the Atlas interface and authorized archive APIs."""
import hmac
import json
import mimetypes

from mazi.http_origin import validate_origin
from mazi.persistence import ArchiveBusy
from mazi.capacity import CapacityExceeded
import os
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

from .identity.core import Conflict, Denied
from .memories.memories import MemoryStore
from .social.server import handler_for as social_handler
from .sources.server import worker


class AppServer(ThreadingHTTPServer):
    request_queue_size = 128

    def __init__(self, server_address, handler, bind_and_activate=True):
        self._dispatch_lock = threading.Lock()
        self._closed = False
        dispatch_lock = self._dispatch_lock

        class SerializedHandler(handler):
            def do_GET(self):
                with dispatch_lock:
                    if self.server._closed:
                        return self.send_error(503, 'Server is closing')
                    return super().do_GET()

            def do_POST(self):
                with dispatch_lock:
                    if self.server._closed:
                        return self.send_error(503, 'Server is closing')
                    return super().do_POST()

        super().__init__(server_address, SerializedHandler, bind_and_activate)

    def server_close(self):
        with self._dispatch_lock:
            self._closed = True
            super().server_close()

DIST = Path(__file__).resolve().parents[1] / 'dist'
LAND = Path(__file__).parent / 'sources' / 'land.geojson'
APP_PATHS = {'/', '/explore', '/atlas', '/imports', '/review', '/timeline', '/places',
             '/discover', '/people', '/ask', '/memories', '/answer-evidence', '/settings', '/login', '/welcome', '/about', '/introduction', '/circle', '/search'}


def handler_for(store, dist=None, drain=None):
    """drain runs bounded queue work per request; without it the process's worker thread owns the queue."""
    store.shared_mode = True
    build = Path(dist) if dist is not None else DIST

    class Handler(social_handler(store)):
        def work(self):
            if drain is None:
                return self.json(200, {'pending': False, 'mode': 'thread'})
            try:
                return self.json(200, drain())
            except OSError:
                return self.json(503, {'error': 'Background work unavailable; retry shortly'})

        def place(self):
            try:
                validate_origin(self.headers.get('Origin'), self.headers.get('Host', ''))
                if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                    raise ValueError('JSON required')
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 4096:
                    raise ValueError('Invalid request size')
                body = json.loads(self.rfile.read(length))
                if not isinstance(body, dict):
                    raise ValueError('Expected object')
                from .atlas import place_memory
                return self.json(200, {'ok': True, **place_memory(
                    store, self.user(), body['group'], body['memory'], body.get('place', ''))})
            except ArchiveBusy:
                return self.json(503, {'error': 'Archive is busy; retry shortly'})
            except Denied as exc:
                return self.json(403, {'error': str(exc)})
            except (KeyError, ValueError, TypeError):
                return self.json(400, {'error': 'Invalid request'})

        def photo(self, write=False):
            try:
                if write:
                    validate_origin(self.headers.get('Origin'), self.headers.get('Host', ''))
                    if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                        raise ValueError('JSON required')
                    length = int(self.headers.get('Content-Length', '0'))
                    if not 0 < length <= 4096:
                        raise ValueError('Invalid request size')
                    body = json.loads(self.rfile.read(length))
                    if not isinstance(body, dict):
                        raise ValueError('Expected object')
                    result = store.patch_photo(self.user(), body['group'], body['asset'], body['changes'], body['expected_snapshot'])
                else:
                    query = parse_qs(urlsplit(self.path).query)
                    result = store.photo_correction(self.user(), query['group'][0], query['asset'][0])
                    if 'place' in query:
                        from .places import lookup, label
                        place = query['place'][0]
                        if len(place) > 200:
                            raise ValueError('Invalid place')
                        match = lookup(place)
                        result['candidates'] = [label(city) for city in match.get('candidates', [])]
                return self.json(200, result)
            except Conflict as exc:
                return self.json(409, {'error': str(exc)})
            except ArchiveBusy:
                return self.json(503, {'error': 'Archive is busy; retry shortly'})
            except Denied as exc:
                return self.json(403, {'error': str(exc)})
            except (KeyError, ValueError, TypeError, IndexError):
                return self.json(400, {'error': 'Invalid correction; an anniversary requires its approved date'})

        def do_POST(self):
            if urlsplit(self.path).path == '/api/atlas/photo':
                return self.photo(write=True)
            if urlsplit(self.path).path == '/api/atlas/place':
                return self.place()
            if urlsplit(self.path).path != '/api/work':
                return super().do_POST()
            try:
                validate_origin(self.headers.get('Origin'), self.headers.get('Host', ''))
                self.user()
            except ArchiveBusy:
                return self.json(503, {'error': 'Archive is busy; retry shortly'})
            except Denied as exc:
                return self.json(403, {'error': str(exc)})
            return self.work()

        def do_GET(self):
            parts = urlsplit(self.path)
            path = unquote(parts.path)
            if path == '/api/work':
                secret = os.environ.get('CRON_SECRET', '')
                supplied = self.headers.get('Authorization', '')
                if not secret or not hmac.compare_digest(supplied.encode(), f'Bearer {secret}'.encode()):
                    return self.json(401, {'error': 'Unauthorized'})
                return self.work()
            if path == '/api/atlas/photo':
                return self.photo()
            if path in ('/api/atlas', '/api/atlas/memory'):
                try:
                    from .atlas import atlas_view, memory_view
                    query = parse_qs(parts.query)
                    group = query.get('group', [''])[0]
                    if path == '/api/atlas/memory':
                        return self.json(200, memory_view(store, self.user(), group, query.get('memory', [''])[0]))
                    return self.json(200, atlas_view(store, self.user(), group))
                except CapacityExceeded as exc:
                    return self.json(400, {'code': 'capacity_exceeded', 'error': str(exc)})
                except ArchiveBusy:
                    return self.json(503, {"error": "Archive is busy; retry shortly"})
                except Denied as exc:
                    return self.json(403, {'error': str(exc)})
                except (ValueError, TypeError):
                    return self.json(400, {'error': 'Invalid request'})
            if path.startswith('/api/') or path == '/health':
                return super().do_GET()
            if path == '/land.geojson':
                return self.send(200, LAND.read_bytes(), 'application/geo+json')
            if '\x00' in path or '\\' in path or '..' in Path(path).parts:
                return self.json(404, {'error': 'Not found'})
            if path in APP_PATHS:
                target = build / 'index.html'
                if not target.is_file():
                    return self.json(503, {'error': 'Atlas build unavailable. Run npm run build before starting the app.'})
            else:
                target = build / path.lstrip('/')
                if not target.resolve().is_relative_to(build.resolve()) or not target.is_file():
                    return self.json(404, {'error': 'Not found'})
            mime = mimetypes.guess_type(target.name)[0] or 'application/octet-stream'
            return self.send(200, target.read_bytes(), mime)

    return Handler


def main():
    root = Path(os.environ.get('MAZI_IMPORT_DATA_DIR', '.mazi-imports'))
    port = int(os.environ.get('MAZI_IMPORT_PORT', '8005'))
    store = MemoryStore(root)
    stop = threading.Event()
    background = threading.Thread(target=worker, args=(root, stop), daemon=True)
    server = AppServer(('127.0.0.1', port), handler_for(store))
    background.start()
    print(f'Mazi: http://127.0.0.1:{port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        stop.set()
        background.join(timeout=35)
        server.server_close()
        store.close()
