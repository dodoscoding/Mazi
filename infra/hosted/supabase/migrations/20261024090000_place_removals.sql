SET search_path TO mazi, pg_catalog;
CREATE TABLE IF NOT EXISTS place_removals (
 owner_id TEXT NOT NULL, asset_id TEXT NOT NULL, group_id TEXT NOT NULL, removed_at TEXT NOT NULL,
 PRIMARY KEY(owner_id,asset_id)
);
ALTER TABLE place_removals ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_access ON place_removals TO mazi_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON place_removals TO mazi_app;
REVOKE ALL ON place_removals FROM PUBLIC, anon, authenticated;
