import hashlib
import http.client
import json
import sys
import tempfile
import threading
import unittest
from http.server import HTTPServer
from pathlib import Path

from mazi.archive.review import ReviewStore
from mazi.archive.server import handler_for

from tests.backend.imports.test_adapters import zip_bytes
from tests.backend.imports.test_engine import picture


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

    def test_selected_photo_contributions_are_scoped_and_owner_only(self):
        path = f"/api/review/my-contributions?group={self.group}"
        status, body = self.request(path + "&asset=" + self.asset)
        self.assertEqual(status, 200)
        owned = json.loads(body)
        self.assertEqual(len(owned), 1)
        self.assertEqual(owned[0]["asset"], self.asset)
        self.assertEqual(json.loads(self.request(path + "&asset=unavailable-photo")[1]), [])
        self.assertEqual(self.request(path + "&asset=" + self.asset, token=self.outsider_token)[0], 403)
        self.assertEqual(self.request("/api/review/delete-contribution", {"origin": owned[0]["id"]},
                                      token=self.outsider_token)[0], 403)
        self.assertEqual(self.request("/api/review/delete-contribution", {"origin": owned[0]["id"]})[0], 200)
        self.assertEqual(json.loads(self.request(path + "&asset=" + self.asset)[1]), [])
        self.assertEqual(self.request(f"/api/review/rendition/{self.asset}")[0], 403)

    def test_review_place_reports_how_it_matched_the_map(self):
        ben = self.store.register("ben@example.test", "correct horse battery")
        self.store.accept(ben, self.store.invite(self.alice, self.group))
        token = self.store.login("ben@example.test", "correct horse battery")
        def correct(place):
            status, body = self.request("/api/review/correct", {"asset": self.asset, "title": "", "capture_date": None, "place": place}, token=token)
            self.assertEqual(status, 200)
            return json.loads(body)
        self.assertEqual(correct("girne"), {"ok": True, "place_match": "matched", "place": "Kyrenia, CY", "candidates": []})
        self.assertEqual(correct("Victoria"), {"ok": True, "place_match": "ambiguous", "place": None, "candidates": [
            "Victoria, British Columbia, CA", "Victoria, Texas, US", "Victoria, SC", "Victoria, Entre Ríos, AR", "Victoria, La Araucanía, CL"]})
        self.assertEqual(correct("Nowhereville"), {"ok": True, "place_match": "missing", "place": None, "candidates": []})
        self.assertEqual(json.loads(self.request(f"/api/review/timeline?group={self.group}", token=token)[1])["items"][0]["place"], "nowhereville")
        self.assertEqual(correct(""), {"ok": True, "place_match": "empty", "place": None, "candidates": []})

    def test_suggestion_reads_and_decisions_require_circle_membership(self):
        for queue in ("duplicates", "reviewed-pairs", "events", "reviewed-events"):
            with self.subTest(queue=queue):
                self.assertEqual(self.request(f"/api/review/{queue}?group={self.group}",
                                              token=self.outsider_token)[0], 403)
        for action in ("merge", "dismiss", "undo"):
            with self.subTest(pair_action=action):
                self.assertEqual(self.request("/api/review/pair", {
                    "group": self.group, "left": self.asset, "right": "unavailable-asset", "action": action,
                }, token=self.outsider_token)[0], 403)
        for decision in ("accept", "reject", "undo"):
            with self.subTest(event_decision=decision):
                self.assertEqual(self.request("/api/review/event", {
                    "group": self.group, "assets": [self.asset, "unavailable-asset"],
                    "title": "Unavailable event", "decision": decision,
                }, token=self.outsider_token)[0], 403)

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
