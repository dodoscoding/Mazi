"""Admission counters only: no prompts, chapters or archive evidence are persisted."""
import os
import time
from datetime import datetime, timezone
from mazi.persistence import initialize_schema

NOTICE_VERSION = 'sample-v1'
SCHEMA = '''
CREATE TABLE IF NOT EXISTS parallel_usage (
 group_id TEXT NOT NULL, "user" TEXT NOT NULL, day TEXT NOT NULL,
 chapters INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(group_id,"user",day));
CREATE TABLE IF NOT EXISTS parallel_notice (
 group_id TEXT NOT NULL, "user" TEXT NOT NULL, version TEXT NOT NULL, accepted_at INTEGER NOT NULL,
 PRIMARY KEY(group_id,"user"));
CREATE TRIGGER IF NOT EXISTS parallel_member_departure AFTER DELETE ON members BEGIN
 DELETE FROM parallel_notice WHERE group_id=OLD.group_id AND "user"=OLD.user_id;
END;
'''


class NoticeRequired(Exception):
    pass


class QuotaReached(Exception):
    pass


def enabled():
    # No environment setting can enable a paid provider in this implementation.
    return os.environ.get('MAZI_PARALLEL_ENABLED') == '1' and os.environ.get('MAZI_PARALLEL_PROVIDER', 'fake') == 'fake'


def initialize(store):
    initialize_schema(store.db, SCHEMA)


def accepted(store, profile):
    row = store.db.execute('SELECT version FROM parallel_notice WHERE group_id=? AND "user"=?',
                           (profile['group_id'], profile['user_id'])).fetchone()
    return bool(row and row[0] == NOTICE_VERSION)


def accept(store, profile, version):
    if version != NOTICE_VERSION:
        raise ValueError('Notice version changed')
    with store.transaction():
        store.db.execute('INSERT INTO parallel_notice VALUES(?,?,?,?) ON CONFLICT(group_id,"user") DO UPDATE SET version=excluded.version, accepted_at=excluded.accepted_at',
                         (profile['group_id'], profile['user_id'], version, int(time.time())))


def reserve(store, profile):
    group, user = profile['group_id'], profile['user_id']
    day = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    member_limit = max(1, int(os.environ.get('MAZI_PARALLEL_MEMBER_LIMIT', '30')))
    circle_limit = max(1, int(os.environ.get('MAZI_PARALLEL_CIRCLE_LIMIT', '150')))
    # Store.transaction serializes admissions across connections (SQLite immediate /
    # hosted advisory transaction lock), not just threads in this process.
    with store.transaction():
        store._member(user, group)
        if not accepted(store, profile):
            raise NoticeRequired()
        member = store.db.execute('SELECT chapters FROM parallel_usage WHERE group_id=? AND "user"=? AND day=?', (group,user,day)).fetchone()
        total = store.db.execute('SELECT COALESCE(SUM(chapters),0) FROM parallel_usage WHERE group_id=? AND day=?', (group,day)).fetchone()[0]
        if (member and member[0] >= member_limit) or total >= circle_limit:
            raise QuotaReached()
        store.db.execute('INSERT INTO parallel_usage VALUES(?,?,?,1) ON CONFLICT(group_id,"user",day) DO UPDATE SET chapters=parallel_usage.chapters+1', (group,user,day))
    # Attempts remain counted after failure; retries cannot bypass the daily cap.
    return (group,user,day)
