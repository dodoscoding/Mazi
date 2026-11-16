# Independent H1 social Home interface review

Verdict: FAIL at `65056c9`. One P2 activity-return defect and one P2 existing-test regression need correction. The new Home journeys otherwise pass independent checks.

- Base: `2b4b09d3f90954bc71c00e262da829366dcb5982`.
- Head: `65056c9b2b000d8686f68f135d30d3cc1f809a6f`.
- Stable patch ID: `98eed9c6974f214bdf7ed44f46d48541d318af2e`.
- Scope: bounded Home/activity reader, selected-memory route and direct grouped-photo entry, lazy app boundaries, shared styles, Turkish detail copy and compatibility. Backend API was already merged. Reviewer: GPT-6.1 Sol with high reasoning, independent within one model family.

## Standards

### P2: Update all affected existing journey selectors

Existing browser contracts still use labels translated by this change. Independently ran two desktop cases against the actual synthetic sample server and current production build:

- `tests/atlas.spec.ts:182`, “leaving the atlas during the intro counts as seeing it”, times out waiting for link `Back`; the actual detail link is `Geri`.
- `tests/journey.spec.ts:33`, “select, open, explore photos and context; Back restores selection and focus”, times out waiting for button `Show conversation`; the actual label is `Konuşmayı göster`.

The same file also retains `Back` at lines 37, 56, 65, 82 and 110, plus `Memory not found` at line 63. `tests/resilience.spec.ts:36` retains `Back`. These are relevant existing contracts required by AGENTS and the implementation plan's browser gate. Update exact selectors to their intended Turkish labels while preserving assertions for context, focus, history, content and recovery. Do not translate the unrelated entry introduction's existing Back buttons merely because they share the old word.

No other standards finding. Runtime additions introduce no explanatory comments or suppressions; Photo's existing style comment moved with unchanged style rules. The lazy modules are coherent route boundaries rather than speculative abstractions. The notebook and full-Atlas mock changes preserve the tested ownership/content assertions while providing their new bounded endpoints. Tests that intentionally examine multiple archive cards explicitly warm Atlas, which is a legitimate archive context rather than a replacement for direct-selected network checks.

## Spec

### P2: Preserve the activity page when returning from a detail

Locations: `src/social/SocialHome.tsx:86`, `:129`; `src/App.tsx:75-97`. The activity cursor exists only in SocialHome state. Opening a detail unmounts that component; Back mounts it with an empty cursor and requests the first page. App records scroll and opener ID but no activity-page location. Its restoration cannot focus a page-two opener that is no longer rendered.

Independent real HTTP/browser reproduction on a fresh local Home fixture:

1. Upload one generated JPEG through the actual ZIP inventory/import interface and worker.
2. Create 22 comments through the authorized API on its permanent photo target.
3. Open `/circle?section=activity`, select “Sonraki haberler” and verify two rows.
4. Open the first page-two activity row, then use detail's “Geri”.
5. The app returns to the first 20 rows, loses the original row and focuses H1 rather than its opener. The same cursor loss applies to browser history return because the activity URL does not identify the page.

Observed output:

```text
Before detail: {"rows":2,"opener":"activity-comment:…","first":"Alice paylaştı\nIndependent activity 1\n…"}
After Geri: {"rows":20,"openerPresent":0,"focusedTag":"H1","first":"Alice paylaştı\nIndependent activity 21\n…"}
```

Preserve the opaque activity cursor as part of the return location, scoped to current profile/group. Return should re-read that bounded page and restore the actual opener/scroll if it remains authorized; if the opener disappears, a deliberate heading fallback is appropriate. Add a real page-two detail/Back case (and history return) without caching private activity text or issuing a full Atlas request.

No further scoped runtime finding. Home follows the server's bounded feature priority and deduplicated projection. Initial Home and direct grouped `photo-ASSET` entry request zero full Atlas and notebook endpoints. Current action time remains separate from the photograph's 2020 evidence. Empty planning, stored plan timezone, independent phone attendance, actual ZIP worker/grouping, two comments, reaction, next-day refresh and notebook deep-link focus all pass. Error and denied states, partial continuation and late-response disposal pass their scoped checks. Selected revalidation preserves known content on transient failure, clears it on denied responses and ignores aborted results. Shared Photo and note-link styles are imported by actual consumers after route splitting.

## Independent verification

