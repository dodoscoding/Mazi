"""One loopback app origin for the Atlas interface and authorized archive APIs."""
import mimetypes
import os
import threading
from http.server import HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

from .identity.core import Denied
from .memories.memories import MemoryStore
from .memories.server import handler_for as memory_handler
from .sources.server import worker

DIST = Path(__file__).resolve().parents[1] / 'dist'
LAND = Path(__file__).parent / 'sources' / 'land.geojson'
APP_PATHS = {'/', '/atlas', '/imports', '/review', '/timeline', '/places',
             '/discover', '/people', '/ask', '/memories', '/answer-evidence', '/settings', '/login', '/welcome', '/about', '/circle', '/search'}


def handler_for(store, dist=None):
    store.shared_mode = True
    build = Path(dist) if dist is not None else DIST

    class Handler(memory_handler(store)):
        def do_GET(self):
            parts = urlsplit(self.path)
            path = unquote(parts.path)
            if path == '/api/atlas':
                try:
                    from .atlas import atlas_view
                    group = parse_qs(parts.query).get('group', [''])[0]
                    return self.json(200, atlas_view(store, self.user(), group))
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
    server = HTTPServer(('127.0.0.1', port), handler_for(store))
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
