"""No tools, network provider, free-form generation, or persisted answer content.

Imported text is searchable data only. Output consists of attributed metadata,
not inferred historical facts. Each processing boundary re-reads live evidence.
"""
import hashlib
from mazi.persistence import initialize_schema

import json
import re
import time
from datetime import datetime, timezone
from urllib.parse import urlencode

from mazi.capacity import CapacityExceeded
from mazi.identity.core import Conflict, Denied
from mazi.discovery.discovery import DiscoveryStore, text

SCHEMA = '''
CREATE TABLE IF NOT EXISTS answer_processing (
 group_id TEXT NOT NULL, subject TEXT NOT NULL, enabled INTEGER NOT NULL,
 PRIMARY KEY(group_id,subject));
CREATE TABLE IF NOT EXISTS answer_usage (
 group_id TEXT NOT NULL, "user" TEXT NOT NULL, day TEXT NOT NULL,
 requests INTEGER NOT NULL DEFAULT 0, seconds REAL NOT NULL DEFAULT 0,
 PRIMARY KEY(group_id,"user",day));
CREATE TRIGGER IF NOT EXISTS answer_member_departure AFTER DELETE ON members BEGIN
 DELETE FROM answer_processing WHERE group_id=OLD.group_id AND subject=OLD.user_id;
END;
CREATE TRIGGER IF NOT EXISTS answer_consent_insert AFTER INSERT ON answer_processing BEGIN
 INSERT INTO discovery_generations VALUES(NEW.group_id,1) ON CONFLICT(group_id) DO UPDATE SET revision=discovery_generations.revision+1;
END;
CREATE TRIGGER IF NOT EXISTS answer_consent_update AFTER UPDATE ON answer_processing BEGIN
 INSERT INTO discovery_generations VALUES(NEW.group_id,1) ON CONFLICT(group_id) DO UPDATE SET revision=discovery_generations.revision+1;
END;
'''
COVERAGE = ('This archive is incomplete. Results cover only your currently visible, processing-consented '
            'imported photographs, not the group’s entire past. Missing results do not mean an event never happened.')
STOP = set('when where what which show find me us our we was were is are the a an of in at on for with did photo photos photograph photographs memory memories earliest latest imported archive'.split())


ANSWER_PAGE_ROWS = 128
ANSWER_ORIGIN_BYTES = 64 * 1024
ANSWER_ROW_BYTES = 68 * 1024
ANSWER_ASSET_BYTES = 8 * 1024 * 1024
ANSWER_ASSET_ROWS = 8192
ANSWER_PASS_BYTES = 64 * 1024 * 1024
ANSWER_PASS_ROWS = 100000
ANSWER_EVIDENCE_BYTES = 64 * 1024
ANSWER_PASS_SECONDS = 3
ANSWER_REQUEST_SECONDS = 8


def _check_answer_time(request_started, pass_started=None):
    now = time.monotonic()
    if (now - request_started > ANSWER_REQUEST_SECONDS or
            (pass_started is not None and now - pass_started > ANSWER_PASS_SECONDS)):
        raise CapacityExceeded('Memory answers exceeded the local processing budget. No partial answer was returned.')


