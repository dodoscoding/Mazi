# P1 backend verification

Base revision is `75727e0`. The feature adds plans and attendance without archive prerequisites. Frontend delivery remains separate.

## Before

`python -m unittest tests.backend.social.test_plans` failed because `mazi.social` did not exist. The first contract commit is `1b97d92`. After the domain implementation, the three HTTP tests failed because `/api/social/plans/create` returned 404. Logs remain local at `/tmp/mazi-social-plans-red.log` and `/tmp/mazi-social-http-red.log`.

## Current checks

Focused domain and HTTP contracts cover empty archives, two members, ownership and membership denial, receipts, stale versions, cancellation, desired attendance, departure, timezone gaps/folds, pagination, export admission and optional approved-memory visibility. `npm run typecheck` passes. Hosted evidence uses only the isolated `mazi_social_20261104_test` schema and private `mazi-social-test` bucket. The migration was applied to that synthetic schema with its search path substituted. Production was not mutated.

The final command results and commit are recorded by the coordinator after review. The browser and physical-phone journeys remain frontend acceptance work. No UI screenshot is claimed for a backend-only change.
