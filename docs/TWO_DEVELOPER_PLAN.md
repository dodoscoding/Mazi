# Mazi two-developer delivery plan

**Goal:** Divide M0 through M7 between two developers so independent work progresses in parallel and each milestone closes with integrated acceptance evidence.

**Status:** Ownership recorded as the M0 engineering decision on 5 October 2026. M0 is complete with recorded decisions and passing local access/browser evidence. M1-M7 remain unstarted; task checkboxes below represent implementation handoffs.

**Confirmed direction:** [D13-D15](DECISIONS.md) and [PRODUCT.md](../PRODUCT.md) establish one 8-10-person group, website-only current scope, Home/Timeline/Search, and immediate group sharing. Native packages below are conditional future proposals.

**Architecture:** Both developers work in the same application and media/import pipeline. Stable authorization, normalized import, and read contracts let the web experience and processing work progress together without separate implementations of privacy rules.

**Tech stack:** Use the accepted [Architecture](ARCHITECTURE.md) and [M0 acceptance](M0_ACCEPTANCE.md). Next.js production web, PostgreSQL, Supabase Auth/private Storage, and one worker with database leases replace the Inngest proposal. Keep React Atlas/plain CSS. MapLibre is deferred to M3; native work remains conditional.

**Spec:** [Roadmap](ROADMAP.md), [Specification](SPEC.md), [Contracts](CONTRACTS.md), and [Test plan](TEST_PLAN.md) remain canonical. This is a delivery allocation; code paths, signatures, package commands, and detailed feature implementation plans follow M0's stack and repository-layout decisions.

## Assign two complementary owners

| Developer | Primary ownership | Supporting responsibility |
| --- | --- | --- |
| Dev A: platform and access | Database schema/migrations, authentication, membership, group access, authorized APIs, availability/withdrawal, search backend, deployment and recovery. | Review Dev B's worker, parser, and native access boundaries; implement suggestion/retrieval services as those milestones arrive. |
| Dev B: experience and ingestion | Web journeys, accessibility, upload client, media worker stages, normalized adapters, import reporting, discovery interfaces; native companion if qualified. | Review Dev A's policies from actual user journeys; own fixtures, media compatibility, and browser/device evidence. |

Both developers own tests and operational evidence for their changes. Neither is a dedicated QA person. These assignments assume both can work across the stack; swap whole packages if skills differ, while preserving one owner per package. A product decision-maker supplies scope/privacy approvals and milestone acceptance. Swift capability is a staffing check only if native work is later approved.

## Global constraints

- M0 precedes M1; M1 precedes M2; M2 precedes M3. A mock or parser experiment does not satisfy a milestone exit.
- Successfully ingested items share automatically with all active group members. No review or whole-batch gate delays availability.
- Preview, original, context, location, identity, and Memory metadata use the same group audience. Parent links cannot expose cross-group or withdrawn children.
- Preserve originals, raw date evidence, source appearances, and contribution ownership. Group dedupe cannot disclose another group's matching material.
- Use synthetic fixtures in Git/CI. Real archives require consent, restricted storage, and the relevant M0 privacy/provider decisions.
- Recognition and optional AI stay disabled until their own gates pass. Basic archiving remains usable without them.
- Keep source support conditional on demonstrated fixtures and device behavior. Do not promise complete history or Apple People labels.
- The remaining two-developer envelope is 17-25 working weeks: M1 6-8, M2 4-6, M3 4-6, plus 3-5 reserve. Re-estimate after the manual pilot and first real archive; no launch date is set.

## Establish interfaces before parallel implementation

Dev A leads the authorization/schema boundary; Dev B leads the normalized item and worker boundary. Both review these contracts in M0 and settle implementation names before M1. Record logical changes in [Contracts](CONTRACTS.md), access changes in [Privacy](PRIVACY.md), and stack/scope decisions in [Decisions](DECISIONS.md).

