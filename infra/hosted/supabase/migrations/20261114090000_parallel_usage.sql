-- Fiction content remains browser-only. Apply before enabling the sample endpoint.
SET search_path TO mazi, pg_catalog;
CREATE TABLE IF NOT EXISTS parallel_usage (
 group_id TEXT NOT NULL, "user" TEXT NOT NULL, day TEXT NOT NULL,
 chapters INTEGER NOT NULL DEFAULT 0 CHECK (chapters >= 0),
 PRIMARY KEY(group_id,"user",day)
);
CREATE TABLE IF NOT EXISTS parallel_notice (
 group_id TEXT NOT NULL, "user" TEXT NOT NULL, version TEXT NOT NULL,
 accepted_at BIGINT NOT NULL, PRIMARY KEY(group_id,"user")
);
ALTER TABLE parallel_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE parallel_notice ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_access ON parallel_usage TO mazi_app USING (true) WITH CHECK (true);
CREATE POLICY runtime_access ON parallel_notice TO mazi_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON parallel_usage, parallel_notice TO mazi_app;
REVOKE ALL ON parallel_usage, parallel_notice FROM PUBLIC, anon, authenticated;
CREATE FUNCTION parallel_member_departure() RETURNS trigger LANGUAGE plpgsql
SET search_path = mazi, pg_catalog AS $$
BEGIN
 DELETE FROM parallel_notice WHERE group_id=OLD.group_id AND "user"=OLD.user_id;
 RETURN OLD;
END;
$$;
CREATE TRIGGER parallel_member_departure AFTER DELETE ON members
FOR EACH ROW EXECUTE FUNCTION parallel_member_departure();
