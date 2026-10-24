# Synthesized design: map places from GPS and Review

Inputs: GROUNDING.md, candidate-a.md (read-time), candidate-b.md (write-time). Synthesis is B's write path for GPS with A's read-time handling of Review, and one new table instead of B's three schema changes.

## Synthesis decision

| Question | A | B | Chosen |
| --- | --- | --- | --- |
| GPS pins | Derived on every read from payloads | Materialized into `shared_places` at publish, plus backfill | B. Places, Discovery, Answers and export keep reading one table, and reads don't scan every payload. |
| Review pins | Read-time geocode of `review_annotations.place` | New `review_places` table | A, in Atlas only. The text already lives in `review_annotations` and the gazetteer is static, so no second copy is stored. Discovery already uses the text. |
| Removal | `place_removals` tombstone | `place_removals` tombstone | Both agree. Keyed by (owner_id, asset_id), so a re-import cannot resurrect it. |
| `basis` / `place_id` columns | none | added | Not added (YAGNI). Agreement resolves (city, country) through the gazetteer at read time. |
| Pin coordinates | City centre | City centre | City centre. The circle never sees exact home coordinates. |

## Data shape

- `cities.json` (committed 1016d51): `fields` = name, ascii, turkish, country, region, latitude, longitude, population. Row index is the place id.
- New table, SQLite in `mazi/sources/sources.py` DDL and hosted migration `infra/hosted/supabase/migrations/20261024090000_place_removals.sql` (with RLS policy for `mazi_app` mirroring `shared_places`, and the privileges/index conventions of `20261014173956_hosted_privileges_and_indexes.sql`):
  `place_removals(owner_id TEXT NOT NULL, asset_id TEXT NOT NULL, group_id TEXT NOT NULL, removed_at TEXT NOT NULL, PRIMARY KEY(owner_id, asset_id))`.
- `shared_places` unchanged.

## Module: `mazi/places.py` (pure, no store access)

```python
City = namedtuple('City', 'id name country region latitude longitude population')
def cities() -> list[City]                      # loaded once per process from cities.json
def gps_degrees(raw: dict) -> tuple[float, float] | None   # PIL IFD strings from location_assertions raw; None when malformed or (0,0)
def nearest(latitude, longitude, limit_km=100) -> City | None   # grid index, not a full scan
def lookup(text: str) -> dict   # {'status': 'matched', 'city': City} | {'status': 'ambiguous', 'candidates': [City, ...5]} | {'status': 'missing'} | {'status': 'empty'}
                                # matches name/ascii/turkish, case- and accent-insensitive with Turkish dotted/dotless i folded; accepts "City, CC"; bare name matches when its population >= 10x runner-up
def identify(city: str, country: str) -> int | None   # gazetteer id for agreement, None when unknown
```

## Write path (sources store)

- `SourceStore.share_gps(origin_id)` inside the publishing transaction: reads the origin, skips when withdrawn, a `shared_places` row exists, or `place_removals` has (owner_id, asset_id); parses the first `gps_exif` location assertion, snaps with `nearest`, inserts `shared_places(origin, country, city, lat, lon, day)` at the city centre, `day` from the resolved capture date when present. Idempotent: rerunning converges.
- Hook it where an origin is published (`mazi/imports/engine.py` ~475, wherever `archive_origins` rows are inserted for any source kind, including Discord bot and companion paths). Same code on SQLite and PostgreSQL.
- `set_place(..., latitude=None)` also upserts `place_removals`. A later manual share by the same contributor deletes the tombstone for that asset.
- Backfill: `python -m mazi.places.backfill` (or a function the existing hosted ops command can call) runs `share_gps` over live origins in batches of 200, safe to rerun, prints counts.

## Read path

- `mazi/atlas.py`: per photo, a matched Review place (`lookup(review_annotations.place)`) wins; otherwise the origin rows from `shared_places` as today. `_place` agreement compares `identify(city, country)`, falling back to the folded name; the coordinate mean stays.
- Discovery, Answers, Places list, export: unchanged (they read `shared_places`).

## Review feedback

- `correct_asset` returns `place_match: matched|ambiguous|missing|empty` plus candidates' display labels ("Victoria, British Columbia, CA"). The Review UI (`src/features/archive/*`) shows one status line: "Pinned in Kyrenia, CY", "Several places match. Add the country, e.g. 'Victoria, CA'.", or "Not found on the map. Saved as text." No chooser widget in this change.

## Docs

- `docs/DECISIONS.md` D21 (owner decision 23 Oct 2026: GPS auto-pins at city centre, contributor removal is sticky, any member can place a memory by naming a city in Review; offline gazetteer). Update `docs/history/sources/README.md:30` and `MAP_DATA.md`, and `docs/DEPLOYMENT.md` for migration-before-deploy and backfill. Run `npm run check:docs`.

## Rollout order

Apply migration in Supabase SQL Editor, deploy, run backfill. Deploying before the migration breaks Places/Atlas reads of `place_removals`.

## Known gaps (accepted)

No villages more than 100 km from any listed place. A second contributor's GPS copy of the same photo still pins until that contributor removes it. Apple companion still sends no location.

## Throughput checkpoint

- Blocking first steps. `mazi/places.py` with its unit tests, and the `place_removals` DDL plus hosted migration. Everything else imports them.
- Independent workstreams. Write path and backfill (sources/imports), Atlas read and agreement (atlas.py), Review feedback (archive store + UI), docs. They touch disjoint files except shared tests.
- Shared mutable state. `shared_places` gains a second writer (`share_gps`) beside `set_place`. Both run inside store transactions and the insert never overwrites, so no extra locking.
- Smallest safe decomposition. One owner. The workstreams are small, coupled through one module and one table, and a single diff is easier to review than four partial ones.
