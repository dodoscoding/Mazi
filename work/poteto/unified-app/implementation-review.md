# Unified app implementation review

Independent same-family review on 14 October 2026. Reviewed the actual relocation and added integration in `src/features`, `src/useArchive.ts`, `src/Atlas.tsx`, `mazi/atlas.py`, `mazi/server.py`, `scripts/run-app.mjs`, browser/backend contracts and the workflow trail. No application edits, commits, external review or cross-family validation occurred. Applied the pinned Poteto wrapper/adapter and performed the scoped Comment Sicko audit directly because further delegation was prohibited.

Final verdict is accepted for the local consolidation scope. All actionable findings below are resolved; the final resolution section records independent runtime evidence. The initial review is retained as an audit trail.

## Initial actionable findings, now resolved

1. **P1. Dispose private feature state on access denial.** `src/features/lifecycle.ts` lines 24–52 clears selected output containers and hides others, but preserves form values and unreleased object URLs. `FeaturePage` does not subscribe to `mazi:access-lost`. In the built app on an isolated temporary archive, signed in as Ben, opened Memories, entered `PRIVATE DRAFT AFTER ACCESS LOSS` in `#capsule-text`, logged out through `/api/logout`, then clicked Refresh stories. The recap request returned 403 and cleared recap output, but the private capsule draft remained visible with exactly that value. Capsule title/photo selection likewise lie outside the cleared selectors; archive workspaces are merely hidden with their private markup retained. Dispose the entire private mount and its media resources on denial, preserving only an explicit recovery surface. Add a real logout/member-removal denial test asserting cleared form values, private DOM and URLs, including pending requests.
2. **P2. Bind evidence reads to the selected circle.** `src/features/evidence/mount.js` line 16 fetches the unchanged route query through `lifecycle.search`; `src/features/index.tsx` lines 51 and 81 remount the same query on group changes. Reproduction used two circles belonging to Ben. Opened circle A's supporting record, then changed Current circle to B. The shared selector showed B while `#record` still displayed A's `Dinner with friends`, date and Istanbul place. Backend authorization remained correct because Ben belonged to both circles, but the view violates shared circle isolation and can expose a record from the wrong working context. Clear/redirect the evidence route on circle changes, or reject a query group that differs from the active context. Test two populated circles and delayed evidence responses.
3. **P3. Remove sample copy from the real Timeline.** `src/App.tsx`'s Timeline branch unconditionally renders `Three fictional memories, a few familiar feelings.` while listing real authorized cards. Condition this statement on sample mode and describe real archive coverage otherwise.

## Corrected during review

These were reported to the parent and the subsequent source was inspected. Reverification remains with the parent.

- CI invoked deleted domain npm scripts and used `.venv` evaluators without creating `.venv`. The revised workflow uses setup plus `test:backend`, `test:app` and `test:domains`.
- Optional CLIP installation referenced the deleted `../phase1/requirements.txt`. It now references `../../requirements.txt`.
- The Photos companion hardcoded backend port 8005, incompatible with `npm start` on 5173. It now defaults to the public app URL and accepts a validated `MAZI_APP_URL` override. Native compilation was not run by this reviewer.

## Verification and gaps

- `.venv/bin/python -m unittest tests.backend.test_atlas tests.backend.test_server -v` passed all six tests. They cover real/cross-year cards, hidden-photo/event suppression, membership denial, static-path containment, missing builds, Origin rejection and identity reopening.
- Browser reproductions ran installed Chrome headlessly against `MAZI_IMPORT_PORT=8029 .venv/bin/python -m tests.browser.memories_server`, which creates a temporary synthetic archive. Both findings above were directly observed. No personal data or shared running server was used.
- The available integrated browser result reported four passing desktop/phone cases. These prove broad connected workflows and repeated story navigation; they do not cover the reproduced group-query mismatch or access-denied form retention.
- Required acceptance gaps remain delayed circle-A results after circle-B selection, visibility/page lifecycle disposal and reload, denial during downloads/FileReader/media completion, and launcher failure/shutdown with child cleanup. Existing import browser suites must run against the unified shell, not only the newly added happy-path journey. Reopening a root created only by the renamed store does not independently prove compatibility with a populated pre-relocation root; retain that compatibility evidence separately.

