# Candidate A: derive places at read time

No backfill: production photos with `location_assertions` light up on deploy.

## Data shape

```python
Place(gid, name, ascii, country, adm1, latitude, longitude, population)   # static gazetteer row
Resolved(origin, asset_id, basis,  # 'review'|'shared'|'gps'
         key,                      # ('g', gid) | ('raw', norm(city), CC)
         city, country, latitude, longitude, day)
```

```sql
-- sources.py SCHEMA + hosted migration 20261024090000_place_removals.sql (RLS/grants as discord_guild_links)
CREATE TABLE IF NOT EXISTS place_removals (asset_id TEXT NOT NULL REFERENCES archive_assets(id),
 owner_id TEXT NOT NULL, removed_at TEXT NOT NULL, PRIMARY KEY(asset_id, owner_id));
```

Keyed (asset, contributor), so a re-import cannot revive a removed pin.

## Modules (`mazi/places/`)

```python
# gazetteer.py: gazetteer.tsv (~450 KB) built by tools/gazetteer/build.py; sha256 pinned in a test
@functools.cache
def gazetteer() -> Gazetteer: raise NotImplementedError   # once per process; public static data
def norm(text) -> str: ...   # İ/ı->i, NFKD, drop marks, casefold
Gazetteer.forward(text) -> (status, [Place])   # "City" | "City, CC" | "City, Adm1, CC";
                                               # a bare name wins only at POP_MAX >= 10x the runner-up
Gazetteer.nearest(lat, lon, max_km=100) -> Place | None   # 1-degree grid, ring search
# exif.py
def gps_degrees(assertions) -> (lat, lon) | None: ...   # parses '(41.0, 0.0, 30.5)'; rejects nan and (0,0)
# resolve.py: pure, no SQL, no authorization
def resolve_asset(asset_id, review_place, review_day, origins, memo) -> list[Resolved]: ...
def agree(records) -> dict | None: ...   # replaces atlas._place
```

`memo` is request-scoped. Only the gazetteer (public static data) lives per process.

`SourceStore._place_sources()` is one shared SQL fragment for every reader. It LEFT JOINs `shared_places`, `place_removals` (on asset and owner) and `review_annotations`. It projects `location_assertions` only: `json_extract` on SQLite, `(payload::jsonb)->` on Postgres. It adds no WHERE: callers keep their membership, withdrawal, hiding and visibility checks.

## Precedence (per asset)

| Evidence | Pin | Removed by |
|---|---|---|
| Review place that resolves | One pin at the gazetteer centre, on the asset's lowest live origin. Suppresses the rows below. | Any member, by clearing it in Review |
| `shared_places` row | The contributor's exact coordinates. Key snaps to a gid when forward(city, CC) is within 50 km. | Contributor |
| EXIF GPS with no tombstone | Nearest place within 100 km, shown at city-centre coordinates, never exact GPS | Contributor (writes the tombstone) |
| Review text that does not resolve | No pin; still search and timeline evidence | n/a |

`agree` needs one `key` across records; coordinates are the mean (old literal tests survive). 'İstanbul'/'istanbul' agree; Springfield IL/MO do not.

## Callers that change

- `mazi/atlas.py:17-27`: `_place` becomes `agree`. `:83-86`: add `_place_sources()` to the payload query it already runs. `:120-126` is deleted.
- `mazi/sources/sources.py:401-418` `set_place`: when coordinates are None, delete the shared row and upsert into `place_removals`.
- `sources.py:421-465` `_places`: scan live origins, resolve, then sort by (day, origin). Filters compare `key`. Points gain `basis` and `removable`. The 20k-point, 8 MiB and 15 s budgets stay.
- `sources.py:509-575`: export resolves within `ids`, sorts, then streams.
- `mazi/discovery/discovery.py:308,388,553` and `mazi/answers/answers.py:170` switch to `_place_sources()` plus `resolve_asset`, so a Review country now feeds the filters.
- `mazi/archive/review.py:384` `correct_asset` returns `forward(place)` as `{status, match, candidates[:5]}`, passed through at `archive/server.py:113`. The text is saved in every case.
- `src/features/places/mount.js:294-317`: each row is labelled "From photo location", "Shared by you" or "Named in Review". Removable rows get their own Remove button, which uses the existing null POST.
- `src/features/archive/mount.js:336-347`: not found shows "Saved. We couldn't find this town on the map; add the country, e.g. 'Kalkan, TR'." Ambiguous shows up to 5 choices, and the chosen one is re-saved as "Springfield, Illinois, US".
- `tests/backend/test_atlas.py:121` flips.

## Tests (literal outputs)

- `gps_degrees`: N `'(41.0, 0.0, 30.5)'` with E `'(28.0, 58.0, 0.0)'` gives `(41.008472, 28.966667)`. `'(28.0, nan)'` gives None.
- An Istanbul GPS import gives a card `place.name == 'Istanbul'` and `country == 'TR'` at the pinned NE coordinates, and a point with `basis == 'gps'`.
- Owner removes the pin, then re-imports: `place is None` and `points == []`. Ben trying to remove it gets `Denied`.
- Review: 'İzmir' resolves to 'Izmir'/'TR'. 'Springfield' gives `ambiguous` with 5 candidates and no pin. 'Xyzzy' gives `none`, no pin, and the timeline place `'xyzzy'`.
- Review 'Paris' overrides a manual share at Lyon. Clearing Review brings Lyon back.
- Hiding, withdrawal and member removal drop GPS pins in atlas, `/api/places`, the discovery country filter, answers and export.
- 10,000 GPS origins: `/api/places` takes under 3 s on SQLite, and the gazetteer loads once.

## Risks

- **Deploy order.** The hosted runtime never runs DDL (`persistence.py:285`), so every atlas and places read fails until the migration is applied. Apply it before deploying.
- **Cost.** Every read pays a jsonb cast per payload: roughly 0.2–0.5 s of database CPU at 10k origins, repeated on each atlas load, with nothing amortised.
- **Removal scope.** Another member's own GPS copy of the same photo still pins until that member removes it.
- **Data gaps.** NE 10m has no villages: GPS more than 100 km from a listed town gets no pin, and small towns snap to a neighbour. Rows with ISO_A2 `-99` need mapping.

## Rejected

- A NULL-coordinate tombstone in `shared_places`: it breaks NOT NULL and forces every reader to filter it.
- Removals written into the payload: that mutates evidence and fingerprints.
- A per-origin tombstone: a re-import resurrects the pin.
- Cross-request place cache: it retains user coordinates.
- Exact GPS coordinates on pins.
