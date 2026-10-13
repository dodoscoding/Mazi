# Mazi decisions and risks

The user confirmed a small team targeting production launch on 2 October 2026. M0 records owner preferences and delegated engineering decisions for the narrowed manual pilot on 5 October 2026. The local M0 access experiment passes; production enforcement remains M1 work. Later choices remain proposals unless marked as confirmed decisions.

The existing [project plan](../PROJECT_PLAN.md), added upstream in eb81cc9, was discovered during PR preparation. It specifies Inngest, Tailwind CSS, MapLibre, earlier manual People tagging, and a different navigation arrangement. D13-D15 supersede the earlier navigation, sharing, current platform scope, and visual brief as confirmed on 3 October 2026. M0 selected database jobs with leases over Inngest, plain CSS over Tailwind, and deferred MapLibre to M3. Next.js production integration starts in M1. Its four broad stages correspond to M1, M2, M3 through M5, and M6 through M7 here.

## Decision register

| ID | Decision and status | Reason and rejected alternative | Owner and decision gate |
| --- | --- | --- | --- |
| D01 | Engineering decision, 5 October: Next.js production web in M1, PostgreSQL, Supabase Auth/private Storage, one worker; retain React Atlas and plain CSS. EU hosting; MapLibre deferred to M3. | Small-team operations and relational provenance. Reject microservices and a graph database until measurements justify them. | Technical lead, M0 upload/access experiment. |
| D02 | Accepted 5 October: EU-hosted server-readable archive with encryption in transit/at rest; no E2EE claim. Optional AI and face recognition off. | Server media processing and retrieval need readable inputs. Client-held keys require a different recovery/search design. | Product and technical leads, accepted 5 October; provider/privacy review before real imports or hosted provisioning. |
| D03 | Superseded for the initial release by confirmed D14: one group audience and immediate sharing. | The earlier private-staging and component-grant interpretation is preserved in Git history and the source brief; it is no longer the implementation target. | Product owner, confirmed 3 October 2026; backend lead, M1 T02. |
| D04 | Revised proposal: group-scoped exact dedupe and rendition reconciliation as each contribution becomes available. | D14 makes accepted contributions visible to all active members. Preserve contribution ownership and deny cross-group matching or existence disclosure. | Backend/media leads, M1 T05 and M3 merge/undo. |
| D05 | Accepted 5 October: manual JPEG/PNG M1 pilot within M0 limits. M2 exports, HEIC, and video remain conditional on representative fixtures; native Apple and AI follow later. | Complete the archive loop before the most uncertain integrations. An Apple-first launch needs staffing and schedule revision. | Product owner accepted narrowed pilot, 5 October; M2 fixture gate remains. |
| D06 | Accepted 5 October: departure withdraws the departing member's own contributions and dependencies; independent eligible copies remain. | Makes future access predictable. A permanent group contribution policy needs explicit member agreement. | Product owner accepted, 5 October; Dev A owns M1 lifecycle enforcement. |
| D07 | Deferred: current scope is website only under D13. A later native companion needs a new scope decision. | The earlier macOS-first hypothesis is not a current delivery commitment. | Product/native leads, before any native work is scheduled. |
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
| D15 | Warm, personal, nostalgic, photography-led experience with bespoke visual craft, tasteful animation, and meaningful 3D exploration. Adapt scene complexity by device, offer reduced motion and equivalent conventional controls. | Revises and accepts the initial visual sentence. HELIOS is an exploration/interaction reference, not an approved space theme. Start with a concept image, then a working Home-to-memory/photos/context prototype using synthetic content; test with 2-3 friends. Exact visual world and technical stack remain open. |

Q1-Q5 established audience, purpose, platform, navigation, and phone workflows. Q6-Q10 established design ambition, the HELIOS reference, the prototype, and device/accessibility behavior. Q11-Q14 replaced granular sharing with immediate group sharing and chose the concept-first workflow. Q15 confirmed the complete summary. The workflow preference is stored only in .impeccable/config.json; it is not a product stack decision.

The original brief and initial project plan remain unchanged historical sources. D13-D15 take precedence where they conflict. Existing GitHub issue bodies and the earlier work/poteto/roadmap-issues/ creation payloads predate these decisions and require reconciliation before implementation; this local documentation update does not claim to have updated or closed those issues.

## Prototype decision - 3 October 2026

**D16: Atlas experiment.** The team selected The Atlas of Us from the bolder concepts and authorized choosing the stack and building Home → memory → photos/context on phones and computers. Use React 19.2, TypeScript, Vite, React Three Fiber 9/Three.js, plain CSS, native browser transitions and local synthetic fixtures. [Stack, alternatives and boundaries](PROTOTYPE_STACK.md) are authoritative for this experiment. This does not settle D01/D10 production infrastructure or complete M0, authentication, imports, storage or security acceptance.

The product owner approved the delivered prototype and requested saving the session decisions, creating a pull request and merging it on 3 October 2026. This confirms the Atlas selection and prototype stack, superseding D15's earlier open visual-world/stack wording for this experiment. Approval covers the documented responsive layout, synthetic photographs, procedural 3D chart and motion. On 5 October the owner reported positive feedback from 2-3 friends. This is owner-reported evidence without a raw study record. Physical-device testing and numerical comp-fidelity validation remain open. D13-D16 and PRODUCT.md are the durable record of this session. Issue #3's product-context exit is satisfied; its older private-staging and review-before-sharing text is superseded by D14.

## Open choices

Implementation boundary, 6 October 2026: the requested Phase 2 import engine is runnable in [the local Python harness](../phase2/README.md), reusing the existing local identity foundation. It applies D14 automatic group availability and D06 departure withdrawal to its new archive data; the old M1 staging experiment remains separate. This is synthetic implementation evidence, not a replacement for D01's production stack. The old M2 issue payload's private staging and three-group beta instructions are superseded by D13/D14; the implementation uses the canonical contracts. Production provider integration, consented exporter fixtures, codecs and the one-group beta remain open.

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
| Capsule author access and edits | Unspecified. | M7 capsule design | Capsule implementation cannot start. |

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
