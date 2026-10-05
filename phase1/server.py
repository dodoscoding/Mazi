"""Local M1 pilot HTTP interface. Bind only to localhost."""

from __future__ import annotations

import base64
import json
import os
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from .core import Conflict, Denied, Store


HTML = (Path(__file__).with_name("index.html")).read_bytes()


def handler_for(store: Store):
    class Handler(BaseHTTPRequestHandler):
        def send(self, status: int, body: bytes, content_type: str = "application/json", cookie: str | None = None):
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
            if cookie is not None:
                self.send_header("Set-Cookie", cookie)
            self.end_headers()
            self.wfile.write(body)

        def json(self, status: int, value, cookie: str | None = None):
            self.send(status, json.dumps(value).encode(), cookie=cookie)

        def token(self):
            cookie = SimpleCookie()
            try:
                cookie.load(self.headers.get("Cookie", ""))
                return cookie["mazi_session"].value if "mazi_session" in cookie else None
            except Exception:
                return None

        def user(self):
            return store.user_for_token(self.token())

        def do_GET(self):
            parts = urlsplit(self.path)
            path = parts.path
            try:
                if path == "/":
                    return self.send(200, HTML, "text/html; charset=utf-8")
                if path == "/app.js":
                    return self.send(200, Path(__file__).with_name("app.js").read_bytes(), "text/javascript; charset=utf-8")
                user = self.user()
                query = parse_qs(parts.query)
                if path == "/api/groups":
                    return self.json(200, store.groups_for(user))
                if path == "/api/timeline":
                    return self.json(200, store.timeline(user, query.get("group", [""])[0], query.get("q", [""])[0]))
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
            except Denied as exc:
                self.json(403, {"error": str(exc)})
            except (ValueError, IndexError):
                self.json(400, {"error": "Invalid request"})

        def do_POST(self):
            path = urlsplit(self.path).path
            try:
                origin = self.headers.get("Origin")
                host = self.headers.get("Host", "")
                if origin and origin not in (f"http://{host}", f"https://{host}"):
                    raise Denied("Invalid origin")
                if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                    raise Denied("JSON required")
                length = int(self.headers.get("Content-Length", "0"))
                if length <= 0 or length > 28 * 1024 * 1024:
                    raise Denied("Invalid request size")
                body = json.loads(self.rfile.read(length))
                if not isinstance(body, dict):
                    raise ValueError("Expected object")
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
                if path == "/api/memory":
                    return self.json(201, {"id": store.create_memory(
                        user, body["group"], body["title"], body["media_ids"])})
                if path == "/api/memory/publish":
                    store.publish_memory(user, body["id"], body["audience"],
                                         body.get("recipients"), body["version"])
                    return self.json(200, {"ok": True})
                self.json(404, {"error": "Not found"})
            except (KeyError, ValueError, TypeError, json.JSONDecodeError) as exc:
                self.json(400, {"error": "Invalid request"})
            except Conflict as exc:
                self.json(409, {"error": str(exc)})
            except Denied as exc:
                self.json(403, {"error": str(exc)})

    return Handler


def main():
    root = Path(os.environ.get("MAZI_DATA_DIR", ".mazi-pilot"))
    store = Store(root)
    print("Mazi M1 pilot: http://127.0.0.1:8000")
    try:
        HTTPServer(("127.0.0.1", 8000), handler_for(store)).serve_forever()
    finally:
        store.close()


if __name__ == "__main__":
    main()
