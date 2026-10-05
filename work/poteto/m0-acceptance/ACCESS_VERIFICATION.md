# M0 provider access verification

## Scope and environment

Observed on 5 October 2026 in the dedicated local `mazi-m0-experiment` project: Node v24.15.0, locked Supabase CLI 2.119.0, HTTP API on loopback port 56321 and PostgreSQL on 56322. Container images: PostgreSQL `17.11.0.002`, Auth `v2.197.0`, PostgREST `v16.4`, Storage `v1.79.28`, Kong `2.8.1`. No hosted project, paid provisioning or personal archive was used.

The [fixture manifest](../../../tests/m0/fixtures/manifest.json) records the synthetic JPEG/PNG provenance and SHA-256 values. The JPEG decodes to 1536×1024 and PNG to 2×2 using macOS `sips`; the suite verifies exact retained bytes. These two samples do not establish general JPEG/PNG decoding, a 24MP decoder boundary, sanitization, or a production ingestion pipeline. The private bucket declares JPEG/PNG MIME types and a 25MiB upload limit.

## Observed evidence

The behavioral contract was committed before implementation as `db377b9`. `node --test tests/m0/*.test.mjs` first exited 1 at membership insertion with HTTP 404 while the schema was absent; real user creation and password sign-ins had succeeded. Setup users were removed afterward.

The CLI generated `20261005111409_m0_access_experiment.sql` with `supabase migration new m0_access_experiment`. `supabase db query --local --file` rejected the multi-statement transaction as a prepared-statement restriction before applying it. The transaction was validated using `docker exec -i supabase_db_mazi-m0-experiment psql -U postgres -d postgres -v ON_ERROR_STOP=1`; the verified minimal SQL was manually preserved in that CLI-generated migration. `db pull` was not used. This keeps explicit private-helper and Storage grants/policies rather than introducing a broad provider schema diff.

Initial provider runs passed 9/9 tests in 2.15s and 2.28s, including tightened positive listings, exact row counts, root listing isolation and strict database authorization errors. The parent then ran `npx supabase db reset --local` against the dedicated experiment, replaying the migration and bucket seed from a fresh database. Parent `npm run test:m0` passed 9/9 in 2.424s; `npx supabase migration list --local` reported `20261005111409` applied locally, and parent `npx supabase db advisors --local` reported no security issues. These are observed parent results, not independent worker reruns. No tests were skipped. This proves repeated synthetic runs plus fresh migration replay; it does not prove production migration safety.

The parent committed the schema/seed as `5b22299` and test hardening as `ab424c4`; the fresh-reset acceptance result above is at `ab424c4`. This receipt remains for the parent's documentation commit. `node --check tests/m0/access.test.mjs` and scoped `git diff --check` passed before handoff. `npm run lint` passes the Prettier formatting check; no separate semantic linter is configured.

| Contract | Observed result |
| --- | --- |
| Alice, Ben and active administrator | Exact available rows, metadata, counts, object names, JPEG/PNG bytes; successful lists required. |
| Outsider, removed member, other-group actor, anonymous | No target-group rows, counts, names or bytes; root listings contain only the actor's eligible group. |
| Per-item readiness | Making one processing item available exposes it immediately while a withdrawn neighbor stays inaccessible. |
| Public URL and guessed key | Denied through real Storage routes. |
| Direct database mutation | INSERT and owner/group/state or membership reassignment receive 401/403; privileged snapshots remain unchanged. |
| Direct Storage mutation | Upload, overwrite and delete cannot change retained bytes; a filtered delete may return an empty successful result. |
| Reader revocation and contributor departure | Ben's existing JWT loses reads after membership commit; his contribution disappears from Alice's reads while an independent administrator-owned copy remains. |
| Contribution withdrawal | Alice's same current JWT loses withdrawn rows and bytes on new requests; the independently owned exact PNG copy remains readable. |

## Policy ownership and limits

Membership SELECT is self-only. A private, non-API `SECURITY DEFINER` helper checks live active reader and contributor membership and returns only a boolean; it requires `auth.uid()`, has an empty search path, fully qualified tables, and authenticated-only execute privileges. This lookup is needed because an invoker cannot read another contributor's membership under self-only RLS. Contribution RLS owns eligibility; Storage SELECT matches an eligible contribution's exact immutable key. Application tables grant actors SELECT only. Storage retains provider-owned base grants; RLS denies mutation through the absence of write policies. Privileged synthetic setup models state transitions and cannot count as allowed-actor evidence.

The technical lead owns this experiment and hosted-provider parity/cost follow-up; a second developer reviews the allowed/denied matrix. The generated local Auth configuration is permissive for a disposable local experiment and is not production registration, invitation or session policy. No M1 upload/authentication UI, ingestion validation, signed-link expiry/cache behavior, deletion cleanup, backups or full T01–T15 acceptance is implemented. Local HTTP cannot prove hosted EU region, TLS/encryption, provider terms, processing location or the €75 operating ceiling. Originals remain server-readable, optional AI remains off, and export compatibility remains conditional on future fixtures.

## Review correction and final replay

The independent reviewer inspected the live catalog. Provider-owned Storage grants still allow table mutations in principle; absence of Storage write policies denies actor writes. The final migration therefore preserves those grants and uses RLS for Storage enforcement. Application tables grant SELECT only. This corrects the earlier design's intended Storage ACL claim.

After the correction, the parent replayed the migration with `npx supabase db reset --local`, then `npm run test:m0` passed 9/9 in 2.294s and the security advisor again found zero issues. Withdrawal now targets Alice's available PNG and asserts its bytes equal the independent administrator's PNG; only Alice's contribution becomes inaccessible. The reviewer approved revision 7a9aadd, with no blocking findings.
