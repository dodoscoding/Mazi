# P1 backend verification

Base revision is `75727e0`. The feature adds plans and attendance without archive prerequisites. Frontend delivery remains separate.

## Before

`python -m unittest tests.backend.social.test_plans` failed because `mazi.social` did not exist. The first contract commit is `1b97d92`. After the domain implementation, the three HTTP tests failed because `/api/social/plans/create` returned 404. Logs remain local at `/tmp/mazi-social-plans-red.log` and `/tmp/mazi-social-http-red.log`.

## Current checks

Focused domain and HTTP contracts cover empty archives, two members, ownership and membership denial, receipts, stale versions, cancellation, desired attendance, departure, timezone gaps/folds, pagination, export admission and optional approved-memory visibility. `npm run typecheck` passes. Hosted evidence uses only the isolated `mazi_social_20261104_test` schema and private `mazi-social-test` bucket. The migration was applied to that synthetic schema with its search path substituted. Production was not mutated.

Implementation commits are `0a068bc` and the hidden-child regression fix following it. Documentation is `02dfd09`.

- `.venv/bin/python -m unittest tests.backend.social.test_plans tests.backend.social.test_plans_http` passes 20 tests on Python 3.14.7.
- `.venv/bin/python -m unittest tests.backend.social.test_plans tests.backend.social.test_plans_http tests.backend.test_export_file tests.backend.test_export_admission tests.backend.discovery.test_people_export` passed 88 tests before the final overlapping-hidden-event regression was added. The final two P1 tests were rerun in the focused 20-test command.
- The earlier 137-test adjacent run exposed four empty-export file-inventory failures. The implementation now omits `social.json` when there are no authored social contributions. The subsequent 88-test run passes those exact export contracts without changing their assertions.
- The hosted command uses `MAZI_DATABASE_SCHEMA=mazi_social_20261104_test MAZI_STORAGE_BUCKET=mazi-social-test MAZI_BACKEND=supabase MAZI_TEST_POSTGRES=1 node --env-file=.env.supabase` to spawn `.venv/bin/python -m unittest tests.backend.social.test_plans_postgres`. All 3 tests pass after the test-only migration, double-precision correction and composite foreign keys. This covers exact instants, fractional timestamp storage, current membership, lower-level departure cleanup, replay, CAS, export, concurrent writes, RLS, client-role denial and the indexed group/time query.
- `npm run typecheck`, `npm run check:docs`, `.venv/bin/python -m compileall -q mazi/social`, and `git diff --check` pass.

The application backend remains pending independent coordinator review. Full integrated suite, browser and deployment checks belong to the coordinator after the remaining slices are integrated. The browser and physical-phone journeys remain frontend acceptance work. No UI screenshot is claimed for a backend-only change.
