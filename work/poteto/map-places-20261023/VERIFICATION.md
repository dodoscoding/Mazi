# Map places verification

Branch `fix/map-places-from-gps`, local SQLite backend, 23 October 2026.

## Browser

`evidence/seed_serve.py <port> <dir> review` imports three JPEGs through the Apple source. One has EXIF GPS near Istanbul. A member then names the second photo `girne` in Review. `evidence/drive.mjs` drives the built app in headless Chromium at 1440×1024.

| | Before (origin/main c9b5804) | After |
| --- | --- | --- |
| `/api/atlas` places | `null`, `null`, `null` | Istanbul TR (41.1069, 29.0081), Kyrenia CY (35.326, 33.333), `null` |
| Globe | Land, 0 pins ([before](evidence/before-globe.png)) | Istanbul and Kyrenia labelled ([after](evidence/after-globe.png)) |
| Flat map | 0 nodes ([before](evidence/before-flat.png)) | 2 nodes ([after](evidence/after-flat.png)) |
| Page errors | none | none (three.js deprecation and GPU ReadPixels warnings only) |

The Places page lists 1 shared location. It reads `shared_places`, so the Review-named Kyrenia appears on the Atlas but not in the Places list.

## Gates

- `npm run test:backend`: 520 tests OK, 12 skipped.
- Re-run of the new and changed backend modules: 34 tests OK. `tests/dom/review.test.mjs`: 4/4.
- `npm run test:dom` 131/131, `npm run build`, `npm run lint`, `npm run check:docs`, `git diff --check`: pass.

## Not verified

- PostgreSQL. `test_postgres` is opt-in and was skipped. The `place_removals` migration has not been applied anywhere.
- The backfill against the production archive.
- Playwright suites under `tests/*.spec.ts`.