- `node --test tests/dom/social-home.test.mjs tests/dom/archive-hook.test.mjs tests/dom/route-history.test.mjs tests/dom/discord-return.test.mjs`: **29 passed**, zero failed/skipped.
- `MAZI_UNIFIED_PORT=8174 npx playwright test --config playwright.home.config.ts`: **seven passed, one explicit duplicate-phone skip**, 36.1 seconds. Uses actual temporary archive, ZIP import/worker, independent authenticated New York phone session, plan attendance, grouped-photo canonical route, comments/reaction, next-day return and notebook focus. Network assertions confirm zero full Atlas or notebook calls on initial Home/direct photo. Activity reads 20 then two rows; scoped axe and 320-pixel layout pass.
- Dedicated independent Playwright reproduction on a fresh `tests.browser.home_server` at port 8174 produced the page-two return defect above.
- Two existing desktop cases via a temporary external Playwright config and force-local sample server at port 5316: **two failed**, exclusively on the stale translated labels listed above. Error contexts explicitly show the actual `Geri` and `Konuşmayı göster` controls. No application startup failure was involved.
- Inspected five synthetic screenshots: empty desktop, plan desktop, next-day desktop, next-day 320-pixel independent phone, activity phone. Typography and controls are readable; fixed navigation appears at its viewport location within the full-page phone image. Synthetic solid-color JPEGs are intentional, not missing photos.
- `npm run check:budgets`: passes unchanged ceilings: entry 92.9/150 KiB gzip, all scripts 414.2/420, index CSS 19.7/40, Globe 243.0/256. Optional CSS sum is disclosed separately in author evidence and is not confused with the enforced index-CSS check.
- `git diff --check 2b4b09d...HEAD`: passes the complete committed branch.

Author evidence separately records notebook/detail/clarity/unified checks; those broader counts are not claimed as newly independent runs. Builds were serialized; the separate sample server reused the completed dist without rebuilding during the Home run. Both independent local servers were stopped, and their temporary archives removed. Generated Home screenshots were restored to the reviewed head; the worktree is clean. No implementation file, production archive, hosted service, publication or deployment changed. Physical-phone and five-friend acceptance remain open.

## Superseding focused H1 correction review

Verdict: PASS at `bc4d603d578681c803955ee2c0be693e50501d5b`. Both original P2 findings are resolved. The original FAIL and its evidence remain above; this verdict supersedes it.

- Base: `2b4b09d3f90954bc71c00e262da829366dcb5982`.
- Exact reviewed head: `bc4d603d578681c803955ee2c0be693e50501d5b`.
- Stable full-branch patch ID: `0fa1108d8d87512c425eb073d32fca6b26f75104`.
- Correction comparison: prior `65056c9`, red `2599118`, fix `aa3ca76` and final evidence `bc4d603`.
- Main `921670e` is not integrated in this head; the coordinator identifies its additional keyword-backend boundary as a subsequent integration step. This verdict does not claim to verify that later integration.

### Standards

No new standards finding. The old Atlas, journey and resilience selectors now use the intended Geri, Konuşmayı göster and Anı bulunamadı controls. All context, text, keyboard, recovery and focus assertions remain intact. Unrelated introduction Back buttons are unchanged. Runtime correction adds no comment, suppression or private cache.

### Spec

Activity paging now writes the opaque cursor and group to its history URL and binds the entry to current profile/group metadata. The scoped initial position is captured once for the mount. An unbound cursor is removed before requesting the page; a different profile/group cannot reuse the old scoped cursor. The history data contains no activity text or comments. Current authorized bounded reads supply each page.

The independently reproduced page-two route now survives both detail Geri and browser Back. The exact cursor URL returns, its actual opener regains focus and nonzero scroll is restored. Reload re-reads the same page. If the opener is deleted while detail is open, the remaining authorized page renders and focus deliberately falls back to the heading at scroll zero. The asynchronous restore runs once for that mount rather than pulling later refreshes back to an old opener. Existing group/session invalidation and selected denial disposal remain intact.

### Independent verification

- `node --test tests/dom/social-home.test.mjs tests/dom/archive-hook.test.mjs tests/dom/route-history.test.mjs tests/dom/discord-return.test.mjs`: **30 passed**, zero failed/skipped. Includes current-scope cursor rejection before an old-page read, exact cursor retry, late private disposal and network ownership.
- `MAZI_UNIFIED_PORT=8174 npx playwright test --config playwright.home.config.ts --grep 'photo-only Home|Home and selected detail recover'`: **four passed**, 27.5 seconds. Desktop and phone each run the real ZIP/worker fixture, page-two Geri/browser Back, exact URL/opener/nonzero scroll, refresh, deleted-opener fallback and zero full Atlas/notebook reads. The paired error/withdrawal case confirms retry and removal of selected/Home content after actual origin withdrawal.
- Existing Atlas intro-return, full journey and reduced-motion resilience cases via the temporary sample config on port 5316, desktop and phone: **six passed**, 5.5 seconds. Both originally failing contracts now complete, alongside the resilience flow with its translated Back control.
- The Home command built once before browser startup. The additional sample fixture reused that completed dist with no concurrent rebuild. Both local servers stopped after checks.
- `npm run check:budgets`: unchanged ceilings pass: entry 92.9/150 KiB gzip, scripts 414.4/420, index CSS 19.7/40, Globe 243.0/256.
- `git diff --check 2b4b09d...HEAD`: full committed branch passes. The regenerated activity screenshot was restored, and the tracked worktree is clean.

The previous independent seven-case Home journey and visual evidence remain valid for unchanged flows; broad author suites were not repeated. No implementation edit, production data, hosted service, publication or deployment changed during this review. Physical-phone and friend-study limitations remain open.
