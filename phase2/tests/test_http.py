import base64
import hashlib
import http.client
import json
import tempfile
import threading
import unittest
from http.server import HTTPServer

from phase2.engine import ImportStore
from phase2.server import handler_for
from test_adapters import zip_bytes
from test_engine import picture


class HttpTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = ImportStore(self.temp.name)
        self.alice = self.store.register("alice@example.test", "correct horse battery")
        self.ben = self.store.register("ben@example.test", "correct horse battery")
        self.group = self.store.create_group(self.alice, "Friends")
        self.store.accept(self.ben, self.store.invite(self.alice, self.group))
        self.alice_token = self.store.login("alice@example.test", "correct horse battery")
        self.ben_token = self.store.login("ben@example.test", "correct horse battery")
        self.server = HTTPServer(("127.0.0.1", 0), handler_for(self.store))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.thread.join()
        self.server.server_close()
        self.store.close()
        self.temp.cleanup()

    def request(self, path, body=None, token=None, origin=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port)
        headers = {"Cookie": "mazi_session=" + (token or self.alice_token)}
        if origin:
            headers["Origin"] = origin
        if body is not None:
            headers["Content-Type"] = "application/json"
        connection.request("GET" if body is None else "POST", path, json.dumps(body) if body is not None else None, headers)
        response = connection.getresponse()
        data = response.read()
        result = (response.status, dict(response.getheaders()), data)
        connection.close()
        return result

    def test_http_flow_permissions_headers_and_media(self):
        data = zip_bytes({"chat.txt": "01/01/2020, 12:00 - Ana: a.jpg (file attached)\n<script>alert(1)</script>", "a.jpg": picture()})
        body = {"group": self.group, "source": "whatsapp", "namespace": "account", "size": len(data),
                "sha256": hashlib.sha256(data).hexdigest()}
        self.assertEqual(self.request("/api/imports/start", body, origin="https://evil.test")[0], 403)
        code, headers, result = self.request("/api/imports/start", body)
        self.assertEqual(code, 201)
        self.assertEqual(headers["Cache-Control"], "no-store")
        run = json.loads(result)["id"]
        self.assertEqual(self.request("/api/imports/" + run, token=self.ben_token)[0], 403)
        self.assertEqual(self.request("/api/imports/chunk", {"id": run, "offset": 0, "data": base64.b64encode(data).decode()})[0], 200)
        self.assertEqual(self.request("/api/imports/finish", {"id": run})[0], 200)
        self.store.scan(run)
        self.assertEqual(self.request("/api/imports/confirm", {"id": run})[0], 200)
        while self.store.work_once():
            pass
        code, _, gallery = self.request("/api/archive?group=" + self.group, token=self.ben_token)
        self.assertEqual(code, 200)
        asset = json.loads(gallery)[0]["id"]
        self.assertEqual(self.request(f"/api/archive/{asset}/origins", token=self.ben_token)[0], 200)
        self.assertEqual(self.request(f"/api/archive/{asset}/original", token=self.ben_token)[2], picture())
        self.store.remove_member(self.alice, self.group, self.ben)
        self.assertEqual(self.request(f"/api/archive/{asset}/preview", token=self.ben_token)[0], 403)
        self.assertEqual(self.request(f"/api/archive/{asset}/origins", token=self.ben_token)[0], 403)
        self.assertEqual(self.request("/api/imports/withdraw", {"id": run})[0], 200)
        self.assertEqual(self.request(f"/api/archive/{asset}/original")[0], 403)

    def test_bad_requests_and_static_content_security_policy(self):
        for body in ([], {"source": "bogus"}, {"group": self.group, "source": "manual", "namespace": {}, "size": 1, "sha256": "a" * 64}):
            self.assertEqual(self.request("/api/imports/start", body)[0], 400)
        status, headers, html = self.request("/")
        self.assertEqual(status, 200)
        self.assertIn("frame-ancestors 'none'", headers["Content-Security-Policy"])
        self.assertIn(b"Start importing to group", html)
        self.assertEqual(self.request("/api/archive?group=" + self.group + "&offset=-1")[0], 400)


if __name__ == "__main__":
    unittest.main()
