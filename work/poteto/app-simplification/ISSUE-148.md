# Issue 148 — Monthly Photos acceptance

## Scope and revisions

Implements #148 under specification D28. Branch `codex/simplification-148`
started from integration `445d3da5c9e79a8f41e1dc37a333ed801cff0e60`.
Merged integration `6fb57f59cd9f3757c83c8df51bceea7d3f5b6321` in `7088926`.
No schema, storage, access-policy, deployment or production acceptance changes.

## Behavior

Globe links to `/photos`. The standalone composition reuses the existing gallery,
archive projection, match/filter API, photo evidence labels, selection tools and
canonical shared viewer. Individual assets appear once, grouped by month, with
newest months and days first. The old moment/all-photo choice is absent.

One visible year picker and a compact, named Filters dialog replace the permanent
filter rail. The current circle comes from the shared lifecycle, without another
group selector. Year/place filters, selected photograph index, URL, focus and browse
position use the existing viewer origin-restoration contract.

A shared-only date remains labelled as sharing evidence and explicitly states that
the capture date is unknown. Unknown, ambiguous, conflicting or cross-month dates
remain in an explicit Undated section and picker option. These Photos year values
are display chronology; future Annual recap eligibility must independently require
reliable capture chronology.

Loading, archive failure/retry, empty-filter/reset and existing empty-archive/Add
presentations remain available. Withdrawal removes content from Photos, Globe's
projection and detail access. Session loss clears private media and retained state.
Search, recap, final navigation and old-route retirement remain with their tickets.

## Agreed seam and TDD evidence

Uses real-app Playwright with the existing unified server and desktop/Pixel 7
projects. `playwright.photos.config.ts` extends the unified setup and enables an
isolated richer seed through `MAZI_PHOTOS_FIXTURE=1`; ordinary unified fixtures stay
unchanged. The seed includes eight synthetic photographs: distinct capture months
and days, shared-only chronology, unknown dates, and one asset with two conflicting
capture origins. Test assertions use visible UI and public HTTP boundaries.

- `dbd8245`: initial desktop and phone contract failed because Globe had no Photos link.
- `718a677`: direct monthly browsing and selected-photo viewer return passed 2/2.
- `9919958`: extended chronology/filter journey exposed the compact dialog's missing accessible name. The effective Undated count is explicitly checked.
- `a306062`: named compact filters, retained year/place selection, shared-only evidence, Undated/conflict presentation and effective counts passed 4/4.
- `94fad31`: regression journeys cover a gated 503 loading/failure/retry, empty-filter reset, a real API-ingested then withdrawn contribution, 404 detail state, and session-loss media clearing. Focused config is included in `npm run test:app`.

## Verification

- `MAZI_UNIFIED_PORT=8118 npx playwright test --config playwright.photos.config.ts`: 8/8 passed after merging integration; includes keyboard Escape, reduced motion, month/day ordering, exact selected photo, return filters/focus, failure recovery and access propagation.
- `MAZI_UNIFIED_PORT=8118 npx playwright test --config playwright.unified.config.ts -g 'one authenticated shell|shared viewer'`: 10/10 passed after integration (30.8s); retained workflows and viewer contracts remain valid.
- `npm run test:unit`: 23/23 passed.
- Build/typecheck passed in every integrated server launch. `npm run lint` and `git diff --check` passed.
- `npm run check:budgets`: Globe 243.0/256 KiB, entry 93.0/150 KiB and stylesheet 19.7/40 KiB pass. Total scripts are temporarily 422.4/420 KiB after the latest integration (Photos alone was 418.9 before that merge). No budget was raised; later retirement must recover the 2.4 KiB overage.

## Visual evidence and limits

`photos-months-desktop.png` and `photos-months-phone.png` show the month sequence;
`photos-undated-desktop.png` and `photos-undated-phone.png` show explicit conflicting
and unknown chronology. Desktop month and phone Undated renderings were inspected.

All data and media are synthetic. Existing server-side match capacity and archive
projection limits are retained; no new paging or backend abstraction was introduced.
The existing Memories/Timeline and supporting routes remain usable during transition.
