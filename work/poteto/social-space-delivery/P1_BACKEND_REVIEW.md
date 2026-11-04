# P1 backend independent shipping review

Verdict: PASS for the backend-only plan and attendance change. No actionable correctness, privacy, regression or documented-standard finding was identified. Frontend, social Home and full release acceptance remain separate.

- Reviewer: GPT-6.1 Sol, high reasoning, independent from the patch author.
- Base: `75727e0b3e28d0fea384f1c0f5cfdc4e04ed4914`.
- Head: `07de77e57b15e3d64fbf95fb6cd94e0363dd5377`.
- Stable patch ID: `968c25f18a2cf2fd70d6e6ba9bdf779e7d29419d`.
- Diff: `git diff 75727e0...07de77e`.

## Standards

No actionable findings. The implementation keeps plan rules in the social domain and transport mapping in its HTTP adapter. It reuses MemoryStore's transaction and export integration rather than introducing another Store inheritance layer. Field parsing is at the command boundary. The two added module docstrings state module ownership; there are no added constraint comments, suppressions or explanatory comments to remove. Comment deletions, restorations, reshape flags and unenforced constraints are all zero.

No meaningful Mysterious Name, Duplicated Code, Data Clump, repeated-switch, speculative-generality or middle-man finding warrants a change. The small cancel/delete wrapper functions expose meaningful domain actions while the shared implementation keeps their version/receipt logic identical.

## Spec

The backend implements the scoped P1 contract. Plans work without archive photos. Group/organizer and group/attendee membership have composite foreign keys in both SQLite and PostgreSQL. Organizer-only updates, cancellation and deletion check the expected revision through a conditional write. Create and mutation receipts are scoped by group, actor and request key; changing content under a used key conflicts. Replaying a deleted result returns its identity with `deleted: true`, and replaying an old attendance command returns current state without writing over a newer response.

Attendance validates active plan state inside the same write transaction as its mutation. Repeated desired state does not increase the count or attendance revision. Cancellation and attendance serialize in independent SQLite and hosted connections. Membership removal through the lower-level identity Store clears organizer plans and dependent attendance, or clears the departing attendee's own responses. Read joins independently require current organizer/attendee membership.

ZoneInfo round trips reject nonexistent local times. Ambiguous local times require an explicit valid UTC offset. Stored local values and UTC instants remain distinct, end times must follow starts, and upcoming reads compare against the server clock. Stable start/ID keyset pagination handles equal start instants.

An optional approved-memory link checks group, approval, every original child's active origin/current ownership, personal hidden photos, direct event hides and overlapping hidden-event children. Unavailable links are omitted from reads and exports without deleting independently authored plan text or changing archive dates. Plan writes cannot attach an inaccessible target.

Export includes only the member's authored plans and current attendance. Organizer exports remove other members' attendance lists. Social metadata participates in both `_write_export_archive` and `_capture_export_metadata`, so a plan edit between construction and final admission rejects the prepared ZIP. Empty social contributions do not change existing export inventories.

The hosted migration uses DOUBLE PRECISION for epoch values, matching SQLite's floating-point precision. All three new tables enable RLS, grant runtime access only to mazi_app, and revoke PUBLIC/anon/authenticated access. The departure function is an invoker function in the private schema with an explicit search path and revoked public execution. The group/start/ID index is exercised by a real hosted EXPLAIN assertion.

## Independent verification

Commands ran in `/Users/altanesmer/Desktop/Ales/Mazi-wt/social-plans` with synthetic fixtures.

- `.venv/bin/python -m unittest tests.backend.social.test_plans tests.backend.social.test_plans_http tests.backend.test_export_admission` passed 44 tests. This includes actual authenticated HTTP create/join/read/edit/cancel, missing-session and wrong-origin denial, stale versions, deleted-command replay, cross-group denial, hidden-memory links, both concurrency cases and final export admission.
- The hosted test command below passed all three tests. It used only the separately provisioned `mazi_social_20261104_test` schema and private `mazi-social-test` bucket. Existing private credentials were loaded into the child environment without printing them. The test harness checks the synthetic schema suffix before any mutation. No production schema, bucket or archive was tested or mutated.

```sh
MAZI_DATABASE_SCHEMA=mazi_social_20261104_test MAZI_STORAGE_BUCKET=mazi-social-test MAZI_BACKEND=supabase MAZI_TEST_POSTGRES=1 node --env-file=.env.supabase -e 'const {spawnSync}=require("node:child_process"); process.exit(spawnSync(".venv/bin/python",["-m","unittest","tests.backend.social.test_plans_postgres"],{stdio:"inherit",env:{...process.env,MAZI_DATABASE_SCHEMA:"mazi_social_20261104_test",MAZI_STORAGE_BUCKET:"mazi-social-test",MAZI_BACKEND:"supabase",MAZI_TEST_POSTGRES:"1"}}).status ?? 1)'
```

- `npm run check:docs` passed with 19 documents and 309 links.
- `git diff --check 75727e0...07de77e` passed.
- The migration, domain, HTTP adapter, export integration, local/hosted tests and changed privacy/contract text were inspected. The worktree remained clean.

The hosted checks independently confirm exact UTC/fractional epoch preservation, membership constraints, replay/CAS, identity-boundary cleanup, export, cancellation/attendance serialization, RLS/client-role denial and index use. They do not claim a production migration or deployment.

## Limits and release requirements

Apply the additive hosted migration before deploying code that accesses these tables. The frontend two-member desktop/phone journey belongs to the separate P1 UI PR. This review did not rerun all existing backend/browser suites, disaster-recovery restoration, production, physical-phone or five-friend acceptance. In particular, retry-after-deletion is verified; a complete restored-backup deletion-reconciliation drill remains broader release evidence and is not implied by receipt tests. The existing hosted backup tooling discovers tables and foreign-key dependencies dynamically, so the new tables do not require a hard-coded backup inventory addition.

Standards findings: zero. Spec findings: zero within this backend-only scope. The next acceptance gap is the P1 UI and integrated release journey.
