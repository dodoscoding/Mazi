# Independent C1 reactions backend review

Verdict: PASS. No actionable correctness, security, standards or scoped-spec findings.

Reviewer is GPT-6.1 Sol with high reasoning. This is independent review within one model family.

- Base: `921799dc37dca54c7c2c93a4f7006b01608d7633`.
- Head: `f859ecfc90ebd3a57ef93a20cc2373d5410413f8`.
- Stable patch ID: `dca211987762e2a8b0dfcf3f69d5b7577001f8bc`.
- Diff: `git diff 921799d...f859ecf`.
- Scope: C1 native reaction backend, schema, authenticated HTTP adapter, lifecycle/export participation and associated contracts. The reaction UI and H1 activity remain separate slices.

## Standards

No findings. The change follows the existing standalone social-module and HTTP-adapter boundary. Closed target parsing selects trusted SQL columns. Database constraints encode the one-target rule, group relationships and member/target/emoji uniqueness. No new application/test narration comments or suppressions were introduced. The new module docstring states its public domain responsibility. Full branch whitespace passes.

## Spec

No findings against the scoped C1 reaction contract. Permanent photo, approved-memory and native-comment identities remain separate. Comment authorization resolves the current underlying target and active comment author. Every single read, batch read, write and receipt replay checks current target access before returning counts or names. Batch input is limited to 50 unique targets; all are authorized before aggregate projection. A denied target cannot leave a partial response.

The shared projection aggregates counts and reader state in one SQL query. A second window-ranked query returns no more than 51 names per target and emoji, which supports a 50-name result cap and exact count/truncation state. It does not issue a separate HTTP request or aggregate query for each comment. Current membership, active state and reaction deletion tombstones filter both projections.

Desired-state writes preserve one reaction per member, target and emoji. Exact receipt replay returns the current aggregate rather than reapplying an older command. New keys cannot duplicate an enabled reaction. Departure and comment deletion cascade through database foreign keys and retain text-free deletion identities. The stale-row tests retain the current ledger, so rejoining or reinserting an old row cannot restore a removed contribution. The documentation correctly distinguishes this from restoring an old complete snapshot without current-ledger reconciliation.

SQLite and PostgreSQL schemas use equivalent target checks, partial unique indexes and composite group foreign keys. Hosted timestamps use double precision. Both tables enable RLS, with application-role access only; runtime deletion-ledger access is read/insert only. Export includes only the actor's active, currently visible reactions, without other members' names or aggregate counts, and participates in both ZIP construction and final admission fingerprints. Imported chat reaction evidence and notebook semantics remain unchanged.

## Independent verification

- `.venv/bin/python -m unittest tests.backend.social.test_reactions tests.backend.social.test_reactions_http tests.backend.social.test_comments tests.backend.social.test_comments_http tests.backend.social.test_plans tests.backend.social.test_plans_http tests.backend.test_export_file tests.backend.test_export_admission tests.backend.discovery.test_people_export tests.backend.memories.test_memories tests.backend.memories.test_memories_http tests.backend.memories.test_advanced` passed all 136 tests in 19.438 seconds on Python 3.14.
- Explicit isolated hosted run of `tests.backend.social.test_reactions_postgres -v` passed all three tests in 28.922 seconds. The environment selected `MAZI_DATABASE_SCHEMA=mazi_social_20261104_test`, `MAZI_STORAGE_BUCKET=mazi-social-test`, `MAZI_BACKEND=supabase` and `MAZI_TEST_POSTGRES=1`, using the existing private environment file only through child-process environment loading. No live archive schema was tested.
- Hosted checks exercised exact fractional timestamps, batch projection, authored synthetic export, hidden target exclusion, identity-store departure, stale-row suppression after rejoin, comment-delete cascade, tombstone target denial, partial uniqueness, foreign keys, RLS, client-role denial, append-only runtime ledger privileges and the target-index query plan.
- `npm run check:docs` passed with 19 documents and 323 local links.
- `git diff --check 921799d...HEAD` passed.

The reviewed worktree remained clean. No production migration, deployment or user-facing publication was performed. UI, the complete application suite and final production acceptance remain coordinator work; their absence is not a claim of this backend-only verdict.
