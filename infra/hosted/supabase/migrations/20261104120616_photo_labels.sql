SET search_path TO mazi, pg_catalog;

CREATE TABLE IF NOT EXISTS photo_label_versions (
 group_id TEXT NOT NULL, asset_id TEXT NOT NULL, dimension TEXT NOT NULL CHECK(dimension IN ('people_present','screenshot','ai')),
 revision INTEGER NOT NULL CHECK(revision>0), PRIMARY KEY(group_id,asset_id,dimension),
 FOREIGN KEY(group_id,asset_id) REFERENCES archive_assets(group_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS photo_labels (
 group_id TEXT NOT NULL, asset_id TEXT NOT NULL, dimension TEXT NOT NULL,
 value TEXT NOT NULL, method TEXT CHECK(method='member' OR method IS NULL), actor_id TEXT,
 revision INTEGER NOT NULL CHECK(revision>0), updated_at DOUBLE PRECISION NOT NULL,
 PRIMARY KEY(group_id,asset_id,dimension),
 CHECK((dimension IN ('people_present','screenshot') AND value IN ('yes','no','unknown')) OR
       (dimension='ai' AND value IN ('generated','edited','none-declared','unknown'))),
 FOREIGN KEY(group_id,asset_id,dimension) REFERENCES photo_label_versions(group_id,asset_id,dimension) ON DELETE CASCADE,
 FOREIGN KEY(group_id,actor_id) REFERENCES members(group_id,user_id)
);
CREATE INDEX IF NOT EXISTS photo_labels_actor ON photo_labels(group_id,actor_id,asset_id,dimension);

CREATE FUNCTION photo_label_version_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = mazi, pg_catalog AS $$
BEGIN
 IF NEW.revision<OLD.revision THEN RAISE check_violation USING MESSAGE='Label revision cannot go backwards'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER photo_label_version_monotonic BEFORE UPDATE ON photo_label_versions FOR EACH ROW EXECUTE FUNCTION photo_label_version_guard();
CREATE FUNCTION photo_label_member_departure() RETURNS trigger LANGUAGE plpgsql SET search_path = mazi, pg_catalog AS $$
BEGIN
 UPDATE photo_label_versions v SET revision=v.revision+1 WHERE v.group_id=OLD.group_id AND EXISTS
 (SELECT 1 FROM photo_labels l WHERE l.group_id=v.group_id AND l.asset_id=v.asset_id AND l.dimension=v.dimension AND l.actor_id=OLD.user_id);
 UPDATE photo_labels l SET value='unknown',method=NULL,actor_id=NULL,revision=v.revision,updated_at=extract(epoch FROM clock_timestamp())
 FROM photo_label_versions v WHERE l.group_id=OLD.group_id AND l.actor_id=OLD.user_id AND v.group_id=l.group_id AND v.asset_id=l.asset_id AND v.dimension=l.dimension;
 RETURN OLD;
END;
$$;
CREATE TRIGGER photo_label_departure BEFORE DELETE ON members FOR EACH ROW EXECUTE FUNCTION photo_label_member_departure();
CREATE FUNCTION photo_label_epoch() RETURNS trigger LANGUAGE plpgsql SET search_path = mazi, pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  INSERT INTO discovery_generations VALUES(OLD.group_id,1) ON CONFLICT(group_id) DO UPDATE SET revision=discovery_generations.revision+1;
  RETURN OLD;
 END IF;
 INSERT INTO discovery_generations VALUES(NEW.group_id,1) ON CONFLICT(group_id) DO UPDATE SET revision=discovery_generations.revision+1;
 RETURN NEW;
END;
$$;
CREATE FUNCTION photo_label_people_epoch() RETURNS trigger LANGUAGE plpgsql SET search_path = mazi, pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  INSERT INTO discovery_generations SELECT group_id,1 FROM discovery_people WHERE id=OLD.person ON CONFLICT(group_id) DO UPDATE SET revision=discovery_generations.revision+1;
  RETURN OLD;
 END IF;
 INSERT INTO discovery_generations SELECT group_id,1 FROM discovery_people WHERE id=NEW.person ON CONFLICT(group_id) DO UPDATE SET revision=discovery_generations.revision+1;
 RETURN NEW;
END;
$$;
CREATE TRIGGER photo_label_insert_epoch AFTER INSERT ON photo_labels FOR EACH ROW EXECUTE FUNCTION photo_label_epoch();
CREATE TRIGGER photo_label_tag_insert_epoch AFTER INSERT ON discovery_tags FOR EACH ROW EXECUTE FUNCTION photo_label_people_epoch();
CREATE TRIGGER photo_label_update_epoch AFTER UPDATE ON photo_labels FOR EACH ROW EXECUTE FUNCTION photo_label_epoch();
CREATE TRIGGER photo_label_tag_update_epoch AFTER UPDATE ON discovery_tags FOR EACH ROW EXECUTE FUNCTION photo_label_people_epoch();
CREATE TRIGGER photo_label_delete_epoch AFTER DELETE ON photo_labels FOR EACH ROW EXECUTE FUNCTION photo_label_epoch();
CREATE TRIGGER photo_label_tag_delete_epoch AFTER DELETE ON discovery_tags FOR EACH ROW EXECUTE FUNCTION photo_label_people_epoch();
CREATE TRIGGER photo_label_suppression_insert_epoch AFTER INSERT ON discovery_suppressions FOR EACH ROW EXECUTE FUNCTION photo_label_people_epoch();
CREATE TRIGGER photo_label_suppression_delete_epoch AFTER DELETE ON discovery_suppressions FOR EACH ROW EXECUTE FUNCTION photo_label_people_epoch();
REVOKE ALL ON FUNCTION photo_label_version_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION photo_label_member_departure() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION photo_label_epoch() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION photo_label_people_epoch() FROM PUBLIC, anon, authenticated;
ALTER TABLE photo_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_access ON photo_labels TO mazi_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON photo_labels TO mazi_app;
REVOKE ALL ON photo_labels FROM PUBLIC, anon, authenticated;
ALTER TABLE photo_label_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_access ON photo_label_versions TO mazi_app USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON photo_label_versions TO mazi_app;
REVOKE ALL ON photo_label_versions FROM PUBLIC, anon, authenticated;
