# Social space delivery evidence

## Checkpoint

The plan was merged first in [PR #112](https://github.com/dodoscoding/Mazi/pull/112), at `75727e0b3e28d0fea384f1c0f5cfdc4e04ed4914`. All eight runtime slices are merged through [PR #139](https://github.com/dodoscoding/Mazi/pull/139), runtime `1a0234a1a41a78e46b60723748df6d7d089be4c2`. Git first-parent history and GitHub merged-PR metadata agree for every PR below.

This is a pre-deployment checkpoint. Production remains unchanged. The completed local release matrix and qualified hosted evidence are recorded below. Current main is `f69f605d5933bda1884784ba03646536a9fdc617` after reviewed test-only PRs #140/#142 and the separately reviewed About sentence in #141. Production migrations and live deployment evidence will be appended after execution.

## Runtime slices and independent review

| Slice | Merged PRs | Independent reports and reviewed feature heads |
| --- | --- | --- |
| A1 | #116 | [Photo evidence](A1_REVIEW.md), superseding PASS at `a12df88`. |
| A2 | #120, #123 | [Read/date basis](A2_READ_REVIEW.md), PASS at `fb83745`; [selected correction/export](A2_WRITE_REVIEW.md), `7f09c85`. |
| N1 | #114, #135 | [Navigation](N1_REVIEW.md), `adea0b7`; [Turkish journey](JOURNEY_COPY_REVIEW.md), superseding PASS at `e279efd`. |
| F1 | #121, #128 | [Declarations/lifecycle/export](F1_LABELS_REVIEW.md), `f30e273`; [selected/bulk editor](F1_UI_REVIEW.md), superseding PASS at `dbbc351`. |
| F2 | #131, #137, #139 | [Shared API](F2_API_REVIEW.md), `65e82c9`; [keyword boundary](KEYWORD_BOUNDARY_REVIEW.md); [combined UI](F2_UI_REVIEW.md), final PASS at `6a45de8` after H1 integration. |
| P1 | #115, #125 | [Backend](P1_BACKEND_REVIEW.md), `07de77e`; [interface](P1_UI_REVIEW.md), superseding PASS at `60f6b03`. |
| C1 | #118, #119, #124, #130 | [Comments](C1_COMMENTS_REVIEW.md), `5adfd3b`; [reactions](C1_REACTIONS_REVIEW.md), `f859ecf`; [batch performance](REACTION_PERFORMANCE_REVIEW.md), `cabfe13`; [interface](C1_UI_REVIEW.md), superseding PASS at `8e85429`. |
| H1 | #132, #138 | [Bounded API](H1_API_REVIEW.md), superseding PASS at `6715b3f`; [Home/activity/selected detail](H1_UI_REVIEW.md), superseding PASS at `bc4d603`. |

Each report contains its exact base/head, commands, fixtures, evidence and limits. Original FAIL sections remain intact; appended rechecks state which verdict supersedes them. The [append-only decision ledger](decisions.tsv) is preserved, including historical holds. Review independence uses one model family with separate implementation and review ownership.

Cross-slice prerequisites have separate records: [GPS precision](GPS_REVIEW.md) (#113), [idle sockets and safe shutdown](SERVER_REVIEW.md) (#117), [archive DTO fixtures](ARCHIVE_FIXTURE_REVIEW.md) (#122), [D27 bundle allocation](BUDGET_REVIEW.md) (#126), [CI contracts](CI_CONTRACTS_REVIEW.md) (#127), [reviewed-place export fixture](EXPORT_FIXTURE_REVIEW.md) (#129), [JSON allocation](ATLAS_MEMORY_REVIEW.md) (#133), [Atlas label boundary](ATLAS_LABEL_BOUNDARY_REVIEW.md) (#134), and [export ordering](EXPORT_ORDER_REVIEW.md) (#136).

## Merged PR ledger

All entries below are merged on 4 November 2026. The revision column links each exact merge commit.

| PR | Change | Merge revision |
| --- | --- | --- |
| [#112](https://github.com/dodoscoding/Mazi/pull/112) | docs(product): plan photo visibility, navigation and private group interaction | [`75727e0`](https://github.com/dodoscoding/Mazi/commit/75727e0b3e28d0fea384f1c0f5cfdc4e04ed4914) |
| [#113](https://github.com/dodoscoding/Mazi/pull/113) | test(places): compare GPS coordinates with explicit precision | [`49f1f21`](https://github.com/dodoscoding/Mazi/commit/49f1f218ead0c64e3af1e027d5edd5a40fb49bb4) |
| [#114](https://github.com/dodoscoding/Mazi/pull/114) | feat(navigation): simplify Home and repair grouped destinations | [`8d6a746`](https://github.com/dodoscoding/Mazi/commit/8d6a746df7ce0a3f76ae2716230cc5d66904451b) |
| [#115](https://github.com/dodoscoding/Mazi/pull/115) | feat(social): add private plans and attendance APIs | [`02d5cb6`](https://github.com/dodoscoding/Mazi/commit/02d5cb6e5a378b6c7e0229573b18839bf90cd0a2) |
| [#116](https://github.com/dodoscoding/Mazi/pull/116) | feat(atlas): show each photo date and place evidence | [`88830a7`](https://github.com/dodoscoding/Mazi/commit/88830a78e09ed537804f59a30998e2c8a868ad92) |
| [#117](https://github.com/dodoscoding/Mazi/pull/117) | fix(server): accept idle sockets outside serialized dispatch | [`9dfdf9c`](https://github.com/dodoscoding/Mazi/commit/9dfdf9c469029d59ae436f522e5c07ca9525b96b) |
| [#118](https://github.com/dodoscoding/Mazi/pull/118) | feat(social): add authorized photo and memory comments | [`921799d`](https://github.com/dodoscoding/Mazi/commit/921799dc37dca54c7c2c93a4f7006b01608d7633) |
| [#119](https://github.com/dodoscoding/Mazi/pull/119) | feat(social): add authorized desired-state reactions | [`7f84682`](https://github.com/dodoscoding/Mazi/commit/7f846826dc0aeb50b252b486835b5fa72443e2fb) |
| [#120](https://github.com/dodoscoding/Mazi/pull/120) | feat(search): filter photo dates by capture, sharing or chronology | [`1e04437`](https://github.com/dodoscoding/Mazi/commit/1e0443758ebb79ea2543e97b7acc855cc80c6e66) |
| [#121](https://github.com/dodoscoding/Mazi/pull/121) | feat(labels): add versioned photo declarations and atomic batch edits | [`ff65dd2`](https://github.com/dodoscoding/Mazi/commit/ff65dd25aac9b3f1eb57cd80068dee12a32d7e12) |
| [#122](https://github.com/dodoscoding/Mazi/pull/122) | test(archive): supply complete photo fixtures to the archive hook | [`cdfe6f4`](https://github.com/dodoscoding/Mazi/commit/cdfe6f42b5cee4f6df2a07828006c618d3ebf930) |
| [#123](https://github.com/dodoscoding/Mazi/pull/123) | feat(atlas): correct selected photo dates and places safely | [`1f39e14`](https://github.com/dodoscoding/Mazi/commit/1f39e149dc6dd88af080d3ecbb530812a9db919a) |
| [#124](https://github.com/dodoscoding/Mazi/pull/124) | perf(reactions): authorize comment pages in bounded queries | [`39249c4`](https://github.com/dodoscoding/Mazi/commit/39249c4a1c906d297ace0e0a865129a699a2d506) |
| [#125](https://github.com/dodoscoding/Mazi/pull/125) | feat(plans): arrange meetings and attendance without photos | [`634355f`](https://github.com/dodoscoding/Mazi/commit/634355f7cec3a940abd49299063e7501be4a1b9c) |
| [#126](https://github.com/dodoscoding/Mazi/pull/126) | chore(perf): allocate bundle budget for social features | [`b3efcf7`](https://github.com/dodoscoding/Mazi/commit/b3efcf7d1c300bb12173b58908b31106c32ea08f) |
| [#127](https://github.com/dodoscoding/Mazi/pull/127) | test(ci): align social archive contracts with setup and date basis | [`a5ffdb4`](https://github.com/dodoscoding/Mazi/commit/a5ffdb47acb6a641bda2ae74201b1c283d9bde6b) |
| [#128](https://github.com/dodoscoding/Mazi/pull/128) | feat(labels): expose photo labels and atomic bulk editing | [`09f9198`](https://github.com/dodoscoding/Mazi/commit/09f919818b78b990d01b040737e98a42570d40ce) |
| [#129](https://github.com/dodoscoding/Mazi/pull/129) | test(export): verify the authoritative reviewed place projection | [`182d419`](https://github.com/dodoscoding/Mazi/commit/182d419df06cddac8e72aef1f4c350369a59b2fd) |
| [#130](https://github.com/dodoscoding/Mazi/pull/130) | feat(conversations): add photo and memory comments with reactions | [`8aa0302`](https://github.com/dodoscoding/Mazi/commit/8aa03020aa8003160fa98e082e9232b7febcd9dc) |
| [#131](https://github.com/dodoscoding/Mazi/pull/131) | feat(filters): share authoritative same-photo matching across reads | [`27b51d2`](https://github.com/dodoscoding/Mazi/commit/27b51d248a86471c2a974f2e7b06f42398b6f58d) |
| [#132](https://github.com/dodoscoding/Mazi/pull/132) | feat(home): add bounded social summaries and selected-memory reads | [`7e147aa`](https://github.com/dodoscoding/Mazi/commit/7e147aa025c49a17d282e06468dcb6dd4cf2309c) |
| [#133](https://github.com/dodoscoding/Mazi/pull/133) | fix(http): preserve Atlas memory budget during JSON assembly | [`c47ae8c`](https://github.com/dodoscoding/Mazi/commit/c47ae8ca408956e6f2cc6235bf5d398e1cdf65f4) |
| [#134](https://github.com/dodoscoding/Mazi/pull/134) | fix(labels): retain readable Atlas pages beyond the fact batch limit | [`abf1238`](https://github.com/dodoscoding/Mazi/commit/abf1238c87efc241d0332a43839334a8e967e70e) |
| [#135](https://github.com/dodoscoding/Mazi/pull/135) | fix(navigation): complete Turkish Atlas and photo journey controls | [`337d71f`](https://github.com/dodoscoding/Mazi/commit/337d71f5eb7c8329ea1bbf7411a6d19b6a079fd9) |
| [#136](https://github.com/dodoscoding/Mazi/pull/136) | fix(export): stabilize discovery ordering after social indexes | [`2b4b09d`](https://github.com/dodoscoding/Mazi/commit/2b4b09d3f90954bc71c00e262da829366dcb5982) |
| [#137](https://github.com/dodoscoding/Mazi/pull/137) | fix(filters): preserve keyword pages beyond the fact batch boundary | [`921670e`](https://github.com/dodoscoding/Mazi/commit/921670ea1cfbbaf219baa4bc2af9c1bd719d0b7b) |
| [#138](https://github.com/dodoscoding/Mazi/pull/138) | feat(home): connect bounded social Home and activity navigation | [`d203ba7`](https://github.com/dodoscoding/Mazi/commit/d203ba7080547c8cf6511ecd2d434fd3a7cd9a64) |
| [#139](https://github.com/dodoscoding/Mazi/pull/139) | feat(filters): combine authoritative photo filters across Gallery and Search | [`1a0234a`](https://github.com/dodoscoding/Mazi/commit/1a0234a1a41a78e46b60723748df6d7d089be4c2) |
| [#140](https://github.com/dodoscoding/Mazi/pull/140) | test(hosted): align private database contracts with current schema | [`d65dda9`](https://github.com/dodoscoding/Mazi/commit/d65dda9c65471720c127b8c9a8cfb3322982cff9) |
| [#141](https://github.com/dodoscoding/Mazi/pull/141) | fix(about): describe private activity without outdated social claims | [`23388ce`](https://github.com/dodoscoding/Mazi/commit/23388cef28f522023243615351c7a6f9569f0528) |
| [#142](https://github.com/dodoscoding/Mazi/pull/142) | test(browser): reconcile integrated social archive contracts | [`f69f605`](https://github.com/dodoscoding/Mazi/commit/f69f605d5933bda1884784ba03646536a9fdc617) |

## Final review axes

### Standards

[Final Standards review](FINAL_STANDARDS_REVIEW.md): **PASS**, zero actionable documented-standard breaches or smell findings, for plan base `75727e0` through runtime `1a0234a`. It remains independent of the Spec report. It does not replace the final regression suite.

### Spec

[Final Spec review](FINAL_SPEC_REVIEW.md): **PASS+NOTES**, no actionable software blocker at the same runtime head. Its P3 documentation note identified the stale combined-filter future status in CONTRACTS.md. The delivery documentation now corrects that sentence; the original finding is preserved. Human/pilot and deployment limits remain open.

The axes are recorded separately without a combined ranking or a claim that either completes deployment acceptance. [About copy delta](ABOUT_COPY_REVIEW.md) separately verifies PR #141 at `b1f5aef`: public audience claims now match private activity and reactions. Its canonical desktop/phone About paths pass; no application logic changed.

## Measured limits and acceptance evidence

The merged-candidate `npm run check:budgets` measurement, independently checked again while preparing this ledger:

| Asset | Measured gzip | Enforced ceiling |
| --- | --- | --- |
| Entry JavaScript | 92.6 KiB | 150 KiB |
| All JavaScript | 417.3 KiB | 420 KiB |
| Index stylesheet | 19.7 KiB | 40 KiB |
| Globe chunk | 243.0 KiB | 256 KiB |

[D27](../../../docs/DECISIONS.md#social-feature-bundle-budget-4-november-2026) records the total-script change from 400 to 420 KiB for optional social code. Primary entry, stylesheet and Globe ceilings remain unchanged. Optional route CSS is separate from the enforced index stylesheet; its sum is not claimed to fit the index-CSS ceiling. Total-script headroom is 2.7 KiB.

Focused independent evidence proves bounded reaction authorization (127 to seven SQL calls in the paired hosted fixture), real 10,001-photo Atlas label continuity, the unchanged 4 MiB grouped-response allocation cap, and shared photo filters with exact current-authority counts. These are scoped fixtures, not general production latency or memory guarantees. [Performance contracts](../../../docs/PERFORMANCE_BUDGETS.md) and the linked reviews preserve the measurements and qualifications.

The H1/C1/P1 browser records include independent synthetic desktop/phone sessions, real ZIP import/worker, plan creation and attendance, separate photo/memory conversations, comment/reaction replay, withdrawn targets and next-day return. H1 network assertions prove zero initial full Atlas or per-card notebook requests; activity remains bounded and scoped history return re-reads current authority. Phone evidence is Chromium emulation.

## Final local release matrix

Environment: macOS 27.0 arm64, Node 24.15.0, Python 3.14.7, locked Playwright 1.63.0. Independent compatibility checks also used Python 3.11. Fixtures are synthetic and local except the explicitly isolated PostgreSQL contracts.

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run test:backend` | 701 tests, 28 environment-dependent skips; OK | [Complete log](BACKEND_314_FINAL.log). Backend tree is unchanged from tested `b017d69`. |
| `npm run test:unit` | 23 passed | [Log](UNIT_FINAL.log). |
| `npm run test:dom` | 228 passed | [Log](DOM_FINAL.log). |
| `npm test`, Chromium and Firefox desktop/phone | 290 passed, 34 intentional project skips | [Final log](BROWSER_RELEASE.log). Merged PR #141 runtime plus the exact final committed metadata fixture; file identity was checked byte-for-byte at the PR #142 merge. Firefox uses child-only `CFFIXED_USER_HOME` for the macOS profile-launch issue. |
| Unified application config | 94 passed, no skips | [Complete canonical run](../ci-browser-contracts/UNIFIED_GREEN.txt), behavior `cebb2ac`; [independent correction review](BROWSER_CONTRACTS_REVIEW.md). The separately reviewed About sentence passed both projects after its change. |
| Plans application config | 15 passed, 1 cross-project duplication skip | [Log](PLANS_FINAL.log). |
| Conversations application config | 21 passed, 1 cross-project duplication skip | [Complete final log](CONVERSATIONS_RELEASE.log), exact final committed withdrawal contract. |
| Home application config | 7 passed, 1 cross-project duplication skip | [Log](HOME_FINAL.log). |
| Domain browser config | 40 passed, 2 explicit learned-model opt-in skips | [Complete run](../ci-browser-contracts/DOMAINS_GREEN.txt). |
| Real learned model browser paths | 2 passed, actual local CLIP | [Log](../ci-browser-contracts/LEARNED_GREEN.txt); independent real-model recheck also passed. |
| Build/typecheck, formatting, four bundle ceilings, documentation links | PASS | [Build](BUILD_FINAL.log), [formatting](LINT_FINAL.log), [budgets](BUDGETS_FINAL.log), [documents](DOCS_FINAL.log). The build, formatting, budgets and documentation gates pass again on merged `f69f605`. |
| Retrieval and answers evaluation | Recall@10 1.0 against 0.85 target; privacy 3/3; 100 supported answers and 50 correct abstentions | [Retrieval](RETRIEVAL_FINAL.log), [answers](ANSWERS_FINAL.log). Fixed synthetic regressions, not production accuracy acceptance. |

The four `test:app` configurations are listed separately so their actual commands and counts remain auditable. Text-log trailing whitespace is normalized for Git; outcome text, commands, trace details and historical failures are retained. Earlier interrupted/failed attempts remain in `BROWSER_FINAL.log`, `APP_FINAL.log`, `CONVERSATIONS_FINAL.log`, the browser-correction record and hosted reports. Final green evidence supersedes only the identified failures; nothing is silently rewritten. [Browser correction verification](../ci-browser-contracts/VERIFICATION.md) records fixture consent, grouping cleanup, authoritative total snapshots and current-document logout-race setup.

## Pending final release record

- Whole-product local suites: **PASS**, with exact counts and skips above. Pending GitHub workflow execution is separate from this completed local matrix; no remote CI pass is inferred. [Superseded CI cancellations](SUPERSEDED_CI.json) record only obsolete delivery runs.
- Isolated hosted contracts: **PASS+NOTES across exact-path reruns**, after test-only PR #140. All 23 original paths have passing evidence against unchanged runtime. This is not a fresh green monolithic suite: the final four-case batch retained a 45-second pooler connection timeout before its lock window; each corrected path passed separately at `d9bf0df`. [Frozen failures and reruns](FINAL_HOSTED_VERIFICATION.md), [independent correction review](HOSTED_TEST_CONTRACTS_REVIEW.md), and original artifacts remain preserved. Cold hosted connection latency remains a limitation.
- Production migrations: **not applied by this audit**. Compatible private-schema migrations must precede the application rollout; record their exact names and outcomes under the tested release revision.
- Deployment: **pending**. Record the exact deployed commit, deployment ID/URL and health/session/representative access results after execution. Main merges do not deploy automatically.

Hosted synthetic verification uses only `mazi_social_20261104_test` and the private `mazi-social-test` bucket. Production `mazi` remains separate. Credentials, private archive text and personal screenshots are excluded from this ledger.

## External acceptance and classification limits

The five-friend first-click study, physical-phone pilot, representative hosted concurrency and recovery acceptance, and M0–M7 milestone acceptance are not complete. D17 still exposes one configured circle; synthetic circle-replacement fixtures do not establish a production multi-circle switching product.

Photo labels are independent member declarations and approved-person facts. No automatic screenshot/AI classifier, model confidence or detection accuracy is claimed. The plan's optional source-verified suggestion pilot follows F2 and requires an authorized labeled dataset and measured coverage/accuracy before adoption; missing or unverifiable evidence stays unknown. No external human study or classification pilot was substituted with synthetic tests.