class AnswerStore(DiscoveryStore):
    daily_limit = 50

    def __init__(self, root, encoder=None):
        super().__init__(root, encoder)
        initialize_schema(self.db, SCHEMA)

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
        row = self.db.execute('SELECT requests,seconds FROM answer_usage WHERE group_id=? AND "user"=? AND day=?', (group, user, day)).fetchone()
        return dict(day_utc=day, requests=row['requests'] if row else 0, seconds=round(row['seconds'], 3) if row else 0,
                    daily_limit=self.daily_limit, provider_cost_eur=0, provider='none; local extractive engine', infrastructure_cost='not measured')

    def answer_settings(self, user, group):
        self._member(user, group)
        return dict(group_enabled=self._answer_enabled(group, '*'), contribution_enabled=self._answer_enabled(group, user),
                    local_processing_enabled=self._enabled(group, '*'), usage=self._usage(user, group))

    def _authorize_answer(self, user, group):
        self._member(user, group)
        if not all((self._answer_enabled(group, '*'), self._answer_enabled(group, user), self._enabled(group, '*'))):
            raise Denied('Enable group local processing and Memory answers, and opt in to Memory answers first')

    def _evidence_record(self, user, group, asset):
        doc = self._document(user, asset)
        owners = [r[0] for r in self.db.execute('SELECT DISTINCT owner_id FROM archive_origins WHERE asset_id=? AND withdrawn=0', (asset,))]
        annotation = self.db.execute('SELECT * FROM review_annotations WHERE asset_id=?', (asset,)).fetchone()
        subjects = owners + ([annotation['actor_id']] if annotation else [])
        if not doc['eligible'] or not all(self._answer_enabled(group, subject) for subject in subjects):
            return None
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
        return dict(evidence=record, content=doc['content'], fingerprint=doc['fingerprint'])

    def _records(self, user, group):
        self._authorize_answer(user, group)
        ids = self._visible_ids(user, group)
        if len(ids) > 1000:
            raise CapacityExceeded('Local Memory answers support up to 1,000 visible photographs')
        records = []
        for asset in ids:
            record = self._evidence_record(user, group, asset)
            if record is not None:
                records.append(record)
        records.sort(key=lambda row: row['evidence']['id'])
        return records

    def _snapshot(self, user, group):
        rows = self._records(user, group)
        digest = hashlib.sha256(json.dumps([self._generation(group), rows], sort_keys=True).encode()).hexdigest()
        return rows, digest

    def _bounded_answer_route(self, user, group):
        rows = self.db.execute('''SELECT 1 FROM archive_assets a
            WHERE a.group_id=? AND NOT EXISTS (
                SELECT 1 FROM discovery_hidden h WHERE h."user"=? AND h.asset=a.id)
            AND EXISTS (SELECT 1 FROM archive_origins o JOIN members m
                ON m.group_id=o.group_id AND m.user_id=o.owner_id
                WHERE o.asset_id=a.id AND o.withdrawn=0)
            ORDER BY a.id LIMIT 1001''', (group, user)).fetchall()
        return len(rows) > 1000

    def _answer_records(self, user, group, request_started, pass_started):
        # Text is guarded in SQL before either driver can prefetch it into Python.
        fields = ('id', 'origin', 'live_owner', 'payload', 'title', 'capture_date',
                  'place', 'actor_id', 'annotation_member', 'city')
        length = (lambda field: f'octet_length({field})') if getattr(self.db, 'hosted', False) else (
            lambda field: f'length(CAST({field} AS BLOB))')
        row_bytes = ' + '.join(f'COALESCE({length(field)},0)' for field in fields)
        guarded = ','.join(f'CASE WHEN payload_bytes<=? AND row_bytes<=? THEN {field} ELSE NULL END AS {field}'
                           for field in fields)
        query = f'''WITH projected AS (
            SELECT a.id,o.id AS origin,m.user_id AS live_owner,
                CASE WHEN m.user_id IS NOT NULL THEN o.payload ELSE NULL END AS payload,
                lp.enabled AS local_owner,ap.enabled AS answer_owner,
                n.title,n.capture_date,n.place,n.actor_id,am.user_id AS annotation_member,
                nl.enabled AS local_annotation,na.enabled AS answer_annotation,p.city
            FROM archive_origins o JOIN archive_assets a ON a.id=o.asset_id
            LEFT JOIN members m ON m.group_id=o.group_id AND m.user_id=o.owner_id
            LEFT JOIN discovery_processing lp ON lp.group_id=a.group_id AND lp.subject=o.owner_id
            LEFT JOIN answer_processing ap ON ap.group_id=a.group_id AND ap.subject=o.owner_id
            LEFT JOIN review_annotations n ON n.asset_id=a.id
            LEFT JOIN members am ON am.group_id=a.group_id AND am.user_id=n.actor_id
            LEFT JOIN discovery_processing nl ON nl.group_id=a.group_id AND nl.subject=n.actor_id
            LEFT JOIN answer_processing na ON na.group_id=a.group_id AND na.subject=n.actor_id
            LEFT JOIN shared_places p ON p.origin=o.id
            WHERE o.group_id=? AND a.group_id=? AND o.withdrawn=0 AND o.asset_id>=?
            AND NOT EXISTS (SELECT 1 FROM discovery_hidden h WHERE h."user"=? AND h.asset=a.id)
            AND EXISTS (SELECT 1 FROM archive_origins live JOIN members lm
                ON lm.group_id=live.group_id AND lm.user_id=live.owner_id
                WHERE live.asset_id=a.id AND live.withdrawn=0)
            AND (o.asset_id>? OR (o.asset_id=? AND o.id>?))
            ORDER BY o.asset_id,o.id LIMIT {ANSWER_PAGE_ROWS}
        ), measured AS (
            SELECT projected.*,COALESCE({length('payload')},0) AS payload_bytes,
                {row_bytes} AS row_bytes FROM projected
        ) SELECT payload_bytes,row_bytes,{guarded},local_owner,answer_owner,
            local_annotation,answer_annotation FROM measured ORDER BY id,origin'''
        last_asset = last_origin = ''
        asset = annotation = budget_asset = None
        raw, filenames, contexts, dates, places, cities = [], [], [], set(), set(), set()
        eligible = True
        asset_bytes = asset_rows = pass_bytes = pass_rows = 0

        def finish():
            if not eligible:
                return None
            title = annotation['title'] or ''
            place = next(iter(places)) if len(places) == 1 else ''
            content = ' '.join([title, *sorted(cities | ({place} if place else set())), *filenames, *contexts])
            fingerprint = hashlib.sha256()
            for part in json.JSONEncoder(ensure_ascii=False).iterencode([self.encoder.version, content, raw]):
                fingerprint.update(part.encode())
            corrected = annotation['capture_date']
            effective_dates = {corrected} if corrected else dates
            day = next(iter(effective_dates)) if len(effective_dates) == 1 else None
            evidence = dict(id=asset, title=title or 'Untitled photograph', date=day,
                            dates=sorted(effective_dates), place=place,
                            date_basis='reviewed correction' if corrected else 'conflicting source dates' if len(effective_dates) > 1 else 'source capture date' if effective_dates else 'date unknown',
                            url='/api/answers/evidence?' + urlencode(dict(group=group, asset=asset)))
            if len(json.dumps(evidence).encode()) > ANSWER_EVIDENCE_BYTES:
                raise CapacityExceeded('Memory answers exceeded the 64 KiB evidence limit per photograph. No partial answer was returned.')
            return dict(evidence=evidence, content=content, fingerprint=fingerprint.hexdigest())

        while True:
            _check_answer_time(request_started, pass_started)
            batch = self.db.execute(query, (group, group, last_asset, user, last_asset, last_asset, last_origin,
                                           *([ANSWER_ORIGIN_BYTES, ANSWER_ROW_BYTES] * len(fields)))).fetchall()
            if not batch:
                break
            # Charge the entire transfer before decoding any source in this batch.
            for row in batch:
                if row['payload_bytes'] > ANSWER_ORIGIN_BYTES:
                    raise CapacityExceeded('Memory answers exceeded the 64 KiB metadata limit per origin. No partial answer was returned.')
                if row['row_bytes'] > ANSWER_ROW_BYTES:
                    raise CapacityExceeded('Memory answers exceeded the 68 KiB projected metadata limit per row. No partial answer was returned.')
                if budget_asset != row['id']:
                    budget_asset, asset_bytes, asset_rows = row['id'], 0, 0
                asset_bytes += row['row_bytes']
                pass_bytes += row['row_bytes']
                asset_rows += 1
                pass_rows += 1
                if asset_bytes > ANSWER_ASSET_BYTES:
                    raise CapacityExceeded('Memory answers exceeded the 8 MiB metadata limit per photograph. No partial answer was returned.')
                if asset_rows > ANSWER_ASSET_ROWS:
                    raise CapacityExceeded('Memory answers exceeded the 8,192 origin-row limit per photograph. No partial answer was returned.')
                if pass_bytes > ANSWER_PASS_BYTES:
                    raise CapacityExceeded('Memory answers exceeded the 64 MiB metadata limit for one evidence check. Each answer makes three checks, up to 192 MiB in total. No partial answer was returned.')
                if pass_rows > ANSWER_PASS_ROWS:
                    raise CapacityExceeded('Memory answers exceeded the 100,000 origin-row limit per evidence check. No partial answer was returned.')
            for row in batch:
                if asset is not None and asset != row['id']:
                    result = finish()
                    # Drop source state before yielding; retained results hold evidence only.
                    raw, filenames, contexts, dates, places, cities = [], [], [], set(), set(), set()
                    if result is not None:
                        yield result
                        del result
                    _check_answer_time(request_started, pass_started)
                    eligible = True
                asset, annotation = row['id'], row
                eligible = eligible and bool(row['answer_owner'])
                if row['actor_id'] is not None:
                    eligible = eligible and bool(row['annotation_member'] and row['local_annotation'] and row['answer_annotation'])
                if row['live_owner'] is None:
                    continue
                eligible = eligible and bool(row['local_owner'])
                payload = json.loads(row['payload'])
                raw.append((row['origin'], row['payload']))
                filenames.append(str(payload.get('original_filename') or ''))
                context = [str(c.get('text') or '') for c in payload.get('context', [])]
                if context:
                    contexts.append(' '.join(context))
                for assertion in payload.get('capture_assertions', []):
                    try:
                        dates.add(datetime.fromisoformat(assertion['local'].replace('Z', '+00:00')).date().isoformat())
                    except (KeyError, ValueError, TypeError, AttributeError):
                        pass
                _, source_places = self._date_place_evidence(asset, payload, row)
                places.update(source_places)
                if row['city'] is not None:
                    cities.add(row['city'])
                del payload, context, source_places
            last_asset, last_origin = batch[-1]['id'], batch[-1]['origin']
            del batch, row
        if asset is not None:
            result = finish()
            raw, filenames, contexts, dates, places, cities = [], [], [], set(), set(), set()
            if result is not None:
                yield result
                del result
        _check_answer_time(request_started, pass_started)

    def _bounded_snapshot(self, user, group, request_started, question=None):
        pass_started = time.monotonic()
        self._authorize_answer(user, group)
        digest = hashlib.sha256(('[' + json.dumps(self._generation(group)) + ', [').encode())
        tokens = set(re.findall(r'\w+', question.casefold())) if question is not None else set()
        terms = tokens - STOP
        unsupported = bool(tokens & {'why', 'ever', 'always', 'never', 'first', 'last', 'everyone', 'all', 'how', 'who'})
        ordered, latest = bool(tokens & {'earliest', 'latest'}), 'latest' in tokens
        evidence, total, target, unknown, first = [], 0, None, False, True

        def matches(content):
            remaining = terms.copy()
            for word in re.finditer(r'\w+', content.casefold()):
                remaining.discard(word.group())
                if not remaining:
                    return True
            return False

        for record in self._answer_records(user, group, request_started, pass_started):
            if not first:
                digest.update(b', ')
            first = False
            for part in json.JSONEncoder(sort_keys=True).iterencode(record):
                digest.update(part.encode())
            if terms and not unsupported and matches(record['content']):
                row = record['evidence']
                if ordered and not row['date']:
                    unknown = True
                elif not ordered or target is None or (row['date'] > target if latest else row['date'] < target):
                    if ordered:
                        target, total, evidence = row['date'], 0, []
                    total += 1
                    if len(evidence) < 5:
                        evidence.append(row)
                elif row['date'] == target:
                    total += 1
                    if len(evidence) < 5:
                        evidence.append(row)
                del row
            del record
        digest.update(b']]')
        uncertainty = []
        if unsupported:
            uncertainty.append('I cannot establish causes, identities, totals, or absolute history from these records.')
        elif ordered:
            if unknown:
                total, evidence = 0, []
                uncertainty.append('Missing or conflicting dates prevent reliable ordering of the matching records.')
            elif total:
                uncertainty.append('This is an archive-only ordering, not a claim about the first or last event in your lives.')
        _check_answer_time(request_started, pass_started)
        return dict(digest=digest.hexdigest(), evidence=evidence, matching_records=total, uncertainty=uncertainty)

    def _checkpoint(self, stage):
        """Processing boundary; overridden by race tests, never by request data."""

    def evidence(self, user, group, asset):
        with self.transaction():
            self._authorize_answer(user, group)
            asset_row = self._asset(user, asset)
            if asset_row['group_id'] != group or self.db.execute(
                    'SELECT 1 FROM discovery_hidden WHERE "user"=? AND asset=?', (user, asset)).fetchone():
                raise Denied('Evidence no longer available')
            record = self._evidence_record(user, group, asset)
            if record is None:
                raise Denied('Evidence no longer available')
            return record['evidence']

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
            bounded = self._bounded_answer_route(user, group)
            self.db.execute('INSERT INTO answer_usage(group_id,"user",day,requests) VALUES(?,?,?,1) ON CONFLICT(group_id,"user",day) DO UPDATE SET requests=answer_usage.requests+1', (group, user, usage['day_utc']))
            if bounded:
                snapshot = self._bounded_snapshot(user, group, started, question)
                digest = snapshot['digest']
            else:
                rows, digest = self._snapshot(user, group)
        self._checkpoint('dispatch')
        with self.transaction():
            current_digest = (self._bounded_snapshot(user, group, started)['digest'] if bounded
                              else self._snapshot(user, group)[1])
            if current_digest != digest:
                raise Conflict('Archive or consent changed; ask again')
        if bounded:
            matched, total, uncertainty = snapshot['evidence'], snapshot['matching_records'], snapshot['uncertainty']
        else:
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
            current_digest = (self._bounded_snapshot(user, group, started)['digest'] if bounded
                              else self._snapshot(user, group)[1])
            if current_digest != digest:
                raise Conflict('Archive or consent changed; ask again')
            self.db.execute('UPDATE answer_usage SET seconds=seconds+? WHERE group_id=? AND "user"=? AND day=?', (time.monotonic() - started, group, user, usage['day_utc']))
            result = dict(status='supported' if claims else 'abstained', claims=claims, evidence=matched,
                        message='Matching archive records, with attributed metadata.' if claims else 'I do not have enough eligible archive evidence to answer that.',
                        coverage=COVERAGE, uncertainty=uncertainty, matching_records=total, shown=len(matched), usage=self._usage(user, group))
            if bounded:
                _check_answer_time(started)
            return result
