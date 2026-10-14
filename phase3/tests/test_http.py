import hashlib
import http.client
import json
import sys
import tempfile
import threading
import unittest
from http.server import HTTPServer
from pathlib import Path

from phase3.review import ReviewStore
from phase3.server import handler_for

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "phase2" / "tests"))
from test_adapters import zip_bytes
from test_engine import picture


class ReviewHttpTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = ReviewStore(self.temp.name)
        self.alice = self.store.register("alice@example.test", "correct horse battery")
        self.outsider = self.store.register("outsider@example.test", "correct horse battery")
        self.group = self.store.create_group(self.alice, "Friends")
        self.token = self.store.login("alice@example.test", "correct horse battery")
        self.outsider_token = self.store.login("outsider@example.test", "correct horse battery")
        data = zip_bytes({"photo.jpg": picture()})
        run = self.store.begin_import(self.alice, self.group, "manual", "account", len(data), hashlib.sha256(data).hexdigest(), {})
        self.store.write_chunk(self.alice, run, 0, data)
        self.store.finish_transfer(self.alice, run)
        self.store.scan(run)
        self.store.confirm(self.alice, run)
        while self.store.work_once():
            pass
        self.asset = self.store.gallery(self.alice, self.group)[0]["id"]
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
        headers = {"Cookie": "mazi_session=" + (token or self.token)}
        if body is not None:
            headers["Content-Type"] = "application/json"
        if origin:
            headers["Origin"] = origin
        connection.request("GET" if body is None else "POST", path,
                           json.dumps(body) if body is not None else None, headers)
        response = connection.getresponse()
        result = response.status, response.read()
        connection.close()
        return result

    def test_review_endpoints_authorization_and_withdrawal(self):
        timeline = f"/api/review/timeline?group={self.group}"
        self.assertEqual(self.request("/health")[0], 200)
        self.assertEqual(json.loads(self.request(f"/api/review/metrics?group={self.group}")[1])["visible_assets"], 1)
        self.assertEqual(self.request(f"/api/review/metrics?group={self.group}", token=self.outsider_token)[0], 403)
        self.assertEqual(self.request(timeline)[0], 200)
        self.assertEqual(self.request(timeline, token=self.outsider_token)[0], 403)
        self.assertEqual(self.request(f"/api/review/export?group={self.group}", token=self.outsider_token)[0], 403)
        self.assertEqual(self.request("/api/review/correct", {"asset": self.asset, "title": "Day",
                                                       "capture_date": "2020-10-06", "place": "Home", "anniversary": True},
                                      origin="https://evil.test")[0], 403)
        self.assertEqual(self.request("/api/review/correct", {"asset": self.asset, "title": "Day",
                                                       "capture_date": "2020-10-06", "place": "Home", "anniversary": True})[0], 200)
        self.assertEqual(json.loads(self.request(timeline)[1])["items"][0]["title"], "Day")
        self.assertEqual(self.request(f"/api/review/rendition/{self.asset}")[0], 200)
        self.store.withdraw(self.alice, self.store.db.execute("SELECT id FROM import_runs").fetchone()[0])
        self.assertEqual(self.request(f"/api/review/rendition/{self.asset}")[0], 403)
        self.assertEqual(json.loads(self.request(timeline)[1])["total"], 0)


if __name__ == "__main__":
    unittest.main()
