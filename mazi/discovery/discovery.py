"""Current authorization precedes filtering, ranking, counts and People output.

SQLite write transactions serialize local retrieval with membership/consent
mutations. Vectors are derivatives, never an authorization source.
"""
from mazi.archive.export import ExportArray
from mazi.archive.photo_context import SharingContext, hidden_event_assets
from mazi.archive.photo_metadata import resolve_photo

from .photo_filters import PhotoFilter
import hashlib
from mazi.persistence import initialize_schema, insertion_order

import json
import time
import uuid
from collections import Counter
from datetime import date

from mazi.capacity import CapacityExceeded
from mazi.identity.core import Conflict, Denied
from mazi.sources.sources import SourceStore
from . import embeddings as model

KEYWORD_ORIGIN_BYTES = 64 * 1024
KEYWORD_ASSET_BYTES = 8 * 1024 * 1024
KEYWORD_REQUEST_BYTES = 64 * 1024 * 1024
KEYWORD_SCAN_SECONDS = 2
DISCOVERY_SCAN_SECONDS = 15
DISCOVERY_ITEMS = 10000
EXPORT_PEOPLE_CITY_KEYS = 1000
EXPORT_PEOPLE_CITY_ENTRIES = 4096
EXPORT_PEOPLE_CITY_CHARACTERS = 262144

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


def sharers(payloads, owners):
    """Who shared a photograph, as its card says: the chat senders, else the importing members."""
    senders = {label for payload in payloads if (label := (payload.get('sender') or {}).get('label'))}
    return senders or {name for name in owners if name}


def facets(source_counts, sharer_counts):
    return dict(sources=[dict(value=value, count=count) for value, count in sorted(source_counts.items(), key=lambda entry: (-entry[1], entry[0]))],
                shared_by=[dict(value=value, count=count) for value, count in sorted(sharer_counts.items(), key=lambda entry: (entry[0].casefold(), entry[0]))])


