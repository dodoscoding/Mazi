# Mazi roadmap

Build a private archive that a small team can operate in production. Deliver a complete import, review, publication, and rediscovery loop before adding native synchronization and conversational AI.

Status on 2 October 2026 is planning only. No milestone has started. The [specification](SPEC.md) owns release scope, and the [test plan](TEST_PLAN.md) owns test definitions.

## Use the planning assumptions

Use three engineers as the estimating assumption. Assign one to web experience, one to backend and permissions, and one to imports and media processing. Share a product/design lead and part-time QA or security review. Budget a Swift specialist for M4 or replace another engineer's work during that milestone.

Treat durations as elapsed working-week ranges for that squad, including integration and review. These are planning estimates, not commitments or measured velocity. Re-estimate after M0 and after the first real archive. Do not convert these ranges to launch dates until capacity, supported formats, and infrastructure costs are agreed.

Use 15 to 23 working weeks for M0 through the M3 launch candidate. Reserve another 3 to 5 weeks for archive compatibility, security findings, and release stabilization. The initial planning envelope is therefore 18 to 28 weeks. A smaller team or an Apple-sync requirement at launch changes that envelope.

## Follow the dependencies

```mermaid
flowchart LR
    M0["M0 Validate scope and contracts"] --> M1["M1 Private memory pilot"]
    M1 --> M2["M2 Historical import beta"]
    M2 --> M3["M3 Production archive launch"]
    M3 --> M4["M4 Apple sync, Discord server, Map"]
    M3 --> M5["M5 People and semantic search"]
    M5 --> M6["M6 Grounded Memory AI"]
    M4 --> M7["M7 Advanced memories"]
    M6 --> M7
```

Run M4 and M5 in parallel only with separate capacity. Otherwise finish M4 before M5, or prioritize M5 if beta demand favors discovery. Export-format research and a bounded PhotoKit feasibility experiment may start in M0. They do not imply early feature delivery.

## Deliver each milestone

| ID | Outcome | Dependencies | Estimate | Accountable role |
| --- | --- | --- | --- | --- |
| M0 | Validated scope, representative fixtures, privacy decisions, architecture experiment results. | None | 1 to 2 weeks | Technical lead with product lead |
| M1 | Internal group can privately upload, review, share, and revisit a memory. | M0 gates | 5 to 7 weeks | Backend lead with web engineer |
| M2 | Closed beta can reconstruct history from supported archive exports. | M1 | 4 to 6 weeks | Import engineer |
| M3 | Production launch with useful discovery, safe suggestions, recovery, and measured scale. | M2 | 5 to 8 weeks | Technical lead with QA |
| M4 | Selective Apple synchronization, authorized Discord server intake, and map exploration. | M3; source-specific feasibility | 5 to 8 weeks | Native/integration lead |
| M5 | Authorized multimodal retrieval and People; recognition only if consent gates pass. | M3 | 4 to 7 weeks | Retrieval lead |
| M6 | Memory AI gives evidence-backed answers with uncertainty. | M5 | 3 to 5 weeks | Retrieval lead with product lead |
| M7 | Recaps, stories, capsules, and media generation shipped as separate increments. | M4 and M6 program exits; individual features use only actual dependencies | Re-estimate per feature | Product lead |

### M0. Resolve the expensive unknowns

- [ ] Confirm the first production scope, format limits, group limits, capacity, cost ceiling, and supported browsers.
- [ ] Accept or revise the proposed stack and the server-readable privacy model in [Decisions](DECISIONS.md).
- [ ] Collect consented, redacted exports from each source and document missing fields. Store sensitive fixtures outside Git.
- [ ] Exercise a small upload-to-private-preview experiment with database authorization and storage denial from a second account.
- [ ] Exercise a PhotoKit selection and iCloud retrieval experiment on an actual supported device. Record permission and background limits.
- [ ] Define each role's acceptance evidence and establish build, lint, type, and test commands when the app scaffold exists.

Exit when the privacy decisions that affect storage are recorded, every promised importer has a fixture and a declared supported format, and the first denied-access experiment has evidence. If a source cannot meet the proposed scope, record the reduced scope before estimating its parser. These experiments have not run in this documentation task.

### M1. Deliver the private memory loop

- [ ] Implement authentication, group membership, single-use expiring invitations, and database authorization.
- [ ] Implement private object storage and resumable manual image/video upload with per-item validation and progress.
- [ ] Preserve originals, source appearances, capture-time evidence, and exact duplicate identity within the permitted scope.
- [ ] Deliver private staging, audience selection, independent metadata controls, share preview, publication, revocation, and deletion.
- [ ] Deliver manual memories and sub-events, basic Today, paged Timeline, media detail, and keyword search over titles and captions.
- [ ] Add core audit events, migration checks, minimal export, error monitoring, and an internal recovery drill.

Exit when two members and one outsider pass tests T01 through T06, T08, and T09 in [Test plan](TEST_PLAN.md). Demonstrate a ten-photo memory with one duplicate, one rejected file, a hidden location, and revoked access. Keep M1 restricted to an internal pilot.

### M2. Import real history

- [ ] Finalize the normalized adapter contract using the existing manual importer.
- [ ] Deliver WhatsApp export support first, then Messenger, then Discord user export. Reorder only if fixture evidence justifies it.
- [ ] Preserve bounded message context, reactions where supplied, source identities, archive coverage, and separate share dates.
- [ ] Add checkpointed scans, queue leases, per-item retry, cancellation, import reconciliation, and human-readable outcome reports.
- [ ] Test common image and video formats against the published format matrix. Reject unsupported codecs clearly.
- [ ] Run a closed beta with at least three consented groups and the representative archive fixture set.