| Boundary | Producer | Consumer | Contract to freeze |
| --- | --- | --- | --- |
| Identity and policy | Dev A | All clients and workers | Authenticated owner/group, active membership, group isolation, contribution availability, policy/consent versions, allowed and denied actor fixtures. |
| Upload and jobs | Dev A: acceptance/storage/job persistence; Dev B: client and processing stages | Upload UI and worker | Manifest identity, scoped quarantine upload, completion validation, job lease/idempotency, item outcomes, retry/cancel, durable output attachment. |
| Normalized imports | Dev B | Dev A's persistence and shared processing | Versioned NormalizedImportItem and coverage report from Contracts; owner/group derived server-side; occurrence identity separate from SHA-256. |
| Automatic availability and correction | Dev A | Dev B's import/correction UI | Per-item group availability, ownership, atomic completion, version/lease checks, idempotency, correction/withdrawal, and explicit processing failures. |
| Discovery | Dev A | Dev B's Home/Timeline/Search and later views | Authorized bounded results, stable cursor, undated partition, uncertainty, eligible rendition, authorized facets/counts, inaccessible evidence omitted. |
| Revocation and cleanup | Dev A: deny/invalidate; Dev B: worker effects | Every new read/processing path | Immediate denial after policy commit, stale-output rejection, referenced-object preservation, tombstones, published signed-link expiry. |

The Atlas UI remains in src; M0 synthetic manual fixtures belong in tests/m0/fixtures and evidence in work/poteto/m0-acceptance. M1 decides production app and worker layout before adding runtime flows. Dev A owns shared migrations and deployment configuration. Dev B proposes migration needs before implementing dependent stages. Contract mocks use the same shapes and denied cases as integration tests; they are temporary development aids.

## M0: Validate scope and make parallel work possible

M0 is complete for the narrowed manual pilot. The table records its handoffs. For later work, follow each row in order; the two columns within a row can proceed together after any stated dependency.

| Wave | Dev A package | Dev B package | Handoff and acceptance |
| --- | --- | --- | --- |
| M0.1 | [x] Record accepted D01/D02/D06/D10/D12, reconcile PROJECT_PLAN, and define region, cost ceiling, quotas, storage and role ownership. The local access experiment passes; production safeguards remain M1 work. | [x] Establish synthetic JPEG/PNG manual fixtures, declared unsupported formats, with validation outcomes due in M1, selected Chrome/Firefox desktop and Android targets, and the Home-to-memory journey. The ten-photo production journey is M1 acceptance. Chat-export representative fixtures move to M2; native work is deferred. | Product owner confirmed the narrowed manual pilot and storage-affecting preferences on 5 October; detailed limits/retention are engineering decisions; provider/hosting/privacy review remains required before real imports or hosted provisioning. Confirm two-person capacity; native staffing is deferred. |
| M0.2 | [x] Build the local Supabase database/Auth/private Storage experiment after accepted stack decisions; document checks and demonstrate another active member allowed and outsider/removed member denied. Local CI checks are established; production Next.js integration follows in M1. | [x] Prepare [manual-format fixtures and expected normalized records](../tests/m0/fixtures/normalized-items.json). M1 implements the normalizer against these logical expectations. Retain the delivered Atlas prototype and owner-reported positive feedback; record 38 passing browser checks and 2 canonical screenshot skips; physical Android remains a pre-M1 gate. | Record actual experiment results; reduce unsupported promises. The design prototype is not a production milestone exit. |
| M0.3 | [x] Freeze policy, persistence, upload/availability/read boundaries; map schema and API ownership. | [x] Freeze normalized-item/worker boundaries; map UI, processing, fixture, and test ownership. | Both review contracts, test actors, repo layout, evidence locations, and a revised two-developer estimate. |

