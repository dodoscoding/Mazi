SET search_path TO mazi, pg_catalog;
CREATE TABLE IF NOT EXISTS discord_link_requests (
 state TEXT PRIMARY KEY, user_id TEXT NOT NULL, group_id TEXT NOT NULL, expires_at DOUBLE PRECISION NOT NULL
);
CREATE TABLE IF NOT EXISTS discord_guilds (
 group_id TEXT NOT NULL, guild_id TEXT NOT NULL, name TEXT NOT NULL, linked_by TEXT NOT NULL,
 linked_at DOUBLE PRECISION NOT NULL, PRIMARY KEY(group_id,guild_id)
);
ALTER TABLE discord_link_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_access ON discord_link_requests TO mazi_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON discord_link_requests TO mazi_app;
REVOKE ALL ON discord_link_requests FROM PUBLIC, anon, authenticated;
ALTER TABLE discord_guilds ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_access ON discord_guilds TO mazi_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON discord_guilds TO mazi_app;
REVOKE ALL ON discord_guilds FROM PUBLIC, anon, authenticated;
