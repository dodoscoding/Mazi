# Mazi decisions and risks

The user confirmed a small team targeting production launch on 2 October 2026. M0 records owner preferences and delegated engineering decisions for the narrowed manual pilot on 5 October 2026. The local M0 access experiment passes; production enforcement remains M1 work. Later choices remain proposals unless marked as confirmed decisions.

The existing [project plan](../PROJECT_PLAN.md), added upstream in eb81cc9, was discovered during PR preparation. It specifies Inngest, Tailwind CSS, MapLibre, earlier manual People tagging, and a different navigation arrangement. D13-D15 supersede the earlier navigation, sharing, current platform scope, and visual brief as confirmed on 3 October 2026. M0 selected database jobs with leases over Inngest, plain CSS over Tailwind, and deferred MapLibre to M3. D18 retains the current React/Python application for the authorized hosted archive; the earlier Next.js/Supabase Auth production proposal requires a separate decision before implementation. Its four broad stages correspond to M1, M2, M3 through M5, and M6 through M7 here.

## Decision register

| ID | Decision and status | Reason and rejected alternative | Owner and decision gate |
| --- | --- | --- | --- |
| D01 | Engineering decision, 5 October: Next.js production web in M1, PostgreSQL, Supabase Auth/private Storage, one worker; retain React Atlas and plain CSS. EU hosting; MapLibre deferred to M3. | Small-team operations and relational provenance. Reject microservices and a graph database until measurements justify them. | Technical lead, M0 upload/access experiment. |
| D02 | Accepted 5 October: EU-hosted server-readable archive with encryption in transit/at rest; no E2EE claim. Optional AI and face recognition off. | Server media processing and retrieval need readable inputs. Client-held keys require a different recovery/search design. | Product and technical leads, accepted 5 October; provider/privacy review before real imports or hosted provisioning. |
| D03 | Superseded for the initial release by confirmed D14: one group audience and immediate sharing. | The earlier private-staging and component-grant interpretation is preserved in Git history and the source brief; it is no longer the implementation target. | Product owner, confirmed 3 October 2026; backend lead, M1 T02. |
| D04 | Revised proposal: group-scoped exact dedupe and rendition reconciliation as each contribution becomes available. | D14 makes accepted contributions visible to all active members. Preserve contribution ownership and deny cross-group matching or existence disclosure. | Backend/media leads, M1 T05 and M3 merge/undo. |
| D05 | Accepted 5 October: manual JPEG/PNG M1 pilot within M0 limits. M2 exports, HEIC, and video remain conditional on representative fixtures; native Apple and AI follow later. | Complete the archive loop before the most uncertain integrations. An Apple-first launch needs staffing and schedule revision. | Product owner accepted narrowed pilot, 5 October; M2 fixture gate remains. |
| D06 | Accepted 5 October: departure withdraws the departing member's own contributions and dependencies; independent eligible copies remain. | Makes future access predictable. A permanent group contribution policy needs explicit member agreement. | Product owner accepted, 5 October; Dev A owns M1 lifecycle enforcement. |
| D07 | On 13 October the owner requested Phase 4 implementation; use the proposed macOS-first direction for a local companion alongside the website. | Extends D13 for this implementation only. iOS, native distribution and production launch are not approved by local build evidence. | Product/native leads; real-device acceptance remains open. |
| D08 | Source requirement for optional face recognition; disabled until consent and removal are specified. | Uploader control alone cannot resolve other subjects' participation. Manual People associations are independently deliverable. | Product/privacy lead, before M5 recognition work. |
| D09 | Engineering decision, 5 October: raw evidence plus separate resolved timestamp assertions. | Preserves conflicts, uncertain timezones, and corrections. Reject silently replacing capture dates with message times. | Import lead, M1 T06. |
| D10 | Engineering decision, 5 October: database queue with leases and idempotent stages instead of Inngest. | Avoids another managed system initially. Revisit if measured worker/queue load exceeds its budget. | Backend lead, M2 T04. |
| D11 | Proposed opt-in optional AI with versioned outputs and provider controls. | Core archiving must survive model outage or opt-out. No default retention/training promise. | Technical/privacy leads, before provider dispatch. |
| D12 | Accepted 5 October: €75/month ceiling, no paid M0 provisioning; M1 limits and application retention targets in M0_ACCEPTANCE, TEST_PLAN, and PRIVACY. | Make acceptance reviewable without treating estimates as measurements. | Engineering targets recorded 5 October under delegated M0 scope; measure before provisioning and at M2. |

