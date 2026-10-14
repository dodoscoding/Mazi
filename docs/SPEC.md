# Mazi product specification

The confirmed product direction is recorded in [PRODUCT.md](../PRODUCT.md) and [D13-D15](DECISIONS.md), dated 3 October 2026. Remaining implementation and release details are proposals. This specification reconciles the preserved [original brief](source/PRODUCT_BRIEF.md) with those decisions; no feature exists yet.

## Product purpose

Mazi helps one invite-only friend group of 8-10 people rediscover shared history from fragmented personal archives. Members sign in; imported material becomes visible to the entire group as it is successfully ingested. Review supports subsequent corrections and organization. Overlapping contributions preserve source evidence without repeated gallery entries.

The core unit is a memory supported by media and historical evidence. An album alone does not describe who shared a photo later, which conversation it appeared in, or why its date is uncertain.

## Users and outcomes

| User | Need | Observable outcome |
| --- | --- | --- |
| Contributor | Recover years of scattered files and messages. | A resumable import lists available media, missing material, and original context. |
| Reviewer | Correct and organize imported history. | Dates, duplicate suggestions, and source context can be inspected and corrected after import; review never gates group visibility. |
| Group member | Rediscover shared history or find a particular moment. | Home encourages exploration; Timeline and Search retrieve group media with capture dates and source history. |
| Group administrator | Manage a trusted group. | Invitations expire and membership can be revoked; administrators read the same group archive as other active members. |
| Person appearing in media | Future People features need clear identity and removal rules. | Personal hiding, subject disassociation, and recognition controls remain later proposals to decide before People launches; initial audience controls are deferred. |

## Release boundaries

The first production release is the M3 exit in the [roadmap](ROADMAP.md). M1 is an internal pilot. M2 is a closed beta. Initial navigation is Home, Timeline, Search; later destinations remain roadmap proposals and appear only when shipped. The current product is a website.

| Capability | First production release | Later delivery |
| --- | --- | --- |
| Accounts and groups | One invite-only friend group of 8-10 people, membership roles, expiring invitations, account recovery. | Growth beyond this cohort is undecided; cross-group discovery remains excluded. |
| Import and review | Manual images and common video formats, resumable transfers, immediate group sharing, post-import review. | Native Apple library access is a deferred M4 proposal requiring new scope approval. |
| Archives | Validated WhatsApp, Messenger, and Discord user-export formats, each with a visible support matrix. | Discord server integration at M4, separately gated. |
| Media identity | Exact duplicate handling, reviewed near-duplicate suggestions, retained variants and provenance. | More expensive video similarity only after a measured need. |
| Memories | Manual memories, manual sub-events, editable date and place, reviewed event suggestions. | Richer automatic hierarchy and collaborative stories at M7. |
| Discovery | Timeline, keyword search, date/source/place filters, rediscovery Home, approved On This Day. | Map at M4, multimodal search and People at M5, Memory AI at M6. |
| Access | Sign-in and active group membership on every read. All imported content has the same group audience. | Private staging and individual/component audience controls are deferred. Recognition at M5 needs its own decision. |
| Operations | Audit events, export, deletion, recovery drill, quotas, alerts, accessibility, monitored production. | Generated recaps, video, and capsules at M7. |

Keyword search covers group titles, user captions, and imported source text. It does not promise object recognition. On This Day excludes removed or technically unavailable material and uncertain anniversary dates.

## Primary journeys

1. A group creator signs in, creates a private group, and sends a single-use invitation through their chosen channel. The recipient accepts before expiry. An expired or revoked invitation grants nothing.
2. A contributor selects files or an archive and sees the inventory, formats, size, and processing choices. Transfer and background progress survive interruption. Successful items remain reviewable if other items fail.
3. Each successfully ingested item enters the group archive automatically. Import UI explains this before submission and shows per-item progress and failures. The contributor can review dates, duplicates, source context, and warnings afterward; there is no audience selector or Publish action.
4. A member opens a memory through Home, Timeline, or Search. All active group members can see the same available contributions and their imported context. Deleted, withdrawn, cross-group, or technically unavailable evidence contributes no results or counts.
5. A member contributes a better copy of an existing image. As it becomes available, group-scoped reconciliation can improve the rendition for the whole group while preserving contributed files and origins.
6. A contributor withdraws or deletes a contribution under the proposed lifecycle policy. Future access stops according to the [revocation contract](PRIVACY.md). Independently contributed copies remain, but the removed contributor's context does not.

## Navigation

| Area | Responsibility | First milestone |
| --- | --- | --- |
| Home | Rediscovery across dates; group memories and sufficiently precise On This Day. | Basic M1, anniversary feature M3. |
| Timeline | Year, month, day, memory, sub-event, and media exploration. Unknown dates remain in an explicit undated view. | M1, scale work M3. |
| Map | Authorized places, area filters, and travel history. A media item without shared location contributes no point. | M4. |
| Search | Keyword and structured filters first; later combined visual, text, person, and place retrieval. | M1, archive text M2, semantic M5. |
| People | Confirmed visible associations, shared memories, and places. No popularity scores or competitive rankings. | M5. |
| Memory AI | Answers from authorized evidence with citations and uncertainty. | M6. |

Unavailable areas are omitted from the shipped navigation. My Imports and group settings are supporting routes. My Imports remains easy to reach without becoming a primary destination. Home, Timeline, Search is the initial ordering.

## Product rules

