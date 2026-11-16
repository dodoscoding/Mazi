SET search_path TO mazi, pg_catalog;
CREATE INDEX IF NOT EXISTS social_comments_activity ON social_comments(group_id,updated_at,id);
CREATE INDEX IF NOT EXISTS social_reactions_activity ON social_reactions(group_id,updated_at,id) WHERE active=1;
CREATE INDEX IF NOT EXISTS social_plans_activity ON social_plans(group_id,updated_at,id);
CREATE INDEX IF NOT EXISTS social_plans_upcoming ON social_plans(group_id,status,starts_at,id);
CREATE INDEX IF NOT EXISTS archive_origins_selected ON archive_origins(asset_id,id);
CREATE INDEX IF NOT EXISTS archive_origins_run_page ON archive_origins(group_id,run_id,id);