## Scoped Comment Sicko audit

Report-only audit. No touched application files and zero deletions. No correctness/safety suppressions were found in the scoped integration files.

- `MUST KILL` the denial-cleanup workaround in `createLifecycle.apiFetch`. Its comment says private markup is removed while the code mostly hides selected containers and leaves form state. Replace it with structural disposal and a recovery boundary, then remove the justification.
- Remove the repeated first-line narration from all seven feature `mount.js` files, the stale page/global narration in Memories, the backgrounding narration in Answers, the stale-results narration in Places and the socket-binding narration in the launcher. They describe owned code rather than an external constraint.
- The Places date-line comment explains an owned drawing rule and can be expressed by the drawing helper's name. No license/public-contract comments were flagged.

Model the Domain shaped the shared-context and disposal findings. Prove It Works shaped the independent browser reproductions rather than relying on compilation or the passing happy-path suite.

## Final independent resolution verification

The findings above describe the initial implementation. All three actionable correctness findings are now resolved. Final verdict is **accepted for the local consolidation scope**, with the production and optional-runtime limitations already recorded elsewhere unchanged. This remains a same-family review.

- **P1 resolved.** Inspected `createLifecycle.apiFetch` and `FeaturePage.accessLost`. Denial clears private fields and disposes the feature, aborts requests, removes private markup and revokes owned URLs. A fresh headless Chrome reproduction on temporary fixture port 8029 created a story/slideshow and an unsaved capsule draft, performed actual API logout, and refreshed. `#capsule-text` and `#stories` both had zero nodes, recovery Sign in was visible, and the exact slideshow blob URL appeared in both the creation and revocation audit. Recovery through the actual login form succeeded. No browser page errors occurred.
- **P2 resolved.** Inspected the supporting-record loader's selected-circle check. Repeated the two-circle reproduction with an explicit circle-A evidence query. Selecting circle B left the header on B, emptied `#record`, and displayed the other-circle explanation. Navigating to Memories showed the same B value in its feature dropdown. This proves the fix against real authorized responses rather than a mocked group comparison.
- **P3 resolved.** The real Timeline no longer rendered the fictional-memory sentence in the same independent browser run. Source now conditions sample copy on demo mode.
- **Origin/proxy verified.** Ran Vite with the actual repository configuration and isolated port 8030, targeting the temporary backend on 8029. Same-origin login and authenticated groups returned 200; a mutation with `Origin: http://other.test` returned 403. No Origin relaxation was required.
- **Built launcher verified.** Started `node scripts/run-app.mjs --built` with a fresh temporary data root and port 8031. Health became available, `/` returned 200 with the Atlas root, SIGINT produced exit code zero, and the port no longer accepted requests. The temporary launcher data and fixture server were cleaned up. No user archive was opened.
- **Regression evidence inspected.** The parent’s final complete integrated suite records six passing desktop/phone cases in `browser-privacy-verification.md`. Added contracts cover access-loss drafts, evidence circle isolation and delayed Atlas responses through circle/session transitions. My earlier six backend tests remain passing evidence; they were not needlessly rerun for frontend-only fixes.

The denial-cleanup `MUST KILL` is closed by structural disposal. Seven repeated mount narration comments and the lifecycle workaround justification are gone, and the scoped source search found no correctness/safety suppressions. Four owned narration comments remain in Memories, Answers and Places, including the date-line explanation. They are report-only comment cleanup flags, not unresolved correctness or privacy defects. No comments or application code were edited by this reviewer.

The audit trail’s main verification status and decision ledger still need the parent’s final completion update. Remote CI, native companion compilation, a full optional learned-model installation, and every earlier domain-browser project were not rerun by this reviewer; no independent claim is made for those surfaces.

Parent completion update: removed the four remaining owned narration comments without changing behavior. The final decision ledger and verification report now record completed checks, old-root compatibility, domain browser results and their limitations.