**Exit:** Accepted storage/privacy decisions recorded, manual JPEG/PNG fixtures and declared limits established, denied database/storage access demonstrated, website targets, desktop/phone-emulation runs, and design evidence recorded; physical Android verification required before M1 pilot, and runnable checks documented. [M0 acceptance](M0_ACCEPTANCE.md) links the passing local evidence. D03/D04 and later D08/D11 remain tied to their implementation gates.

The M1 pilot accepts only manual JPEG/PNG with the exact group/member/file limits in [M0 acceptance](M0_ACCEPTANCE.md). Archive ZIP, HEIC, video, and chat exports remain unsupported until their later fixture gates pass. Existing WebP display photographs are not input-validation evidence.

## M1: Ship the internal shared group memory loop

Start after M0 acceptance. Dev B can build screens against agreed contracts while Dev A implements them; real uploads and shared reads wait for the corresponding backend handoff.

| Wave | Dev A package | Dev B package | Handoff and acceptance |
| --- | --- | --- | --- |
| M1.1 | [ ] Authentication/recovery, groups, roles, expiring single-use invitations, membership and database policies. | [ ] Invite/sign-in flows and responsive application shell; upload/review screens against contract fixtures. | T01 passes against real policies before enabling group access. Shared actor fixtures cover active member, administrator, removed member, outsider, and another synthetic group. |
| M1.2 | [ ] Contributor-owned, group-scoped ImportRun/ImportItem persistence, private storage/quarantine, scoped upload acceptance, job persistence, contribution/origin/variant identity. | [ ] Resumable upload client and manual adapter; worker validation, hashes, original retention, metadata assertions and sanitized previews. | Agree job persistence before worker integration. Exercise T03/T04/T06 and M1 T05; rejected files remain visible outcomes. |
| M1.3 | [ ] Atomic per-item availability, correction APIs, completion conflicts/idempotency, withdrawal/deletion and group rendition selection. | [ ] Automatic-sharing explanation, date correction, post-import review, progress/retry/cancel and withdraw/delete UI. | Integrate available group items from M1.2. T02/T05/T09 prove group-visible GPS/context, independent copies, outsider denial, and membership/withdrawal handling. |
| M1.4 | [ ] Manual Memory/sub-event APIs, authorized Home/Timeline/detail/keyword reads; audit, migration checks, minimal export, monitoring, object backups and database/object recovery drill. | [ ] Memory/sub-event editing, rediscovery Home, paged Timeline with undated view, media detail and keyword search; accessible full journey. | Query shapes can be built earlier; final reads integrate automatically available group data. T08 and the full ten-photo pilot run close the wave. |

**Exit:** Both reproduce T01 through T06, T08 and T09 at their M1 scope. Demonstrate two members and an outsider with ten photos, a duplicate, rejected file, group-visible location/context and revoked membership access. Include the additional acceptance actors where a scenario requires them. Internal pilot only.

## M2: Add historical exports and closed beta

Dev B owns each source adapter in sequence: WhatsApp, Messenger, then Discord user export. Dev A works concurrently on durability and shared integration. A reorder needs fixture evidence recorded in Decisions.

| Wave | Dev A package | Dev B package | Handoff and acceptance |
| --- | --- | --- | --- |
| M2.1 | [ ] Extend manifest scanning/checkpoint persistence, leases, per-item retry/cancel and reconciliation; enforce bounded archive/fetch policy at execution boundaries. | [ ] Finalize normalized contract using manual import; implement WhatsApp inventory/normalization and its locale, multiline, missing-media and overlap fixtures. | Freeze adapter changes before wiring persistence. T03/T06/T07 include ambiguous repeated-message overlap without silent collapse. |
| M2.2 | [ ] Integrate WhatsApp into the established pipeline; add permitted archive-context/search reads, coverage, reactions and separate share dates. Extend crash/race tests. | [ ] Implement Messenger JSON, then Discord user-export adapters against the same boundary. Add archive inventory/progress/review/report UI and codec matrix tests. | Parsers may be tested without deployment. Each source gets its own real pipeline acceptance before being advertised. No invented Discord conversation history. |
| M2.3 | [ ] Prove 20,000-item replay, cancellation, complete accounting and object reconciliation; measure processing/storage cost; address database/recovery beta findings. | [ ] Run representative fixture matrix and coordinate the confirmed friend group, group-access walkthrough and archive UX findings; address parser/worker failures. | Both complete beta observations and evidence; keep personal archives out of CI and Git. |