Exit when T03, T04, T06, T07, and T09 pass, every discovered item has an outcome, and replaying a 20,000-item manifest adds no repeated appearances. Source integrations only claim fields demonstrated by fixtures. Complete the beta privacy walkthrough before expanding invitations.

### M3. Launch the production archive

- [ ] Add perceptual duplicate suggestions, explicit merge review, split/undo, and authorized rendition selection.
- [ ] Add explainable event suggestions using time, permitted location, and available grouping metadata.
- [ ] Add improved timestamp review, place normalization, approved On This Day, and virtualized timeline views.
- [ ] Complete export, account/group lifecycle controls, retention jobs, monitoring, incident procedures, and restore verification.
- [ ] Run the scale, accessibility, usability, privacy, cost, and release checks below.
- [ ] Release to the agreed invite-only cohort after the product owner records acceptance evidence.

Exit when T01 through T10 and T14 pass against the release candidate, the production checklist is complete, and no unresolved access leak or data-loss defect remains. Visual and event models remain optional. Launch can use reviewed deterministic time/place suggestions without cloud AI.

### M4. Add continuous sources and places

- [ ] Ship one native platform first. The proposed default is macOS for bulk imports, followed by iOS after device validation.
- [ ] Add metadata-first selection, album/date/type filters, foreground resumable uploads, change tracking, and permission-revocation handling.
- [ ] Handle Live Photo components and original/edited versions without silently dropping resources.
- [ ] Add Discord bot intake only for selected channels and date ranges with required permissions and an explicit continuous-import switch.
- [ ] Add Map, country/city filters, and optional travel paths derived only from visible places.

Exit when T12 and the source-specific T07 fixtures pass, changed permissions stop ingestion, and one real-device interrupted sync resumes without repeated appearances. Apple-origin People labels are not a promised API capability. Map readiness does not depend on shipping a native companion.

### M5. Add People and semantic retrieval

- [ ] Add versioned visual/text embeddings, combined authorized filters, and a held-out retrieval evaluation set.
- [ ] Add People with manual confirmed associations, separate account/person identities, personal hiding, subject disassociation, and protection against automatic retagging.
- [ ] Enable face recognition only after nonmember consent, withdrawal, provider retention, and deletion choices are settled and tested.
- [ ] Preserve useful search when recognition or all AI processing is disabled.

Exit when T11 passes, T01/T02/T09 remain green for retrieval, and the proposed retrieval target in the test plan is met. Face recognition may remain disabled while semantic search ships.

### M6. Answer with archive evidence

- [ ] Implement retrieval-grounded answers with accessible evidence links and explicit archive-coverage language.
- [ ] Recheck permissions and processing consent before retrieval, provider dispatch, and answer delivery.
- [ ] Treat imported messages as untrusted content. Prevent them from authorizing tools or data access.
- [ ] Add abstention, conflicting-date behavior, deletion invalidation, usage limits, and cost reporting.

Exit when T13 passes on the held-out questions and adversarial cases. Every factual answer is supported by evidence the requesting member can still access. An incomplete archive never supports an absolute claim about the group's entire past.

### M7. Ship advanced memories separately

Prioritize annual recaps and collaborative stories using approved memories. Follow with server-enforced time capsules, richer sub-events, slideshows, and generated video as separate scoped releases. Run T15 before any capsule launch. Define quality, processing cost, and export controls for each generated format before implementation. Notifications are a separate opt-in increment.

## Apply the production gate

- [ ] Record supported source formats, device/browser versions, and upload limits in the product.
- [ ] Pass direct database, storage, API, worker, search, and cache authorization tests.
- [ ] Complete restore, export, deletion, membership-removal, and rollback drills with evidence.
- [ ] Meet the performance and availability targets or record an explicitly accepted revised target before release.
- [ ] Resolve region, provider terms, processing consent, retention, and any required privacy/legal review for the launch cohort.
- [ ] Publish a privacy explanation that distinguishes encryption at rest from end-to-end encryption.
- [ ] Validate keyboard use, screen readers, focus, contrast, progress announcements, and reduced motion.
- [ ] Assign incident ownership, alerts, cost limits, support contact, and a release rollback decision-maker.
- [ ] Review the working flows with the product owner and attach screenshots to the implementation PRs.

## Split work without duplicating documentation

| Workstream | Starts after | Owns | Coordination point |
| --- | --- | --- | --- |
| Identity and privacy | M0 decisions | Membership, grants, RLS, revocation | Blocks all shared reads. |
| Web experience | M0 journeys | Review, timeline, memory detail, accessibility | Uses the same authorization contract as APIs. |
| Media and jobs | M0 storage experiment | Validation, variants, queue, recovery | Manual import proves the pipeline before other adapters. |
| Archive parsers | M0 fixtures; integration after M1 | Normalization and source compatibility | Can build independent fixture-driven parsers concurrently. |
| Intelligence and retrieval | M2 normalized evidence | Dedupe suggestions, clustering, embeddings, AI | Cannot broaden source visibility or consent. |
| Native Apple | M0 feasibility; full delivery M4 | Device authorization and selective sync | Shares the established import contract. |
| Operations and QA | M0 | CI, isolation tests, backups, cost, release evidence | Work proceeds in every milestone. |

Keep the shared specification, architecture, contracts, test plan, and decision register canonical. Create workstream-specific documents only when a contract grows beyond those files. Use one coherent behavior per implementation PR, with failing tests where appropriate, the smallest implementation, and relevant acceptance evidence. Do not create speculative PR numbers or empty workstream folders.
