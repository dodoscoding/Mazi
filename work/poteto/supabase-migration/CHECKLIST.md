# Supabase application migration

- [x] Read the Principles section of the poteto-mode skill.
- [x] Phase A: Frame.
- [x] Phase B: Design the workflow.
- [x] Phase C: Run the loop.
- [x] Phase D: Keep the audit trail.
- [x] Phase E: Verify and hand back.

## Acceptance predicate

The Mazi project in Frankfurt stores application records in PostgreSQL and durable archive bytes in private Supabase Storage. Both the API and worker use the hosted configuration. Shared-code profiles and opaque sessions retain the D17 behavior. Synthetic imports, reads, denied access, withdrawal, worker retries, and restart checks pass against the hosted project. Local archive compatibility remains available. No existing archive is copied implicitly.

## Throughput checkpoint

- Blocking first steps. Confirm project identity, inspect the 44-table schema and filesystem paths, choose the migration design, and verify restricted database connectivity.
- Independent workstreams. Database adaptation and object storage use disjoint modules. Provider configuration remains with the parent. Review follows completed artifacts.
- Shared mutable state. One writer owns each module. Provider schema writes and migration execution remain serialized. Existing transaction invariants must survive concurrent API and worker connections.
- Smallest safe decomposition. Retain domain behavior and shared-code entry. Introduce only the database and durable-object boundaries the hosted runtime needs.

## Work units

- [x] Verify the empty healthy Mazi project, organization, and region.
- [x] Disable public Supabase signup and retain email confirmation and disabled anonymous sign-in.
- [x] Compare two architecture candidates and record a reviewed choice.
- [x] Add focused failing contracts for database and storage behavior.
- [x] Implement PostgreSQL records, migrations, and restricted runtime credentials.
- [x] Implement private durable storage for every archive byte path.
- [x] Configure both runtime processes and preserve existing archive keys.
- [x] Add explicit archive migration and recovery procedures.
- [x] Run local regression suites, hosted domain checks, and hosted browser journeys.
- [x] Run provider security advisors and independent code review.
- [x] Record exact evidence, limitations, and coherent commits.

## Provider identity

Project `elgwhwkqutmmbdjthubl`, organization `gprywpflwiijdozifqnv`, region `eu-central-1`, Free plan. The existing `supabase/config.toml` remains the local M0 experiment and is not linked to this project. A separate hosted schema owns the application migration.

## Completion

The owner archive was explicitly transferred after the hosted HTTP/recovery checks. All 44 domain tables match the original restricted backup and current local source. Two profiles, one group, sessions, shared-code policy, and introduction state were preserved; no media existed. The local source and backups remain private. Disposable synthetic rows, objects, validation buckets, and test schemas were removed. [Verification](VERIFICATION.md) records the final checks and operating limits.
