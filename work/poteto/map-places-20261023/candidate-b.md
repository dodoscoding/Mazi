# Candidate B: materialize places at write time

Read at c9b5804. Contributor-owned origin pins stay in `shared_places`; member-set asset pins from Review go in `review_places`.

## Data shape

```sql
ALTER TABLE shared_places ADD COLUMN basis TEXT NOT NULL DEFAULT 'manual' CHECK (basis IN ('manual','gps'));
ALTER TABLE shared_places ADD COLUMN place_id TEXT;   -- 'ne:<NE_ID>', NULL if manual is unmatched
CREATE TABLE place_removals (group_id TEXT, owner_id TEXT, asset_id TEXT, removed_at TEXT NOT NULL,
  PRIMARY KEY(group_id,owner_id,asset_id));
CREATE TABLE review_places (asset_id TEXT PRIMARY KEY, group_id TEXT NOT NULL, place_id TEXT NOT NULL,
  country TEXT NOT NULL, city TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL,
  actor_id TEXT NOT NULL, updated_at TEXT NOT NULL);
```

**No `review` basis.** On a contributor's origin, that contributor could delete a member's correction and their withdrawal would erase it. A nullable `origin` breaks every `p.origin=o.id` join. Discovery and Answers already read `review_annotations.place`, so they stay unchanged.

**Tombstones key on (group, owner, asset).** Keyed by origin, a re-import as a new occurrence would bring the pin back.

## Modules

`mazi/places/gazetteer.py` reads `mazi/places/data/populated_places.json`, built once from the NE GeoJSON (NE_ID unique across 7,342 rows; 12 `ISO_A2='-99'` rows dropped). It is cached per process: public static data, not authorized data.

```python
@dataclass(frozen=True)
class Place: id: str; name: str; country: str; admin: str | None; latitude: float; longitude: float; population: int
def fold(text: str) -> str: raise NotImplementedError  # NFKD, strip marks, casefold, ı->i
def parse_gps(raw: dict[str, str]) -> tuple[float, float] | None: raise NotImplementedError  # reject NaN/range/(0,0)
def nearest(lat: float, lon: float, max_km: float = 100) -> Place | None: raise NotImplementedError
def lookup(text: str) -> Place | list[Place]: raise NotImplementedError  # [] none, >1 ambiguous
```

`lookup` matches folded NAME/NAMEASCII/NAME_EN/NAME_TR; a `, CC` or `, Country` suffix narrows. Several matches return the top one only at 10× the next POP_MAX.

```python
# SourceStore overrides a no-op ImportStore hook; runs inside the origin's transaction
def _origin_published(self, origin_id, payload):
    point = nearest(*parse_gps(first gps_exif raw))
    if not point or EXISTS place_removals(group, owner, asset): return
    INSERT shared_places(..., basis='gps', place_id=P.id, coords=P centre, day=capture day)
      ON CONFLICT(origin) DO NOTHING
```

Pins snap to the city centre: no exact home coordinates, and same-city pins agree exactly.

`ReviewStore._resolve_review_place(group, asset, text, place_id, user) -> {"status": matched|ambiguous|not_found|cleared, "candidates": [...]}` upserts or deletes `review_places` in the annotation's transaction.

## Precedence

1. **Manual beats GPS:** `set_place` keeps `DO UPDATE`; GPS uses `DO NOTHING`.
2. **Sticky removal:** delete the origin's row and the owner's other `gps` rows on the asset, insert a tombstone. Manual re-set is allowed; GPS never returns.
3. **Review beats origins** on the card when matched; unmatched text falls through.
4. **`_place`** keys on `place_id or ('name', fold(city), country)`; SAME_PLACE_KM stays.

## Callers that change

- `mazi/imports/engine.py:475`: call the hook after the origin INSERT.
- `mazi/sources/sources.py:43`: DDL, plus an `add_missing_columns` helper at `mazi/persistence.py:284` (local only).
- `sources.py:401-418` `set_place`: use a column list, set `basis`/`place_id` via `lookup` within the country, and write the tombstone.
- `sources.py:426-460` `_places`: add `basis` and `mine`, and append `review_places` points (`origin:null`) under the existing budgets.
- `mazi/archive/review.py:384-404` `correct_asset`: add a `place_id=None` kwarg and return the resolution. `review.py:47` gets DDL; `:605` adds export.
- `mazi/archive/server.py:113`: pass `place_id` and return `{"ok":true,"place":...}`.
- `mazi/atlas.py:15-26`: re-key `_place`. `:120-126`: select `place_id`, read `review_places` for the `consumers` assets, and drop origin rows on assets that have one.
- `src/features/archive/mount.js:339`:
  - On ambiguous, offer "Which Victoria? British Columbia, CA · Texas, US …" and re-send with the chosen `place_id`.
  - On not found, show "Saved. We couldn't find "Xyz" on the map — try the nearest city."
- `src/features/places/mount.js:294-317`: own rows get "Remove pin" (POST `{origin, latitude:null}`): "Pin removed. This photo's location won't pin it again." Labels: "From photo location"; "Placed in Review" (not removable).
- Add column lists to 6-value SQLite inserts in `tests/backend/test_places_http.py:148`, `answers/test_streaming.py:94,196`, `answers/test_streaming_resources.py:104`, `discovery/test_discovery.py:225`, `test_keyword_scaling.py:41` and `test_remaining_capacity.py:28`.

## Backfill

`python -m mazi.places.backfill [--after ORIGIN] [--batch 200] [--dry-run]` runs on the owner's machine with `MAZI_BACKEND=supabase`, like `hosted_ops`. Each batch is one transaction: origins with `withdrawn=0 AND id>?` by id, `_origin_published` on each, `place_id` filled on NULL manual rows. It prints `{"scanned":200,"pinned":37,"removed":2,"existing":5,"no_fix":150,"no_city":6,"next":"<id>"}`. A rerun gives `pinned:0`.

## Hosted migration and order

`infra/hosted/supabase/migrations/20261024090000_place_materialization.sql` uses `IF NOT EXISTS` and `DOUBLE PRECISION`, a `DO`-guarded `runtime_access` policy, and grants as in `20261023120000`.

**Order: migrate, deploy, backfill.** Old code survives the additive migration (Postgres fills defaults). Deploying first breaks Atlas and Places.

## Tests

| Case | Expected |
|---|---|
| `parse_gps({'1':'N','2':'(41.0, 0.0, 51.84)','3':'E','4':'(28.0, 58.0, 30.0)'})` | `(41.0144, 28.975)` |
| `nearest` on that point | `Istanbul`, `TR` |
| GPS JPEG import, `/api/atlas` | `place.name=='Istanbul'` |
| Manual `Kadıköy`, then backfill | manual value survives |
| Remove, then backfill twice, then re-import as a new occurrence | `pinned:0, removed:1`; `place is None` |
| `_place([İstanbul/TR, istanbul/TR])` | one place |
| `_place([Istanbul/TR, Ankara/TR])` | `None` |
| Review `'Victoria'` | `ambiguous`, 5 candidates |
| Review `'Victoria'` with the CA `place_id` | `matched` |
| Review `'Xyzzy'` | `not_found`, text kept |
| Review place, then hide or withdraw the asset | gone for others |

## Risks

A second contributor's GPS still pins the asset; no pins beyond 100 km from a populated place; a wrong Review match hides GPS; the manual migration can be forgotten.

## Rejected

Read-time derivation (removal re-evaluated every read); Review rows in `shared_places` (ownership); a hidden flag (every reader filters); exact GPS pins (privacy); a Vercel backfill route (time limits).