class DiscoveryStore(SourceStore):
    def __init__(self, root, encoder=None):
        super().__init__(root)
        initialize_schema(self.db, SCHEMA)
        self.encoder = encoder if encoder is not None else model.configured_encoder()

    def _visible_ids(self, user, group):
        ids = super()._visible_ids(user, group)
        hidden = {r[0] for r in self.db.execute('SELECT asset FROM discovery_hidden WHERE "user"=?', (user,))}
        return [asset for asset in ids if asset not in hidden]

    def _correction_visible_ids(self, user, group):
        return set(self._visible_ids(user, group)) - hidden_event_assets(self, user, group)

    def gallery(self, user, group, offset=0, limit=30):
        if type(offset) is not int or offset < 0 or type(limit) is not int or not 1 <= limit <= 100:
            raise ValueError('Invalid page')
        result = []
        for asset in self._visible_ids(user, group)[offset:offset + limit]:
            row = self._asset(user, asset)
            origins = self.origins(user, asset)
            result.append(dict(id=asset, width=row['width'], height=row['height'], origins=origins['items'], origin_count=origins['total'], next_origin_offset=origins['next_offset']))
        return result

    def _rendition_locator(self, user, asset, *, original=None):
        if original is None:
            original = self._asset_locator(user, asset)
        self._member(user, original[0]['group_id'])
        resolved = super()._rendition_locator(user, asset, original=original)
        hidden = {row[0] for row in self.db.execute(
            'SELECT asset FROM discovery_hidden WHERE "user"=? AND asset IN (?,?)',
            (user, asset, resolved[0]['id']))}
        if asset in hidden:
            raise Denied('Rendition hidden from discovery')
        return original if resolved[0]['id'] in hidden else resolved

    def _places_query(self, user, group):
        clause, params = super()._places_query(user, group)
        hidden = hidden_event_assets(self, user, group)
        if hidden:
            clause += ' AND o.asset_id NOT IN (' + ','.join('?' for _ in hidden) + ')'
            params = (*params, *sorted(hidden))
        return clause + ' AND NOT EXISTS (SELECT 1 FROM discovery_hidden h WHERE h."user"=? AND h.asset=o.asset_id)', (*params, user)

    def places(self, user, group, country='', city='', paths=False):
        return super().places(user, group, text(country).upper(), text(city), paths)

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
        return self._people(user, group, manage)

    def _people(self, user, group, manage=False, *, reuse_cities=False):
        return list(self._iter_people(user, group, manage, reuse_cities=reuse_cities))

    def _iter_people(self, user, group, manage=False, *, reuse_cities=False):
        city_cache = {} if reuse_cities else None
        city_entries = city_characters = 0

        def asset_cities(asset):
            nonlocal city_entries, city_characters
            if city_cache is None:
                return self._document(user, asset)['cities']
            if asset in city_cache:
                return city_cache[asset]
            cities = tuple(self._export_document(user, asset)['cities'])
            characters = sum(len(city) for city in cities)
            if (len(city_cache) < EXPORT_PEOPLE_CITY_KEYS and
                    city_entries + len(cities) <= EXPORT_PEOPLE_CITY_ENTRIES and
                    city_characters + characters <= EXPORT_PEOPLE_CITY_CHARACTERS):
                city_cache[asset] = cities
                city_entries += len(cities)
                city_characters += characters
            return cities

        visible = set(self._visible_ids(user, group))
        events = None if reuse_cities else self.accepted_events(user, group)
        rows = (self._export_rows('SELECT * FROM discovery_people WHERE group_id=?', (group,), [('name', 'name', False), ('id', 'id', False)])
                if reuse_cities else self.db.execute('SELECT * FROM discovery_people WHERE group_id=? ORDER BY name,id', (group,)))
        for row in rows:
            # Departed identities do not resurface through another member's tag.
            if row['account'] and not self.db.execute('SELECT 1 FROM members WHERE group_id=? AND user_id=?', (group, row['account'])).fetchone():
                continue
            tag_query = ('SELECT t.asset FROM discovery_tags t JOIN members m ON m.user_id=t.actor AND m.group_id=? '
                         'WHERE t.person=? AND NOT EXISTS (SELECT 1 FROM discovery_suppressions s WHERE s.person=t.person AND s.asset=t.asset)')
            tags = (self._export_rows(tag_query, (group, row['id']), [('t.asset', 'asset', False)])
                    if reuse_cities else self.db.execute(tag_query, (group, row['id'])))
            assets = [r[0] for r in tags if r[0] in visible]
            if assets or (manage and row['creator'] == user):
                memories = (ExportArray(self._export_person_memories(user, group, visible, set(assets)))
                            if events is None else [dict(id=e['id'], title=e['title']) for e in events if set(e['assets']) & set(assets)])
                yield dict(id=row['id'], name=row['name'], assets=assets, count=len(assets), is_me=row['account'] == user, verified=bool(row['account']), places=sorted({city for asset in assets for city in asset_cities(asset)}), memories=memories)

    def _export_document(self, user, asset):
        self._asset(user, asset)
        annotation = self.db.execute('SELECT * FROM review_annotations WHERE asset_id=?', (asset,)).fetchone()
        place, conflicting = None, False
        for payload in self._export_origins(user, asset):
            _, places = self._date_place_evidence(asset, payload, annotation)
            for candidate in places:
                if place is None:
                    place = candidate
                elif candidate != place:
                    conflicting = True
        cities = set()
        if place and not conflicting:
            cities.add(place)
        for row in self._export_rows('SELECT DISTINCT p.city FROM shared_places p JOIN archive_origins o ON o.id=p.origin JOIN members m ON m.group_id=o.group_id AND m.user_id=o.owner_id WHERE o.asset_id=? AND o.withdrawn=0', (asset,), [('p.city', 'city', False)]):
            cities.add(row[0])
        return dict(cities=sorted(cities))

    def _export_person_memories(self, user, group, visible, assets):
        event_order = "e.id" if getattr(self.db, "hosted", False) else insertion_order(self.db, "e")
        for row in self._export_rows("SELECT id,title,asset_ids,updated_at," + event_order + " AS export_order FROM review_events e WHERE group_id=? AND status='accepted' AND NOT EXISTS (SELECT 1 FROM discovery_hidden_events h WHERE h.event=e.id AND h.\"user\"=?) ", (group, user), [("updated_at", "updated_at", True), (event_order, "export_order", False)]):
            event_assets = {asset for asset in json.loads(row['asset_ids']) if asset in visible}
            if len(event_assets) >= 2 and event_assets & assets:
                yield dict(id=row['id'], title=row['title'])

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

    def _document(self, user, asset, context=None):
        row = self._asset(user, asset)
        origins = self.db.execute('SELECT o.*,sp.display_name AS owner_name FROM archive_origins o JOIN members m ON m.user_id=o.owner_id AND m.group_id=o.group_id LEFT JOIN shared_profiles sp ON sp.user_id=o.owner_id WHERE o.asset_id=? AND o.withdrawn=0 ORDER BY o.id', (asset,)).fetchall()
        annotation = self.db.execute('SELECT * FROM review_annotations WHERE asset_id=?', (asset,)).fetchone()
        evidence = [json.loads(o['payload']) for o in origins]
        title = annotation['title'] if annotation else ''
        dates, places = set(), set()
        for payload in evidence:
            source_dates, source_places = self._date_place_evidence(asset, payload, annotation)
            dates.update(source_dates)
            places.update(source_places)
        day = next(iter(dates)) if len(dates) == 1 else None
        place = next(iter(places)) if len(places) == 1 else ''
        shared = [dict(r) for r in self.db.execute('SELECT p.country,p.city,p.latitude,p.longitude FROM shared_places p JOIN archive_origins o ON o.id=p.origin JOIN members m ON m.group_id=o.group_id AND m.user_id=o.owner_id WHERE o.asset_id=? AND o.withdrawn=0', (asset,))]
        cities = sorted({p['city'] for p in shared} | ({place} if place else set()))
        content = ' '.join([title, *cities, *[str(p.get('original_filename') or '') for p in evidence], *[str(c.get('text') or '') for p in evidence for c in p.get('context', [])]])
        eligible = self._enabled(row['group_id'], '*') and all(self._enabled(row['group_id'], o['owner_id']) for o in origins)
        if annotation:
            eligible = eligible and self._enabled(row['group_id'], annotation['actor_id']) and bool(self.db.execute('SELECT 1 FROM members WHERE group_id=? AND user_id=?', (row['group_id'], annotation['actor_id'])).fetchone())
        fingerprint = hashlib.sha256(json.dumps([self.encoder.version, content, [(o['id'], o['payload']) for o in origins]], ensure_ascii=False).encode()).hexdigest()
        sources = {r[0] for r in self.db.execute('SELECT DISTINCT r.source FROM import_runs r JOIN archive_origins o ON o.run_id=r.id JOIN members m ON m.group_id=o.group_id AND m.user_id=o.owner_id WHERE o.asset_id=? AND o.withdrawn=0', (asset,))}
        result = dict(id=asset, title=title, date=day, place=place or '', content=content, eligible=bool(eligible), fingerprint=fingerprint, sources=sources,
                      shared_by=sharers(evidence, (o['owner_name'] for o in origins)), cities=cities, countries={p['country'] for p in shared})
        if context is not None:
            provenance = [context.provenance(origin['run_id'], payload) for origin, payload in zip(origins, evidence)]
            result['evidence'] = resolve_photo(dates, provenance, annotation['place'] if annotation else '', shared)
        return result

    def _bounded_document(self, user, asset):
        byte_length = 'octet_length(o.payload)' if getattr(self.db, 'hosted', False) else 'length(CAST(o.payload AS BLOB))'
        row = self.db.execute(f'SELECT MAX({byte_length}) AS largest,SUM({byte_length}) AS total,COUNT(*) AS origins '
                              'FROM archive_origins o JOIN members m ON m.group_id=o.group_id AND m.user_id=o.owner_id '
                              'WHERE o.asset_id=? AND o.withdrawn=0', (asset,)).fetchone()
        if row['origins'] > 8192 or (row['largest'] or 0) > KEYWORD_ORIGIN_BYTES or (row['total'] or 0) > KEYWORD_ASSET_BYTES:
            raise CapacityExceeded('Local discovery exceeded its per-photograph metadata budget')
        return self._document(user, asset)

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
        started = time.perf_counter()
        with self.transaction():
            ids = self._visible_ids(user, group)
            large = len(ids) > 1000
            if len(ids) > DISCOVERY_ITEMS:
                raise CapacityExceeded('Local index supports up to 10,000 visible photographs')
            if large:
                candidates = []
                for doc in self._keyword_documents(user, group, '', started, processing=True, photo_evidence=False):
                    if len(candidates) < limit and doc['eligible'] and self._cached_vectors(doc) is None:
                        candidates.append(doc['id'])
                ids = candidates
        indexed, discarded = 0, 0
        attempted = 0
        for asset in ids:
            if attempted >= limit:
                break
            with self.transaction():
                if asset not in self._visible_ids(user, group):
                    continue
                before = self._bounded_document(user, asset) if large else self._document(user, asset)
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
                after = self._bounded_document(user, asset) if large else self._document(user, asset)
                if not after['eligible'] or generation != self._generation(group) or after['fingerprint'] != before['fingerprint']:
                    discarded += 1
                    continue
                self._save_vectors(group, after, vectors, elapsed)
                indexed += 1
        with self.transaction():
            visible = self._visible_ids(user, group)
            if large and len(visible) > DISCOVERY_ITEMS:
                raise CapacityExceeded('Local index supports up to 10,000 visible photographs')
            documents = (self._keyword_documents(user, group, '', time.perf_counter(), processing=True, photo_evidence=False) if large
                         else (self._document(user, asset) for asset in visible))
            remaining = sum(doc['eligible'] and self._cached_vectors(doc) is None for doc in documents)
        return dict(indexed=indexed, discarded=discarded, remaining=remaining)

    def _keyword_documents(self, user, group, person, started, processing=False, bounded_metadata=True, photo_evidence=True):
        last_asset = last_origin = ''
        asset, records, shared, sources, owners, annotation = None, [], [], set(), set(), None
        provenance = []
        asset_bytes = request_bytes = asset_origins = request_origins = 0
        fingerprints, eligible = [], True
        scan_seconds = DISCOVERY_SCAN_SECONDS if processing else KEYWORD_SCAN_SECONDS
        def consume_context(size):
            nonlocal request_bytes, request_origins
            request_bytes += size
            request_origins += 1
            if bounded_metadata and request_bytes > KEYWORD_REQUEST_BYTES:
                raise CapacityExceeded('Words & filters metadata exceeds the 64 MiB request limit')
            if bounded_metadata and request_origins > 100000:
                raise CapacityExceeded('Local discovery exceeded its metadata origin-count budget')
        context = SharingContext(self, user, group, started, scan_seconds, bounded_metadata, consume_context) if photo_evidence else None
        hidden = hidden_event_assets(self, user, group)
        byte_length = 'octet_length(o.payload)' if getattr(self.db, 'hosted', False) else 'length(CAST(o.payload AS BLOB))'
        payload = f'CASE WHEN {byte_length}<=? THEN o.payload ELSE NULL END' if bounded_metadata else 'o.payload'
        person_match = '''EXISTS (
            SELECT 1 FROM discovery_tags t JOIN discovery_people p ON p.id=t.person
            JOIN members m ON m.group_id=p.group_id AND m.user_id=t.actor
            WHERE t.person=? AND t.asset=a.id AND p.group_id=a.group_id
            AND (p.account IS NULL OR EXISTS (SELECT 1 FROM members identity_member
                 WHERE identity_member.group_id=p.group_id AND identity_member.user_id=p.account))
            AND NOT EXISTS (SELECT 1 FROM discovery_suppressions d WHERE d.person=t.person AND d.asset=t.asset)
        )''' if person else '1'

        def document():
            dates, places = set(), set()
            for payload in records:
                source_dates, source_places = self._date_place_evidence(asset, payload, annotation)
                dates.update(source_dates)
                places.update(source_places)
            day = next(iter(dates)) if len(dates) == 1 else None
            place = next(iter(places)) if len(places) == 1 else ''
            cities = sorted({item['city'] for item in shared} | ({place} if place else set()))
            title = annotation['title'] or ''
            content = ' '.join([title, *cities, *[str(p.get('original_filename') or '') for p in records],
                                *[str(c.get('text') or '') for p in records for c in p.get('context', [])]])
            result = dict(id=asset, title=title, date=day, place=place, content=content,
                          sources=sources, shared_by=sharers(records, owners), cities=cities, countries={item['country'] for item in shared},
                          person_match=annotation['person_match'])
            if photo_evidence:
                result['evidence'] = resolve_photo(dates, provenance, annotation['place'] or '', shared)
            if processing:
                fingerprint = hashlib.sha256(json.dumps([self.encoder.version, content, fingerprints], ensure_ascii=False).encode()).hexdigest()
                result.update(eligible=eligible, fingerprint=fingerprint)
            return result

        while True:
            if bounded_metadata and time.perf_counter() - started > scan_seconds:
                raise CapacityExceeded('Words & filters exceeded the local metadata scan time budget')
            batch = self.db.execute(f'''SELECT a.id,o.id AS origin,{byte_length} AS payload_bytes,
                    {payload} AS payload,
                    o.run_id,r.source,sp.display_name AS owner_name,n.title,n.capture_date,n.place,p.country,p.city,p.latitude,p.longitude,{person_match} AS person_match,
                    (EXISTS (SELECT 1 FROM discovery_processing d WHERE d.group_id=a.group_id AND d.subject='*' AND d.enabled<>0)
                    AND EXISTS (SELECT 1 FROM discovery_processing d WHERE d.group_id=a.group_id AND d.subject=o.owner_id AND d.enabled<>0)
                    AND (n.asset_id IS NULL OR (EXISTS (SELECT 1 FROM discovery_processing d WHERE d.group_id=a.group_id AND d.subject=n.actor_id AND d.enabled<>0)
                        AND EXISTS (SELECT 1 FROM members actor WHERE actor.group_id=a.group_id AND actor.user_id=n.actor_id)))) AS eligible
                FROM archive_origins o JOIN archive_assets a ON a.id=o.asset_id
                JOIN members m ON m.group_id=o.group_id AND m.user_id=o.owner_id
                JOIN import_runs r ON r.id=o.run_id
                LEFT JOIN review_annotations n ON n.asset_id=a.id
                LEFT JOIN shared_places p ON p.origin=o.id
                LEFT JOIN shared_profiles sp ON sp.user_id=o.owner_id
                WHERE o.group_id=? AND a.group_id=? AND o.withdrawn=0 AND o.asset_id>=?
                AND NOT EXISTS (SELECT 1 FROM discovery_hidden h WHERE h."user"=? AND h.asset=a.id)
                AND (o.asset_id>? OR (o.asset_id=? AND o.id>?))
                ORDER BY o.asset_id,o.id LIMIT 256''',
                (*((KEYWORD_ORIGIN_BYTES,) if bounded_metadata else ()), *((person,) if person else ()), group, group,
                 last_asset, user, last_asset, last_asset, last_origin)).fetchall()
            if not batch:
                break
            for row in batch:
                if row['id'] in hidden:
                    continue
                if asset is not None and asset != row['id']:
                    yield document()
                    records, shared, sources, owners, asset_bytes = [], [], set(), set(), 0
                    provenance = []
                    fingerprints, eligible, asset_origins = [], True, 0
                asset, annotation = row['id'], row
                if bounded_metadata and row['payload_bytes'] > KEYWORD_ORIGIN_BYTES:
                    raise CapacityExceeded('Words & filters metadata exceeds the 64 KiB per-origin limit')
                asset_origins += 1
                request_origins += 1
                if bounded_metadata and (asset_origins > 8192 or request_origins > 100000):
                    raise CapacityExceeded('Local discovery exceeded its metadata origin-count budget')
                asset_bytes += row['payload_bytes']
                request_bytes += row['payload_bytes']
                if bounded_metadata and asset_bytes > KEYWORD_ASSET_BYTES:
                    raise CapacityExceeded('Words & filters metadata exceeds the 8 MiB per-photograph limit')
                if bounded_metadata and request_bytes > KEYWORD_REQUEST_BYTES:
                    raise CapacityExceeded('Words & filters metadata exceeds the 64 MiB request limit')
                record = json.loads(row['payload'])
                records.append(record)
                if context is not None:
                    provenance.append(context.provenance(row['run_id'], record))
                if processing:
                    fingerprints.append((row['origin'], row['payload']))
                    eligible = eligible and bool(row['eligible'])
                if row['country'] is not None:
                    shared.append({key: row[key] for key in ('country', 'city', 'latitude', 'longitude')})
                sources.add(row['source'])
                owners.add(row['owner_name'])
            last_asset, last_origin = batch[-1]['id'], batch[-1]['origin']
            del batch
        if asset is not None:
            yield document()
        if bounded_metadata and time.perf_counter() - started > scan_seconds:
            raise CapacityExceeded('Words & filters exceeded the local metadata scan time budget')

    def _keyword_search(self, user, group, query='', person='', place='', country='', object_query='', start='', end='', source='', similar='', offset=0, limit=30, bounded_metadata=True, shared_by='', date_basis='', photo_filters=None, collect=False):
        self._member(user, group)
        if similar and not self.db.execute('''SELECT 1 FROM archive_assets a
                WHERE a.id=? AND a.group_id=?
                AND EXISTS (SELECT 1 FROM archive_origins o JOIN members m
                    ON m.group_id=o.group_id AND m.user_id=o.owner_id WHERE o.asset_id=a.id AND o.withdrawn=0)
                AND NOT EXISTS (SELECT 1 FROM discovery_hidden h WHERE h."user"=? AND h.asset=a.id)''',
                (similar, group, user)).fetchone():
            raise Denied('Reference image unavailable for processing')
        started = time.perf_counter()
        self.db.execute('''DELETE FROM discovery_vectors WHERE asset IN (
            SELECT a.id FROM archive_assets a WHERE a.group_id=? AND (
                NOT EXISTS (SELECT 1 FROM archive_origins o JOIN members m
                    ON m.group_id=o.group_id AND m.user_id=o.owner_id WHERE o.asset_id=a.id AND o.withdrawn=0)
                OR (NOT EXISTS (SELECT 1 FROM discovery_hidden h WHERE h."user"=? AND h.asset=a.id) AND (
                    NOT EXISTS (SELECT 1 FROM discovery_processing p WHERE p.group_id=a.group_id AND p.subject='*' AND p.enabled<>0)
                    OR EXISTS (SELECT 1 FROM archive_origins o JOIN members m
                        ON m.group_id=o.group_id AND m.user_id=o.owner_id WHERE o.asset_id=a.id AND o.withdrawn=0
                        AND NOT EXISTS (SELECT 1 FROM discovery_processing p WHERE p.group_id=a.group_id AND p.subject=o.owner_id AND p.enabled<>0))
                    OR EXISTS (SELECT 1 FROM review_annotations n WHERE n.asset_id=a.id AND (
                        NOT EXISTS (SELECT 1 FROM discovery_processing p WHERE p.group_id=a.group_id AND p.subject=n.actor_id AND p.enabled<>0)
                        OR NOT EXISTS (SELECT 1 FROM members m WHERE m.group_id=a.group_id AND m.user_id=n.actor_id)))
                ))))''', (group, user))
        total, items, matched = 0, [], []
        predicate = PhotoFilter(self, user, group, person=person, place=place, country=country, source=source, shared_by=shared_by, start=start, end=end, date_basis=date_basis, **(photo_filters or {}))
        source_counts, sharer_counts = Counter(), Counter()
        words, objects = query.casefold().split(), model.terms(object_query)
        for doc in self._keyword_documents(user, group, "", started, bounded_metadata=bounded_metadata):
            source_counts.update(doc['sources'])
            sharer_counts.update(doc['shared_by'])
            predicate.count(doc)
            if not predicate.matches(doc):
                continue
            if object_query and not objects <= model.terms(doc['content']):
                continue
            if query and not all(word in doc['content'].casefold() for word in words):
                continue
            if collect:
                matched.append(doc["id"])
            elif offset <= total < offset + limit:
                items.append(dict(id=doc['id'], title=doc['title'], date=doc['date'], place=doc['place'],
                                  sources=sorted(doc['sources']), shared_by=sorted(doc['shared_by']),
                                  score=1.0, basis='keyword / filters', people=[], assetId=doc['id'], evidence=doc['evidence']))
            total += 1
        if collect:
            return dict(asset_ids=matched, total=total, photo_facets=predicate.facets(), facets=facets(source_counts, sharer_counts))
        self._hydrate_people(user, group, items)
        self._attach_photo_labels(group, items)
        return dict(items=items, total=total, photo_facets=predicate.facets(), next_offset=offset + limit if offset + limit < total else None,
                    facets=facets(source_counts, sharer_counts),
                    mode='keyword / filters', model=None, unindexed=0, message=self.encoder.message)

    def _hydrate_people(self, user, group, items):
        page = {item['id']: item for item in items}
        if page:
            for row in self.db.execute('''SELECT t.asset,p.id,p.name,p.account,p.creator,t.actor
                    FROM discovery_tags t JOIN discovery_people p ON p.id=t.person
                    JOIN members m ON m.group_id=p.group_id AND m.user_id=t.actor
                    WHERE p.group_id=? AND t.asset IN (%s)
                    AND (p.account IS NULL OR EXISTS (SELECT 1 FROM members identity_member
                        WHERE identity_member.group_id=p.group_id AND identity_member.user_id=p.account))
                    AND NOT EXISTS (SELECT 1 FROM discovery_suppressions d WHERE d.person=t.person AND d.asset=t.asset)
                    ORDER BY p.name,p.id''' % ','.join('?' for _ in page), (group, *page)):
                page[row['asset']]['people'].append(dict(id=row['id'], name=row['name'], is_me=row['account'] == user,
                                                       can_remove=row['actor'] == user or row['creator'] == user))
    def search(self, user, group, **filters):
        if any(key.startswith('_') for key in filters):
            raise ValueError('Invalid search parameter')
        return self._search(user, group, **filters)

    def photo_matches(self, user, group, **filters):
        if any(key.startswith('_') for key in filters) or filters.get('mode', 'keyword') != 'keyword':
            raise ValueError('Gallery supports words and filters')
        return self._search(user, group, _all_ids=True, **filters)

    def _search(self, user, group, query='', mode='keyword', person='', place='', country='', object_query='', start='', end='', source='', similar='', offset=0, limit=30, shared_by='', date_basis='', people_present='', screenshot='', ai='', years='', places='', uncertain='', _all_ids=False):
        photo_filters = dict(people_present=people_present, screenshot=screenshot, ai=ai, years=years, places=places, uncertain=uncertain)
        for value in (query, place, country, object_query, start, end, similar):
            text(value)
        if mode not in ('keyword', 'semantic') or date_basis not in ('', 'capture', 'shared', 'chronology') or type(offset) is not int or offset < 0 or type(limit) is not int or not 1 <= limit <= 100:
            raise ValueError('Invalid search')
        for stamp in (start, end):
            if stamp and (len(stamp) != 10 or date.fromisoformat(stamp).isoformat() != stamp):
                raise ValueError('Invalid date')
        if start and end and start > end:
            raise ValueError('Invalid date range')
        with self.transaction():
            if mode == 'keyword':
                self._member(user, group)
                probe = self.db.execute('''SELECT a.id FROM archive_assets a WHERE a.group_id=?
                    AND EXISTS (SELECT 1 FROM archive_origins o JOIN members m
                        ON m.group_id=o.group_id AND m.user_id=o.owner_id WHERE o.asset_id=a.id AND o.withdrawn=0)
                    AND NOT EXISTS (SELECT 1 FROM discovery_hidden h WHERE h."user"=? AND h.asset=a.id)
                    LIMIT 1001''', (group, user)).fetchall()
                return self._keyword_search(user, group, query, person, place, country, object_query,
                                            start, end, source, similar, offset, limit,
                                            bounded_metadata=len(probe) > 1000, shared_by=shared_by, date_basis=date_basis, photo_filters=photo_filters, collect=_all_ids)
            hidden = hidden_event_assets(self, user, group)
            visible = [asset for asset in self._visible_ids(user, group) if asset not in hidden]
            large = len(visible) > 1000
            if len(visible) > DISCOVERY_ITEMS:
                raise CapacityExceeded('Local related search supports up to 10,000 visible photographs')
            started = time.perf_counter()
            people = [] if large else self.people(user, group)
            predicate = PhotoFilter(self, user, group, person=person, place=place, country=country, source=source, shared_by=shared_by, start=start, end=end, date_basis=date_basis, **photo_filters)
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
                doc = self._bounded_document(user, similar) if large else self._document(user, similar)
                if not doc['eligible']:
                    similar = ''
                else:
                    cached = self._cached_vectors(doc) if large else self._vectors(user, group, doc)
                    if cached is None:
                        raise Conflict('Build the local search index before using this reference image')
                    reference = cached['visual']
            # Garbage-collect inaccessible rows even when an independent writer performed withdrawal.
            allowed = set(super()._visible_ids(user, group))
            for row in self.db.execute('SELECT v.asset FROM discovery_vectors v JOIN archive_assets a ON a.id=v.asset WHERE a.group_id=?', (group,)).fetchall():
                if row[0] not in allowed:
                    self.db.execute('DELETE FROM discovery_vectors WHERE asset=?', (row[0],))
            result = []
            source_counts, sharer_counts = Counter(), Counter()
            context = SharingContext(self, user, group, started, DISCOVERY_SCAN_SECONDS, bounded=large)
            documents = (self._keyword_documents(user, group, "", started, processing=True) if large
                         else (self._document(user, asset, context) for asset in visible))
            for doc in documents:
                asset = doc['id']
                if large and time.perf_counter() - started > DISCOVERY_SCAN_SECONDS:
                    raise CapacityExceeded('Local related search exceeded its 15 second processing budget')
                if not doc['eligible']:
                    self.db.execute('DELETE FROM discovery_vectors WHERE asset=?', (asset,))
                source_counts.update(doc['sources'])
                sharer_counts.update(doc['shared_by'])
                predicate.count(doc)
                if not predicate.matches(doc):
                    continue
                if object_query and not model.terms(object_query) <= model.terms(doc['content']):
                    continue  # Explicit text concepts, never inferred objects/faces.
                score, basis = 1.0, 'keyword / filters'
                vectors = (self._cached_vectors(doc) if large else self._vectors(user, group, doc)) if semantic and doc['eligible'] else None
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
                result.append(dict(id=asset, title=doc['title'], date=doc['date'], place=doc['place'],
                                   sources=sorted(doc['sources']), shared_by=sorted(doc['shared_by']), score=round(score, 5), basis=basis, assetId=asset, evidence=doc['evidence'],
                                   people=[] if large else [dict(id=p['id'], name=p['name'], is_me=p['is_me'], can_remove=bool(self.db.execute('SELECT 1 FROM discovery_tags t JOIN discovery_people p ON p.id=t.person WHERE t.person=? AND t.asset=? AND (t.actor=? OR p.creator=?)', (p['id'], asset, user, user)).fetchone())) for p in people if asset in p['assets']]))
            result.sort(key=lambda r: (-r['score'], r['id']))
            page = result[offset:offset + limit]
            if large:
                self._hydrate_people(user, group, page)
            self._attach_photo_labels(group, page)
            return dict(items=page, total=len(result), photo_facets=predicate.facets(), next_offset=offset + limit if offset + limit < len(result) else None,
                        facets=facets(source_counts, sharer_counts),
                        mode=self.encoder.label if semantic else 'keyword / filters', model=self.encoder.version if semantic else None, unindexed=unindexed, message=self.encoder.message)

    def _export_personal(self, user, group, kind):
        live = ("EXISTS (SELECT 1 FROM archive_assets a WHERE a.id={asset} AND a.group_id=? AND EXISTS "
                "(SELECT 1 FROM archive_origins o JOIN members m ON m.user_id=o.owner_id AND m.group_id=o.group_id "
                "WHERE o.asset_id=a.id AND o.withdrawn=0))")
        if kind == 'hidden':
            query = ('SELECT h.asset,n.title FROM discovery_hidden h '
                     'LEFT JOIN review_annotations n ON n.asset_id=h.asset WHERE h."user"=? AND ' + live.format(asset='h.asset'))
            for row in self._export_rows(query, (user, group), [('h.asset', 'asset', False)]):
                yield dict(id=row['asset'], title=row['title'] or 'Untitled photograph')
        elif kind == 'suppressed':
            query = ("SELECT s.person,s.asset,p.name FROM discovery_suppressions s "
                     "JOIN discovery_people p ON p.id=s.person WHERE p.group_id=? AND p.account=? AND s.subject IN (?, 'private-review') AND " + live.format(asset='s.asset'))
            for row in self._export_rows(query, (group, user, user, group), [('s.person', 'person', False), ('s.asset', 'asset', False)]):
                yield {key: row[key] for key in ('person', 'asset', 'name')}
        else:
            event_order = "e.id" if getattr(self.db, "hosted", False) else insertion_order(self.db, 'e')
            visible = set(self._visible_ids(user, group))
            query = ('SELECT e.id,e.title,e.asset_ids,e.updated_at,e.status,' + event_order + ' AS export_order FROM review_events e '
                     'WHERE e.group_id=? AND EXISTS (SELECT 1 FROM discovery_hidden_events h WHERE h.event=e.id AND h."user"=?)')
            for row in self._export_rows(query, (group, user), [('e.updated_at', 'updated_at', True), ('e.status', 'status', False), (event_order, 'export_order', False)]):
                if sum(asset in visible for asset in json.loads(row['asset_ids'])) >= 2:
                    yield dict(id=row['id'], title=row['title'])

    def _export_discovery(self, user, group, fingerprint, archive=None):
        fingerprint.json_member('people.json', ExportArray(self._iter_people(user, group, reuse_cities=True)), archive)
        fingerprint.json_member('personal-discovery.json',
                                dict(hidden=ExportArray(self._export_personal(user, group, 'hidden')),
                                     hidden_memories=ExportArray(self._export_personal(user, group, 'hidden_memories')),
                                     suppressed=ExportArray(self._export_personal(user, group, 'suppressed')),
                                     processing=self.settings(user, group)), archive)

    def _capture_export_metadata(self, user, group, ids, fingerprint):
        super()._capture_export_metadata(user, group, ids, fingerprint)
        self._export_discovery(user, group, fingerprint)

    def _write_export_archive(self, user, group, ids, fingerprint, archive, output):
        super()._write_export_archive(user, group, ids, fingerprint, archive, output)
        self._export_discovery(user, group, fingerprint, archive)
