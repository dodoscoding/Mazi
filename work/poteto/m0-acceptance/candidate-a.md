# Candidate A: local Supabase provider experiment

## Problem

M0 must demonstrate D14's per-item automatic sharing and current membership at real database and object boundaries. The Atlas has no backend; this isolated, synthetic experiment tests D01 without adding M1 invitation or authentication UI. Scope is manual JPEG/PNG fixtures, server-readable processing, AI off, EU hosting intent and a €75 monthly ceiling; no paid provisioning. Export compatibility remains conditional on future representative fixtures.

## Usage (caller's view)

`npm run test:m0` starts/resets an explicitly named local Supabase project using locked CLI `2.119.0`, runs Node's built-in test runner, and writes redacted evidence. Docker and Node 22.12+ are prerequisites; unavailable infrastructure fails rather than substitutes mocks. Real calls in `tests/m0/access.test.mjs`:

```js
const run = await experiment.start(); // local-only URL; synthetic users/objects
const alice = await run.signIn('alice');
await run.assertArchive(alice, { rows: ['ready-a'], objects: ['ready-a'] });
await run.assertArchive(await run.signIn('ben'), { rows: ['ready-a'], objects: ['ready-a'] });
await run.removeMember('ben'); // privileged fixture control, not product API
await run.assertArchive(ben, { rows: [], objects: [] }); // reuse current JWT
```

## Shape

`supabase/config.toml` owns local service settings; one migration owns grants, constraints and RLS; `tests/m0/experiment.mjs` owns fixture lifecycle and response/byte assertions; `tests/m0/access.test.mjs` owns the behavioral matrix. Native `fetch` talks directly to Auth, PostgREST and Storage. No client SDK, application server, generic repository layer or browser changes.

Schema: `memberships(group_id uuid, user_id uuid references auth.users, role member|admin, status active|removed, primary key(group_id,user_id))`; `contributions(id uuid primary key, group_id uuid, owner_id uuid, state processing|available|withdrawn, object_key text unique, filename text, media_type image/jpeg|image/png, foreign key(group_id,owner_id) references memberships)`. Index membership lookup and `(group_id,state)`; constrain object keys to canonical `<group>/<contribution>/<fixture-name>` paths. Private bucket `m0-originals` contains real JPEG/PNG bytes.

Read policies use `auth.uid()` and live membership rows, never editable or stale JWT membership claims. Membership RLS exposes only the caller's own membership, making the active-membership lookup nonrecursive. Contribution SELECT requires active membership and `available`; Storage SELECT requires an eligible contribution matching bucket and exact object key, inheriting contribution RLS. Anonymous grants are revoked. Authenticated users receive SELECT only: all direct membership/contribution mutations and Storage upload, overwrite, move and deletion are denied. Privileged fixture setup models ingestion completion and revocation; it cannot count as an allowed-user read. This minimal write surface deliberately does not claim M1 uploads or contributor withdrawal UX.

Signatures: `start(): Promise<Experiment>`; `signIn(actor): Promise<Session>`; `assertArchive(session|null, expected): Promise<void>`; `makeAvailable(id): Promise<void>`; `withdraw(id): Promise<void>`; `removeMember(actor): Promise<void>`; `stop(): Promise<void>`. Bodies are **not implemented**. Session secrets remain internal and assertions hide transport parsing without disguising the tested provider endpoints. Setup credentials never enter actor requests or evidence.

## Acceptance and ownership

Backend lead owns SQL/provider fixtures; the second developer independently reviews denial assertions and evidence. Matrix: Alice, Ben and active admin read ready rows, metadata, counts, Storage listings and exact bytes; outsider, removed member, other-group member and anonymous receive no protected rows, existence metadata or bytes. Two neighbors remain processing/withdrawn while one becomes available; only that item appears automatically. Reuse Ben's unexpired JWT after removal and reuse Alice's after withdrawal. Probe the public-object route with a known key, authenticated original route without a JWT, guessed keys, and direct cross-group writes; require actual denied results, not merely missing UI. Assert failed writes leave rows/bytes unchanged. Capture revision, CLI/container versions, fixture checksums, command, matrix outcomes and timestamps without tokens/passwords.

## Tradeoffs, alternatives and risks

We accept Docker startup and provider coupling in exchange for real Supabase Auth/Storage/RLS evidence. A standalone PostgreSQL plus filesystem server hides fewer provider decisions and leaves token verification/object delivery to custom code; it is cheaper to start but cannot validate D01's provider boundary. Signed URLs are excluded: authenticated downloads recheck policy on every new request; production signed-link expiry, caches and already downloaded bytes remain separate T09 limits. Will hosted EU deployment match the pinned local services, and will measured storage/egress fit €75? The technical lead must resolve both before real imports; local execution proves neither region, provider terms, production cost, encryption controls, backups nor full T01–T15 acceptance. [Provider private-bucket behavior](https://supabase.com/docs/guides/storage/buckets/fundamentals) and [RLS/grants](https://supabase.com/docs/guides/database/postgres/row-level-security) support the experiment shape; execution evidence is still required.

## Synthesis decision and next step

Pending parent synthesis; no implementation selected here. First expose the complete allowed/denied matrix as failing tests, then add the smallest migration and fixture harness that satisfies it. Red-flag screen: three short ownership boundaries, no pass-through API, no temporal stage modules, and one database source of truth for read eligibility.
