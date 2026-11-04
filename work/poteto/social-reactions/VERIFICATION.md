# C1 reactions backend verification

Base revision is `921799d`. Red contract commit `cc6dad6` failed because `mazi.social.reactions` did not exist. The HTTP contracts then failed because `/api/social/reactions/set` returned 404. The implementation adds a compact reactions module, a closed target/emoji model, relational storage, authorized single/batch reads and authored export. Reaction controls and Home activity are separate slices.

## Verified commands

- `.venv/bin/python -m unittest tests.backend.social.test_reactions tests.backend.social.test_reactions_http` passes 14 tests on Python 3.14.7.
- `.venv/bin/python -m unittest tests.backend.social.test_reactions tests.backend.social.test_reactions_http tests.backend.social.test_comments tests.backend.social.test_comments_http tests.backend.social.test_plans tests.backend.social.test_plans_http tests.backend.test_export_file tests.backend.test_export_admission tests.backend.discovery.test_people_export tests.backend.memories.test_memories tests.backend.memories.test_memories_http tests.backend.memories.test_advanced` passes 136 tests in 19.3 seconds.
- The hosted command uses `MAZI_DATABASE_SCHEMA=mazi_social_20261104_test MAZI_STORAGE_BUCKET=mazi-social-test MAZI_BACKEND=supabase MAZI_TEST_POSTGRES=1 node --env-file=.env.supabase` to spawn `.venv/bin/python -m unittest tests.backend.social.test_reactions_postgres`. All 3 tests pass in 29.6 seconds. The coordinator applied the migration with schema paths substituted. Only the isolated schema and synthetic private bucket were changed.
- `npm run typecheck`, `npm run check:docs`, `.venv/bin/python -m compileall -q mazi/social` and `git diff --check` pass. `git diff --check 921799d...HEAD` also passes for the entire branch.

Desired-state tests enable twice, disable, and replay the old enable receipt without another write. Concurrent exact retries create one record. Separate photo, approved-memory and native-comment targets keep their own counts. Hidden photos, overlapping hidden events, withdrawn last sources and other groups deny reads and writes. Imported chat evidence is unchanged. Database contracts reject duplicate and cross-group relationships and unsupported emoji.

A 51-reactor synthetic group proves that exact counts remain 51 while member-name output is capped at 50. The batch read accepts at most 50 unique targets, matches single-target aggregates and rejects an entire mixed-access request. Its shared projection uses one SQL count query and one window-ranked member query after all target authorization. Real HTTP tests cover profile names, state replay, origin/session denial, invalid input and batch access denial.

Hosted tests cover double-precision timestamps, the batch SQL path, authored export with synthetic private object bytes, hidden export exclusion, identity-store departure cascades, read/insert-only deletion ledgers, stale-row suppression after rejoining, a fresh action replacing the stale identity, deleted-comment cascade and retained comment-tombstone denial after stale comment/reaction reinsertion. They also inspect partial uniqueness, group/member foreign keys, RLS, client-role denial and a photo-target index plan.

## Restore scope and remaining acceptance

Reaction deletion ledgers contain only reaction, group and member IDs plus deletion time. They intentionally survive synthetic fixture cleanup because the runtime cannot delete tombstones. Tests retain current ledgers when reintroducing stale rows. They do not claim that a historical full snapshot can know later deletions. Reconcile current receipts and deletion ledgers before restored data serves traffic.

Independent review, browser reaction controls, social Home, full integrated suite, deployment and physical-phone acceptance remain coordinator gates. This backend-only change has no UI screenshot.
