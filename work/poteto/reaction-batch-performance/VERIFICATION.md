# Reaction batch authorization performance

Base revision is `cdfe6f4`. The contract commit `7c0a9f4` fails the 21-target query limit with 128 traced SQLite statements against a limit of 15. Tracing includes the commit statement. The hosted execute counter records 127 calls because commit uses a separate method. The implementation bulk-loads eligible comments and authorizes each distinct original target once. Shared photo authorization now serves labels, conversations and reaction pages. No schema or audience rule changes.

## Same-fixture measurement

The fixture is one synthetic visible photograph and 20 comments with current group access and no active reactions. The profile includes warm PostgreSQL transaction and authorization time. It excludes fixture construction, browser requests and Vercel HTTP overhead.

| Run | Before seconds | After seconds | SQL calls before | SQL calls after |
| --- | --- | --- | --- | --- |
| 1 | 3.805 | 0.208 | 127 | 7 |
| 2 | 3.624 | 0.234 | 127 | 7 |

[BEFORE.json](BEFORE.json) and [AFTER.json](AFTER.json) are raw output from this worktree. [BASELINE.json](BASELINE.json) preserves the coordinator's original measurements at `f859ecf`. Its samples were 3.629 and 3.163 seconds with 127 calls. The repeated current-base profile is the direct comparison above.

The [profile script](profile_reaction_batch.py) refuses to run without `MAZI_TEST_POSTGRES=1`, an isolated schema ending `_test`, and the synthetic `mazi-social-test` bucket. It uses the existing hosted regression fixture, which also checks its schema. Run it from the root with `MAZI_DATABASE_SCHEMA=mazi_social_20261104_test MAZI_STORAGE_BUCKET=mazi-social-test MAZI_BACKEND=supabase MAZI_TEST_POSTGRES=1 node --env-file=.env.supabase` spawning `.venv/bin/python work/poteto/reaction-batch-performance/profile_reaction_batch.py`. Never point mutation fixtures at production.

## Verification

- `.venv/bin/python -m unittest tests.backend.social.test_reaction_batch_performance tests.backend.social.test_reactions tests.backend.social.test_reactions_http tests.backend.social.test_comments tests.backend.social.test_comments_http tests.backend.social.test_labels tests.backend.social.test_labels_http` passes 48 tests.
- The social/export/People/notebook command in the coordinator log passes 160 tests in 22.2 seconds. The final targeted batch and label command passes 19 tests after adding stale-comment reinsertion coverage and renaming the shared authorization import.
- Hosted `tests.backend.social.test_reaction_batch_postgres`, `test_reactions_postgres`, `test_comments_postgres` and `test_labels_postgres` pass 10 tests in 95.2 seconds. They use only `mazi_social_20261104_test` and the synthetic private bucket. The new hosted test enforces the query-count cap without timing assertions.
- `npm run typecheck`, `npm run check:docs` and `git diff --check` pass.

The runtime contracts check all-or-nothing denial after hidden photos, deleted and restored-tombstoned comments, departed authors, missing IDs, another group, withdrawn last sources and partially hidden approved memories. Existing SQL aggregate/member projection is unchanged. Single reads, desired-state writes, authored export and label reads still use current target permission checks.

The measured goal is met for this fixture. Larger sets of distinct approved memories still require their own current all-child authorization. Two warm samples do not establish a p95 guarantee, production browser latency, physical-device acceptance or milestone completion. Final integrated acceptance remains with the coordinator.
