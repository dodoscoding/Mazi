# A2 selected-photo correction verification

## Scope and revision

Branch `codex/photo-corrections-ui-20261104`, originally based on merged A2 read `1e04437`, incorporates main through `cdfe6f4` with merge `ed4ec87`. Behavior head before this record: `7518c69`. Origin verified as `https://github.com/dodoscoding/Mazi.git`. No push, PR, merge to main or deployment was performed by this worker.

The existing replacement Review endpoint remains compatible. The new Atlas photo endpoint patches only date/place and checks canonical annotations plus live authorized origin IDs/fingerprints under the existing archive transaction. The selected-child editor uses stable asset IDs, handles stale snapshots without losing drafts and refreshes Atlas authority after a save. Free place text has no invented pin. Reviewed city locations participate in export and admission; a free place suppresses a source pin while preserving its label in the manifest.

## Red and green

- `5a415d5`: initial domain contract failed because `photo_correction` did not exist; `521df5f` supplies the patch contract.
- `fa0dafa`: reviewed Paris export incorrectly returned source Amsterdam; `8f6ddcc` makes reviewed and unmapped place behavior agree across Places and export.
- Repeated actual phone execution exposed draft overwrite while the initial snapshot was still loading. `52a1c1d` records the loading contract; `df016b6` disables input until the selected snapshot arrives. The final desktop and phone rerun passed.

## Commands and results

- `.venv/bin/python -m unittest tests.backend.test_photo_corrections tests.backend.test_atlas_place tests.backend.test_atlas_projection tests.backend.sources.test_places_export`: 51 passed before the final two additive correction tests. Export profile covered 20,000 location records with maximum page size 128, 27,648 projected UTF-8 bytes/page and 1.27-second final validation.
- `.venv/bin/python -m unittest tests.backend.test_photo_corrections`: final 7 passed, covering omitted-field/sibling preservation, anniversary clear rejection, stale annotation and origin fingerprints, hidden/cross-group reads, HTTP origin/allowlist/conflict boundaries, reviewed/free/clear locations, export admission conflict and unchanged origin payloads/fingerprints.
- `.venv/bin/python -m unittest tests.backend.sources.test_gps_places`: 5 passed during the combined correction/GPS run; covers contributor pin removal surviving a same-image reimport and explicit reshare.
- `.venv/bin/python -m unittest tests.backend.imports.test_engine.EngineTests.test_duplicate_bytes_keep_distinct_origins_and_same_manifest_replays tests.backend.discovery.test_date_basis tests.backend.test_server`: 23 passed, preserving import replay and both Search date paths plus unified server behavior.
- `node --test tests/dom/photo-correction.test.mjs tests/dom/archive-hook.test.mjs tests/dom/place-tray.test.mjs tests/dom/photo-evidence.test.mjs`: the initial combined run passed 18; the subsequent archive-refresh and loading regressions independently passed (10 archive-hook and 3 editor tests). Existing place-tray and gallery/Viewer tests remained green.
- `MAZI_TEST_PORT=5288 MAZI_UNIFIED_PORT=8148 npx playwright test --config playwright.unified.config.ts -g 'selected child corrections'`: final 2 passed (desktop and Pixel 7 emulation). Real synthetic backend: place save, date save, authoritative caption refresh, sibling selection unchanged and place clear; cleanup restores the original annotations.
- `npm run typecheck`, unified build, `npm run lint`, `npm run check:docs`, `npm run check:budgets`: passed. Final measured scripts 392.2/400 KiB gzip, entry 147.8/150, stylesheet 36.7/40, globe 242.9/256. No ceiling changes.
- `git diff --check` and `git diff --check 1e04437...HEAD`: passed before handoff.

## Evidence and limits

[Desktop selected photo](desktop-selected-photo.png) and [phone selected photo](phone-selected-photo.png) show the saved date/unmapped place and separate selected-photo actions. The phone image was visually inspected: facts wrap and sibling locations are not borrowed.

No schema migration or new persistence field. Hosted transaction behavior reuses the existing exclusive archive advisory lock; hosted tests were not rerun for this schema-free slice. Final whole-repository suites and independent review belong to the parent acceptance gate. Physical-phone and five-friend studies remain external acceptance gates. Batch date/place editing is not added; whole-memory city placement remains separate and explicitly displays the affected photograph count. Clearing removes a manual override and may expose remaining source evidence; an anniversary-dependent date clear fails until the full Review flow explicitly changes that anniversary.
