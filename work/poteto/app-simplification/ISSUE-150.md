# Issue 150 — Annual recap in Photos

## Scope and revisions

Implements #150, specification stories 38–41, and decision D28. Branch `codex/simplification-150` in `/tmp/mazi-simplification-150` starts at integration `5d2aff1` (ancestry verified). Remote verified as `https://github.com/dodoscoding/Mazi.git` before commits.

- `229d189`: integrated year-card, chronological browsing, and viewer-return contract.
- `1a47a4c`: Annual recap mode in the shared Photos gallery.
- `8dcacc1`: richer chronology fixture, eligibility, full-year/filter return, withdrawal, and session regression coverage.
- `1d8bbce`, `64de642`: keep bulk editing outside recap and make its capture-year count explicit.
- `9589df6`: merge current integration `a7530da`, including retained Past creations and retired creation APIs. Final recap/Photos checks below ran after merging; both durable configurations remain in `npm run test:app`.

## Behavior and eligibility

Selecting a single year in Photos exposes an Annual recap year card. It opens `/photos?recap=YYYY`, using the same photograph tiles, month browser, and canonical shared viewer. The mode displays the selected full year's eligible photographs in ascending capture-date order, with months ascending and a stable asset-ID tie-break. Closing the viewer restores the recap URL, year, focus, and exact scroll position through the existing origin-restoration contract.

Recap eligibility is independent of Photos display chronology. It requires `photo.evidence.capture` with basis `capture`, status `exact`, one identical start/through calendar date, and the selected capture year. Current server capture evidence emits exact, conflicting, or unknown states. Unknown and conflicting dates, including conflicting dates within one year, cannot provide an invented month/day; they remain outside recap. Sharing timestamps never substitute for capture dates. Reviewed capture corrections qualify through the ordinary domain evidence projection. Excluded photographs remain available in normal Photos, including labelled sharing-only months and Undated/conflict sections.

The year card and recap explicitly explain that ordinary search/filters do not narrow the annual collection. Recap requests all current accessible matches, then applies capture eligibility. The validated `return` parameter restores the originating normal Photos query, year, and filters; a standalone link falls back to Photos. Empty capture years and malformed years show clear empty/invalid states with a route back to Photos.

The mode hides ordinary filters and bulk selection/editing. It adds no publication/review gate, generated selection, narration, story editor, or video workflow. Existing viewer metadata/contribution controls remain available. No backend, schema, storage, access-policy, or provider change occurs.

## TDD and verification

Owner-confirmed seam: existing actual-app desktop and Pixel 7 Playwright journeys. `playwright.recap.config.ts` extends Photos/unified configuration and uses the existing temporary-archive server. `MAZI_RECAP_FIXTURE=1` extends only the richer Photos fixture with February/June captures, a sharing-only 2024 photograph, same-year conflicting capture dates, and cross-year conflicts. Ordinary Photos fixtures and their expected counts remain unchanged. A real synthetic source transfer/withdrawal verifies access filtering; no component mock harness or personal media is used.

Red evidence:

- `MAZI_UNIFIED_PORT=8120 npx playwright test --config playwright.recap.config.ts` before implementation: **2 failed**, absent Annual recap 2024 year-card link.
- `MAZI_UNIFIED_PORT=8120 npx playwright test --config playwright.recap.config.ts -g 'covers the whole capture year'` before the browsing-only adjustment: **2 failed**, the inherited bulk-selection control remained visible. It is now hidden in recap without changing ordinary Photos editing.

Final verification after integration merge:

- `MAZI_UNIFIED_PORT=8120 npx playwright test --config playwright.recap.config.ts`: **8 passed**. Covers ascending month/day ordering, exact photograph and viewer focus/scroll return, independent capture-year inclusion, sharing-only/same-year/cross-year conflict exclusion, normal Photos availability of excluded items, empty/invalid years, full-year membership despite ordinary place filters, return to prior Photos filters, withdrawn media removal/original denial, and session-loss clearing.
- `MAZI_UNIFIED_PORT=8120 npx playwright test --config playwright.photos.config.ts`: **8 passed**, retaining ordinary newest-first Photos, filtering, uncertainty, loading/failure recovery, and access contracts.
- `npm run test:unit`: **23 passed**. Build/typecheck passed in integrated server startup. `npm run lint`, `git diff --check`: passed.
- `npm run check:budgets` after integration: Globe **243.0/256 KiB**, entry **93.2/150 KiB**, stylesheet **19.7/40 KiB** pass. All scripts remain temporarily **422.9/420 KiB** pending the authorized legacy/AI retirement slices. No cap was raised; this is an explicit remaining limitation.

## Shared-gallery handoff and evidence

`createGallery` continues to use its existing Photos option. Recap is detected from the public query, `parameters()` deliberately returns no ordinary filters in that mode, and `remember()` preserves recap plus the validated normal-Photos return URL. Keep search `onSearch`/`onReset` hooks when integrating #149; an empty recap query must hide conversation search results. The search implementer has confirmed the Photos search form will be hidden in recap, preventing a visible query control whose filter is intentionally ignored.

Screenshots: [desktop Annual recap](recap-desktop.png), [phone Annual recap](recap-phone.png). Desktop screenshot inspected: January's 2/5/9 ordering precedes February and June; the capture-only scope and standard viewer return focus are visible.

Existing projection/matching capacity and failure boundaries remain; no new paging guarantee is introduced. Legacy generated/approved-event recap presentation remains with its retirement ticket; this implementation does not use that combined Memories UI/API. These are local synthetic checks, not production milestone acceptance. No push, deployment, individual PR, archive purge, or migration occurred.
