"""Byte compatibility of incrementally encoded private JSON responses."""
import json
import unittest

from mazi.identity.server import handler_for


class JsonResponseTests(unittest.TestCase):
    def test_incremental_encoding_preserves_default_json_bytes_and_cookie(self):
        handler = object.__new__(handler_for(None))
        sent = []
        handler.send = lambda status, body, **options: sent.append((status, body, options))
        value = {'names': ['Ana', '雪', '❤️'], 'escaped': '\n"\\',
                 'facts': [None, True, False, 3, -1.25, {'nested': []}]}
        handler.json(200, value, cookie='mazi_session=synthetic')
        self.assertEqual(sent, [(200, json.dumps(value).encode(), {'cookie': 'mazi_session=synthetic'})])

    def test_encoding_failure_does_not_send_headers_or_partial_response(self):
        handler = object.__new__(handler_for(None))
        sent = []
        handler.send = lambda *args, **options: sent.append((args, options))
        with self.assertRaises(TypeError):
            handler.json(200, {'prefix': 'encoded first', 'unsupported': object()})
        self.assertEqual(sent, [])
