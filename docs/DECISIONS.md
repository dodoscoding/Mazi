# Mazi decisions and risks

The user confirmed a small team targeting production launch on 2 October 2026. Other choices below are planning proposals unless marked as source requirements. Proposed defaults let planning proceed without claiming user approval or implementation proof.

The existing [project plan](../PROJECT_PLAN.md), added upstream in eb81cc9, was discovered during PR preparation. It specifies Inngest, Tailwind CSS, MapLibre, earlier manual People tagging, and a different navigation arrangement. This document set does not supersede those choices. M0 must reconcile them, especially the database-queue proposal in D10 versus Inngest, before implementation. Its four broad stages correspond to M1, M2, M3 through M5, and M6 through M7 here.

## Decision register

| ID | Decision and status | Reason and rejected alternative | Owner and decision gate |
| --- | --- | --- | --- |
| D01 | Proposed Next.js, PostgreSQL, Supabase Auth/private Storage, one worker deployment. | Small-team operations and relational provenance. Reject microservices and a graph database until measurements justify them. | Technical lead, M0 upload/access experiment. |
| D02 | Proposed server-readable archive with encryption in transit/at rest; no E2EE claim. | Server media processing and retrieval need readable inputs. Client-held keys require a different recovery/search design. | Product and technical leads, before real M0 imports. |
| D03 | Source requirement implemented in the plan as private staging plus independent component grants. | Sharing a photo must not disclose its conversation or exact GPS. Reject an asset-wide visibility flag. | Backend lead, M1 T02. |
| D04 | Proposed private-scope dedupe, then reconciliation of visible published contributions. | Avoid duplicate-existence leaks and private-master promotion. Accept retained duplicate bytes across inaccessible audiences. | Backend/media leads, M1 T05 and M3 merge/undo. |
| D05 | Proposed M3 production scope includes validated exports; native Apple and conversational AI follow later. | Complete the archive loop before the most uncertain integrations. An Apple-first launch needs staffing and schedule revision. | Product lead, M0 scope acceptance. |
| D06 | Proposed departure revokes the departing member's group contributions; independent copies remain. | Makes future access predictable. A permanent group contribution policy needs explicit member agreement. | Product lead, before M1 publication schema is finalized. |
| D07 | Proposed macOS-first native companion, then iOS. | Bulk foreground import is the first use case. Actual device cohort may justify iOS first. | Product/native leads, M0 device experiment. |
| D08 | Source requirement for optional face recognition; disabled until consent and removal are specified. | Uploader control alone cannot resolve other subjects' participation. Manual People associations are independently deliverable. | Product/privacy lead, before M5 recognition work. |
| D09 | Proposed raw evidence plus separate resolved timestamp assertions. | Preserves conflicts, uncertain timezones, and corrections. Reject silently replacing capture dates with message times. | Import lead, M1 T06. |
| D10 | Proposed database queue with leases and idempotent stages. | Avoids another managed system initially. Revisit if measured worker/queue load exceeds its budget. | Backend lead, M2 T04. |
| D11 | Proposed opt-in optional AI with versioned outputs and provider controls. | Core archiving must survive model outage or opt-out. No default retention/training promise. | Technical/privacy leads, before provider dispatch. |
| D12 | Proposed numeric budgets and retention in TEST_PLAN and PRIVACY. | Make acceptance reviewable without treating estimates as measurements. | Technical/product leads, M0 confirmation, M2 remeasurement. |

## Open choices

| Choice | Working assumption | Due before | Consequence if unresolved |
| --- | --- | --- | --- |
| Actual squad capacity | Three engineers, shared design/product, part-time QA/security. | Scheduling M0 | Durations stay illustrative. |
| Production cohort and growth | Several invite-only friend groups first. | M0 | Cannot size invitations, storage, support, or abuse controls. |
| Regions, provider terms, and monthly ceiling | No approved provider region or spending ceiling yet. | Provisioning and real imports | Use synthetic fixtures only until settled. |
| Formats, upload quotas, and video limits | JPEG/PNG/HEIC and tested MP4/MOV combinations. | M1 format implementation | Reject unproven formats explicitly. |
| Original downloads and sensitive metadata | Sanitized previews by default, originals separately granted. | M1 publication UX | Do not ship an unrestricted original link. |
| Account departure and group closure | D06 and PRIVACY retention defaults. | M1 lifecycle implementation | Schema and copy require a product decision. |
| Nonmember/minor identity handling | No recognition until policy is accepted. | M5 recognition | Keep recognition disabled. |
| Model provider and processing location | No provider selected. | M5 | Deterministic archive features remain available. |
| Export compatibility | Conditional on representative source fixtures. | M0 and each adapter release | Reduce advertised support rather than infer missing content. |
| Capsule author access and edits | Unspecified. | M7 capsule design | Capsule implementation cannot start. |

## Risk register

| Risk | Effect | Mitigation and evidence gate | Owner |
| --- | --- | --- | --- |
| Private evidence reaches shared derivatives | Disclosure through originals, embeddings, counts, captions, or answers. | Component grants and negative tests T02/T05/T09/T13. | Backend lead |
| Exports omit history or media | Product promises cannot be met. | Fixture inventory and coverage UI; no complete-history claim. T07. | Import lead |
| Source format drift | Previously supported imports fail or parse dates incorrectly. | Versioned adapters, fixtures, explicit unsupported-format result. | Import lead |
| Worker or storage race | Lost items, duplicate origins, orphan bytes. | Stable occurrence keys, leases, reconciliation, crash injection. T03/T04. | Backend lead |
| False duplicate or event merge | History becomes wrong and difficult to repair. | Reviewable suggestions, retained variants, reversible relationships. T05/T10. | Media lead |
| Source/deletion ownership conflict | Departure removes too much or retains private context. | Contribution-aware deletion and explicit D06 policy. T09. | Product/backend leads |
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

The planning run uses a bespoke document workflow, recorded in [the checklist](../work/poteto/product-plan/CHECKLIST.md), and a [decision trail](../work/poteto/product-plan/decisions.tsv). Source claims were checked where accessible. No runtime prototype, migration, performance measurement, security certification, or production cost has been established. Independent review uses the same model family as the author, not a cross-family panel.