## Accepted M0 decisions, 5 October 2026

The owner confirmed EU hosting, server readability without E2EE, optional AI/recognition off, €75/month without paid provisioning, departure withdrawal, manual JPEG/PNG first, conditional later formats, and desktop Chrome/Firefox. [M0 acceptance](M0_ACCEPTANCE.md) distinguishes those preferences from delegated engineering choices for Next.js, database jobs, detailed quotas, retention, Android targets, and schedule. That record owns exact file, quota, browser, retention, cost, ownership, and schedule limits. These are decisions, not completed safeguards. A real local Supabase database/Auth/Storage experiment supplies M0 access proof; [verification](../work/poteto/m0-acceptance/VERIFICATION.md) records passing local results. No paid service or production launch is authorized by this record.

## Confirmed product direction, 3 October 2026

The product owner answered the design discussion for [issue #3](https://github.com/dodoscoding/Mazi/issues/3) in this Codex chat and confirmed the complete summary. [PRODUCT.md](../PRODUCT.md) is the durable product record. These are confirmed requirements, not implemented safeguards or proof of usability.

| ID | Confirmed decision | Supersedes and acceptance consequence |
| --- | --- | --- |
| D13 | One existing invite-only friend group of 8-10 people. Responsive website only. Rediscovery leads; Home, Timeline, Search are the initial primary navigation. My Imports and group settings are supporting routes. | Replaces several-group launch assumptions, Today naming, and the initial project plan's primary Events/Ask AI/My Imports arrangement. Later destinations appear only when shipped. Full small-memory workflows work on phones; desktop supports bulk work. |
| D14 | Every successfully ingested contribution becomes visible to all active group members automatically. Members sign in; no anonymous public access. Private staging, selected recipients, and independent component audiences are deferred. | Replaces D03 and the previous review-then-publish workflow. Review is post-import correction, not permission to publish. Availability follows each item's technical readiness without a batch-wide or human gate. T02/T05/T08/T09 must test group sharing, membership boundaries, and withdrawal instead of selected-member grants. |
| D15 | Warm, personal, nostalgic, photography-led experience with bespoke visual craft, tasteful animation, and meaningful 3D exploration. Adapt scene complexity by device, offer reduced motion and equivalent conventional controls. | Revises and accepts the initial visual sentence. HELIOS is an exploration/interaction reference, not an approved space theme. [D19](#luminous-night-visual-world-14-october-2026) later approved a space theme. Start with a concept image, then a working Home-to-memory/photos/context prototype using synthetic content; test with 2-3 friends. Exact visual world and technical stack remain open. |

Q1-Q5 established audience, purpose, platform, navigation, and phone workflows. Q6-Q10 established design ambition, the HELIOS reference, the prototype, and device/accessibility behavior. Q11-Q14 replaced granular sharing with immediate group sharing and chose the concept-first workflow. Q15 confirmed the complete summary. The workflow preference is stored only in .impeccable/config.json; it is not a product stack decision.

The original brief and initial project plan remain unchanged historical sources. D13-D15 take precedence where they conflict. Existing GitHub issue bodies and the earlier work/poteto/roadmap-issues/ creation payloads predate these decisions and require reconciliation before implementation; this local documentation update does not claim to have updated or closed those issues.

## Prototype decision - 3 October 2026

**D16: Atlas experiment.** The team selected The Atlas of Us from the bolder concepts and authorized choosing the stack and building Home → memory → photos/context on phones and computers. Use React 19.2, TypeScript, Vite, React Three Fiber 9/Three.js, plain CSS, native browser transitions and local synthetic fixtures. [Stack, alternatives and boundaries](PROTOTYPE_STACK.md) are authoritative for this experiment. This does not settle D01/D10 production infrastructure or complete M0, authentication, imports, storage or security acceptance.

The product owner approved the delivered prototype and requested saving the session decisions, creating a pull request and merging it on 3 October 2026. This confirms the Atlas selection and prototype stack, superseding D15's earlier open visual-world/stack wording for this experiment. Approval covers the documented responsive layout, synthetic photographs, procedural 3D chart and motion. On 5 October the owner reported positive feedback from 2-3 friends. This is owner-reported evidence without a raw study record. Physical-device testing and numerical comp-fidelity validation remain open. D13-D16 and PRODUCT.md are the durable record of this session. Issue #3's product-context exit is satisfied; its older private-staging and review-before-sharing text is superseded by D14.

## Shared-code entry decision, 14 October 2026

**D17: Shared-code entry and one-time introduction.** The owner approved a dedicated login screen for the existing local Atlas application. Entering the configured shared code and a new visible name creates a profile and circle membership immediately. Entering an existing name with the code resumes that profile on any browser. Names ignore capitalization and surrounding spaces. No email, personal password, or approval is required. The owner explicitly accepts that any code holder can use another member's name. This replaces the local application's single-use invitation entry flow, not its archive authorization checks.

A valid remembered browser session opens the Atlas directly. A new profile sees the short introduction before the Atlas. Completion is stored with the profile and survives browser changes. About makes the introduction available again. Signed-out visitors see only the login screen, including when they follow a deep link or request sample mode. Existing Atlas, Timeline, Search, My Imports, and Our circle pages remain in scope without a broader redesign.

Profile IDs distinguish stored accounts, not real people. Name uniqueness and remembered sessions reduce accidental duplicates but cannot prevent one person choosing several names. Browser data removal, expiry, and logout end remembered access. Existing archive IDs and contribution ownership must survive this change. Production deployment and milestone acceptance remain separate.

## Hosted archive decision, 14 October 2026

**D18: Hosted PostgreSQL and private Storage for the current app.** The owner requested creation/configuration of Mazi in Altan Esmer's Frankfurt Supabase organization and migration of the existing application. Retain the React Atlas shell, Python domain methods, D17 shared-code identities and sessions. Move durable rows to a private PostgreSQL schema through a restricted server role and retained bytes to a private bucket through server authorization. Keep explicit SQLite/file mode and the unchanged local source. Normal startup selects hosted mode only from the ignored server configuration; archive transfer and database-plus-object recovery remain explicit operations.

This revises D01 for the current runtime: Next.js and Supabase Auth are not prerequisites for this hosted increment and must not silently replace the accepted D17 entry contract. A public production deployment, real-device acceptance, and M0-M7 milestones remain separate gates. The project stays on Free with no paid upgrade; its provider capacity is not the accepted 20 GiB pilot allocation. All 44 domain tables and 12 privacy triggers are ported, with RLS on the private tables and durable object receipts/deletion work. Full orphan collection awaits safe maintenance isolation. [Setup and recovery](SUPABASE_SETUP.md), [runtime ownership](PROTOTYPE_STACK.md), and [synthetic evidence](../work/poteto/supabase-migration/database-implementation.md) record the resulting boundary. Actual archive transfer requires its own recorded result.

## Luminous night visual world, 14 October 2026

**D19: Luminous night.** The owner approved a space theme and selected direction A, Luminous night, from the Claude Design canvas ("Round 2 · Luminous night, every screen"). This supersedes D15's wording that HELIOS is not an approved space theme; D15's other commitments stand. The owner decided:

- Direction A, Luminous night, with the round 2 sheets as the specification for every screen and state.
- The space theme is approved, revising D15 and the HELIOS note in [PRODUCT.md](../PRODUCT.md).
- Delivery is a stack of pull requests, one per stage.
- Ambient sound is built. It stays off by default behind a visible toggle.
- People lines show evidence only. Contributors show as "shared by" and chat participants as "in the conversation". Nothing claims that a person was present.
- Night is the only theme, following the owner's 22 October 2026 update in PR #97. The entry page, header, phone More sheet, and About offer no day toggle. The browser clears earlier day choices.

The [program plan](../work/poteto/luminous-night/PLAN.md) records the data shapes and stage order. The canvas artboards are the measured contract; this decision does not change archive access, sharing, or production acceptance.

## Vercel production runtime, 22 October 2026

**D20: Vercel Hobby with request-driven background work.** The owner asked to deploy the Python application, worker and durable storage, and chose Vercel's free Hobby plan over an always-on container host. Vercel serves the built interface from its CDN and one Python function in `fra1` serves the API through a streaming WSGI bridge. D18's Supabase schema and private bucket remain the only durable state. Streaming keeps the Atlas response and export ZIPs clear of the 4.5 MB non-streamed body limit; uploads already use requests of at most 768 KiB.

Hobby has no always-on process and allows one cron a day. The worker therefore becomes a bounded drain: a signed-in, visible tab calls `POST /api/work`, and a daily cron calls it with `CRON_SECRET`. Imports advance only while someone has the app open, or once a day. The owner accepted that tradeoff. An always-on container host (Fly.io, Render, Railway) would keep the thread worker but costs about $5-7 a month. The local server keeps its worker thread. [Deployment](DEPLOYMENT.md) records setup and limits; [verification](../work/poteto/production-deploy/VERIFICATION.md) records the live journey. Representative real-device latency and M0-M7 milestones remain separate gates.

## Open choices

Implementation boundary, 6 October 2026: the requested Phase 2 import engine is runnable in [the local Python harness](history/imports/README.md), reusing the existing local identity foundation. It applies D14 automatic group availability and D06 departure withdrawal to its new archive data; the old M1 staging experiment remains separate. This is synthetic implementation evidence, not a replacement for D01's production stack. The old M2 issue payload's private staging and three-group beta instructions are superseded by D13/D14; the implementation uses the canonical contracts. Production provider integration, consented exporter fixtures, codecs and the one-group beta remain open.

| Choice | Working assumption | Due before | Consequence if unresolved |
| --- | --- | --- | --- |
| Actual squad capacity | Two developers confirmed on 3 October 2026; see [task allocation](TWO_DEVELOPER_PLAN.md). Product/design, QA/security, and Swift capacity still need confirmation. | M0 complete; two-developer estimate recorded 5 October in M0_ACCEPTANCE | Use the revised two-developer remaining envelope of 17-25 working weeks; no launch date is committed. |
| Growth beyond the first group | One friend group of 8-10 people is confirmed in D13; expansion is undecided. | Expansion beyond that cohort | Reassess capacity and support before adding groups. |
| Regions, provider terms, and monthly ceiling | EU hosting and €75/month ceiling accepted; exact provider region, billing, and terms pending. | Provisioning and real imports | Use synthetic fixtures only until settled. |
| Formats, upload quotas, and video limits | Manual JPEG/PNG within M0 limits; HEIC/video/archive support conditional on later fixtures. | M1 format implementation | Reject unproven formats explicitly. |
| Original download delivery | D14 gives the group one audience, including imported originals and metadata. Download UX and delivery limits remain proposed. | M1 delivery UX | Enforce current group membership on every original link; no per-component audience selector. |
| Account departure and group closure | D06 departure withdrawal and PRIVACY application retention targets accepted; group closure details pending. | M1 lifecycle implementation | Implement accepted departure policy; settle group closure before release. |
| Nonmember/minor identity handling | No recognition until policy is accepted. | M5 recognition | Keep recognition disabled. |
| Model provider and processing location | No provider selected. | M5 | Deterministic archive features remain available. |
| Export compatibility | Conditional on representative source fixtures. | M2 fixture gate and each adapter release | Reduce advertised support rather than infer missing content. |
| Capsule author access and edits | Local continuation: immutable after seal; no author read bypass; author can delete. | Production M7 capsule review | Local rules below; production T15 remains open. |

## Risk register

| Risk | Effect | Mitigation and evidence gate | Owner |
| --- | --- | --- | --- |
| Inaccessible evidence reaches a group or former member | Cross-group, removed-content, or stale-membership disclosure through media, counts, captions, or answers. | Membership, group, withdrawal, and processing-consent checks with T02/T05/T09/T13. | Backend lead |
| Exports omit history or media | Product promises cannot be met. | Fixture inventory and coverage UI; no complete-history claim. T07. | Import lead |
| Source format drift | Previously supported imports fail or parse dates incorrectly. | Versioned adapters, fixtures, explicit unsupported-format result. | Import lead |
| Worker or storage race | Lost items, duplicate origins, orphan bytes. | Stable occurrence keys, leases, reconciliation, crash injection. T03/T04. | Backend lead |
| False duplicate or event merge | History becomes wrong and difficult to repair. | Reviewable suggestions, retained variants, reversible relationships. T05/T10. | Media lead |
| Source/deletion ownership conflict | Departure removes too much or retains withdrawn source context. | Contribution-aware deletion and explicit D06 policy. T09. | Product/backend leads |
| Native background and cloud-resource limits | Apple sync takes longer or cannot run as expected. | Device experiment and foreground-first resumable design. T12. | Native lead |
| Storage, video, egress, or model expense | Unsustainable production operating cost. | Quotas and measured cost by stage; approved ceiling before rollout. | Technical lead |
| Face labeling or ungrounded AI harms trust | Misidentification, false historical claims, unwanted processing. | Separate consent and evidence evaluation; disable unmet features. T11/T13. | Product/retrieval leads |
| Backups preserve deleted data or omit objects | Failed deletion promise or unusable restore. | Tombstone replay, object-aware backups, isolated restore drill. T09/T14. | Operations owner |
| Small team is split across too many platforms | Critical production work stalls. | Finish M3 before full M4/M5; parallelize only with assigned capacity. | Product lead |

## Architecture alternatives

A manual-upload pilot is the shortest useful product and remains M1. It is insufficient for the requested historical reconstruction launch, so archive imports remain in M2. Source-specific import controllers would be shorter for one source but duplicate privacy and retry behavior across the requested sources; the normalized boundary is justified by those existing requirements.

A managed external queue, separate vector database, and microservices remain possible responses to measured limits. None is necessary in the initial plan. Native Apple integration begins with one platform rather than two independent applications. Recognition remains optional so it does not block semantic retrieval.

## Planning method and verification limits

Poteto's Foundational Thinking shaped the decision to define contribution, provenance, and access boundaries before features. Its Laziness Protocol kept the proposed deployment to one application and one worker. Sequence Work into Verifiable Units produced the pilot/beta/production gates. Prove It Works shaped document verification and the future acceptance scenarios.

The planning run uses a bespoke document workflow, recorded in [the checklist](../work/poteto/product-plan/CHECKLIST.md), and a [decision trail](../work/poteto/product-plan/decisions.tsv). Source claims were checked where accessible. The original planning run established no runtime prototype, migration, performance measurement, security certification or production cost. The later D16 prototype has separate evidence and does not certify production behavior. Independent review uses the same model family as the author, not a cross-family panel.

## Phase 4 local implementation decision, 13 October 2026

The owner explicitly requested implementation of Phase 4 from the roadmap. The local implementation follows the proposed macOS-first direction and keeps the website as the archive. [Phase 4 scope and limits](history/sources/README.md) record foreground-only selection/transfer, operator-authorized Discord sources, explicit location sharing, opaque retention of unsupported preview formats, and the offline map. This extends the earlier website-only implementation boundary without asserting production or real-device acceptance. Existing privacy and production-provider contracts remain in force.

## Phase 5 local implementation decision, 13 October 2026

The owner requested implementation of Phase 5. The [local implementation](history/discovery/README.md) applies the proposed People and personal-hiding controls to the Python archive, while preserving the group audience: hiding affects the requesting member's discovery only. Person identity requires an administrator's private verification followed by the subject's confirmation; subject removal persists as a suppression. Nonmember requests use a privately verified administrator workflow. Optional local embedding processing requires group enablement and active contributors' opt-in. A versioned deterministic text-concept/color baseline provides offline retrieval without choosing a hosted provider or enabling face recognition. These local implementation choices do not approve production deployment, recognition, or substitute the synthetic holdout for M5's independent release evaluation.

## Phase 5 learned local retrieval, 14 October 2026

The owner's continuation request extends local Phase 5 with optional pinned CLIP ONNX inference. Model installation is explicit; inference has no network path. Existing group/contributor processing controls apply to learned embeddings, and a monotonic consent generation fences in-flight index work. Learned indexing runs in small batches outside database write locks, followed by current-policy checks; ordinary searches use matching cached vectors and retain keyword fallback. The [model instructions](history/discovery/README.md) and [verification](history/discovery/VERIFICATION.md) record the pinned source, English-query limitation and the generated-image evaluation. Production deployment, recognition and independent real-archive acceptance remain unapproved/open.

## Local advanced-memory increment, 14 October 2026

The Phase 7 implementation request follows M7's separate-increment sequence. The [local implementation contract](history/memories/README.md) delivers deterministic annual recaps and collaborative stories first. Engineering choices for this increment: approved archive events are the source, all original photos must remain visible, annual recaps omit unknown/conflicting/cross-year dates, each member owns their own story contribution, and the story creator owns deletion. Current-access JSON export is explicit; no external processing or generated media is enabled. These choices extend the local Python harness, not D01 production infrastructure. Capsule rules, generated-format quality/cost/export decisions, and M7 production acceptance remain open.

## Phase 7 continuation contract, 14 October 2026

The owner requested continuing the remaining M7 work. Local engineering defaults: capsules contain newly supplied text and an optional JPEG/PNG, isolated from the shared import archive. Sealing is immediate and immutable; no author read/edit exception exists before server UTC unlock. The author may delete at any time while still a member; departure deletes their capsules. Only the author receives a content-free locked receipt. Unlocked reads require current group membership. This resolves the local capsule author/edit choice; production acceptance still requires T15 against production infrastructure.

Generated-format contract before implementation: slideshow frames are current-access JPEGs, manually advanced with no automatic motion. Video export is a deterministic silent MJPEG AVI montage, 640×480 letterboxed, 1 frame/second, 3 seconds/photo, at most 20 photos/60 seconds. No synthetic scenes, audio, external provider, or paid processing. Frames are generated locally, source access is checked before generation and before delivery, output is bounded to 32 MiB and not persisted. Download is explicit and downloaded copies cannot be recalled. CPU/infrastructure cost remains unmeasured; one synchronous export at a time follows the local server's serialization. These limits define local format quality, not production performance. Notifications are opt-in, in-app only, computed from currently unlocked capsules; no email/push dispatch occurs.

## Unified local app, 14 October 2026

The owner requested one app with the Atlas UI and every Phase 7 capability. The selected implementation retains the tested Python archive engine and its SQLite/file formats, moves runtime modules into domain-named `mazi` packages, and brings all feature screens into the React Atlas shell under `src/features`. Atlas reads authorized archive projections rather than defaulting to sample fixtures. Development has one supervising command and one browser origin; the built app serves UI and API together.

A full TypeScript backend port was considered and rejected for this change because it would require re-proving ingestion, source fencing, visibility, consent, capsules and exports without improving the requested interface. Existing DOM workflows become scoped mounted modules with cleanup. This preserves behavior while removing independent phase runtimes. Sample content is explicit at `?demo=1`. Data remains in `.mazi-imports`; no merge with `.mazi-pilot` or production acceptance is implied. The [architecture](PROTOTYPE_STACK.md) and [verification](../work/poteto/unified-app/VERIFICATION.md) record the resulting contract.


## Import continuity and worker ownership, 22 October 2026

The owner requested fixes for background interruption, repeated ZIP reads, and slow-work lease failure, followed by verification and merge. Imports and Circle retain their mounted lifecycle while the document is hidden. The session gate keeps the ready import route mounted during foreground session validation. Navigation, page closure, group or session changes, and denied access still end the route's work. Other feature routes retain background privacy cleanup. Browser suspension and computer sleep remain outside the continuation guarantee.

The import worker reuses one validated ZIP for the current run, bounded by the existing 128 MiB archive limit. A new run replaces that copy. Completion, detected cancellation or access loss, fatal archive errors, and store shutdown release it. No durable cache or storage-format migration is introduced. Hosted upload receipts still require a successful byte readback before acknowledgment; the transport no longer repeats that verification for a new object.

A 60-second lease controls when another worker may reclaim an item. Work must begin under a live lease. After preparation, publication checks the current claim token, run state, withdrawal and membership in the writer transaction. Deadline expiry alone does not discard successful work if the token still belongs to that worker. A replacement claim invalidates the old token immediately. This replaces the earlier hard-expiry retry rule. It avoids heartbeat threads that could be blocked by existing storage write transactions. Competing workers can still repeat preparation after a takeover, but only the current token can publish.
