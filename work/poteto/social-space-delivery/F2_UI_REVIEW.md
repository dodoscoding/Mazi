# F2 filter UI independent review

## Artifact

- Current exact reviewed head: `0d45ce10ee04fbd58140f22f6c17cbd4befbddd1`.
- Base and actual merge-base: `2b4b09d3f90954bc71c00e262da829366dcb5982`.
- Stable full-branch patch ID: `14e162426db6ce92e3d8601eee1ffb7f65087557`.
- Worktree `photo-filters`; reviewed feature diff after its clean main merge. Earlier assigned `7839b27` has identical feature implementation; current base excludes reviewed H1 API, Atlas-copy and baseline prerequisites. No implementation edits or publication.

## Verdict: FAIL

### Standards

No actionable documented-standard violations. Gallery uses the existing server match predicate rather than a second sibling-level client matcher; shared declaration/person controls are reused by both clients. Existing editor lifecycle/cancellation generation remains intact. Naming, duplicate code, data clumps, repeated switches and speculative generality were considered as judgment; no separate mandatory refactor justified. No newly introduced code comments or suppressions requiring correction; moved/existing comments are outside the introduced-comment audit.

### Spec

**P2 — Preserve failed matching authority across Gallery presentation changes.** `src/features/memories/gallery.js:591–605` guards only `matching`; after an error, `matching=false`, `facets=null` and `matched` is empty. A view/order or selection-mode click calls `update`, whose null fallbacks fabricate `0 matching / 0 visible`, then `renderGrid` replaces the actual error/Retry with a successful no-match state. This violates the plan's separate loading/empty/error states and `docs/CONTRACTS.md` promise that failed queries retain unknown totals and offer a retry without partial-result claims.

Independent executable DOM reproduction using the existing feature harness: mount Gallery with two `photoEvidenceMemory` children and initial successful `photoMatches` IDs; return `Error` with `status=400,code=capacity_exceeded` from the second matches request. Click the screenshot Yes checkbox and await Retry. Before presentation change, summary is `Eşleşmeler yüklenemedi.` and grid contains the capacity message plus `Yeniden dene`. Click `#grid-view button[data-view=all]`. Observed summary becomes `0 eşleşen fotoğraf · 0 görünür fotoğraf`; grid says no matching photo and only offers reset. Retry is gone. The undesired-state assertions passed independently.

Keep explicit failed/unavailable match state (or guard absent current authority) in `update` so presentation-only changes cannot turn failure into a zero result or replace recovery. Add failure→view, failure→order and failure→selection-toggle regressions; successful Retry should then populate authoritative counts normally. Initial Atlas failure should likewise remain unavailable under these controls.

No other actionable correctness findings from the inspected feature diff. Controls serialize same-dimension OR and cross-dimension AND to server predicates, preserve exact place arrays/sharer names, match child asset IDs while retaining original detail indices, and separate filtered totals from the server's full-visible denominator. Search uses current API photo facets without initial Atlas/People management, retains legacy omitted date-basis URLs, restores mode, excludes unsupported context and carries predicates through paging. Late responses use generation/group checks. F1 receipt/conflict and lazy-selection cancellation contracts remain green.

## Independent validation

`node --test tests/dom/photo-filters.test.mjs tests/dom/gallery-labels.test.mjs tests/dom/label-editor.test.mjs tests/dom/search-date-basis.test.mjs tests/dom/search-filters.test.mjs tests/dom/search-startup.test.mjs tests/dom/discovery-keyword.test.mjs tests/dom/memories-mobile.test.mjs tests/dom/photo-evidence.test.mjs`: **34 passed**. Covers exact match request/child index, date/mode/source/person restoration and reset, context exclusion/startup, current-group denial/late context races, failed-search recovery, F1 50-photo cap/lazy races/receipts/conflicts, mobile view/order and A1 facts. Independent additional failure→view repro confirmed the gap described above.

Inspected all four settled desktop/phone Search and Gallery captures. They show the selected child alone with declaration badges and preserved source text. These cropped result captures do not independently prove the complete filter controls or physical-phone acceptance; author records six real synthetic desktop/320 px A2/F1/F2 journeys. No browser/dist rebuild was started by this reviewer, and unchanged backend filtering was independently reviewed in its API slice. Full committed branch whitespace passed against the exact head; worktree clean.

## Required merge gate

The feature's recorded primary entry is **152.5/150 KiB**, an explicit current failure. Total scripts **408.5/420**, CSS **37/40** and Globe **242.9/256 KiB** remain within limits. This report does not approve merging or waive the gate: the accepted H1 lazy-route dependency must be integrated, then the combined immutable head must pass the unchanged budget check and relevant integration checks. No duplicate App split or ceiling change is requested.

## Focused correction re-review — functional PASS, merge gate pending

- Current exact reviewed head: `b85570838961222ea63b0cd5bc28fb58085cd8ca`.
- Unchanged base/merge-base: `2b4b09d3f90954bc71c00e262da829366dcb5982`.
- Stable full-branch patch ID: `ca0ebd7143ac20f50708ba4582324a7829b9ac1b`.
- Original FAIL at `0d45ce1` remains above. Red `5f6f8e7`, runtime fix `a636c5e`, browser contract `2e483d3`, final evidence `b855708` reviewed.

