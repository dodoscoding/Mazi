"""Loopback-only Memory answers, inheriting import/review/discovery routes."""
import json
import os
import threading
from http.server import HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from phase1.core import Conflict, Denied
from phase5.server import handler_for as discovery_handler, worker
from .answers import AnswerStore

STATIC = Path(__file__).parent


def handler_for(store):
    class Handler(discovery_handler(store)):
        def send(self, status, body, content_type='application/json', cookie=None):
            if content_type.startswith('text/html') and urlsplit(self.path).path in ('/', '/review', '/places', '/discover'):
                body = body.replace(b'</header>', b'<a href="/ask">Memory answers</a></header>', 1)
            return super().send(status, body, content_type, cookie)

        def do_GET(self):
            parts = urlsplit(self.path)
            files = {'/ask': ('index.html', 'text/html'), '/answer-evidence': ('evidence.html', 'text/html'), '/answers.js': ('answers.js', 'text/javascript'), '/answer-evidence.js': ('evidence.js', 'text/javascript')}
            if parts.path in files:
                name, mime = files[parts.path]
                return self.send(200, (STATIC / name).read_bytes(), mime + '; charset=utf-8')
            if not parts.path.startswith('/api/answers/'):
                return super().do_GET()
            try:
                user = self.user()
                query = {key: values[0] for key, values in parse_qs(parts.query).items()}
                if parts.path == '/api/answers/state':
                    return self.json(200, store.answer_settings(user, query['group']))
                if parts.path == '/api/answers/evidence':
                    return self.json(200, store.evidence(user, query['group'], query['asset']))
                return self.json(404, {'error': 'Not found'})
            except Denied as exc:
                self.json(403, {'error': str(exc)})
            except (KeyError, TypeError, ValueError):
                self.json(400, {'error': 'Invalid request'})

        def do_POST(self):
            path = urlsplit(self.path).path
            if not path.startswith('/api/answers/'):
                return super().do_POST()
            try:
                origin = self.headers.get('Origin')
                if origin and origin != 'http://' + self.headers.get('Host', ''):
                    raise Denied('Invalid origin')
                if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                    raise ValueError('JSON required')
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= 4096:
                    raise ValueError('Invalid size')
                body = json.loads(self.rfile.read(size))
                if not isinstance(body, dict) or not isinstance(body.get('group'), str) or len(body['group']) > 200:
                    raise ValueError('Invalid request')
                user = self.user()
                if path == '/api/answers/ask':
                    return self.json(200, store.answer(user, body['group'], body['question']))
                if path == '/api/answers/processing':
                    store.answer_processing(user, body['group'], body['enabled'], body.get('group_wide', False))
                    return self.json(200, {'ok': True})
                return self.json(404, {'error': 'Not found'})
            except Denied as exc:
                self.json(403, {'error': str(exc)})
            except Conflict as exc:
                self.json(409, {'error': str(exc)})
            except (KeyError, ValueError, TypeError):
                self.json(400, {'error': 'Invalid request'})
    return Handler


def main():
    root = Path(os.environ.get('MAZI_IMPORT_DATA_DIR', '.mazi-imports'))
    port = int(os.environ.get('MAZI_IMPORT_PORT', '8004'))
    store = AnswerStore(root)
    stop = threading.Event()
    background = threading.Thread(target=worker, args=(root, stop), daemon=True)
    server = HTTPServer(('127.0.0.1', port), handler_for(store))
    background.start()
    print(f'Mazi Memory answers: http://127.0.0.1:{port}/ask', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        stop.set()
        background.join(timeout=35)
        server.server_close()
        store.close()


if __name__ == '__main__':
    main()
