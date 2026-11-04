SCHEMA = '''
CREATE TABLE IF NOT EXISTS social_plans (
 id TEXT PRIMARY KEY, group_id TEXT NOT NULL, organizer TEXT NOT NULL,
 title TEXT NOT NULL, start_local TEXT NOT NULL, timezone TEXT NOT NULL,
 start_offset TEXT NOT NULL, starts_at REAL NOT NULL, end_local TEXT,
 end_offset TEXT, ends_at REAL, place TEXT NOT NULL, description TEXT NOT NULL,
 memory_id TEXT, status TEXT NOT NULL CHECK(status IN ('active','cancelled')),
 revision INTEGER NOT NULL, created_at REAL NOT NULL, updated_at REAL NOT NULL,
 UNIQUE(group_id,id),
 FOREIGN KEY(group_id,organizer) REFERENCES members(group_id,user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS social_plans_group_time ON social_plans(group_id,starts_at,id);
CREATE INDEX IF NOT EXISTS social_plans_organizer ON social_plans(group_id,organizer);
CREATE TABLE IF NOT EXISTS social_attendance (
 plan_id TEXT NOT NULL REFERENCES social_plans(id) ON DELETE CASCADE,
 member_id TEXT NOT NULL, state TEXT CHECK(state IN ('yes','maybe','no')),
 revision INTEGER NOT NULL, updated_at REAL NOT NULL, group_id TEXT NOT NULL,
 PRIMARY KEY(plan_id,member_id),
 FOREIGN KEY(group_id,member_id) REFERENCES members(group_id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(group_id,plan_id) REFERENCES social_plans(group_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS social_attendance_member ON social_attendance(member_id,plan_id);
CREATE TABLE IF NOT EXISTS social_receipts (
 group_id TEXT NOT NULL, actor_id TEXT NOT NULL, request_key TEXT NOT NULL,
 operation TEXT NOT NULL, payload_hash TEXT NOT NULL, result_id TEXT NOT NULL,
 created_at REAL NOT NULL, PRIMARY KEY(group_id,actor_id,request_key)
);
CREATE TRIGGER IF NOT EXISTS social_departure AFTER DELETE ON members BEGIN
 DELETE FROM social_attendance WHERE member_id=OLD.user_id AND plan_id IN
 (SELECT id FROM social_plans WHERE group_id=OLD.group_id);
 DELETE FROM social_plans WHERE group_id=OLD.group_id AND organizer=OLD.user_id;
END;
'''

COMMENT_SCHEMA = '''
CREATE UNIQUE INDEX IF NOT EXISTS archive_assets_group_identity ON archive_assets(group_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS review_events_group_identity ON review_events(group_id,id);
CREATE TABLE IF NOT EXISTS social_comments (
 id TEXT PRIMARY KEY, group_id TEXT NOT NULL, photo_id TEXT, memory_id TEXT,
 author_id TEXT NOT NULL, content TEXT NOT NULL, revision INTEGER NOT NULL,
 created_at REAL NOT NULL, updated_at REAL NOT NULL,
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
 photo_id TEXT, memory_id TEXT, deleted_at REAL NOT NULL
);
CREATE TRIGGER IF NOT EXISTS social_comment_deleted BEFORE DELETE ON social_comments BEGIN
 INSERT INTO social_comment_deletions VALUES(OLD.id,OLD.group_id,OLD.author_id,OLD.photo_id,OLD.memory_id,CAST(strftime('%s','now') AS REAL))
 ON CONFLICT(comment_id) DO NOTHING;
END;
'''
