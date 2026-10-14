"""Current authorization precedes filtering, ranking, counts and People output.

SQLite write transactions serialize local retrieval with membership/consent
mutations. Vectors are derivatives, never an authorization source.
"""
import hashlib
from mazi.persistence import initialize_schema

import io
import json
import time
import uuid
import zipfile
from datetime import date

from mazi.identity.core import Conflict, Denied
from mazi.sources.sources import SourceStore
from . import embeddings as model

SCHEMA = '''
CREATE TABLE IF NOT EXISTS discovery_people (
 id TEXT PRIMARY KEY, group_id TEXT NOT NULL, name TEXT NOT NULL, creator TEXT NOT NULL,
 account TEXT, proposed_account TEXT, UNIQUE(group_id,account)
);
CREATE TABLE IF NOT EXISTS discovery_tags (
 person TEXT NOT NULL, asset TEXT NOT NULL, actor TEXT NOT NULL,
 PRIMARY KEY(person,asset)
);
CREATE TABLE IF NOT EXISTS discovery_suppressions (
 person TEXT NOT NULL, asset TEXT NOT NULL, subject TEXT NOT NULL,
 PRIMARY KEY(person,asset)
);
CREATE TABLE IF NOT EXISTS discovery_hidden (
 "user" TEXT NOT NULL, asset TEXT NOT NULL, PRIMARY KEY("user",asset)
);
CREATE TABLE IF NOT EXISTS discovery_hidden_events (
 "user" TEXT NOT NULL, event TEXT NOT NULL, PRIMARY KEY("user",event)
);
CREATE TABLE IF NOT EXISTS discovery_processing (
 group_id TEXT NOT NULL, subject TEXT NOT NULL, enabled INTEGER NOT NULL,
 PRIMARY KEY(group_id,subject)
);
CREATE TABLE IF NOT EXISTS discovery_generations (group_id TEXT PRIMARY KEY, revision INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS discovery_vectors (
 asset TEXT NOT NULL, modality TEXT NOT NULL, version TEXT NOT NULL,
 dimensions INTEGER NOT NULL, fingerprint TEXT NOT NULL, vector TEXT NOT NULL,
 PRIMARY KEY(asset,modality)
);
CREATE TABLE IF NOT EXISTS discovery_measurements (
 group_id TEXT PRIMARY KEY, embeddings INTEGER NOT NULL DEFAULT 0,
 seconds REAL NOT NULL DEFAULT 0
);
CREATE TRIGGER IF NOT EXISTS discovery_consent_insert AFTER INSERT ON discovery_processing BEGIN
 INSERT INTO discovery_generations VALUES(NEW.group_id,1) ON CONFLICT(group_id) DO UPDATE SET revision=discovery_generations.revision+1;
END;
CREATE TRIGGER IF NOT EXISTS discovery_consent_update AFTER UPDATE ON discovery_processing BEGIN
 INSERT INTO discovery_generations VALUES(NEW.group_id,1) ON CONFLICT(group_id) DO UPDATE SET revision=discovery_generations.revision+1;
END;
CREATE TRIGGER IF NOT EXISTS discovery_consent_delete AFTER DELETE ON discovery_processing BEGIN
 INSERT INTO discovery_generations VALUES(OLD.group_id,1) ON CONFLICT(group_id) DO UPDATE SET revision=discovery_generations.revision+1;
END;
CREATE TRIGGER IF NOT EXISTS discovery_membership_epoch AFTER DELETE ON members BEGIN
 INSERT INTO discovery_generations VALUES(OLD.group_id,1) ON CONFLICT(group_id) DO UPDATE SET revision=discovery_generations.revision+1;
END;
CREATE TRIGGER IF NOT EXISTS discovery_member_departure AFTER DELETE ON members BEGIN
 DELETE FROM discovery_tags WHERE person IN (SELECT id FROM discovery_people WHERE group_id=OLD.group_id) AND (actor=OLD.user_id OR person IN (SELECT id FROM discovery_people WHERE account=OLD.user_id));
 DELETE FROM discovery_processing WHERE group_id=OLD.group_id AND subject=OLD.user_id;
 UPDATE discovery_people SET proposed_account=NULL WHERE group_id=OLD.group_id AND proposed_account=OLD.user_id;
 DELETE FROM discovery_vectors WHERE asset IN (SELECT id FROM archive_assets WHERE group_id=OLD.group_id);
END;
CREATE TRIGGER IF NOT EXISTS discovery_origin_withdrawal AFTER UPDATE OF withdrawn ON archive_origins BEGIN
 DELETE FROM discovery_vectors WHERE asset=OLD.asset_id;
END;
CREATE TRIGGER IF NOT EXISTS discovery_origin_deletion AFTER DELETE ON archive_origins BEGIN
 DELETE FROM discovery_vectors WHERE asset=OLD.asset_id;
END;
'''