**Exit:** T03/T04/T06/T07/T09 pass, every discovered item has a current outcome, and replay adds no repeated appearances. Complete the single-group beta and group-access walkthrough; use synthetic groups for isolation checks. Re-estimate remaining launch work from observed compatibility and throughput.

## M3: Complete discovery and production acceptance

Dev A leads suggestion correctness and lifecycle/operations. Dev B leads candidate computation, review experience and scaled browsing. Use deterministic time/place suggestions unless optional model gates have been met.

| Wave | Dev A package | Dev B package | Handoff and acceptance |
| --- | --- | --- | --- |
| M3.1 | [ ] Implement reversible merge/split transactions, preserved evidence/links/contribution state and authorized rendition selection. | [ ] Build perceptual candidate processing and held-out pair fixtures; duplicate compare/accept/reject/undo interface. | Freeze candidate/decision boundary first. T05 plus at least 95% precision on 200 held-out pairs; report recall. |
| M3.2 | [ ] Implement explainable time/place event candidates, durable decisions, dependency invalidation, place normalization and approved On This Day queries. | [ ] Event review/split/correction UI, richer timestamp/place review, On This Day, structured date/source/place filters and virtualized Timeline. | T06/T10 and at least 50 reviewed boundaries; target 80% useful suggestions. Cross-group or withdrawn evidence cannot enter group candidates. |
| M3.3 | [ ] Complete export, account/group lifecycle, retention, quotas, alerts, incident ownership, backup/object restore and rollback drills. Tune policy-enabled queries. | [ ] Run scale browsing, accessibility and usability evaluations; tune media stages; verify formats, privacy explanation, support copy and release screenshots. | Both run release checks against one candidate, including T09/T14 and the cost ceiling. Product owner accepts cohort release evidence. |

**Exit:** T01 through T10 and T14 pass and every production checklist item in Roadmap is satisfied. Use Test plan's M3 100,000-media/20-session/20,000-import profile and published budgets. Verify first-memory usability and discovery success targets from Specification. No unresolved access leak, missing originals or unaccounted import items. Production release needs recorded acceptance.

## M4 and M5: Choose one milestone for the two-person team

After M3, default to M4 followed by M5. Prioritize M5 first if beta demand favors discovery and record that choice. Do not allocate one developer to all of M4 and the other to all of M5: each needs platform and experience work, integration, and review. Parallel M4/M5 delivery requires separate additional capacity and a revised plan.

### M4: Native source intake and Map

| Wave | Dev A package | Dev B package | Handoff and acceptance |
| --- | --- | --- | --- |
| M4.1 | [ ] Extend established ingestion for bounded incremental runs, resource versions, source selection and current permission checks. Implement authorized location/Map queries. | [ ] Build one native platform after a separately accepted native experiment: metadata-first selection/filters, foreground resumable upload, iCloud outcomes and permission handling. | Reuse normalized contract; real-device T12 covers selected subset, interruption, Live Photo and edited resources without dropping components. |
| M4.2 | [ ] Implement authorized Discord bot intake, selected channels/date ranges, rate limits, permission loss and explicit continuous-import control. | [ ] Implement Map, country/city filters and optional travel paths; source selection/status controls after native core integrates. | T02/T07/T12 for newly enabled paths. Map can integrate without waiting for the native companion. |
| M4.3 | [ ] Verify bot backfill, revoked permissions, incremental identity and delivery authorization. | [ ] Verify actual-device interrupted sync and map visibility; record browser/device/source matrix and known limits. | Both reproduce source-specific T07/T12. Source deletion never silently deletes Mazi's retained copy. |

