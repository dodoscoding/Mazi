"""No tools, network provider, free-form generation, or persisted answer content.

Imported text is searchable data only. Output consists of attributed metadata,
not inferred historical facts. Each processing boundary re-reads live evidence.
"""
import hashlib
import json
import re
import time
from datetime import datetime, timezone
from urllib.parse import urlencode

from mazi.identity.core import Conflict, Denied
from mazi.discovery.discovery import DiscoveryStore, text

SCHEMA = '''
CREATE TABLE IF NOT EXISTS answer_processing (
 group_id TEXT NOT NULL, subject TEXT NOT NULL, enabled INTEGER NOT NULL,
 PRIMARY KEY(group_id,subject));
CREATE TABLE IF NOT EXISTS answer_usage (
 group_id TEXT NOT NULL, user TEXT NOT NULL, day TEXT NOT NULL,
 requests INTEGER NOT NULL DEFAULT 0, seconds REAL NOT NULL DEFAULT 0,
 PRIMARY KEY(group_id,user,day));
CREATE TRIGGER IF NOT EXISTS answer_member_departure AFTER DELETE ON members BEGIN
 DELETE FROM answer_processing WHERE group_id=OLD.group_id AND subject=OLD.user_id;
END;
CREATE TRIGGER IF NOT EXISTS answer_consent_insert AFTER INSERT ON answer_processing BEGIN
 INSERT INTO discovery_generations VALUES(NEW.group_id,1) ON CONFLICT(group_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER IF NOT EXISTS answer_consent_update AFTER UPDATE ON answer_processing BEGIN
 INSERT INTO discovery_generations VALUES(NEW.group_id,1) ON CONFLICT(group_id) DO UPDATE SET revision=revision+1;
END;
'''
COVERAGE = ('This archive is incomplete. Results cover only your currently visible, processing-consented '
            'imported photographs, not the group’s entire past. Missing results do not mean an event never happened.')
STOP = set('when where what which show find me us our we was were is are the a an of in at on for with did photo photos photograph photographs memory memories earliest latest imported archive'.split())


