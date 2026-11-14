# Grounding: map places from GPS and Review (23 Oct 2026)

Code at origin/main c9b5804, read-only worktree /Users/altanesmer/Desktop/Ales/Mazi-wt/investigate-20261023.

## Owner decisions (this session)
- D21a. A photo with EXIF GPS is pinned on the circle's map automatically at import. The contributor can remove that pin later, and a removed pin must not come back.
- D21b. Any circle member can place a memory by naming its city in Review (`review_annotations.place`, free text). It is matched to a city and pinned.
- Reverse/forward geocoding is offline from a bundled Natural Earth 10m populated places list (public domain, 7,342 places with NAME, NAMEASCII, NAME_EN, NAME_TR, ISO_A2, LATITUDE, LONGITUDE, POP_MAX, ADM1NAME). Source file: scratchpad/gazetteer-src/ne_10m_populated_places.geojson (sha256 9b8e3de0...). No coordinates leave the server.

## Current behavior (measured by investigators)
- With real imports every `/api/atlas` card has `place: null`; globe and flat map draw land with 0 pins. One manual place renders correctly.
- `mazi/atlas.py:120-126` reads places only from `shared_places` (origin PK, country, city, latitude, longitude, day). `atlas.py:15-26` `_place` returns one place only when all rows share city.casefold()+country and lie within SAME_PLACE_KM of their centre; otherwise None. `'İstanbul'.casefold() != 'istanbul'`.
- Only `SourceStore.set_place` (`mazi/sources/sources.py:401-418`, contributor-only, via `POST /api/places`, `mazi/sources/server.py:120`) writes `shared_places`; latitude=None deletes the row.
- EXIF GPS is stored raw in the origin payload as `location_assertions=[{"source":"gps_exif","raw":{str(tag): str(value)},"inferred":False,"locator":"EXIF:GPSInfo"}]` (`mazi/imports/engine.py:390-393`). Values are PIL IFD strings (rational tuples), never parsed to degrees.
- Review place text: `review_annotations(asset_id PK, group_id, title, capture_date, place, anniversary, actor_id, updated_at)` written by `correct_asset` (`mazi/archive/review.py:384-404`), any member. Used for timeline/search evidence only (`review.py:365-371`), never by atlas.
- Other readers of shared_places: `mazi/discovery/discovery.py:308,388,553`, `mazi/answers/answers.py:170`, `SourceStore._places_query`/`places` (Places page list, filters, dated paths), group export. Privacy invariant: every read rechecks membership, withdrawal, personal hiding, asset visibility; no cached authorized data.
- Hosted backend is the same Python code on PostgreSQL; schema in `infra/hosted/supabase/migrations/*.sql` mirrors SQLite DDL in the stores. The owner applies hosted migrations by hand in the Supabase SQL Editor, so a schema change has a real deployment cost but is allowed.
- Production: Vercel function, imports drained by signed-in tabs via /api/work. Existing production photos already have location_assertions in payloads.
- Frontend: Places page `src/features/places/mount.js` + template (manual share form, list, remove); Atlas `src/atlas/*` consumes `card.place` {name,country,latitude,longitude}; Home copy `src/Home.tsx:172` promises automatic pins. Review UI in `src/features/archive/*`.
- Apple Photos companion sends no location (`tools/apple-photos/MaziPhotos.swift:202-204`), out of scope.
