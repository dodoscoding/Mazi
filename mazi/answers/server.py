"""Loopback-only Memory answers, inheriting import/review/discovery routes."""
import json

from mazi.persistence import ArchiveBusy
from mazi.http_origin import validate_origin
import os
import threading
from http.server import HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from mazi.identity.core import Conflict, Denied
from mazi.discovery.server import handler_for as discovery_handler, worker
from .answers import AnswerStore



def handler_for(store):
    class Handler(discovery_handler(store)):
        def do_GET(self):
            parts = urlsplit(self.path)
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
            except ArchiveBusy:
                return self.json(503, {"error": "Archive is busy; retry shortly"})
            except Denied as exc:
                self.json(403, {'error': str(exc)})
            except (KeyError, TypeError, ValueError):
                self.json(400, {'error': 'Invalid request'})

        def do_POST(self):
            path = urlsplit(self.path).path
            if not path.startswith('/api/answers/'):
                return super().do_POST()
            try:
                validate_origin(self.headers.get('Origin'), self.headers.get('Host', ''))
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
            except ArchiveBusy:
                return self.json(503, {"error": "Archive is busy; retry shortly"})
            except Denied as exc:
                self.json(403, {'error': str(exc)})
            except Conflict as exc:
                self.json(409, {'error': str(exc)})
            except (KeyError, ValueError, TypeError):
                self.json(400, {'error': 'Invalid request'})
    return Handler