class AnswerStore(DiscoveryStore):
    daily_limit = 50

    def __init__(self, root, encoder=None):
        super().__init__(root, encoder)
        self.db.executescript(SCHEMA)

    def _answer_enabled(self, group, subject):
        row = self.db.execute('SELECT enabled FROM answer_processing WHERE group_id=? AND subject=?', (group, subject)).fetchone()
        return bool(row and row[0])

    def answer_processing(self, user, group, enabled, group_wide=False):
        if type(enabled) is not bool or type(group_wide) is not bool:
            raise ValueError('Boolean required')
        with self.transaction():
            self._member(user, group, admin=group_wide)
            self.db.execute('INSERT INTO answer_processing VALUES(?,?,?) ON CONFLICT(group_id,subject) DO UPDATE SET enabled=excluded.enabled', (group, '*' if group_wide else user, int(enabled)))
            self._audit(user, 'answer.processing', group)

    def _usage(self, user, group):
        day = datetime.now(timezone.utc).date().isoformat()
        row = self.db.execute('SELECT requests,seconds FROM answer_usage WHERE group_id=? AND user=? AND day=?', (group, user, day)).fetchone()
        return dict(day_utc=day, requests=row['requests'] if row else 0, seconds=round(row['seconds'], 3) if row else 0,
                    daily_limit=self.daily_limit, provider_cost_eur=0, provider='none; local extractive engine', infrastructure_cost='not measured')

    def answer_settings(self, user, group):
        self._member(user, group)
        return dict(group_enabled=self._answer_enabled(group, '*'), contribution_enabled=self._answer_enabled(group, user), usage=self._usage(user, group))

    def _authorize_answer(self, user, group):
        self._member(user, group)
        if not all((self._answer_enabled(group, '*'), self._answer_enabled(group, user), self._enabled(group, '*'))):
            raise Denied('Enable group local processing and Memory answers, and opt in to Memory answers first')

    def _records(self, user, group):
        self._authorize_answer(user, group)
        ids = self._visible_ids(user, group)
        if len(ids) > 1000:
            raise ValueError('Local Memory answers support up to 1,000 visible photographs')
        records = []
        for asset in ids:
            doc = self._document(user, asset)
            owners = [r[0] for r in self.db.execute('SELECT DISTINCT owner_id FROM archive_origins WHERE asset_id=? AND withdrawn=0', (asset,))]
            annotation = self.db.execute('SELECT * FROM review_annotations WHERE asset_id=?', (asset,)).fetchone()
            subjects = owners + ([annotation['actor_id']] if annotation else [])
            if not doc['eligible'] or not all(self._answer_enabled(group, subject) for subject in subjects):
                continue
            dates = set()
            for origin in self._all_origins(user, asset):
                for assertion in origin.get('capture_assertions', []):
                    try:
                        dates.add(datetime.fromisoformat(assertion['local'].replace('Z', '+00:00')).date().isoformat())
                    except (KeyError, ValueError, TypeError, AttributeError):
                        pass
            corrected = annotation['capture_date'] if annotation else None
            if corrected:
                dates = {corrected}
            day = next(iter(dates)) if len(dates) == 1 else None
            record = dict(id=asset, title=doc['title'] or 'Untitled photograph', date=day, dates=sorted(dates), place=doc['place'],
                          date_basis='reviewed correction' if corrected else 'conflicting source dates' if len(dates) > 1 else 'source capture date' if dates else 'date unknown',
                          url='/api/answers/evidence?' + urlencode(dict(group=group, asset=asset)))
            records.append(dict(evidence=record, content=doc['content'], fingerprint=doc['fingerprint']))
        records.sort(key=lambda row: row['evidence']['id'])
        return records

    def _snapshot(self, user, group):
        rows = self._records(user, group)
        digest = hashlib.sha256(json.dumps([self._generation(group), rows], sort_keys=True).encode()).hexdigest()
        return rows, digest

    def _checkpoint(self, stage):
        """Processing boundary; overridden by race tests, never by request data."""

    def evidence(self, user, group, asset):
        with self.transaction():
            rows = self._records(user, group)
            row = next((r['evidence'] for r in rows if r['evidence']['id'] == asset), None)
            if row is None:
                raise Denied('Evidence no longer available')
            return row

    def answer(self, user, group, question):
        question = text(question, 500)
        if not question:
            raise ValueError('Question required')
        started = time.monotonic()
        with self.transaction():
            self._authorize_answer(user, group)
            usage = self._usage(user, group)
            if usage['requests'] >= self.daily_limit:
                raise Conflict('Daily Memory answer limit reached; resets at 00:00 UTC')
            self.db.execute('INSERT INTO answer_usage(group_id,user,day,requests) VALUES(?,?,?,1) ON CONFLICT(group_id,user,day) DO UPDATE SET requests=requests+1', (group, user, usage['day_utc']))
            rows, digest = self._snapshot(user, group)
        self._checkpoint('dispatch')
        with self.transaction():
            if self._snapshot(user, group)[1] != digest:
                raise Conflict('Archive or consent changed; ask again')
        # Fixed extractive engine: source strings never become instructions or tools.
        tokens = set(re.findall(r"\w+", question.casefold()))
        terms = tokens - STOP
        unsupported = bool(tokens & {'why', 'ever', 'always', 'never', 'first', 'last', 'everyone', 'all', 'how', 'who'})
        matched = [r['evidence'] for r in rows if terms and terms <= set(re.findall(r'\w+', r['content'].casefold()))]
        earliest, latest = 'earliest' in tokens, 'latest' in tokens
        uncertainty = []
        if unsupported:
            matched = []
            uncertainty.append('I cannot establish causes, identities, totals, or absolute history from these records.')
        elif earliest or latest:
            if any(not r['date'] for r in matched):
                matched = []
                uncertainty.append('Missing or conflicting dates prevent reliable ordering of the matching records.')
            elif matched:
                target = (max if latest else min)(r['date'] for r in matched)
                matched = [r for r in matched if r['date'] == target]
                uncertainty.append('This is an archive-only ordering, not a claim about the first or last event in your lives.')
        total = len(matched)
        matched = matched[:5]
        claims = []
        for row in matched:
            statement = f'The archive labels this photograph “{row["title"]}”.'
            if row['date']:
                statement += f' Its recorded date is {row["date"]} ({row["date_basis"]}).'
            elif len(row['dates']) > 1:
                statement += ' Its source dates conflict: ' + ', '.join(row['dates']) + '.'
            else:
                statement += ' Its capture date is unknown.'
            if row['place']:
                statement += f' Its recorded place is “{row["place"]}”.'
            claims.append(dict(text=statement, evidence_ids=[row['id']]))
        self._checkpoint('delivery')
        with self.transaction():
            if self._snapshot(user, group)[1] != digest:
                raise Conflict('Archive or consent changed; ask again')
            self.db.execute('UPDATE answer_usage SET seconds=seconds+? WHERE group_id=? AND user=? AND day=?', (time.monotonic() - started, group, user, usage['day_utc']))
            return dict(status='supported' if claims else 'abstained', claims=claims, evidence=matched,
                        message='Matching archive records, with attributed metadata.' if claims else 'I do not have enough eligible archive evidence to answer that.',
                        coverage=COVERAGE, uncertainty=uncertainty, matching_records=total, shown=len(matched), usage=self._usage(user, group))
