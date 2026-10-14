"""Local import UI plus the existing account/group endpoints."""
from __future__ import annotations

from mazi.persistence import ArchiveBusy

import base64
import json
import os
import threading
from http.server import HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from mazi.identity.core import Conflict, Denied
from mazi.identity.server import handler_for as identity_handler
from .engine import ImportStore



def handler_for(store):
    class Handler(identity_handler(store)):
        def log_message(self, format, *args):
            # URLs can include private names or identifiers; avoid request logging.
            pass

        def do_GET(self):
            parts = urlsplit(self.path)
            path = parts.path
            if not path.startswith(("/api/imports", "/api/archive")):
                return super().do_GET()
            try:
                user = self.user()
                query = parse_qs(parts.query)
                group = query.get("group", [""])[0]
                offset = int(query.get("offset", ["0"])[0])
                if path == "/api/imports":
                    return self.json(200, store.imports_for(user, group))
                if path.startswith("/api/imports/"):
                    return self.json(200, store.report(user, path.rsplit("/", 1)[1], offset))
                if path == "/api/archive":
                    return self.json(200, store.gallery(user, group, offset))
                bits = path.split("/")
                if len(bits) == 5 and bits[4] == "origins":
                    return self.json(200, store.origins(user, bits[3], offset))
                if len(bits) == 5 and bits[3] and bits[4] in ("preview", "original"):
                    data = store.asset_bytes(user, bits[3], bits[4] == "original")
                    return self.send(200, data, "image/jpeg" if bits[4] == "preview" else "application/octet-stream")
                self.json(404, {"error": "Not found"})
            except ArchiveBusy:
                return self.json(503, {"error": "Archive is busy; retry shortly"})
            except Denied as exc:
                self.json(403, {"error": str(exc)})
            except (ValueError, TypeError):
                self.json(400, {"error": "Invalid request"})
            except OSError:
                self.json(503, {"error": "Stored file unavailable; retry later"})

        def do_POST(self):
            path = urlsplit(self.path).path
            if not path.startswith("/api/imports/"):
                return super().do_POST()
            try:
                origin, host = self.headers.get("Origin"), self.headers.get("Host", "")
                if origin and origin != f"http://{host}":
                    raise Denied("Invalid origin")
                if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                    raise ValueError("JSON required")
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= 768 * 1024:
                    raise ValueError("Invalid request size")
                body = json.loads(self.rfile.read(length))
                if not isinstance(body, dict):
                    raise ValueError("Expected object")
                user = self.user()
                if path == "/api/imports/start":
                    run = store.begin_import(user, body["group"], body["source"], body["namespace"],
                                             body["size"], body["sha256"], body.get("options", {}))
                    return self.json(201, {"id": run})
                run = body["id"]
                if path == "/api/imports/chunk":
                    received = store.write_chunk(user, run, body["offset"], base64.b64decode(body["data"], validate=True))
                    return self.json(200, {"received": received})
                actions = {"finish": lambda: store.finish_transfer(user, run),
                           "confirm": lambda: store.confirm(user, run), "cancel": lambda: store.cancel(user, run),
                           "withdraw": lambda: store.withdraw(user, run), "retry": lambda: store.retry(user, run, body["item"])}
                action = actions.get(path.rsplit("/", 1)[-1])
                if action is None:
                    return self.json(404, {"error": "Not found"})
                action()
                self.json(200, {"ok": True})
            except ArchiveBusy:
                return self.json(503, {"error": "Archive is busy; retry shortly"})
            except Denied as exc:
                self.json(403, {"error": str(exc)})
            except Conflict as exc:
                self.json(409, {"error": str(exc)})
            except (KeyError, ValueError, TypeError):
                self.json(400, {"error": "Invalid request"})
            except OSError:
                self.json(503, {"error": "Storage temporarily unavailable; retry later"})

    return Handler


def worker(root, stop):
    store = ImportStore(root)
    try:
        while not stop.is_set():
            if not store.work_once():
                store.reconcile()
                stop.wait(0.5)
    finally:
        store.close()

