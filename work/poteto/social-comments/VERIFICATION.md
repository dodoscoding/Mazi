# C1 comments backend verification

Base revision is `02d5cb6`. Contract commit `b3068f3` failed because `mazi.social.conversations` did not exist. The first two HTTP contracts then failed because `/api/social/comments/create` returned 404. Implementation `0f0ebd5` adds the domain, schema, HTTP adapter and current-visibility authored export. Reactions and UI are separate slices.

## Verified commands

- `.venv/bin/python -m unittest tests.backend.social.test_comments tests.backend.social.test_comments_http` passes 15 tests on Python 3.14.7.
- `.venv/bin/python -m unittest tests.backend.social.test_plans tests.backend.social.test_plans_http tests.backend.social.test_comments tests.backend.social.test_comments_http tests.backend.test_export_file tests.backend.test_export_admission tests.backend.discovery.test_people_export` passes 104 tests.
- `.venv/bin/python -m unittest tests.backend.memories.test_memories tests.backend.memories.test_memories_http tests.backend.memories.test_advanced` passes 18 existing notebook/advanced contracts.
- The hosted command uses `MAZI_DATABASE_SCHEMA=mazi_social_20261104_test MAZI_STORAGE_BUCKET=mazi-social-test MAZI_BACKEND=supabase MAZI_TEST_POSTGRES=1 node --env-file=.env.supabase` to spawn `.venv/bin/python -m unittest tests.backend.social.test_comments_postgres`. All 3 tests pass in 27.6 seconds. Only the isolated schema and synthetic private bucket were changed. The coordinator applied the migration with its schema search paths substituted.
- `npm run typecheck`, `npm run check:docs`, `.venv/bin/python -m compileall -q mazi/social` and `git diff --check` pass.

The focused cases cover multiple messages per author, immutable creation time, CAS, exact create/update/delete replay, other-group and owner denial, plain-text JSON, origin/session checks, equal-time keyset pages, hidden targets and overlapping hidden-event children. A real independent source copy remains eligible after the first origin is withdrawn; removing its owner then denies the conversation. Database tests reject cross-group photo and memory relationships even when the author belongs to both groups.

The hosted cases cover fractional epoch precision, authored export with real synthetic private object bytes, hidden export exclusion, lower-level identity-store departure, deletion tombstones, stale-row reinsertion after rejoin, receipt replay, source withdrawal, runtime/client role privileges and an EXPLAIN plan using the photo/time index. Hosted runtime access to the deletion ledger is read/insert only. Synthetic ledger entries intentionally persist after fixture cleanup because the runtime cannot remove tombstones.

## Restore scope and remaining acceptance

SQLite tests reinsert stale comment rows while retaining the current deletion ledger. They also copy a latest SQLite database snapshot, reopen it and show that retained tombstones still suppress a reintroduced stale row and its create retry. Hosted tests reintroduce a stale row after its author rejoins and keep it inaccessible through the retained ledger. Current target withdrawal is independently rechecked.

These checks do not restore a full historical snapshot from before deletion. Such a snapshot cannot contain future decisions. Reconcile current deletion receipts and tombstones before restored data serves traffic, as required by the privacy policy. Production backup retention, isolated recovery acceptance, UI drafts, browser/physical-phone journeys, reactions and deployment remain separate coordinator gates. This backend change has no UI screenshot.
