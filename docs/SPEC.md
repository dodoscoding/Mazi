# Mazi product specification

Status is proposed. The user confirmed a small team targeting production launch. This specification translates the [original brief](source/PRODUCT_BRIEF.md) into release scope. It does not claim that any feature exists.

## Product purpose

Mazi reconstructs a group's history from fragmented personal archives. A member imports selected material, reviews it privately, and chooses what to share. Other members contribute overlapping evidence without creating repeated gallery entries or exposing private conversations.

The core unit is a memory supported by media and historical evidence. An album alone does not describe who shared a photo later, which conversation it appeared in, or why its date is uncertain.

## Users and outcomes

| User | Need | Observable outcome |
| --- | --- | --- |
| Contributor | Recover years of scattered files and messages. | A resumable import lists available media, missing material, and original context. |
| Reviewer | Decide what friends may see. | A preview shows the selected audience and independently selected metadata before publication. |
| Group member | Find a shared trip or moment. | Timeline and search return authorized media with capture dates and source history. |
| Group administrator | Manage a trusted group. | Invitations expire, membership can be revoked, and private staging remains inaccessible to administrators. |
| Person appearing in media | Control identity associations and unwanted resurfacing. | Members can personally hide media and disassociate manual or recognized tags; nonmembers have a private request path. Recognition has a separate consent gate. |

## Release boundaries

The first production release is the M3 exit in the [roadmap](ROADMAP.md). M1 is an internal pilot. M2 is a closed beta. The long-term six-area navigation remains the destination.

| Capability | First production release | Later delivery |
| --- | --- | --- |
| Accounts and groups | Invite-only groups, membership roles, expiring invitations, account recovery. | Cross-group discovery remains excluded. |
| Import and review | Manual images and common video formats, resumable transfers, private staging, explicit publication. | Native Apple library access at M4. |
| Archives | Validated WhatsApp, Messenger, and Discord user-export formats, each with a visible support matrix. | Discord server integration at M4, separately gated. |
| Media identity | Exact duplicate handling, reviewed near-duplicate suggestions, retained variants and provenance. | More expensive video similarity only after a measured need. |
| Memories | Manual memories, manual sub-events, editable date and place, reviewed event suggestions. | Richer automatic hierarchy and collaborative stories at M7. |
| Discovery | Timeline, keyword search, date/source/place filters, basic Today, approved On This Day. | Map at M4, multimodal search and People at M5, Memory AI at M6. |
| Privacy | Private, selected-member, and group audiences; separate control of context, location, and identity display. | Face recognition at M5 only after consent and removal gates pass. |
| Operations | Audit events, export, deletion, recovery drill, quotas, alerts, accessibility, monitored production. | Generated recaps, video, and capsules at M7. |

Keyword search covers authorized titles, user captions, and explicitly shared source text. It does not promise object recognition. On This Day excludes staged material and uncertain anniversary dates.

## Primary journeys

1. A group creator signs in, creates a private group, and sends a single-use invitation through their chosen channel. The recipient accepts before expiry. An expired or revoked invitation grants nothing.
2. A contributor selects files or an archive and sees the inventory, formats, size, and processing choices. Transfer and background progress survive interruption. Successful items remain reviewable if other items fail.
3. The contributor reviews dates, duplicates, source context, and warnings. Publication defaults to no shared context or precise location. The contributor selects recipients and confirms the share preview.
4. A member opens a memory through Today, Timeline, or Search. The member sees only authorized media and evidence. Source badges and participant counts exclude hidden contributions.
5. A member contributes a better copy of an existing image. Private staging does not change the group's image. After publication, eligible viewers see the best authorized rendition and can inspect permitted origins.
6. A contributor revokes sharing or deletes a contribution. Future access stops according to the [revocation contract](PRIVACY.md). Independently contributed copies remain, but the removed contributor's context does not.

## Navigation

| Area | Responsibility | First milestone |
| --- | --- | --- |
| Today | Recent approved memories, own review queue, approved On This Day. | Basic M1, anniversary feature M3. |
| Timeline | Year, month, day, memory, sub-event, and media exploration. Unknown dates remain in an explicit undated view. | M1, scale work M3. |
| Map | Authorized places, area filters, and travel history. A media item without shared location contributes no point. | M4. |
| Search | Keyword and structured filters first; later combined visual, text, person, and place retrieval. | M1, archive text M2, semantic M5. |
| People | Confirmed visible associations, shared memories, and places. No popularity scores or competitive rankings. | M5. |
| Memory AI | Answers from authorized evidence with citations and uncertainty. | M6. |

Unavailable areas are omitted from the shipped navigation. Import review and group settings are supporting routes, not additional primary destinations.

## Product rules

- Import never publishes content. Background processing never broadens an audience.
- Viewing a photo does not grant its original file, embedded GPS, source text, or person associations.
- A memory is a container, not an access grant for its children.
- Source dates and capture dates remain separate. A guessed capture date remains visibly uncertain.
- Approximate duplicate and event suggestions require review. Rejection and undo remain available.
- AI processing requires an explicit choice and is independently disableable. Basic archiving works without it.
- Imported archive coverage is partial until demonstrated otherwise. Empty search results do not prove an event never happened.
- Nonmembers in messages or images are not silently turned into searchable identified people.
- Personal hiding affects the member's own discovery. Subject disassociation removes manual and recognized identity links without deleting another contributor's independent media.

## Success measures

These are proposed release targets, not measured results.

| Measure | Definition | Target and gate |
| --- | --- | --- |
| Access isolation | Unauthorized reads, writes, counts, and derivatives in the adversarial acceptance suite. | Zero leaks at every release. |
| Import accounting | Every discovered item has a success, missing, unsupported, skipped, or failure outcome. | 100% accounted for in M2 fixtures and beta runs. |
| Recovery | Replaying a completed import or crashing a worker produces extra appearances or lost successful items. | Zero such cases in M2 recovery tests. |
| First shared memory | An invited test member imports, reviews, and publishes a ten-photo memory without assistance. | At least 4 of 5 usability participants complete within 10 minutes at M3. |
| Retrieval usefulness | Beta members find an agreed event in the available archive using timeline or search. | At least 80% of a 30-task set at M3. |
| Performance and reliability | Measured service and user-visible budgets. | All production gates in [Test plan](TEST_PLAN.md). |

## Excluded scope

Public profiles, feeds, followers, engagement rankings, advertising, unofficial platform scraping, automatic server-wide ingestion, and automatic publication are excluded. Perfect recognition and complete reconstruction of missing history are not promises. End-to-end encryption is an unresolved architecture fork, not a property of the proposed server-processing design.

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
