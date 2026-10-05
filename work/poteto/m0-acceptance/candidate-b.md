# Candidate B: PostgreSQL policy and mediated private files

## Problem

M0 needs observable allowed/denied database and byte delivery, independent of the synthetic Atlas UI. This candidate uses a standalone local PostgreSQL instance with RLS and a private filesystem reached only through a small HTTP service. It tests the [contract](../../../docs/CONTRACTS.md), [privacy](../../../docs/PRIVACY.md), and M0 [roadmap](../../../docs/ROADMAP.md) subset of T02/T09; it does not implement M1 authentication or claim T01–T09 complete. Manual synthetic JPEG/PNG fixtures are sufficient for this scope. Export importers, HEIC, and video remain conditional until representative fixtures establish supported formats. EU production hosting, server-readable processing, AI off, and the €75 monthly ceiling remain constraints; this experiment provisions no paid service.

## Usage (caller's view)

```ts
// The harness obtains an opaque fixture session; no production sign-in UI.
const alice = await archive.fixtureSession('alice');
const receipt = await archive.ingest(alice, groupA, jpegFixture);
const ben = await archive.fixtureSession('ben');
const items = await archive.list(ben, groupA); // receipt appears when this item is ready
const original = await archive.open(ben, receipt.contributionId, 'original');
await archive.removeMember(admin, groupA, ben.memberId);
await archive.open(ben, receipt.contributionId, 'original'); // denied with old session
await archive.withdraw(alice, receipt.contributionId);
```

An HTTP smoke harness exercises these operations and records status, safe response shape, and byte hash. Browser probes exercise real HTTP delivery in Chrome and Firefox desktop; the implementer chooses phone emulation. Browser choice is evidence configuration, not an authentication requirement.

## Shape

```ts
type MembershipState = 'active' | 'removed';
type ContributionState = 'processing' | 'available' | 'withdrawn';
type ActorSession = { sessionHandle: string; memberId: UserId }; // opaque identity evidence
type Contribution = { id: ContributionId; groupId: GroupId; ownerId: UserId;
  state: ContributionState; policyVersion: number }; // no object key on caller surface
type ReadyReceipt = { contributionId: ContributionId; state: 'available' };
interface ArchiveExperiment {
  fixtureSession(actor: FixtureActor): Promise<ActorSession>;
  ingest(actor: ActorSession, group: GroupId, file: FixtureFile): Promise<ReadyReceipt>;
  list(actor: ActorSession, group: GroupId): Promise<Contribution[]>;
  open(actor: ActorSession, contribution: ContributionId,
    kind: 'original' | 'thumbnail'): Promise<ReadableStream<Uint8Array>>;
  withdraw(actor: ActorSession, contribution: ContributionId): Promise<void>;
  removeMember(actor: ActorSession, group: GroupId, member: UserId): Promise<void>;
} // Bodies: not implemented; fixtureSession is harness-only.
```

Schema: `memberships(group_id, user_id, role, state)` has a composite primary key; `contributions(id, group_id, owner_id, state, policy_version)` references the membership pair without deleting historical owners; `objects(group_id, contribution_id, kind, object_key, sha256, mime)` uses a composite group/contribution FK and unique `(contribution_id, kind)`. A contribution FK into `objects` cannot cross groups. The object key is a server-generated opaque identifier, never a client pathname. Index membership by its primary key and contributions by `(group_id, state, id)`; all returned objects join available contributions. A small fixture-only schema does not masquerade as the full asset/origin domain model.

Module map: `experiment/archive.ts` owns session verification, request-to-domain parsing, transactions, ingestion readiness and HTTP byte authorization; `experiment/schema.sql` owns constraints/RLS and restricted roles; `experiment/access.test.ts` owns fixture identities and direct SQL/HTTP probes. SQL defines one current-membership/available-contribution predicate reused by contribution and object SELECT policies. Runtime uses a non-owner, non-BYPASSRLS role with forced RLS; only migrations use the owner role. Set trusted identity transaction-locally after session verification, never from a user-supplied header; pooled connections cannot retain identity. Direct SQL tests use the same restricted role and controlled transaction identity, including unset identity. A client cannot access PostgreSQL or set that identity in deployment.

`open` queries the authorized object record through RLS on every request before opening bytes from a directory outside the web root. It never accepts a raw key/path or emits a public URL; responses use `Cache-Control: no-store`. Authorization denial returns no filename, metadata, count, or existence distinction. `ingest` validates JPEG/PNG and creates originals/previews before its item-specific transaction switches to available; a processing/failed neighbor cannot delay the successful item. Withdraw/removal commit current policy changes; subsequent reads with an unchanged JWT/session still query current membership and state. Concurrent ingestion completion locks/checks current membership and contribution state before commit, so withdrawal is terminal and removal cannot resurrect availability. Files written before a rejected transaction remain private orphan cleanup candidates. Already delivered bytes and streams authorized before revocation cannot be recalled; post-commit requests must fail.

This surface hides SQL roles, storage paths, readiness and revocation behind complete operations. It exposes only group/item intent. There is no stage coordinator, public transport type, pass-through repository hierarchy, or synchronized policy cache. Schema relationships enforce group scope; runtime boundary checks validate identity and media. RLS remains the database enforcement layer, while mediated delivery is the storage enforcement layer.

## Synthesis decision

Pending parent comparison; this is a structurally distinct candidate, not the selected implementation.

## Tradeoffs accepted

- We accept a custom delivery service and local session fixture in exchange for a small inspectable experiment without provider provisioning.
- We accept no signed-link grace period in exchange for current-policy checks on every new byte request; the proposed 60-second maximum is an upper bound, not a requirement to emit signed links.
- We accept missing Supabase Auth JWT validation/key rotation, PostgREST role/claim propagation, Storage bucket/object policies, service-role bypass behavior, signed URLs/CDN caches, and managed backup/region/cost evidence in exchange for isolating the core PostgreSQL policy. Passing here proves this implementation only. If D01 remains the production choice, M0 must rerun the allowed/denied and revocation experiment against actual Supabase DB/storage boundaries before claiming that stack validated. Otherwise record a D01 change accepting standalone PostgreSQL plus mediated storage and its operational ownership; do not silently count filesystem success as Supabase acceptance.

## Alternatives considered

Direct object URLs expose expiry/cache policy to callers and weaken immediate new-request revocation; mediated delivery hides both. SQLite plus application checks removes the real RLS boundary the M0 experiment needs. Local Supabase offers better D01 parity but couples this experiment to Auth/PostgREST/Storage infrastructure; it is a viable competing whole shape, not interchangeable evidence.

## Open questions and risks

Will synthesis keep Supabase as production provider, requiring its separate parity receipt, or explicitly revise D01? Will the departure decision withdraw owned contributions atomically, or only remove member reads while D06 remains proposed? The experiment must label the selected behavior and independently test withdrawal either way. Neither choice adds invitations or full account lifecycle to M0.

## Next implementation step

Write failing real-PostgreSQL and real-HTTP tests for Alice/Ben/admin allowed; outsider/removed/cross-group/anonymous denied; processing and withdrawn items absent; one ready item visible beside an unfinished item; current membership/state defeating a stale valid JWT/session after revocation; and guessed keys, static public paths, or direct unauthenticated object requests yielding no bytes or metadata, then implement the smallest schema/service that satisfies them.
