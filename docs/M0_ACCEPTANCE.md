# M0 decisions and acceptance

Status on 5 October 2026: M0 is complete for the narrowed manual pilot. The owner accepted EU hosting, server readability without E2EE, disabled optional AI/recognition, the €75 ceiling without paid provisioning, departure withdrawal, manual JPEG/PNG first, and conditional later formats. The owner selected desktop Chrome/Firefox and delegated phone selection. Architecture, detailed limits, retention targets, ownership, and schedule are engineering choices under the instruction to complete M0. The real local database/private Storage experiment passes after a fresh migration replay. This document does not authorize a production launch or paid provisioning.

## Accepted scope and limits

The M1 internal pilot serves one invite-only group with at most 10 active members. It accepts manual JPEG and PNG inputs. Retain the React Atlas experience in the production website.

| Limit | M1 contract |
| --- | --- |
| Group logical media items | 10,000 maximum |
| Group original and preview bytes | 20 GiB hard cap |
| Member submitted bytes | 5 GiB maximum, subject to the group cap |
| Files per import run | 100 maximum |
| Input file bytes | 25 MiB maximum |
| Decoded image size | 24 million pixels maximum target, enforced before availability in M1 |
| Archive files and expanded archive bytes | 0 supported |
| Video files and video duration | 0 supported |
| Other formats, including HEIC and WebP input | Explicit UNSUPPORTED outcome |

The checked-in WebP photographs are synthetic display assets. They do not prove JPEG or PNG input support. The [manual fixture manifest](../tests/m0/fixtures/manifest.json) records synthetic JPEG/PNG inputs and checksums. Binary round trips and fixture decoding are verified; production validation remains M1 work. M2 chat exports, HEIC, and video remain conditional on representative fixtures, a declared format matrix, and pipeline acceptance. No real chat export is required to accept this narrowed M0 pilot scope.

Desktop targets are current stable Chrome and Firefox. Phone targets are current stable Chrome and Firefox on Android. Record tested versions and hardware in verification evidence. iOS and Safari are deferred unless selected later. Browser emulation does not establish physical-device acceptance.

## Accepted architecture and policy

Use Next.js for the production web application in M1, PostgreSQL, Supabase Auth and private Storage, and one worker. Keep the current React Atlas prototype available while integrating its interface. PostgreSQL jobs use bounded leases, stage idempotency, retry backoff, attempt limits, and failure inspection. This replaces PROJECT_PLAN's Inngest proposal. Plain CSS preserves the existing craft instead of adding Tailwind. MapLibre is deferred to M3; the pilot has no map. These decisions reconcile the preserved PROJECT_PLAN without changing it.

Use EU hosting and a server-readable archive. Encryption in transit and at rest does not constitute E2EE. Optional AI and face recognition remain off. Departure withdraws the departing member's contributions and source dependencies. Independent eligible copies contributed by other members remain. Raw timestamp assertions and resolved display dates remain separate under D09.

Adopt application retention targets of 7 days for inactive unfinished uploads, 30 days after completion for raw archives, 7 days for live deletion cleanup, 180 days for security audit metadata, and 30 days for backup expiry. These targets are application requirements, not provider guarantees. M1 must include object backups as well as database backups and a restore drill that reapplies tombstones. Provider terms, hosting security, privacy disclosures, and region verification remain gates before real imports or hosted provisioning.

The owner accepted a €75 monthly operating ceiling without paid provisioning during M0. Reserve €25 for database/storage, €20 for app/worker, €15 for backups/operations, and €15 contingency. These are planning allocations, not purchase approval or currency-adjusted vendor quotes. [Supabase pricing](https://supabase.com/pricing), checked on 5 October 2026, lists Pro from US$25/month with 100 GB storage and 250 GB egress. This does not prove the complete service fits the ceiling. Measure usage and confirm billing, tax, exchange rate, region, and object-backup costs before provisioning.

## Ownership and remaining schedule

Dev A owns authentication, schema/migrations, policies, APIs, deployment configuration, and CI. Dev B owns normalization, worker stages, adapters, UI, fixtures, and browser/device evidence. Dev A owns shared migrations; Dev B proposes schema needs before dependent code. Both review the policy, normalized-item, upload/availability, authorized-read, and withdrawal contracts in [Contracts](CONTRACTS.md).

For two developers, plan M1 at 6-8 working weeks, M2 at 4-6, and M3 at 4-6. Add 3-5 weeks of stabilization reserve. The remaining envelope is 17-25 working weeks after M0, not a launch date or measured velocity. Re-estimate after the manual pilot and first real archive. The 100,000-item profile belongs to M3; M1 uses the 10,000-item cap.

## Acceptance gates

| Gate | Required evidence | Status on 5 October 2026 |
| --- | --- | --- |
| Scope, limits, browsers, capacity and cost | Owner preferences and delegated engineering decisions recorded here and in D01/D02/D05/D06/D09/D10/D12 | Accepted decisions; cost feasibility unmeasured |
| Storage-affecting privacy decisions | EU region, server readability, departure and retention policy | Recorded policy and engineering targets; provider guarantees unverified |
| Manual fixture and format declaration | `tests/m0/fixtures`, supported and explicit unsupported outcomes | Verified synthetic fixture inventory and binary round trips; M1 decoder/ingestion enforcement remains |
| Database and storage access | Actual Supabase experiment allowing another active member and denying outsider, removed member, cross-group reads and owner/group reassignment | Verified by [the real provider suite](../tests/m0/access.test.mjs), 9/9 checks after fresh reset |
| Per-item availability and ownership | Pending neighbor does not block available item; withdrawal preserves independent copy | Verified per-item readiness, withdrawal and independent-copy reads |
| Atlas experiment and friend feedback | Existing prototype record plus owner report | Owner reported positive feedback from 2-3 friends on 5 October 2026; no raw study record supplied |
| Device and reduced-motion evidence | Existing synthetic browser checks plus documented selected target versions/hardware | 38 passed, 2 canonical screenshot skips across desktop and phone viewports; Firefox used documented same-engine branding isolation; physical Android required before M1 pilot |
| Commands and role handoff | README commands, owner table, contract review | Commands, migration replay and CI checks established; local checks pass |

The access experiment runs the actual local Supabase PostgreSQL, Auth, and private Storage services. A local provider experiment can demonstrate M0 boundaries without provisioning a paid service. It does not prove production hosting, quotas, ingestion, backups, or T01-T15. [M0 verification](../work/poteto/m0-acceptance/VERIFICATION.md) records commands, revisions, fixtures, environment, results and limitations. [Provider evidence](../work/poteto/m0-acceptance/ACCESS_VERIFICATION.md) records the access matrix; [Firefox environment evidence](../work/poteto/m0-acceptance/FIREFOX_ENVIRONMENT.md) records the launch workaround.

M0 closes with accepted decisions, the fixture/format declaration, fresh migration replay and passing real database/storage and browser checks. The declared Android matrix is sufficient for the M0 target decision; physical Android verification is required before the M1 pilot. M1 production flows, M2 archive support, and M3 release acceptance remain separate gates.
