"""Export event ordering uses columns present in the hosted schema."""
import sqlite3
import unittest

from mazi.discovery.discovery import DiscoveryStore


class HostedEventDatabase:
    hosted = True

    def __init__(self):
        self.connection = sqlite3.connect(':memory:')
        self.connection.row_factory = sqlite3.Row
        self.connection.executescript('''
            CREATE TABLE review_events(id TEXT PRIMARY KEY,group_id TEXT,asset_ids TEXT,title TEXT,status TEXT,updated_at TEXT);
            CREATE TABLE discovery_hidden_events("user" TEXT,event TEXT);
            INSERT INTO review_events VALUES('event-b','group','["a","b"]','Second','accepted','2026-10-22');
            INSERT INTO review_events VALUES('event-a','group','["a","b"]','First','accepted','2026-10-22');
        ''')

    def execute(self, query, params=()):
        return self.connection.execute(query, params)


class ExportPostgresOrderingTests(unittest.TestCase):
    def setUp(self):
        self.database = HostedEventDatabase()
        self.addCleanup(self.database.connection.close)
        self.store = DiscoveryStore.__new__(DiscoveryStore)
        self.store.db = self.database
        self.store._visible_ids = lambda user, group: ['a', 'b']

    def test_people_memory_ties_use_existing_hosted_id_column(self):
        self.assertEqual(list(self.store._export_person_memories('reader', 'group', {'a', 'b'}, {'a'})),
                         [dict(id='event-a', title='First'), dict(id='event-b', title='Second')])

    def test_hidden_memory_ties_use_existing_hosted_id_column(self):
        self.database.execute('INSERT INTO discovery_hidden_events VALUES(?,?)', ('reader', 'event-b'))
        self.database.execute('INSERT INTO discovery_hidden_events VALUES(?,?)', ('reader', 'event-a'))
        self.assertEqual(list(self.store._export_personal('reader', 'group', 'hidden_memories')),
                         [dict(id='event-a', title='First'), dict(id='event-b', title='Second')])
