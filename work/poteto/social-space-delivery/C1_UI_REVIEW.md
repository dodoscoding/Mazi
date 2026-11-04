# Independent C1 conversation interface review

Verdict: FAIL at `6526219`. Two P2 behavior gaps need correction. The existing focused DOM and browser journeys pass.

- Base: `b3efcf7d1c300bb12173b58908b31106c32ea08f`.
- Head: `6526219cd62de3f22987604448f1fee3475fe985`.
- Stable patch ID: `4816ed125352570329d0db318f0e2eaab94c982d`.
- Scope: C1 comments/reactions interface, selected-photo versus approved-memory target, detail integration and local synthetic fixture. Existing backend contracts are already merged.
- Reviewer: GPT-6.1 Sol, high reasoning; independent review within one model family.

## Standards

No actionable standards finding. New runtime code introduces no comments, suppressions or any-casts. Comment text and member names render through React escaping; plain-text injection is exercised by the DOM test. The optional panel loads lazily, uses permanent target identity, and separates native conversations from notebook notes and imported source excerpts. Request batching is bounded to the archive target plus at most 20 comment targets. State and uncertain commands remain in component memory. The fixture explicitly selects local storage before creating its temporary archive, and test controls remain outside production handlers.

The panel owns one coherent conversation lifecycle. Its size alone does not justify an unrelated refactor. Existing shared styles and notebook contracts are preserved in the diff.

## Spec

### P2: Show a successfully created comment beyond the current page

Location: `src/social/ConversationPanel.tsx:186` and `:194`. `execute` discards the create response and always reloads the current cursor. The API sorts comments in ascending creation order. Once the current page contains 20 comments, posting another comment clears the composer and says “Kaydedildi.” but displays only the old page; the new comment is absent until the user navigates forward. On longer conversations it can be several pages away. The originating plan explicitly requires that the successful writer immediately sees the result (“Yazmayı başaran kullanıcı sonucu hemen görür”).

Independent real-browser reproduction against the actual local AppServer/MemoryStore:

1. Seed exactly 20 synthetic comments on the selected permanent photo.
2. Open its `discussion=photo` detail and wait for 20 articles.
3. Type `Independent newest comment` in the composer and click “Yorumu paylaş”.
4. Wait for “Kaydedildi.” and total `21 yorum`.
5. The composer is empty, 20 old articles remain, and the new comment is not rendered.
6. Click “Sonraki yorumlar”; the saved comment then appears.

Observed output:

```text
{"total":"21 yorum","rendered":20,"newCommentVisible":0,"composer":"","nextPage":1}
Newly created comment exists only after navigating to the next page
```

Reveal the successful created result with bounded authorized reads and reactions, while preserving deterministic pagination and exact retry identity. Cover creation beyond the first page and a dropped-response receipt replay; do not introduce a duplicate displayed row or per-comment reaction requests.

### P2: Deleting another comment discards an unrelated unsent draft

Location: `src/social/ConversationPanel.tsx:191`. Every successful `comments/*` operation resets the editor. Deleting a saved comment is independent of an unrelated new comment currently being composed, but its successful response silently erases that unsent text.

Using the same actual browser and temporary archive:

1. Have a saved own comment visible.
2. Type `Independent unrelated unsent draft` in the new-comment composer without submitting it.
3. Click “Sil” on the saved comment, then confirm “Yorumu sil”.
4. The saved comment is removed and the unrelated composer becomes empty.

Observed output:

```text
Draft after deleting different saved comment: ""
```

Clear the draft for a successful create/update of that draft or removal of the comment being edited. Preserve an unrelated new draft or another comment's edit draft when deleting a different comment. Add a focused regression, including successful exact retry of deletion where appropriate.

No further scoped finding was identified. The selected-photo and approved-memory targets remain independent, current group/session/target identity keys the panel, denied pages or batches clear private state, and request generations/aborts discard late results. Reactions send desired on/off state with retained request body/key during uncertain retry. The four reaction controls preserve focus while blocked. Current author permissions, stale-edit reload and pagination are exercised against the actual backend.

## Independent verification

All operations used synthetic local fixtures on macOS, Node 24.15.0, Python 3.14.7 and Chromium. Builds were serialized; the independent reproduction reused the completed production build.

- `node --test tests/dom/conversations.test.mjs tests/dom/route-history.test.mjs tests/dom/discord-return.test.mjs`: 21 passed, zero failed. Covers selected-target batching, escaped text, exact retry, stale drafts, denied batch, exact cursor, late results and route/OAuth compatibility.
- `MAZI_UNIFIED_PORT=8160 npx playwright test --config playwright.conversations.config.ts`: 13 passed, one duplicate phone case skipped, 19.5 seconds. Includes independent desktop/320-pixel phone sessions, sibling/memory separation, lost comment and reaction responses, real stale editing, deletion/withdrawal, logout and circle denial, bounded batches, keyboard focus and axe.
- Additional independent Playwright reproduction above ran against a newly started `tests.browser.conversations_server` on port 8160. It seeded 20 comments through the actual API, then used real UI submission and deletion. The server was stopped and its temporary archive removed.
- Inspected all three synthetic conversation screenshots: `memory-desktop.png`, `photo-phone.png`, `page-phone.png`. Text, reaction states, author controls and composer are readable without narrow-screen clipping. Raster scale is device-dependent; it is not a CSS viewport measurement.
- `npm run check:budgets`: passed unchanged D27 ceilings. Entry 148.5/150 KiB gzip; scripts 402.1/420; stylesheet 36.8/40; globe 242.9/256.
- `npm run check:docs`: passed 19 authored documents, 338 local links, 30 requirement mappings, eight milestones and 15 acceptance scenarios.
- `git diff --check b3efcf7...HEAD`: passed for the full committed branch, including evidence logs.

