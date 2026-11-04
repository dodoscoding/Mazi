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
