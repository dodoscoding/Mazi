"""One loopback app origin for the Atlas interface and authorized archive APIs."""
import hmac
import json
import mimetypes

from mazi.http_origin import validate_origin
from mazi.persistence import ArchiveBusy
import os
import threading
from http.server import HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

from .identity.core import Denied
from .memories.memories import MemoryStore
from .memories.server import handler_for as memory_handler
from .sources.server import worker


class AppServer(HTTPServer):
    # One thread keeps the SQLite store safe; a deep backlog stops a page's
    # parallel asset requests from being reset while one request is served.
    request_queue_size = 128

DIST = Path(__file__).resolve().parents[1] / 'dist'
LAND = Path(__file__).parent / 'sources' / 'land.geojson'
APP_PATHS = {'/', '/atlas', '/imports', '/review', '/timeline', '/places',
             '/discover', '/people', '/ask', '/memories', '/answer-evidence', '/settings', '/login', '/welcome', '/about', '/introduction', '/circle', '/search'}


def handler_for(store, dist=None, drain=None):
    """drain runs bounded queue work per request; without it the process's worker thread owns the queue."""
    store.shared_mode = True
    build = Path(dist) if dist is not None else DIST

    class Handler(memory_handler(store)):
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

        def do_POST(self):
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
            if path == '/api/atlas':
                try:
                    from .atlas import atlas_view
                    group = parse_qs(parts.query).get('group', [''])[0]
                    return self.json(200, atlas_view(store, self.user(), group))
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