**Exit:** Roadmap M4 gate passes. Dev B's native assignment is conditional on Swift capability; if unavailable, obtain specialist capacity or record/re-estimate a deferred native increment. Do not claim M4 complete merely because Map and Discord ship. A second native platform gets separate device validation and capacity planning.

### M5: People and semantic retrieval

| Wave | Dev A package | Dev B package | Handoff and acceptance |
| --- | --- | --- | --- |
| M5.1 | [ ] Versioned embeddings/indexing, current consent enforcement and authorized combined search/facets; establish provider/retention decisions before dispatch. | [ ] Build held-out retrieval fixtures, embedding worker stages, combined-search UI and AI-disabled behavior. | Retrieval contract precedes integration. T01/T02/T09 plus at least 100 held-out questions, recall@10 at least 85%, p95 under 2 seconds and zero leaks. |
| M5.2 | [ ] Person/account separation, manual associations, personal hide, subject disassociation/suppression and private request handling. | [ ] People and manual confirmation UX, hide/unhide, subject-removal flows, shared memories/places through authorized APIs. | T11 includes tags applied by others and retries that must not reinstate suppressed associations. |
| M5.3 | [ ] Verify withdrawal invalidation, provider lifecycle and permission changes across retrieval. | [ ] Verify hidden lookalikes, combined filters and manual usefulness with recognition/all optional AI disabled. | Both close T11 and retrieval evaluation. Recognition is a separate optional package only after D08 and consent/deletion/evaluation gates pass. |

**Exit:** Roadmap M5 gate passes. Manual People and semantic retrieval do not require enabled face recognition.

## M6: Grounded Memory AI

Start after M5; M4 is not a prerequisite. If M5 was prioritized first, choose whether to deliver M6 before returning to M4, without running both as full milestones concurrently.

| Wave | Dev A package | Dev B package | Handoff and acceptance |
| --- | --- | --- | --- |
| M6.1 | [ ] Implement authorized retrieval-to-answer flow, consent checks before dispatch/delivery, cited evidence, coverage, abstention, limits and cost reporting. | [ ] Build question/answer UX, accessible citations, uncertainty/conflicting-date states and provider failure behavior; curate held-out and adversarial questions. | Freeze answer/evidence boundary; imported text is data and cannot authorize tools or access. |
| M6.2 | [ ] Add mid-answer revocation/deletion invalidation and prompt-injection/hidden-context tests. | [ ] Run supported-claim, abstention and citation usability evaluation; verify removed evidence cannot open through UI links. | T13 uses at least 100 answerable and 50 unanswerable/adversarial questions; target at least 95% supported claims and 95% correct abstention, zero leaks. |

**Exit:** T13 passes; every factual claim has still-accessible evidence, incomplete history is labeled, and any observed unsupported historical assertion is fixed or narrowed before release.

## M7: Release advanced memories one increment at a time

Program completion depends on M4 and M6. Individual features use only their actual dependencies and may be scheduled earlier by an explicit scope decision. Avoid starting every feature together.

| Order | Dev A package | Dev B package | Actual dependency and gate |
| --- | --- | --- | --- |
| 1 | [ ] Approved-memory recap/story persistence, collaboration/edit rules and dependency invalidation. | [ ] Annual recap and collaborative story editing/preview. | Authorized approved memories; generated text additionally needs approved processing and evaluated evidence handling. Define per-feature acceptance before implementation. |
| 2 | [ ] Server-enforced capsule unlock across every read/derivative path. | [ ] Capsule authoring and locked/unlocked states; direct-link and client-clock scenarios. | Normal group policy plus a separately approved capsule author/edit/access policy. T15 must pass before capsule release. |
| 3 | [ ] Richer sub-event relationships and authorized generation/export jobs with quotas and cost limits. | [ ] Richer hierarchy, slideshow/export experience, then generated video as separately scoped packages. | Approved inputs and format-specific quality/cost/export gates; no requirement to use every earlier feature. |
| 4 | [ ] Opt-in notification delivery, current-membership and contribution-state checks and cancellation. | [ ] Opt-in controls and notification content/accessibility verification. | Only released features and eligible recipients; capsule and revocation checks apply before delivery. |