def text(value, limit=200):
    if not isinstance(value, str) or len(value) > limit:
        raise ValueError('Invalid text')
    return value.strip()


class DiscoveryStore(SourceStore):
    def __init__(self, root, encoder=None):
        super().__init__(root)
        initialize_schema(self.db, SCHEMA)
        self.encoder = encoder if encoder is not None else model.configured_encoder()

    def _visible_ids(self, user, group):
        ids = super()._visible_ids(user, group)
        hidden = {r[0] for r in self.db.execute('SELECT asset FROM discovery_hidden WHERE "user"=?', (user,))}
        return [asset for asset in ids if asset not in hidden]

    def gallery(self, user, group, offset=0, limit=30):
        if type(offset) is not int or offset < 0 or type(limit) is not int or not 1 <= limit <= 100:
            raise ValueError('Invalid page')
        result = []
        for asset in self._visible_ids(user, group)[offset:offset + limit]:
            row = self._asset(user, asset)
            origins = self.origins(user, asset)
            result.append(dict(id=asset, width=row['width'], height=row['height'], origins=origins['items'], origin_count=origins['total'], next_origin_offset=origins['next_offset']))
        return result

    def rendition_bytes(self, user, asset):
        row = self._asset(user, asset)
        visible = set(self._visible_ids(user, row['group_id']))
        if asset not in visible:
            raise Denied('Rendition hidden from discovery')
        selected = self.db.execute('SELECT selected_id FROM review_renditions WHERE asset_id=?', (asset,)).fetchone()
        if selected and selected[0] not in visible:
            return self.asset_bytes(user, asset)
        return super().rendition_bytes(user, asset)

    def places(self, user, group, country='', city='', paths=False):
        self._member(user, group)
        if not isinstance(country, str) or not isinstance(city, str) or type(paths) is not bool:
            raise ValueError('Invalid filters')
        rows = [dict(row) for row in self.db.execute(
            'SELECT p.*,o.asset_id FROM shared_places p JOIN archive_origins o ON o.id=p.origin JOIN members m ON m.group_id=o.group_id AND m.user_id=o.owner_id WHERE o.group_id=? AND o.withdrawn=0 AND NOT EXISTS (SELECT 1 FROM discovery_hidden h WHERE h."user"=? AND h.asset=o.asset_id) ORDER BY p.day,p.origin LIMIT 1001', (group, user))]
        if len(rows) > 1000:
            raise ValueError('Local map limit is 1,000 shared locations')
        visible = set(self._visible_ids(user, group))
        points = [row for row in rows if row['asset_id'] in visible]
        countries = sorted({p['country'] for p in points})
        points = [p for p in points if not country or p['country'] == text(country).upper()]
        cities = sorted({p['city'] for p in points})
        points = [p for p in points if not city or p['city'].casefold() == text(city).casefold()]
        dated = [p for p in points if p['day']]
        return dict(points=points, countries=countries, cities=cities, paths=[[a['origin'], b['origin']] for a, b in zip(dated, dated[1:]) if a['day'] != b['day']] if paths else [])

    def hide(self, user, asset, enabled):
        if type(enabled) is not bool:
            raise ValueError('Boolean required')
        with self.transaction():
            self._asset(user, asset)
            if enabled:
                self.db.execute('INSERT INTO discovery_hidden VALUES(?,?) ON CONFLICT("user",asset) DO NOTHING', (user, asset))
            else:
                self.db.execute('DELETE FROM discovery_hidden WHERE "user"=? AND asset=?', (user, asset))
            self._audit(user, 'discovery.hide' if enabled else 'discovery.unhide', asset)

    def hidden(self, user, group):
        allowed = set(super()._visible_ids(user, group))
        hidden = []
        for (asset,) in self.db.execute('SELECT asset FROM discovery_hidden WHERE "user"=?', (user,)):
            if asset not in allowed:
                continue
            title = self.db.execute('SELECT title FROM review_annotations WHERE asset_id=?', (asset,)).fetchone()
            hidden.append({'id': asset, 'title': title['title'] if title and title['title'] else 'Untitled photograph'})
        return hidden

    def _person(self, user, person):
        row = self.db.execute('SELECT * FROM discovery_people WHERE id=?', (person,)).fetchone()
        if not row:
            raise Denied('Person unavailable')
        self._member(user, row['group_id'])
        return row

    def create_person(self, user, group, name):
        name = text(name, 100)
        if not name:
            raise ValueError('Name required')
        with self.transaction():
            self._member(user, group)
            if self.db.execute('SELECT count(*) FROM discovery_people WHERE group_id=?', (group,)).fetchone()[0] >= 200:
                raise ValueError('Local People limit reached')
            person = uuid.uuid4().hex
            self.db.execute('INSERT INTO discovery_people VALUES(?,?,?,?,NULL,NULL)', (person, group, name, user))
            self._audit(user, 'person.create', person)
        return person

    def propose_identity(self, user, person, account):
        with self.transaction():
            row = self._person(user, person)
            self._member(user, row['group_id'], admin=True)
            self._member(account, row['group_id'])
            if row['account']:
                raise Conflict('Verified identity cannot be reassigned')
            self.db.execute('UPDATE discovery_people SET proposed_account=? WHERE id=?', (account, person))
            self._audit(user, 'person.identity.propose', person)

    def confirm_identity(self, user, person):
        with self.transaction():
            row = self._person(user, person)
            if row['proposed_account'] != user or row['account']:
                raise Denied('No identity confirmation available')
            if self.db.execute('SELECT 1 FROM discovery_people WHERE group_id=? AND account=?', (row['group_id'], user)).fetchone():
                raise Conflict('Account already has a Person identity')
            self.db.execute('UPDATE discovery_people SET account=?,proposed_account=NULL WHERE id=?', (user, person))
            self._audit(user, 'person.identity.confirm', person)

    def identity_requests(self, user, group):
        self._member(user, group)
        return [dict(r) for r in self.db.execute('SELECT id,name FROM discovery_people WHERE group_id=? AND proposed_account=? AND account IS NULL', (group, user))]

    def tag(self, user, person, asset, confirmed):
        if confirmed is not True:
            raise ValueError('Explicit confirmation required')
        with self.transaction():
            row, media = self._person(user, person), self._asset(user, asset)
            if row['group_id'] != media['group_id'] or asset not in self._visible_ids(user, row['group_id']):
                raise Denied('Media unavailable')
            if row['account'] and not self.db.execute('SELECT 1 FROM members WHERE group_id=? AND user_id=?', (row['group_id'], row['account'])).fetchone():
                raise Denied('Verified subject is not a current member')
            if self.db.execute('SELECT 1 FROM discovery_suppressions WHERE person=? AND asset=?', (person, asset)).fetchone():
                raise Conflict('Association suppressed; subject must opt back in')
            self.db.execute('INSERT INTO discovery_tags VALUES(?,?,?) ON CONFLICT(person,asset) DO NOTHING', (person, asset, user))
            self._audit(user, 'person.tag.confirm', person + ':' + asset)

    def untag(self, user, person, asset):
        with self.transaction():
            row = self._person(user, person)
            self._asset(user, asset)
            tag = self.db.execute('SELECT actor FROM discovery_tags WHERE person=? AND asset=?', (person, asset)).fetchone()
            if not tag or (tag[0] != user and row['creator'] != user):
                raise Denied('Association unavailable')
            self.db.execute('DELETE FROM discovery_tags WHERE person=? AND asset=?', (person, asset))
            self._audit(user, 'person.tag.remove', person + ':' + asset)

    def disassociate(self, user, person, asset):
        with self.transaction():
            row = self._person(user, person)
            media = self._asset(user, asset)
            if row['account'] != user or row['group_id'] != media['group_id']:
                raise Denied('Verified subject required')
            self.db.execute('INSERT INTO discovery_suppressions VALUES(?,?,?) ON CONFLICT(person,asset) DO NOTHING', (person, asset, user))
            self.db.execute('DELETE FROM discovery_tags WHERE person=? AND asset=?', (person, asset))
            self._audit(user, 'person.disassociate', person + ':' + asset)

    def restore_association(self, user, person, asset):
        with self.transaction():
            row = self._person(user, person)
            if row['account'] != user or self._asset(user, asset)['group_id'] != row['group_id']:
                raise Denied('Verified subject required')
            self.db.execute('DELETE FROM discovery_suppressions WHERE person=? AND asset=?', (person, asset))
            self.db.execute('INSERT INTO discovery_tags VALUES(?,?,?) ON CONFLICT(person,asset) DO UPDATE SET actor=excluded.actor', (person, asset, user))
            self._audit(user, 'person.opt-in', person + ':' + asset)

    def suppressed(self, user, group):
        self._member(user, group)
        allowed = set(super()._visible_ids(user, group))
        return [dict(r) for r in self.db.execute("SELECT s.person,s.asset,p.name FROM discovery_suppressions s JOIN discovery_people p ON p.id=s.person WHERE p.group_id=? AND p.account=? AND s.subject IN (?, 'private-review')", (group, user, user)) if r['asset'] in allowed]

    def people(self, user, group, manage=False):
        visible = set(self._visible_ids(user, group))
        result = []
        events = self.accepted_events(user, group)
        for row in self.db.execute('SELECT * FROM discovery_people WHERE group_id=? ORDER BY name,id', (group,)):
            # Departed identities do not resurface through another member's tag.
            if row['account'] and not self.db.execute('SELECT 1 FROM members WHERE group_id=? AND user_id=?', (group, row['account'])).fetchone():
                continue
            assets = [r[0] for r in self.db.execute('SELECT t.asset FROM discovery_tags t JOIN members m ON m.user_id=t.actor AND m.group_id=? WHERE t.person=? AND NOT EXISTS (SELECT 1 FROM discovery_suppressions s WHERE s.person=t.person AND s.asset=t.asset)', (group, row['id'])) if r[0] in visible]
            if assets or (manage and row['creator'] == user):
                result.append(dict(id=row['id'], name=row['name'], assets=assets, count=len(assets), is_me=row['account'] == user, verified=bool(row['account']), places=sorted({city for asset in assets for city in self._document(user, asset)['cities']}), memories=[dict(id=e['id'], title=e['title']) for e in events if set(e['assets']) & set(assets)]))
        return result

    def nonmember_review(self, user, person, asset, verified, restore=False):
        if verified is not True or type(restore) is not bool:
            raise ValueError('Privately verified subject request required')
        with self.transaction():
            row = self._person(user, person)
            self._member(user, row['group_id'], admin=True)
            if row['account'] or self._asset(user, asset)['group_id'] != row['group_id']:
                raise Denied('Use the verified member subject controls')
            if restore:
                self.db.execute('DELETE FROM discovery_suppressions WHERE person=? AND asset=?', (person, asset))
                self.db.execute('INSERT INTO discovery_tags VALUES(?,?,?) ON CONFLICT(person,asset) DO UPDATE SET actor=excluded.actor', (person, asset, user))
            else:
                self.db.execute('INSERT INTO discovery_suppressions VALUES(?,?,?) ON CONFLICT(person,asset) DO UPDATE SET subject=excluded.subject', (person, asset, 'private-review'))
                self.db.execute('DELETE FROM discovery_tags WHERE person=? AND asset=?', (person, asset))
            self._audit(user, 'person.private-review.restore' if restore else 'person.private-review.remove', person + ':' + asset)

    def hide_event(self, user, group, event, enabled):
        if type(enabled) is not bool:
            raise ValueError('Boolean required')
        with self.transaction():
            events = super().reviewed_events(user, group)
            if event not in {e['id'] for e in events}:
                raise Denied('Memory unavailable')
            if enabled:
                self.db.execute('INSERT INTO discovery_hidden_events VALUES(?,?) ON CONFLICT("user",event) DO NOTHING', (user, event))
            else:
                self.db.execute('DELETE FROM discovery_hidden_events WHERE "user"=? AND event=?', (user, event))
            self._audit(user, 'discovery.memory.visibility', event)

    def reviewed_events(self, user, group):
        hidden = {r[0] for r in self.db.execute('SELECT event FROM discovery_hidden_events WHERE "user"=?', (user,))}
        return [e for e in super().reviewed_events(user, group) if e['id'] not in hidden]

    def hidden_events(self, user, group):
        hidden = {r[0] for r in self.db.execute('SELECT event FROM discovery_hidden_events WHERE "user"=?', (user,))}
        return [dict(id=e['id'], title=e['title']) for e in super().reviewed_events(user, group) if e['id'] in hidden]

    def _enabled(self, group, subject):
        row = self.db.execute('SELECT enabled FROM discovery_processing WHERE group_id=? AND subject=?', (group, subject)).fetchone()
        return bool(row and row[0])

    def settings(self, user, group):
        self._member(user, group)
        return dict(group_enabled=self._enabled(group, '*'), contribution_enabled=self._enabled(group, user), recognition=False,
                    model=self.encoder.version, model_ready=self.encoder.ready, learned=self.encoder.learned, model_label=self.encoder.label, model_message=self.encoder.message, provider='none; local CPU', provider_cost_per_1000=0)

    def processing(self, user, group, enabled, group_wide=False):
        if type(enabled) is not bool or type(group_wide) is not bool:
            raise ValueError('Boolean required')
        with self.transaction():
            self._member(user, group, admin=group_wide)
            self.db.execute('INSERT INTO discovery_processing VALUES(?,?,?) ON CONFLICT(group_id,subject) DO UPDATE SET enabled=excluded.enabled', (group, '*' if group_wide else user, int(enabled)))
            # Purge the group on every consent transition. Re-enable requires fresh evidence.
            self.db.execute('DELETE FROM discovery_vectors WHERE asset IN (SELECT id FROM archive_assets WHERE group_id=?)', (group,))
            self._audit(user, 'retrieval.processing', group)

    def _document(self, user, asset):
        row = self._asset(user, asset)
        origins = self.db.execute('SELECT o.* FROM archive_origins o JOIN members m ON m.user_id=o.owner_id AND m.group_id=o.group_id WHERE o.asset_id=? AND o.withdrawn=0 ORDER BY o.id', (asset,)).fetchall()
        annotation = self.db.execute('SELECT * FROM review_annotations WHERE asset_id=?', (asset,)).fetchone()
        evidence = [json.loads(o['payload']) for o in origins]
        title = annotation['title'] if annotation else ''
        facts = {self._date_place(asset, p) for p in evidence}
        day, place = next(iter(facts)) if len(facts) == 1 else (None, '')
        shared = [dict(r) for r in self.db.execute('SELECT p.country,p.city FROM shared_places p JOIN archive_origins o ON o.id=p.origin JOIN members m ON m.group_id=o.group_id AND m.user_id=o.owner_id WHERE o.asset_id=? AND o.withdrawn=0', (asset,))]
        cities = sorted({p['city'] for p in shared} | ({place} if place else set()))
        content = ' '.join([title, *cities, *[str(p.get('original_filename') or '') for p in evidence], *[str(c.get('text') or '') for p in evidence for c in p.get('context', [])]])
        eligible = self._enabled(row['group_id'], '*') and all(self._enabled(row['group_id'], o['owner_id']) for o in origins)
        if annotation:
            eligible = eligible and self._enabled(row['group_id'], annotation['actor_id']) and bool(self.db.execute('SELECT 1 FROM members WHERE group_id=? AND user_id=?', (row['group_id'], annotation['actor_id'])).fetchone())
        fingerprint = hashlib.sha256(json.dumps([self.encoder.version, content, [(o['id'], o['payload']) for o in origins]], ensure_ascii=False).encode()).hexdigest()
        sources = {r[0] for r in self.db.execute('SELECT DISTINCT r.source FROM import_runs r JOIN archive_origins o ON o.run_id=r.id JOIN members m ON m.group_id=o.group_id AND m.user_id=o.owner_id WHERE o.asset_id=? AND o.withdrawn=0', (asset,))}
        return dict(id=asset, title=title, date=day, place=place or '', content=content, eligible=bool(eligible), fingerprint=fingerprint, sources=sources, cities=cities, countries={p['country'] for p in shared})

    def _cached_vectors(self, doc):
        rows = self.db.execute('SELECT * FROM discovery_vectors WHERE asset=? ORDER BY modality', (doc['id'],)).fetchall()
        expected = self.encoder.dimensions
        if len(rows) == 2 and all(r['version'] == self.encoder.version and r['fingerprint'] == doc['fingerprint'] and r['dimensions'] == expected.get(r['modality']) for r in rows):
            try:
                vectors = {r['modality']: json.loads(r['vector']) for r in rows}
                for kind, vector in vectors.items():
                    if len(vector) != expected[kind]:
                        raise ValueError('Wrong dimensions')
                    model.cosine(vector, vector)
                return vectors
            except (ValueError, TypeError):
                pass
        return None

    def _save_vectors(self, group, doc, vectors, seconds):
        for kind, vector in vectors.items():
            if len(vector) != self.encoder.dimensions[kind]:
                raise ValueError('Unexpected vector dimensions')
            model.cosine(vector, vector)
            self.db.execute('INSERT INTO discovery_vectors VALUES(?,?,?,?,?,?) ON CONFLICT(asset,modality) DO UPDATE SET version=excluded.version,dimensions=excluded.dimensions,fingerprint=excluded.fingerprint,vector=excluded.vector', (doc['id'], kind, self.encoder.version, len(vector), doc['fingerprint'], json.dumps(vector)))
        self.db.execute('INSERT INTO discovery_measurements VALUES(?,?,?) ON CONFLICT(group_id) DO UPDATE SET embeddings=discovery_measurements.embeddings+excluded.embeddings,seconds=discovery_measurements.seconds+excluded.seconds', (group, 2, seconds))

    def _vectors(self, user, group, doc):
        cached = self._cached_vectors(doc)
        if cached is not None or self.encoder.learned:
            return cached
        started = time.perf_counter()
        vectors = dict(text=self.encoder.text_vector(doc['content']), visual=self.encoder.visual_vector(self.asset_bytes(user, doc['id'])))
        self._save_vectors(group, doc, vectors, time.perf_counter() - started)
        return vectors

    def _generation(self, group):
        row = self.db.execute('SELECT revision FROM discovery_generations WHERE group_id=?', (group,)).fetchone()
        return row[0] if row else 0

    def index_batch(self, user, group, limit=2):
        if type(limit) is not int or not 1 <= limit <= 5:
            raise ValueError('Invalid index batch')
        self._member(user, group)
        if not self.encoder.ready:
            raise Conflict('Local model unavailable; words and filters remain available')
        with self.transaction():
            ids = self._visible_ids(user, group)
            if len(ids) > 1000:
                raise ValueError('Local index limit is 1,000 items')
        indexed, discarded = 0, 0
        attempted = 0
        for asset in ids:
            if attempted >= limit:
                break
            with self.transaction():
                if asset not in self._visible_ids(user, group):
                    continue
                before = self._document(user, asset)
                if not before['eligible'] or self._cached_vectors(before) is not None:
                    continue
                generation = self._generation(group)
                data = self.asset_bytes(user, asset)
            # Expensive inference never holds the database write lock. Mutations can
            # revoke consent here; both the evidence and consent epoch are rechecked.
            attempted += 1
            started = time.perf_counter()
            try:
                vectors = dict(text=self.encoder.text_vector(before['content']), visual=self.encoder.visual_vector(data))
            except RuntimeError as exc:
                raise Conflict('Local model unavailable; the current item was not saved. Earlier indexed items remain available') from exc
            elapsed = time.perf_counter() - started
            with self.transaction():
                if asset not in self._visible_ids(user, group):
                    discarded += 1
                    continue
                after = self._document(user, asset)
                if not after['eligible'] or generation != self._generation(group) or after['fingerprint'] != before['fingerprint']:
                    discarded += 1
                    continue
                self._save_vectors(group, after, vectors, elapsed)
                indexed += 1
        with self.transaction():
            docs = [self._document(user, asset) for asset in self._visible_ids(user, group)]
            remaining = sum(doc['eligible'] and self._cached_vectors(doc) is None for doc in docs)
        return dict(indexed=indexed, discarded=discarded, remaining=remaining)

    def search(self, user, group, query='', mode='keyword', person='', place='', country='', object_query='', start='', end='', source='', similar='', offset=0, limit=30):
        for value in (query, person, place, country, object_query, start, end, source, similar):
            text(value)
        if mode not in ('keyword', 'semantic') or type(offset) is not int or offset < 0 or type(limit) is not int or not 1 <= limit <= 100:
            raise ValueError('Invalid search')
        for stamp in (start, end):
            if stamp and (len(stamp) != 10 or date.fromisoformat(stamp).isoformat() != stamp):
                raise ValueError('Invalid date')
        if start and end and start > end:
            raise ValueError('Invalid date range')
        with self.transaction():
            visible = self._visible_ids(user, group)
            if len(visible) > 1000:
                raise ValueError('Local search limit is 1,000 items')
            people = self.people(user, group)
            person_assets = next((set(p['assets']) for p in people if p['id'] == person), set())
            semantic = mode == 'semantic' and self._enabled(group, '*') and self.encoder.ready
            try:
                query_vector = self.encoder.text_vector(query) if semantic and query else None
            except RuntimeError:
                semantic, query_vector = False, None
            unindexed = 0
            reference = None
            if similar and similar not in visible:
                raise Denied('Reference image unavailable for processing')
            if similar and not semantic:
                similar = ''
            elif similar:
                doc = self._document(user, similar)
                if not doc['eligible']:
                    similar = ''
                else:
                    cached = self._vectors(user, group, doc)
                    if cached is None:
                        raise Conflict('Build the local search index before using this reference image')
                    reference = cached['visual']
            # Garbage-collect inaccessible rows even when an independent writer performed withdrawal.
            allowed = set(super()._visible_ids(user, group))
            for row in self.db.execute('SELECT v.asset FROM discovery_vectors v JOIN archive_assets a ON a.id=v.asset WHERE a.group_id=?', (group,)).fetchall():
                if row[0] not in allowed:
                    self.db.execute('DELETE FROM discovery_vectors WHERE asset=?', (row[0],))
            result = []
            for asset in visible:
                doc = self._document(user, asset)
                if not doc['eligible']:
                    self.db.execute('DELETE FROM discovery_vectors WHERE asset=?', (asset,))
                if person and asset not in person_assets or place and not any(place.casefold() in city.casefold() for city in doc['cities']):
                    continue
                if country and country.upper() not in doc['countries']:
                    continue
                if source and source not in doc['sources'] or start and (not doc['date'] or doc['date'] < start) or end and (not doc['date'] or doc['date'] > end):
                    continue
                if object_query and not model.terms(object_query) <= model.terms(doc['content']):
                    continue  # Explicit text concepts, never inferred objects/faces.
                score, basis = 1.0, 'keyword / filters'
                vectors = self._vectors(user, group, doc) if semantic and doc['eligible'] else None
                if semantic and doc['eligible'] and vectors is None:
                    unindexed += 1
                if vectors is not None:
                    score = self.encoder.score(query_vector, vectors, doc['content'], query) if query else 1.0
                    if reference is not None:
                        if asset == similar:
                            continue
                        score *= model.cosine(reference, vectors['visual'])
                    basis = self.encoder.label
                elif similar:
                    continue
                elif query and not all(word in doc['content'].casefold() for word in query.casefold().split()):
                    continue
                if score <= 0:
                    continue
                result.append(dict(id=asset, title=doc['title'], date=doc['date'], place=doc['place'], score=round(score, 5), basis=basis,
                                   people=[dict(id=p['id'], name=p['name'], is_me=p['is_me'], can_remove=bool(self.db.execute('SELECT 1 FROM discovery_tags t JOIN discovery_people p ON p.id=t.person WHERE t.person=? AND t.asset=? AND (t.actor=? OR p.creator=?)', (p['id'], asset, user, user)).fetchone())) for p in people if asset in p['assets']]))
            result.sort(key=lambda r: (-r['score'], r['id']))
            return dict(items=result[offset:offset + limit], total=len(result), next_offset=offset + limit if offset + limit < len(result) else None,
                        mode=self.encoder.label if semantic else 'keyword / filters', model=self.encoder.version if semantic else None, unindexed=unindexed, message=self.encoder.message)

    def export_archive(self, user, group):
        output = io.BytesIO(super().export_archive(user, group))
        with zipfile.ZipFile(output, 'a', compression=zipfile.ZIP_STORED) as archive:
            archive.writestr('people.json', json.dumps(self.people(user, group)))
            archive.writestr('personal-discovery.json', json.dumps(dict(hidden=self.hidden(user, group), hidden_memories=self.hidden_events(user, group), suppressed=self.suppressed(user, group), processing=self.settings(user, group))))
        return output.getvalue()