**Standards: PASS; Spec: PASS for functional scope.** The one-line authority guard `matching || !facets` in `update` prevents presentation-only controls from replacing unavailable results with fabricated zero counts or deleting Retry. It still updates view/order ARIA and URL before returning. A successful explicit retry restores normal authoritative rendering, original child indices and full-visible denominators. No query/schema/security boundary or budget ceiling changed, and no added comments require correction.

Independent re-execution of the original failed-match→view reproduction now preserves the exact error/retry content, and Retry retains `screenshot=yes` before restoring genuine totals. Focused independent command:

`node --test tests/dom/photo-filters.test.mjs tests/dom/gallery-labels.test.mjs tests/dom/label-editor.test.mjs tests/dom/search-date-basis.test.mjs tests/dom/search-startup.test.mjs tests/dom/discovery-keyword.test.mjs tests/dom/search-filters.test.mjs`

**40 passed**, including nine failed-authority cases (view/order/selection after HTTP 400/503 or initial Atlas failure), successful retry/asset index, pending-state removal, F1 stale lazy opens/receipts/conflicts/access clearing, A2 URL date semantics, Search startup, late context/group races and capacity recovery. Separate original reproduction: **1 passed**. Full committed branch whitespace passed against the exact head; worktree clean. Author records two new real desktop/320 px browser recovery cases, not independently rerun in this focused recheck; no dist rebuild or browser server was started by reviewer.

No remaining actionable functional findings. **This does not satisfy the entry-budget or merge gate.** The previously recorded 152.5/150 KiB entry requires the separately reviewed H1 lazy seam and a passing budget/integration recheck on the final combined immutable head. The earlier required merge-gate section remains applicable.

## Final combined H1/F2 acceptance — PASS

- Exact reviewed head: `6a45de83a67a23db022807b3ea67a5a9b82d0534`.
- Current base/actual merge-base: `d203ba7080547c8cf6511ecd2d434fd3a7cd9a64` (published H1 UI integrated).
- Stable full-branch patch ID: `b5427a20e575fafa8be76c55fb1b5f2e61c6b37f`.
- Earlier FAIL and functional correction history remain above. `git diff a5bf4ca..6a45de8 -- src` is empty: the final published-main merge adds no unexpected application changes. The feature diff against current base contains F2 only; accepted H1/keyword prerequisites are excluded.

**Standards: PASS; Spec: PASS; previously pending H1 bundle dependency: RESOLVED.** Independently ran `npm run check:budgets` before browser verification and again after its clean serialized builds: entry **92.6/150 KiB**, primary CSS **19.7/40 KiB**, Globe **243.0/256 KiB**, all scripts **417.3/420 KiB** gzip. Every unchanged ceiling passes. No duplicate App split or budget increase was introduced. Total scripts retain 2.7 KiB headroom; ordinary future edits must keep running this gate.

Independent cross-feature checks at this exact head:

- `node --test tests/dom/photo-filters.test.mjs tests/dom/gallery-labels.test.mjs tests/dom/social-home.test.mjs tests/dom/archive-hook.test.mjs tests/dom/search-dates.test.mjs tests/dom/feature-page.test.mjs tests/dom/route-history.test.mjs tests/dom/search-startup.test.mjs`: **55 passed**. Covers zero-full-Atlas Home/selected ownership, disposal and group/session privacy, feature/history aliases, exact cursor retry, matched-child predicates/URL/reset, missing-authority recovery and F1 stale lazy selection.
- `MAZI_TEST_PORT=5302 MAZI_UNIFIED_PORT=8162 npx playwright test --config playwright.unified.config.ts -g 'same-photo filters survive|Gallery presentation controls retain failed' --project desktop --project phone --reporter=list`: **4 passed in 10.5s**, including 320px filter matches/reload/original photo index/hidden refresh and actual retry after injected capacity failure.
- After that server completed, same isolated ports and `playwright.home.config.ts -g 'photo-only Home fallback|Home and selected detail recover'`: **4 passed in 30.3s**. Verifies zero full-Atlas/notebook reads, direct selected-photo route, bounded activity paging, Back/history return cursor/focus/scroll, refresh deletion fallback, selected-detail retry and withdrawn-content clearing. No concurrent dist rebuild occurred.
- Both browser commands build/typecheck before serving, successfully. The existing large-chunk advisory remains informational. `npm run check:docs`: **passed**, 19 documents and 348 local links. Full committed branch whitespace passed.

Inspected newly generated phone Search/Gallery result captures: the single matched child and declaration/source facts remain legible. Test-generated screenshot changes were restored only to their committed versions after inspection; worktree clean and exact head unchanged. No app edits, production access or hosted mutations; browser servers completed and stopped.

No remaining actionable findings or unresolved H1/F2 merge dependency in this reviewed combined artifact. Full repository release CI, deployment and physical-device/friend-study acceptance remain delivery-owned checks; this verdict does not claim those external gates were completed.
