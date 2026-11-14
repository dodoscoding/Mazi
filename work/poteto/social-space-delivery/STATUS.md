# Delivery status

All eight runtime slices are merged through PR #139 at `1a0234a1a41a78e46b60723748df6d7d089be4c2`. PR #140 fixes hosted test boundaries, #141 corrects the About audience claim, and #142 reconciles browser contracts; the validated pre-rollout integration candidate is `f69f605d5933bda1884784ba03646536a9fdc617`. Production now serves `41e74de875ab145f4f9d11730df341830f89ab4b` after the separately reviewed direct-memory rewrite in PR #144. All five production migrations, staged checks, promotion and live checks succeeded. All local release configurations have completed successfully; exact counts and skips are in the delivery matrix. Delivery uses this isolated worktree; unrelated checkout changes and worktrees remain preserved.

| Slice | Merged delivery |
| --- | --- |
| A1 | Photo evidence, date/place display and canonical city identity: #116. |
| A2 | Search date bases and selected-photo corrections/export: #120, #123. |
| N1 | Three destinations, task directory, aliases and Turkish journey controls: #114, #135. |
| F1 | Manual declarations, lifecycle/export and atomic selected/bulk editing: #121, #128. |
| F2 | Shared same-photo predicates and Gallery/Search controls: #131, #137, #139. |
| P1 | Archive-independent plans, timezone handling and attendance: #115, #125. |
| C1 | Separate photo/memory comments, reactions and bounded batches: #118, #119, #124, #130. |
| H1 | Bounded social Home/activity and permanent selected-photo detail: #132, #138. |

Separate final reviews at the runtime head remain distinct: [Standards: PASS](FINAL_STANDARDS_REVIEW.md); [Spec: PASS+NOTES](FINAL_SPEC_REVIEW.md). The Spec documentation-status note is corrected in `docs/CONTRACTS.md`; its original review remains intact. Earlier failures and their superseding reviews are preserved. [Delivery evidence](DELIVERY_EVIDENCE.md) links every PR, merge revision, slice review and remaining gate.

The merged candidate's bundle check passes: entry 92.6/150 KiB gzip, total scripts 417.3/420, index CSS 19.7/40 and Globe 243.0/256. D27 records the total-script allocation; primary ceilings did not increase. Optional route CSS is not presented as the enforced index stylesheet.

Local release matrix: backend701 tests/28 skips OK; unit23 and DOM228 passed; Chromium/Firefox290 passed/34 project skips; unified94 passed; plans15, conversations21 and Home7 passed with one deliberate cross-project skip each; domains40 passed/2 model opt-in skips, with both actual CLIP paths passed separately. Build, formatting, docs and all four budgets pass. All23 isolated hosted paths have passing evidence across exact-path reruns, with a documented pooler timeout in the final combined batch. [Original hosted failures](FINAL_HOSTED_VERIFICATION.md) and [independent correction review](HOSTED_TEST_CONTRACTS_REVIEW.md) remain visible. No fresh monolithic hosted pass is claimed. [Rollout](ROLLOUT.md) records completed production migrations, deployment and live verification.

Hosted synthetic checks explicitly use schema `mazi_social_20261104_test` and private bucket `mazi-social-test` in Supabase project `elgwhwkqutmmbdjthubl`. Production schema `mazi` remains separate. Never print `.env.supabase` or secret values. The reviewed additive migrations are applied; the private bucket and runtime-only table access remain verified.

The configured Vercel target is project `prj_rm73tXXOISr9jfe1FtU9YpAncs2B`, team `team_pmgjuOOjaC2wTXtIFmbgFAcB`, name `mazi`, domain `mazi-three.vercel.app`. There is no Git integration, so merges do not deploy. Live deployment is `dpl_6ghKTvCbAH9C7u3gDYdh2DMpS4Ab`; metadata and alias inspection confirm revision `41e74de`. The later handoff commit contains evidence only.

Physical-phone checks, the five-friend findability study, representative hosted concurrency/recovery acceptance and M0–M7 milestone acceptance remain separate. Labels are member declarations, not automatic screenshot/AI detection. The optional source-verified suggestion pilot and its labeled accuracy dataset are not implemented or claimed complete.

Remote CI status remains explicit in [the snapshot](CI_AT_HANDOFF.json); no complete remote workflow pass is claimed. Human and optional-classification gates remain outside the completed implementation/deployment scope.
