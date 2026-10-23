import re
import unittest
from pathlib import Path

from mazi.sources.sources import SCHEMA

MIGRATION = Path(__file__).parents[3] / 'infra/hosted/supabase/migrations/20261024090000_place_removals.sql'


class PlaceRemovalSchemaTests(unittest.TestCase):
    def test_hosted_migration_matches_local_table(self):
        table = re.compile(r'CREATE TABLE IF NOT EXISTS place_removals \(.*?\);', re.S)
        self.assertEqual(table.search(MIGRATION.read_text()).group(), table.search(SCHEMA).group())
        self.assertIn('CREATE POLICY runtime_access ON place_removals TO mazi_app', MIGRATION.read_text())
