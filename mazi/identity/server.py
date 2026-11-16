"""Local M1 pilot HTTP interface. Bind only to localhost."""

from __future__ import annotations

from mazi.persistence import ArchiveBusy
from mazi.http_origin import validate_origin

import base64
import json
import io
import os
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from .core import Conflict, Denied, Store




def handler_for(store: Store):
    class Handler(BaseHTTPRequestHandler):
        def send_headers(self, status: int, length: int, content_type: str, cookie: str | None = None):
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(length))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
            if cookie is not None:
                self.send_header("Set-Cookie", cookie)
            self.end_headers()

        def send(self, status: int, body: bytes, content_type: str = "application/json", cookie: str | None = None):
            self.send_headers(status, len(body), content_type, cookie)
            self.wfile.write(body)

        def json(self, status: int, value, cookie: str | None = None):
            body = io.BytesIO()
            for fragment in json.JSONEncoder().iterencode(value):
                body.write(fragment.encode())
            self.send(status, body.getvalue(), cookie=cookie)

        def token(self):
            cookie = SimpleCookie()
            try:
                cookie.load(self.headers.get("Cookie", ""))
                return cookie["mazi_session"].value if "mazi_session" in cookie else None
            except Exception:
                return None

        def user(self):
            return store.shared_session(self.token())["user_id"] if store.shared_mode else store.user_for_token(self.token())

        def do_GET(self):
            parts = urlsplit(self.path)
            path = parts.path
            try:
                if path == "/api/session":
                    return self.json(200, store.shared_session(self.token()))
                user = self.user()
                query = parse_qs(parts.query)
                if path == "/api/groups":
                    return self.json(200, store.groups_for(user))
                if path == "/api/members":
                    return self.json(200, store.members_for(user, query.get("group", [""])[0]))
                if path == "/api/timeline":
                    return self.json(200, store.timeline(user, query.get("group", [""])[0],
                                                         query=query.get("q", [""])[0],
                                                         offset=int(query.get("offset", ["0"])[0]),
                                                         limit=int(query.get("limit", ["20"])[0])))
                if path == "/api/export":
                    return self.json(200, store.export_group(user, query.get("group", [""])[0]))
                if path.startswith("/api/upload/"):
                    return self.json(200, store.upload_status(user, path.rsplit("/", 1)[1]))
                if path == "/api/owned-media":
                    return self.json(200, store.owned_media(user, query.get("group", [""])[0]))
                if path == "/api/owned-memories":
                    return self.json(200, store.owned_memories(user, query.get("group", [""])[0]))
                if path.startswith("/api/memory/"):
                    return self.json(200, store.memory_view(user, path.rsplit("/", 1)[1]))
                if path.startswith("/api/media/"):
                    bits = path.split("/")
                    if len(bits) == 5 and bits[4] in ("preview", "original"):
                        data = store.media_bytes(user, bits[3], bits[4] == "original")
                        return self.send(200, data, "image/jpeg" if bits[4] == "preview" else "application/octet-stream")
                    return self.json(200, store.media_view(user, bits[3]))
                self.json(404, {"error": "Not found"})
            except ArchiveBusy:
                return self.json(503, {"error": "Archive is busy; retry shortly"})
            except Denied as exc:
                self.json(403, {"error": str(exc)})
            except (ValueError, IndexError):
                self.json(400, {"error": "Invalid request"})

        def do_POST(self):
            path = urlsplit(self.path).path
            try:
                origin = self.headers.get("Origin")
                host = self.headers.get("Host", "")
                validate_origin(origin, host)
                if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                    raise Denied("JSON required")
                length = int(self.headers.get("Content-Length", "0"))
                if length <= 0 or length > 28 * 1024 * 1024:
                    raise Denied("Invalid request size")
                body = json.loads(self.rfile.read(length))
                if not isinstance(body, dict):
                    raise ValueError("Expected object")
                if path == "/api/entry":
                    profile, token = store.enter_shared(code=body.get("code"), name=body.get("name"))
                    secure = "; Secure" if origin == f"https://{host}" else ""
                    return self.json(200, profile, f"mazi_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000{secure}")
                if store.shared_mode and path in {"/api/register", "/api/login", "/api/accept", "/api/group", "/api/invite", "/api/invite/revoke"}:
                    raise Denied("Use shared-code entry")
                if path == "/api/logout":
                    if self.token():
                        store.logout(self.token())
                    return self.json(200, {"ok": True}, "mazi_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0")
                if path == "/api/introduction/complete":
                    store.complete_introduction(self.token())
                    return self.json(200, store.shared_session(self.token()))
                if path == "/api/register":
                    store.register(body["email"], body["password"])
                    return self.json(201, {"ok": True})
                if path == "/api/login":
                    token = store.login(body["email"], body["password"])
                    cookie = f"mazi_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400"
                    return self.json(200, {"ok": True}, cookie)
                user = self.user()
                if path == "/api/logout":
                    store.logout(self.token())
                    return self.json(200, {"ok": True}, "mazi_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0")
                if path == "/api/group":
                    return self.json(201, {"id": store.create_group(user, body["name"])})
                if path == "/api/invite":
                    return self.json(201, {"token": store.invite(user, body["group"])})
                if path == "/api/accept":
                    return self.json(200, {"group": store.accept(user, body["token"])})
                if path == "/api/invite/revoke":
                    store.revoke_invite(user, body["group"], body["token"])
                    return self.json(200, {"ok": True})
                if path == "/api/member/remove":
                    store.remove_member(user, body["group"], body["user"])
                    return self.json(200, {"ok": True})
                if path == "/api/upload/start":
                    return self.json(201, {"id": store.begin_upload(
                        user, body["group"], body["filename"], body["size"],
                        body["sha256"], body.get("caption", ""), body.get("capture_date"))})
                if path == "/api/upload/chunk":
                    data = base64.b64decode(body["data"], validate=True)
                    return self.json(200, {"received": store.upload_chunk(
                        user, body["id"], body["offset"], data)})
                if path == "/api/upload/finish":
                    return self.json(200, {"id": store.finish_upload(user, body["id"])})
                if path == "/api/upload":
                    data = base64.b64decode(body["data"], validate=True)
                    return self.json(201, {"id": store.upload_image(
                        user, body["group"], body["filename"], data,
                        body.get("caption", ""), body.get("capture_date"))})
                if path == "/api/media/publish":
                    store.publish_media(user, body["id"], body["components"],
                                        body["audience"], body.get("recipients"), body["version"])
                    return self.json(200, {"ok": True})
                if path == "/api/media/revoke":
                    store.revoke_media(user, body["id"])
                    return self.json(200, {"ok": True})
                if path == "/api/media/delete":
                    store.delete_media(user, body["id"])
                    return self.json(200, {"ok": True})
                if path == "/api/memory":
                    return self.json(201, {"id": store.create_memory(
                        user, body["group"], body["title"], body["media_ids"])})
                if path == "/api/memory/publish":
                    store.publish_memory(user, body["id"], body["audience"],
                                         body.get("recipients"), body["version"])
                    return self.json(200, {"ok": True})
                if path == "/api/memory/revoke":
                    store.revoke_memory(user, body["id"])
                    return self.json(200, {"ok": True})
                if path == "/api/memory/delete":
                    store.delete_memory(user, body["id"])
                    return self.json(200, {"ok": True})
                self.json(404, {"error": "Not found"})
            except (KeyError, ValueError, TypeError, json.JSONDecodeError) as exc:
                self.json(400, {"error": "Invalid request"})
            except Conflict as exc:
                self.json(409, {"error": str(exc)})
            except ArchiveBusy:
                return self.json(503, {"error": "Archive is busy; retry shortly"})
            except Denied as exc:
                self.json(403, {"error": str(exc)})

    return Handler