The author's committed evidence records 30 existing notebook cases and 37 detail cases with seven inapplicable skips. Those unchanged suites were inspected but not independently repeated after the concrete blockers were confirmed. Existing source notebook integration remains separate in the reviewed diff. Direct `/memory/photo-ASSET` loading is explicitly deferred to H1; this C1 review verifies permanent selected-photo targets inside approved-memory detail routes. Configured-circle replacement is an honest synthetic D17 fixture, not a new production group-switch API. Physical-phone and five-friend acceptance remain open.

Generated screenshot changes from the independent browser run were restored to the reviewed revision. The worktree is clean. No implementation file, production data, hosted schema, publication or deployment changed during this review.

## Superseding focused correction review

Verdict: PASS at `8e854292ee955079efc467962558b1abe1284b89`. Both original P2 findings are resolved. This supersedes the original FAIL above and preserves its reproduction evidence.

- Original fixed-point base: `b3efcf7d1c300bb12173b58908b31106c32ea08f`.
- Current-main comparison base: `182d419df06cddac8e72aef1f4c350369a59b2fd`.
- Exact reviewed head: `8e854292ee955079efc467962558b1abe1284b89`.
- Stable patch ID against current main: `23fb5f8c46603075c209785d446dd3ce7f531276`.
- Stable full-branch patch ID against original base: `74e022628097cd5ed8008bcb1b4be84bfa7680bf`.
- Correction comparison: prior reviewed `6526219`; red contracts `7a6b0d9`, runtime fix `0b6412e`, main integration `30daacb`, final evidence `8e85429`.

### Standards

No new standards finding. The added saved-result receipt uses React-escaped plain text and a concise accessible complementary label. It adds no runtime comment, suppression or cast. It is separate from conversation rows and does not expand reaction targets. The refreshed `confirmed-phone.png` was inspected: its saved text and explanation wrap cleanly. Current-main integration retains both lazy PhotoLabels and ConversationPanel imports and their independent controls. Previously reviewed C1 target selection and notebook separation remain intact.

### Spec

Successful create now keeps the actual server-returned result while refreshing the current page. If that ID is absent from the visible page, the confirmed plain text appears immediately in a clearly identified saved-result receipt. If the ID is already present, no extra receipt appears. The page remains at most 20 comment rows, with at most 21 reaction targets. Navigating to the new comment's page removes the receipt and shows its text once. Exact lost-response replay uses the backend's surviving current result rather than constructing a second comment; a deleted replay result is excluded.

The receipt participates in the existing private lifecycle. `load` discards it on normal refresh or pagination, `clear` discards it on denied group/session/access events, and target/profile remount disposes it. The refreshed comment and reaction reads retain current target authorization and generation checks. The feature adds no private cache or extra per-comment request.

Successful create clears its composer; update or delete clears the editor only when it acts on the comment being edited. Deleting a different saved comment preserves an unrelated new-composer draft or another comment's edit draft. That condition remains correct during exact deletion replay after the first response is lost. No new spec finding.

### Independent verification

- `node --test tests/dom/conversations.test.mjs tests/dom/route-history.test.mjs tests/dom/discord-return.test.mjs`: **25 passed**, zero failed/skipped. Includes off-page receipt, 20-row/21-target bound, refresh disposal, and unrelated new/edit draft preservation with exact delete retry.
- `MAZI_UNIFIED_PORT=8160 npx playwright test --config playwright.conversations.config.ts --grep 'beyond the current page|deleting a different'`: **eight passed**, zero failed/skipped, 10.4 seconds. Each correction ran on desktop and phone against the actual temporary archive: normal and committed/lost-response/replayed create, immediate single confirmed text, unchanged reaction bounds, next-page deduplication, and committed deletion replay preserving each unrelated draft type.
- Browser startup completed a fresh production build. No concurrent build used its dist output.
- `npm run check:budgets`: passes unchanged ceilings on the combined app: entry 149.5/150 KiB gzip, scripts 405.5/420, CSS 36.9/40 and globe 242.9/256.
- `git diff --check b3efcf7...HEAD` and `git diff --check 182d419...HEAD`: both pass for the complete committed branch.

The previous independent 13-case C1 journey remains the evidence for unchanged broad flows; unchanged notebook/detail suites were not repeated. The author's evidence separately records 21 full C1 browser passes with one duplicate skip and two F1 coexistence passes. Those counts are not represented as new independent runs here. Local-only synthetic fixtures and phone-emulation limits remain as described above. No application edit, hosted mutation, publication or deployment occurred.
