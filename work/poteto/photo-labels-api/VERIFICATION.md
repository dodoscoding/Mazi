# F1 photo declarations backend verification

Base revision is `7f84682`. Red contract commit `ff5e671` failed because `mazi.social.labels` did not exist. The two HTTP contracts then failed because `/api/social/labels/set` returned 404. The implementation adds independent manual dimensions, current confirmed-person projection, atomic versioned writes, durable replay and authored export. Atlas and Search payloads are unchanged in this backend slice.

## Verified commands

- `.venv/bin/python -m unittest tests.backend.social.test_labels tests.backend.social.test_labels_http` passes 15 tests on Python 3.14.7.
- `.venv/bin/python -m unittest tests.backend.social.test_labels tests.backend.social.test_labels_http tests.backend.social.test_reactions tests.backend.social.test_reactions_http tests.backend.social.test_comments tests.backend.social.test_comments_http tests.backend.social.test_plans tests.backend.social.test_plans_http tests.backend.test_export_file tests.backend.test_export_admission tests.backend.discovery.test_people_export tests.backend.discovery.test_shared_by tests.backend.memories.test_memories tests.backend.memories.test_memories_http tests.backend.memories.test_advanced` passes 156 tests in 22 seconds.
- The hosted command uses `MAZI_DATABASE_SCHEMA=mazi_social_20261104_test MAZI_STORAGE_BUCKET=mazi-social-test MAZI_BACKEND=supabase MAZI_TEST_POSTGRES=1 node --env-file=.env.supabase` to spawn `.venv/bin/python -m unittest tests.backend.social.test_labels_postgres`. All 3 tests pass in 31.2 seconds. The coordinator applied the migration with schema paths substituted. Only the isolated schema and synthetic private bucket were changed.
- `npm run typecheck`, `npm run check:docs`, `.venv/bin/python -m compileall -q mazi/social` and `git diff --check` pass.

The fixture imports 50 real synthetic photos to exercise the accepted bulk boundary. It verifies independent values and versions, a clear, expected-version conflicts, all-or-nothing mixed access, reordered exact replay, payload conflicts and two simultaneous editors. Unknown old data does not turn source sharers into depicted people. Confirmed associations derive presence. Suppression hides names and derived presence; an existing active approved tag still blocks a contradictory manual absence with a name-free error.

Current membership, source eligibility, direct photo hides and overlapping hidden-event children are checked before a batch read, write or replay. Cross-group target/actor relationships are rejected. Label, tag and suppression writes advance discovery generations. Export includes only the actor's current-version declarations on visible photos and rechecks metadata before admission. Existing source/sharer filters, social domains, export categories and notebooks pass adjacent contracts.

The hosted cases cover exact fractional timestamps, atomic expected-version and clear behavior, current-scope export, lower-level identity-store departure, a retained revision after clearing attribution, stale declaration reinsertion after rejoining, old receipt replay, a fresh current-version replacement, a database revision rollback guard, approved tags/suppression, generation invalidation, composite group/member constraints, private RLS, runtime ledger privileges and an actor query index plan.

## Restore scope and remaining acceptance

Member departure clears only declarations still authored by that member and advances their retained dimension versions. It does not clear another member's later correction. The separate ledger retains group/photo/dimension IDs and versions without previous values. Tests reintroduce stale declaration rows while retaining current ledger revisions and require unknown/current-version output. They do not claim that an old complete snapshot knows later corrections. Reconcile current revisions and deletion decisions before serving restored data.

Independent review, label badges/editors, bulk-selection controls, F2 combined filters, integrated browser checks, deployment and physical-device acceptance remain coordinator gates. This backend-only change has no UI screenshot or automatic image-classification dependency.