**Exit:** Re-estimate and accept each feature separately; an unfinished optional feature does not become a hidden promise in a recap release. Capsule launch always requires T15.

## Review focus and evidence ownership

| Failure condition | Owning packages | Required behavior/evidence |
| --- | --- | --- |
| Concurrent invitation acceptance or stale ingest completion | Dev A, M1.1/M1.3 | One invite acceptance; stale policy/lease versions rejected without partial availability. T01/T02 and explicit conflict tests. |
| Cross-group or withdrawn contribution leaks through a duplicate, parent Memory or derivative | Dev A, M1.3/M1.4/M3.1; Dev B's consuming views | No inaccessible rendition/count/context promotion; withdrawn or cross-group children stay absent. T02/T05/T09. |
| Worker crash, late completion or ambiguous overlapping exports | Dev B stages/adapters with Dev A persistence, M1.2/M2 | No lost originals/repeated side effects; uncertain records retained, stale outputs rejected. T03/T04/T07/T09. |
| Date-only, DST or conflicting capture/share evidence | Dev B metadata/parsers and Dev A resolution/queries, M1.2/M2/M3.2 | Raw assertions retained, uncertainty visible, unknown dates undated; no false anniversary. T06/T10. |
| Revocation during retrieval, restore, native sync or locked-content delivery | Dev A enforcement and Dev B worker/client checks, M3 through M7 | Deny new reads, reapply tombstones, halt ingestion and exclude inaccessible evidence/locked derivatives. T09/T12/T13/T15. |

Dev A maintains database/API/storage authorization and recovery evidence. Dev B maintains parser/media fixtures, browser accessibility/usability, and device evidence. Both run end-to-end milestone gates and review the other developer's changes. Later features rerun the existing access/lifecycle scenarios for each new read path.

## Working agreement and first actions

Plan each active wave with one implementation package per developer. As a capacity assumption, reserve about one day per developer each week for review, integration, documentation and failures; do not count ten feature-development days per week. If one lane blocks, the other takes a ready fixture/test/UI package or helps the bottleneck instead of starting a later milestone's full implementation.

Use a separate branch/worktree per package, with the `codex/` prefix where appropriate. Land shared contracts/migrations before dependent integration; each task has one owner and the other developer reviews it. Keep changes small and coherent. Expose missing behavior with tests, make the smallest implementation, add meaningful regression coverage, and use imperative Conventional Commit messages.

Each implementation PR links its milestone and relevant decision, records exact revisions/commands/fixture versions/environment/results/evidence locations, includes UI screenshots where relevant, and calls out schema, privacy, security and deployment effects. Record unresolved limits with an owner and next decision point. Update canonical documents when behavior changes.

The next actions prepare M1:

1. Assign real names to Dev A/Dev B and confirm the product decision-maker; native capability is deferred until that scope is approved.
2. Use the accepted M0 record and passing local experiment as the starting contract. Dev A prepares production auth/storage integration; Dev B prepares the manual normalization/worker and upload journey.
3. Create focused M1 implementation packages against the frozen interfaces and real allowed/denied tests.
4. Use the revised two-developer envelope as a planning estimate, then re-estimate after the manual pilot and first real archive.

M0 is complete; no M1-M7 production acceptance scenario is complete. This plan's verification covers structure, local links and canonical consistency; the separate [Atlas prototype evidence](../work/design/atlas/VERIFICATION.md) covers the synthetic browsing experiment and alone does not close M0 or production acceptance. M0 also has [real database/storage evidence](../work/poteto/m0-acceptance/ACCESS_VERIFICATION.md).
