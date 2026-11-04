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

REACTION_SCHEMA = '''
CREATE TABLE IF NOT EXISTS social_reactions (
 id TEXT PRIMARY KEY, group_id TEXT NOT NULL, photo_id TEXT, memory_id TEXT, comment_id TEXT,
 member_id TEXT NOT NULL, emoji TEXT NOT NULL CHECK(emoji IN ('👍','❤️','😂','🎉')),
 active INTEGER NOT NULL CHECK(active IN (0,1)), created_at REAL NOT NULL, updated_at REAL NOT NULL,
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
 reaction_id TEXT PRIMARY KEY, group_id TEXT NOT NULL, member_id TEXT NOT NULL, deleted_at REAL NOT NULL
);
CREATE TRIGGER IF NOT EXISTS social_reaction_deleted BEFORE DELETE ON social_reactions BEGIN
 INSERT INTO social_reaction_deletions VALUES(OLD.id,OLD.group_id,OLD.member_id,CAST(strftime('%s','now') AS REAL))
 ON CONFLICT(reaction_id) DO NOTHING;
END;
'''

LABEL_SCHEMA = '''
CREATE TABLE IF NOT EXISTS photo_label_versions (
 group_id TEXT NOT NULL, asset_id TEXT NOT NULL, dimension TEXT NOT NULL CHECK(dimension IN ('people_present','screenshot','ai')),
 revision INTEGER NOT NULL CHECK(revision>0), PRIMARY KEY(group_id,asset_id,dimension),
 FOREIGN KEY(group_id,asset_id) REFERENCES archive_assets(group_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS photo_labels (
 group_id TEXT NOT NULL, asset_id TEXT NOT NULL, dimension TEXT NOT NULL,
 value TEXT NOT NULL, method TEXT CHECK(method='member' OR method IS NULL), actor_id TEXT,
 revision INTEGER NOT NULL CHECK(revision>0), updated_at REAL NOT NULL,
 PRIMARY KEY(group_id,asset_id,dimension),
 CHECK((dimension IN ('people_present','screenshot') AND value IN ('yes','no','unknown')) OR
       (dimension='ai' AND value IN ('generated','edited','none-declared','unknown'))),
 FOREIGN KEY(group_id,asset_id,dimension) REFERENCES photo_label_versions(group_id,asset_id,dimension) ON DELETE CASCADE,
 FOREIGN KEY(group_id,actor_id) REFERENCES members(group_id,user_id)
);
CREATE INDEX IF NOT EXISTS photo_labels_actor ON photo_labels(group_id,actor_id,asset_id,dimension);
CREATE TRIGGER IF NOT EXISTS photo_label_version_monotonic BEFORE UPDATE ON photo_label_versions WHEN NEW.revision<OLD.revision BEGIN
 SELECT RAISE(ABORT,'Label revision cannot go backwards');
END;
CREATE TRIGGER IF NOT EXISTS photo_label_departure BEFORE DELETE ON members BEGIN
 UPDATE photo_label_versions SET revision=revision+1 WHERE group_id=OLD.group_id AND EXISTS
 (SELECT 1 FROM photo_labels l WHERE l.group_id=photo_label_versions.group_id AND l.asset_id=photo_label_versions.asset_id AND l.dimension=photo_label_versions.dimension AND l.actor_id=OLD.user_id);
 UPDATE photo_labels SET value='unknown',method=NULL,actor_id=NULL,
 revision=(SELECT v.revision FROM photo_label_versions v WHERE v.group_id=photo_labels.group_id AND v.asset_id=photo_labels.asset_id AND v.dimension=photo_labels.dimension),
 updated_at=CAST(strftime('%s','now') AS REAL) WHERE group_id=OLD.group_id AND actor_id=OLD.user_id;
END;
CREATE TRIGGER IF NOT EXISTS photo_label_insert_epoch AFTER INSERT ON photo_labels BEGIN
 INSERT INTO discovery_generations VALUES(NEW.group_id,1) ON CONFLICT(group_id) DO UPDATE SET revision=discovery_generations.revision+1;
END;
CREATE TRIGGER IF NOT EXISTS photo_label_update_epoch AFTER UPDATE ON photo_labels BEGIN
 INSERT INTO discovery_generations VALUES(NEW.group_id,1) ON CONFLICT(group_id) DO UPDATE SET revision=discovery_generations.revision+1;
END;
CREATE TRIGGER IF NOT EXISTS photo_label_delete_epoch AFTER DELETE ON photo_labels BEGIN
 INSERT INTO discovery_generations VALUES(OLD.group_id,1) ON CONFLICT(group_id) DO UPDATE SET revision=discovery_generations.revision+1;
END;
CREATE TRIGGER IF NOT EXISTS photo_label_tag_insert_epoch AFTER INSERT ON discovery_tags BEGIN
 INSERT INTO discovery_generations SELECT group_id,1 FROM discovery_people WHERE id=NEW.person ON CONFLICT(group_id) DO UPDATE SET revision=discovery_generations.revision+1;
END;
CREATE TRIGGER IF NOT EXISTS photo_label_tag_update_epoch AFTER UPDATE ON discovery_tags BEGIN
 INSERT INTO discovery_generations SELECT group_id,1 FROM discovery_people WHERE id=NEW.person ON CONFLICT(group_id) DO UPDATE SET revision=discovery_generations.revision+1;
END;
CREATE TRIGGER IF NOT EXISTS photo_label_tag_delete_epoch AFTER DELETE ON discovery_tags BEGIN
 INSERT INTO discovery_generations SELECT group_id,1 FROM discovery_people WHERE id=OLD.person ON CONFLICT(group_id) DO UPDATE SET revision=discovery_generations.revision+1;
END;
CREATE TRIGGER IF NOT EXISTS photo_label_suppression_insert_epoch AFTER INSERT ON discovery_suppressions BEGIN
 INSERT INTO discovery_generations SELECT group_id,1 FROM discovery_people WHERE id=NEW.person ON CONFLICT(group_id) DO UPDATE SET revision=discovery_generations.revision+1;
END;
CREATE TRIGGER IF NOT EXISTS photo_label_suppression_delete_epoch AFTER DELETE ON discovery_suppressions BEGIN
 INSERT INTO discovery_generations SELECT group_id,1 FROM discovery_people WHERE id=OLD.person ON CONFLICT(group_id) DO UPDATE SET revision=discovery_generations.revision+1;
END;
'''

HOME_SCHEMA = '''
CREATE INDEX IF NOT EXISTS social_comments_activity ON social_comments(group_id,updated_at,id);
CREATE INDEX IF NOT EXISTS social_reactions_activity ON social_reactions(group_id,updated_at,id) WHERE active=1;
CREATE INDEX IF NOT EXISTS social_plans_activity ON social_plans(group_id,updated_at,id);
CREATE INDEX IF NOT EXISTS social_plans_upcoming ON social_plans(group_id,status,starts_at,id);
CREATE INDEX IF NOT EXISTS archive_origins_selected ON archive_origins(asset_id,id);
CREATE INDEX IF NOT EXISTS archive_origins_run_page ON archive_origins(group_id,run_id,id);
'''
