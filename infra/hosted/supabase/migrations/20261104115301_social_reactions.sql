SET search_path TO mazi, pg_catalog;

CREATE TABLE IF NOT EXISTS social_reactions (
 id TEXT PRIMARY KEY, group_id TEXT NOT NULL, photo_id TEXT, memory_id TEXT, comment_id TEXT,
 member_id TEXT NOT NULL, emoji TEXT NOT NULL CHECK(emoji IN ('👍','❤️','😂','🎉')),
 active INTEGER NOT NULL CHECK(active IN (0,1)), created_at DOUBLE PRECISION NOT NULL, updated_at DOUBLE PRECISION NOT NULL,
 CHECK((photo_id IS NOT NULL AND memory_id IS NULL AND comment_id IS NULL) OR
       (photo_id IS NULL AND memory_id IS NOT NULL AND comment_id IS NULL) OR
       (photo_id IS NULL AND memory_id IS NULL AND comment_id IS NOT NULL)),
 FOREIGN KEY(group_id,member_id) REFERENCES members(group_id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(group_id,photo_id) REFERENCES archive_assets(group_id,id) ON DELETE CASCADE,
 FOREIGN KEY(group_id,memory_id) REFERENCES review_events(group_id,id) ON DELETE CASCADE,
 FOREIGN KEY(group_id,comment_id) REFERENCES social_comments(group_id,id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS social_reactions_photo_member ON social_reactions(group_id,photo_id,member_id,emoji) WHERE photo_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS social_reactions_memory_member ON social_reactions(group_id,memory_id,member_id,emoji) WHERE memory_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS social_reactions_comment_member ON social_reactions(group_id,comment_id,member_id,emoji) WHERE comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS social_reactions_member ON social_reactions(group_id,member_id,id);
CREATE TABLE IF NOT EXISTS social_reaction_deletions (
 reaction_id TEXT PRIMARY KEY, group_id TEXT NOT NULL, member_id TEXT NOT NULL, deleted_at DOUBLE PRECISION NOT NULL
);

CREATE FUNCTION social_reaction_tombstone() RETURNS trigger LANGUAGE plpgsql SET search_path = mazi, pg_catalog AS $$
BEGIN
 INSERT INTO social_reaction_deletions VALUES(OLD.id,OLD.group_id,OLD.member_id,extract(epoch FROM clock_timestamp()))
 ON CONFLICT(reaction_id) DO NOTHING;
 RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION social_reaction_tombstone() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER social_reaction_deleted BEFORE DELETE ON social_reactions FOR EACH ROW EXECUTE FUNCTION social_reaction_tombstone();
ALTER TABLE social_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_access ON social_reactions TO mazi_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON social_reactions TO mazi_app;
REVOKE ALL ON social_reactions FROM PUBLIC, anon, authenticated;
ALTER TABLE social_reaction_deletions ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_access ON social_reaction_deletions TO mazi_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT ON social_reaction_deletions TO mazi_app;
REVOKE ALL ON social_reaction_deletions FROM PUBLIC, anon, authenticated;
