SET search_path TO mazi, pg_catalog;

CREATE UNIQUE INDEX IF NOT EXISTS archive_assets_group_identity ON archive_assets(group_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS review_events_group_identity ON review_events(group_id,id);
CREATE TABLE IF NOT EXISTS social_comments (
 id TEXT PRIMARY KEY, group_id TEXT NOT NULL, photo_id TEXT, memory_id TEXT,
 author_id TEXT NOT NULL, content TEXT NOT NULL, revision INTEGER NOT NULL,
 created_at DOUBLE PRECISION NOT NULL, updated_at DOUBLE PRECISION NOT NULL,
 CHECK((photo_id IS NOT NULL AND memory_id IS NULL) OR (photo_id IS NULL AND memory_id IS NOT NULL)),
 FOREIGN KEY(group_id,author_id) REFERENCES members(group_id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(group_id,photo_id) REFERENCES archive_assets(group_id,id) ON DELETE CASCADE,
 FOREIGN KEY(group_id,memory_id) REFERENCES review_events(group_id,id) ON DELETE CASCADE,
 UNIQUE(group_id,id)
);
CREATE INDEX IF NOT EXISTS social_comments_photo_time ON social_comments(group_id,photo_id,created_at,id);
CREATE INDEX IF NOT EXISTS social_comments_memory_time ON social_comments(group_id,memory_id,created_at,id);
CREATE INDEX IF NOT EXISTS social_comments_author ON social_comments(group_id,author_id,id);
CREATE TABLE IF NOT EXISTS social_comment_deletions (
 comment_id TEXT PRIMARY KEY, group_id TEXT NOT NULL, author_id TEXT NOT NULL,
 photo_id TEXT, memory_id TEXT, deleted_at DOUBLE PRECISION NOT NULL
);

CREATE FUNCTION social_comment_tombstone() RETURNS trigger LANGUAGE plpgsql SET search_path = mazi, pg_catalog AS $$
BEGIN
 INSERT INTO social_comment_deletions VALUES(OLD.id,OLD.group_id,OLD.author_id,OLD.photo_id,OLD.memory_id,extract(epoch FROM clock_timestamp()))
 ON CONFLICT(comment_id) DO NOTHING;
 RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION social_comment_tombstone() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER social_comment_deleted BEFORE DELETE ON social_comments FOR EACH ROW EXECUTE FUNCTION social_comment_tombstone();
ALTER TABLE social_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_access ON social_comments TO mazi_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON social_comments TO mazi_app;
REVOKE ALL ON social_comments FROM PUBLIC, anon, authenticated;
ALTER TABLE social_comment_deletions ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_access ON social_comment_deletions TO mazi_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT ON social_comment_deletions TO mazi_app;
REVOKE ALL ON social_comment_deletions FROM PUBLIC, anon, authenticated;
