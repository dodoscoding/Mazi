"""Local review screen and API. Bind only to localhost."""
from __future__ import annotations

import json
import os
import threading
from http.server import HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from mazi.identity.core import Conflict, Denied
from mazi.imports.server import handler_for as import_handler
from mazi.imports.server import worker
from .review import ReviewStore



def handler_for(store):
    class Handler(import_handler(store)):
        def do_GET(self):
            parts = urlsplit(self.path)
            path = parts.path
            if path == "/health":
                try:
                    store.db.execute("SELECT 1").fetchone()
                    return self.json(200, {"status": "ok"})
                except Exception:
                    return self.json(503, {"status": "unavailable"})
            if not path.startswith("/api/review/"):
                return super().do_GET()
            try:
                user = self.user()
                query = parse_qs(parts.query)
                group = query.get("group", [""])[0]
                offset = int(query.get("offset", ["0"])[0])
                if path == "/api/review/timeline":
                    return self.json(200, store.timeline(user, group, offset, query=query.get("q", [""])[0]))
                if path == "/api/review/duplicates":
                    return self.json(200, store.duplicate_suggestions(user, group))
                if path == "/api/review/reviewed-pairs":
                    return self.json(200, store.reviewed_pairs(user, group))
                if path == "/api/review/my-contributions":
                    return self.json(200, store.owned_origins(user, group))
                if path == "/api/review/metrics":
                    return self.json(200, store.group_metrics(user, group))
                if path == "/api/review/events":
                    return self.json(200, store.event_suggestions(user, group))
                if path == "/api/review/accepted-events":
                    return self.json(200, store.accepted_events(user, group))
                if path == "/api/review/reviewed-events":
                    return self.json(200, store.reviewed_events(user, group))
                if path == "/api/review/on-this-day":
                    return self.json(200, store.on_this_day(user, group))
                if path == "/api/review/export":
                    return self.send(200, store.export_archive(user, group), "application/zip")
                if path.startswith("/api/review/rendition/"):
                    return self.send(200, store.rendition_bytes(user, path.rsplit("/", 1)[1]), "image/jpeg")
                self.json(404, {"error": "Not found"})
            except Denied as exc:
                self.json(403, {"error": str(exc)})
            except (ValueError, TypeError):
                self.json(400, {"error": "Invalid request"})
            except OSError:
                self.json(503, {"error": "Stored file unavailable; retry later"})

        def do_POST(self):
            path = urlsplit(self.path).path
            if not path.startswith("/api/review/"):
                return super().do_POST()
            try:
                origin, host = self.headers.get("Origin"), self.headers.get("Host", "")
                if origin and origin != f"http://{host}":
                    raise Denied("Invalid origin")
                if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                    raise ValueError("JSON required")
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= 64 * 1024:
                    raise ValueError("Invalid request size")
                body = json.loads(self.rfile.read(length))
                if not isinstance(body, dict):
                    raise ValueError("Expected object")
                user = self.user()
                if path == "/api/review/correct":
                    store.correct_asset(user, body["asset"], title=body.get("title", ""),
                                        capture_date=body.get("capture_date"), place=body.get("place", ""),
                                        anniversary=body.get("anniversary", False))
                elif path == "/api/review/pair":
                    store.review_pair(user, body["group"], body["left"], body["right"], body["action"])
                elif path == "/api/review/rendition":
                    store.select_rendition(user, body["group"], body["asset"], body["selected"])
                elif path == "/api/review/delete-contribution":
                    store.delete_origin(user, body["origin"])
                elif path == "/api/review/leave-group":
                    store.leave_group(user, body["group"])
                elif path == "/api/review/event":
                    return self.json(200, {"id": store.review_event(user, body["group"], body["assets"],
                                                                       body.get("title", ""), body["decision"])})
                else:
                    return self.json(404, {"error": "Not found"})
                self.json(200, {"ok": True})
            except Denied as exc:
                self.json(403, {"error": str(exc)})
            except Conflict as exc:
                self.json(409, {"error": str(exc)})
            except (KeyError, ValueError, TypeError):
                self.json(400, {"error": "Invalid request"})

    return Handler