- Import automatically shares each successfully ingested item with the group, including available context and metadata. Technical processing is not a human publication gate.
- Current active group membership governs previews, originals, context, location, identities, memory metadata, and discovery. Individual audience controls are deferred.
- A memory and its children must belong to the same group; hierarchy cannot expose withdrawn, deleted, or cross-group content.
- Source dates and capture dates remain separate. A guessed capture date remains visibly uncertain.
- Approximate duplicate and event suggestions require review. Rejection and undo remain available.
- AI processing requires an explicit choice and is independently disableable. Basic archiving works without it.
- Imported archive coverage is partial until demonstrated otherwise. Empty search results do not prove an event never happened.
- Nonmembers in messages or images are not silently turned into searchable identified people.
- The owner-requested [local Phase 5 implementation](history/discovery/README.md) applies manual People and personal discovery hiding without changing the shared group audience. The [Phase 5 decision](DECISIONS.md) records identity verification, suppression and optional local processing; production integration and recognition gates remain open.

## Design direction and first experiment

The owner confirmed warm, personal, photography-led design with bespoke visual craft, tasteful animation, and meaningful 3D exploration. [PRODUCT.md](../PRODUCT.md) records the reference and constraints. The team selected and approved The Atlas of Us prototype under D16; [DESIGN.md](../DESIGN.md) records its implemented visual system. The synthetic experiment does not establish production acceptance or user-study outcomes.

Begin with a concept image and then a working Home-to-memory journey through photos and context using synthetic content. Test with 2-3 friends on phones and computers, observing clarity, enjoyment, and desire to return. Adapt scene complexity by device, provide reduced motion, and retain equivalent conventional controls. The complete small-memory workflow must work on phones; desktop supports bulk work.

## Success measures

These are proposed release targets, not measured results.

| Measure | Definition | Target and gate |
| --- | --- | --- |
| Access isolation | Unauthorized reads, writes, counts, and derivatives in the adversarial acceptance suite. | Zero leaks at every release. |
| Import accounting | Every discovered item has a success, missing, unsupported, skipped, or failure outcome. | 100% accounted for in M2 fixtures and beta runs. |
| Recovery | Replaying a completed import or crashing a worker produces extra appearances or lost successful items. | Zero such cases in M2 recovery tests. |
| First shared memory | An invited test member imports a ten-photo memory without assistance, sees it become available to the group automatically, and can correct it afterward. | At least 4 of 5 usability participants complete within 10 minutes at M3. |
| Retrieval usefulness | Beta members find an agreed event in the available archive using timeline or search. | At least 80% of a 30-task set at M3. |
| Performance and reliability | Measured service and user-visible budgets. | All production gates in [Test plan](TEST_PLAN.md). |

## Excluded scope

Public profiles, feeds, followers, engagement rankings, advertising, unofficial platform scraping, and automatic server-wide ingestion are excluded. Automatic sharing of member-selected imports within the signed-in group is explicitly included under D14. Perfect recognition and complete reconstruction of missing history are not promises. End-to-end encryption is an unresolved architecture fork, not a property of the proposed server-processing design.

## Traceability to the original brief

Every source section has a planning home and a delivery milestone. These rows record planned coverage, not completion.

| Brief section | Planning home | Milestone |
| --- | --- | --- |
| B01 Product vision | SPEC | M0 |
| B02 Main user experience | SPEC, PRIVACY | M1 through M3 |
| B03 Core navigation | SPEC | M1, M4, M5, M6 |
| B04 Core data concept | CONTRACTS | M0, M1 |
| B05 Import architecture | IMPORTS, ARCHITECTURE | M1, M2 |
| B06 Apple Photos | IMPORTS | M4 |
| B07 Discord | IMPORTS | Export M2, server M4 |
| B08 WhatsApp | IMPORTS | M2 |
| B09 Messenger | IMPORTS | M2 |
| B10 Deduplication | CONTRACTS, TEST_PLAN | Exact M1, perceptual M3 |
| B11 Timestamp reconciliation | CONTRACTS | Basic M1, archive M2 |
| B12 Memory detection | ARCHITECTURE, TEST_PLAN | M3 |
| B13 AI processing pipeline | ARCHITECTURE, PRIVACY | M3, M5, M6 |
| B14 Semantic search | CONTRACTS, TEST_PLAN | M5 |
| B15 Face recognition | PRIVACY, DECISIONS | Optional M5 |
| B16 Memory AI | CONTRACTS, TEST_PLAN | M6 |
| B17 Privacy model | PRIVACY, CONTRACTS | M0 onward |
| B18 Storage | ARCHITECTURE, PRIVACY | M1 |
| B19 Group collaboration | CONTRACTS | M1, M3 |
| B20 Memory structure | CONTRACTS, SPEC | Manual M1, suggestions M3, richer M7 |
| B21 On This Day | SPEC, TEST_PLAN | M3 |
| B22 Year recap | ROADMAP, PRIVACY | M7 |
| B23 Time capsules | CONTRACTS, TEST_PLAN | M7 |
| B24 Provenance | CONTRACTS, IMPORTS | M1, M2 |
| B25 Non-goals | SPEC | All milestones |
| B26 Workstreams | ROADMAP | All milestones |
| B27 Milestones | ROADMAP | M0 through M7 |
| B28 Quality requirements | TEST_PLAN, ARCHITECTURE | All milestones |
| B29 Engineering principle | CONTRACTS | M0 onward |
| B30 Final product goal | ROADMAP, SPEC | M5 through M7 |
