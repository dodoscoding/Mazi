# Photo evidence verification

## Red contract

At `75727e0`, four new `AtlasTests` contracts fail with missing `assetId` or `evidence` keys. The focused command selects the four `test_photo_evidence_*` and `test_unmapped_reviewed_place_*` methods. Synthetic fixtures cover reviewed İstanbul, Discord sharing-only dates, conflicting capture evidence, sibling place isolation, unchanged origin payloads, and unmapped review text.

## Delivery scope

A1 adds read-only per-photo evidence and renders its date/place facts. Search filtering and correction writes remain A2. Existing card fields and source fingerprints remain compatible.

## Implemented result

`e77a3fc` adds the per-photo read model and shared renderers. `ea60c8f` preserves those facts after a successful whole-memory place save even when its subsequent Atlas reread fails. The latter regression failed first at `0dcb087`, showing the old Istanbul/null values instead of the saved Kyrenia values.

Current import producers expose precise EXIF second timestamps, selected-source calendar days and precise Review corrections. They do not represent approximate capture dates or asserted intervals. The additive wire type and renderer distinguish those states for represented evidence; the resolver does not invent them. This increment does not change Search date filtering, correction commands, schema, export ownership or source payloads.

## Passing checks

Environment is macOS with the repository's installed Node and shared Python virtual environment. All fixtures are synthetic.

- `npm run typecheck` passed.
- `.venv/bin/python -m unittest tests.backend.test_atlas tests.backend.test_atlas_place tests.backend.test_atlas_projection tests.backend.archive.test_chronology` passed 62 tests. The 1001-photo constant-query budget and 4 MiB projection peak-memory assertion passed. Legacy card fields retain their exact byte projection after removing only the two new photo fields.
- `node --test tests/unit/chronology.test.ts tests/unit/atlas-model.test.ts` passed 14 tests.
- `node --test tests/dom/photo-evidence.test.mjs tests/dom/timeline-dates.test.mjs tests/dom/memories-mobile.test.mjs` passed 5 tests.
- `node --test tests/dom/place-tray.test.mjs` passed 5 tests, including saved-child facts after a failed refresh.
- `node --test tests/dom/atlas.test.mjs tests/dom/places.test.mjs tests/dom/places-recovery.test.mjs` passed 30 tests.
- `MAZI_TEST_PORT=5275 npx playwright test tests/memory-detail.spec.ts --grep 'photo facts stay visible' --project desktop --project phone` passed both browser journeys. They traverse Home, both gallery layouts, selected-photo Viewer, Timeline and the unplaced Atlas list.
- `npm run lint`, `npm run check:docs`, `npm run check:budgets` and `git diff --check` passed. The checked build has entry 146.5 KiB gzip of 150 KiB, all scripts 389.4 KiB of 400 KiB, Globe 242.9 KiB of 256 KiB and CSS 36.7 KiB of 40 KiB.

## Synthetic visual evidence

The browser checks wait for finite animations and image loading before capture. Gallery and Viewer captures were visually inspected. Phone facts wrap beneath each thumbnail, and the second photo keeps its own sharing date and unknown place.

- [Desktop gallery](screenshots/desktop-gallery.png)
- [Phone gallery](screenshots/phone-gallery.png)
- [Desktop Viewer](screenshots/desktop-viewer.png)
- [Phone Viewer](screenshots/phone-viewer.png)

## Acceptance limits

The coordinator owns independent review, the final full suites, merge and deployment. This slice does not claim physical-phone verification, a five-friend discovery study, production milestone acceptance, or rollout. It adds no processing inference or new private audience.

## Same-name city review correction

Independent review at `5e6630c` found that Springfield in Massachusetts and Illinois shared the short label `Springfield, US`. The grouped summary borrowed the first pin and separate Atlas cards collapsed into one node. Red commit `f743794` reproduces both failures using the actual bundled gazetteer. The correction preserves region labels when names repeat within a country, matches authorized source centroids to canonical cities, compares canonical coordinates for grouped pins and summary identity, and uses those coordinates in new-evidence Atlas node IDs. Legacy sample keys remain compatible. A source with an ambiguous city name and no matching canonical centroid stays unmapped. The existing whole-memory place response carries an optional region through optimistic photo facts.

After the correction, 55 focused Atlas backend tests and 22 chronology/Atlas unit plus photo-evidence/place-tray DOM tests passed. The added source-centroid and region-preserving save checks passed separately. The desktop/phone photo-facts browser journey passed again. Typecheck passed. Lint was rerun after formatting the final regression additions. Canonical contracts record the optional pin region and coordinate identity.
