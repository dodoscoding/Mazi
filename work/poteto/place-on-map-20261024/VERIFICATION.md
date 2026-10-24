# Name on the map: verification

Branch `feat/place-memories-on-map`, cut from `origin/main` 548ba3f. Owner decision of 24 October 2026, recorded as the D21 addendum in `docs/DECISIONS.md`. All data is synthetic.

## What was built

- `POST /api/atlas/place` (`mazi/atlas.py` `place_memory`, routed in `mazi/server.py`). It takes `group`, `memory` (an Atlas card id) and `place` text. The server resolves the card's photographs itself and never takes a photograph list from the client. It upserts `review_annotations.place` for each photograph and leaves title, date and anniversary alone. Only a single matching city is written, stored as its full gazetteer label. Ambiguous text returns candidates, unknown text writes nothing, and empty text clears existing Review places without creating annotations. Every write is audit-logged.
- The Places list (`SourceStore._places`) now shows a matched Review city in place of a photograph's shared locations, limited to photographs the member can see.
- `src/atlas/PlaceMemories.tsx` adds the Unplaced memories tray beside the globe and flat map, the shared city form, and `usePlacedMemories`. The form is also on the featured card as Add a place / Change place, with Clear. A pin shows at once from the server's response, then the Atlas is reread without the loading screen.

## Measured

| Gate | Result |
| --- | --- |
| `npm run build` | Pass |
| `npm run lint` (now includes `tests/dom/*.mjs`) | Pass |
| `npm run check:docs` | Pass: 16 documents, 182 local links |
| `npm run test:dom` | 135 of 135 pass |
| `npm run test:backend` | 532 tests OK, 12 skipped (the PostgreSQL suites, which need `.env.supabase`) |
| `git diff --check` | Clean |

New tests:

- `tests/backend/test_atlas_place.py`, 12 tests. They cover these cases:
  - A place-only write keeps title, date and anniversary.
  - A memory's photographs all get the place, including ones with no annotation.
  - Ambiguous and unknown text write nothing, and a tapped candidate label pins that city.
  - Clearing falls back to the GPS location and creates no annotation.
  - Outsiders, other groups, departed members, unknown or empty card ids, personally hidden photographs, hidden memories and withdrawn photographs are all denied, with nothing written.
  - Invalid input is rejected.
  - The Places list shows the named city in place of the shared location, and skips unmatched text, hidden photographs and withdrawn photographs.
  - The HTTP round trip works, and the endpoint rejects a missing session, a foreign Origin, an unknown card and a malformed body.
- `tests/dom/place-tray.test.mjs`, 4 tests. They cover these cases:
  - The tray is collapsed, then opens to show its rows.
  - "Victoria" offers candidates and the chosen one pins.
  - An unknown city is reported, writes nothing and the memory stays in the tray.
  - On a phone the tray closes after a pin.
  - Clearing sends empty text.
  - `usePlacedMemories` shows the pin before the reread, then takes the server's Atlas.
- `tests/backend/discovery/test_discovery.py` `test_personal_hides_do_not_count_toward_the_map_limit` now clears its fixture's Review place "Amsterdam" first. Otherwise that city would correctly stand in for the 1001 shared rows the test counts.

### Browser drive

The built app ran against a local seeded backend in headless Chromium, using `evidence/seed_serve.py` and `evidence/drive.mjs` on port 8531. The archive held two WhatsApp chat imports with no GPS. One import was an approved two-photo memory, "Lake weekend". The seed recorded `gps_origins: 0` and `shared_places: 0` (`evidence/*-seed.txt`). The run used one server and one browser, and both were stopped afterwards.

| Step | Desktop 1440×1024 | Phone 375×812 |
| --- | --- | --- |
| Empty map with tray | `desktop-1-empty-globe.png`, `desktop-2-empty-flat.png`: 0 places, tray open with 3 memories | `phone-1-empty-globe.png`, `phone-2-empty-flat.png`: tray closed on the Replay line, 3 |
| Type "girne" for Lake weekend | `desktop-3-typing-girne.png` | `phone-3-typing-girne.png` |
| After placing, globe | `desktop-4-after-globe.png`: label "Kyrenia · 1", readout "1 place", tray count 2, toast "Lake weekend is pinned in Kyrenia, CY." | `phone-4-after-globe.png`: same, and the tray closed to show the pin |
| After placing, flat map | `desktop-5-after-flat.png`: 1 flat node | `phone-5-after-flat.png`: 1 flat node |
| "Victoria" | `desktop-6-ambiguous.png`: 5 candidate choices | `phone-6-ambiguous.png` |
| Places page | `desktop-7-places.png`: "2 shared locations · 1 place in 1 country", two Kyrenia rows | `phone-7-places.png`: same |

The response was `{"place_match": "matched", "place": "Kyrenia, CY", "pin": {"name": "Kyrenia", "country": "CY", "latitude": 35.326, "longitude": 33.333}}`. No page horizontal scroll occurred at either width. The run logged no errors apart from three.js deprecation and GPU-stall warnings (`evidence/*-report.json`).

The first phone drive found a real layout defect. The closed pill covered the year summary, and the open panel overlapped Replay. Commit 2573344 fixed it, and the screenshots above come from after the fix (`evidence/measure.mjs` measured the phone HUD).

## Not verified

- PostgreSQL. The write uses the same `INSERT … ON CONFLICT DO UPDATE` and `UPDATE` SQL path as `correct_asset`, but `npm run test:postgres` and hosted Supabase did not run, because `.env.supabase` is absent here.
- Production, Vercel and real devices. Nothing was deployed. Phone layout was checked only by headless Chromium phone emulation, not on a real phone or with a real on-screen keyboard.
- The 458-memory scale. The tray renders every unplaced memory with lazy thumbnails. Its scrolling and render cost at 458 rows were not measured.
- Archive export. `places.json` in the export still lists only `shared_places` contribution locations, not Review cities. This is recorded in D21.
- Keyboard-only and screen-reader passes over the tray were not run. Controls are native buttons, inputs and a labelled form with a `role="status"` region.

## Review change

The independent review found that nine stored labels did not read back as their city. Two causes in `mazi/places.lookup`: Natural Earth lists a few cities twice a few kilometres apart (Adapazarı, Jingmen City, Bandar Lampung), which made typing "Adapazarı" permanently ambiguous with two identical choices; and "Guanajuato, Guanajuato, MX" also matched "Guanajuato City" through its alternative name. Lookup now treats the same name, region and country as one place, and a full label prefers the exact city name. `tests/backend/test_places.py` checks every one of the 7,342 labels reads back as its city.
