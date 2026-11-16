# Reaction batch performance independent review

Verdict: PASS. No actionable correctness, regression, privacy, or validation findings.

- Base: `cdfe6f42b5cee4f6df2a07828006c618d3ebf930`.
- Head: `cabfe13264126ddc5141b9ee7ab71576c1e881d5`.
- Stable patch ID: `2eb798c0f917a0019d7fc80d9f3c209af21c00ee`.
- Diff: `git diff cdfe6f4...cabfe13`.
- Reviewer: independent GPT-6.1 Sol reviewer, high reasoning. Review used one model family.

## Standards

No findings. The shared `authorize_photos` function preserves the existing label authorization query and replaces duplicate conversation checks. The batch command keeps parsing at its boundary and current permission checks inside one transaction. The extraction removes repeated policy code without introducing a feature dependency from reactions to labels.

New-code comment review found no suppressions, workaround narratives, or constraint comments. The short module docstrings describe the authorization boundary and guarded measurement command. No application files were changed during review.

## Spec

No findings. The command first validates current group membership, then loads the complete requested comment set through the active-author and deletion-ledger predicate. Missing, departed, cross-group, or deletion-tombstoned comments reject the entire response. Distinct original photo and memory targets are authorized before any aggregate is returned. Photo authorization retains current source-owner membership, withdrawn-origin, personal-hide, and hidden-memory-child rules. Memory authorization retains its all-original-children checks.

The aggregate/member SQL and desired-state receipt handling remain unchanged. Single-target reads, writes, authored exports, and label operations continue to use current authorization. No storage schema, public audience, or UI changes are introduced.

## Independent verification

- The focused reaction batch, reactions, comments, labels, and real HTTP command passed 48 tests in 9.1 seconds.
- The explicit isolated hosted query-count test passed. It used `mazi_social_20261104_test` and private bucket `mazi-social-test`, never the live archive schema.
- The guarded hosted profile was rerun against the reviewed head. One photo plus 20 comments produced two warm measurements of **0.215 and 0.227 seconds**, with **7 SQL calls** each. This independently reproduces the author's post-change result. The recorded current-base samples were 3.805 and 3.624 seconds with 127 calls.
- `npm run check:docs` passed with 19 documents and 328 local links.
- `git diff --check cdfe6f4...HEAD` passed. The reviewed worktree remained clean.

The Prove It Works principle led this review to rerun the hosted profile and permission contracts rather than infer a performance result from the source diff. The measured fixture has no active reactions, so its member-name query is unnecessary. The count/name projection tests cover active reactions separately. These two warm samples exclude browser and Vercel HTTP overhead and do not establish production p95 latency. Larger sets of distinct approved memories retain their existing child-authorization cost.

The author evidence and reproducible command are in `work/poteto/reaction-batch-performance/VERIFICATION.md` and `profile_reaction_batch.py`.
