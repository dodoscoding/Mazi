# Mazi product specification

The confirmed product direction is recorded in [PRODUCT.md](../PRODUCT.md) and [D28](DECISIONS.md#app-simplification-14-november-2026). Remaining release details are proposals. This specification reconciles the preserved [original brief](source/PRODUCT_BRIEF.md) with those decisions. Local implementation evidence does not establish production acceptance.

## Product purpose

Mazi helps one invite-only friend group of 8-10 people rediscover shared history from fragmented personal archives. Members sign in; imported material becomes visible to the entire group as it is successfully ingested. Review supports subsequent corrections and organization. Overlapping contributions preserve source evidence without repeated gallery entries.

The core unit is a memory supported by media and historical evidence. An album alone does not describe who shared a photo later, which conversation it appeared in, or why its date is uncertain.

## Users and outcomes

| User | Need | Observable outcome |
| --- | --- | --- |
| Contributor | Recover years of scattered files and messages. | A resumable import lists available media, missing material, and original context. |
| Reviewer | Correct and organize imported history. | Dates, duplicate suggestions, and source context can be inspected and corrected after import; review never gates group visibility. |
| Group member | Rediscover shared history or find a particular moment. | Globe encourages exploration; Photos retrieves individual photographs by month/year and search, with source conversation context. |
| Group administrator | Manage a trusted group. | Invitations expire and membership can be revoked; administrators read the same group archive as other active members. |
| Person appearing in media | Future People features need clear identity and removal rules. | Personal hiding, subject disassociation, and recognition controls remain later proposals to decide before People launches; initial audience controls are deferred. |

## Release boundaries

The first production release is the M3 exit in the [roadmap](ROADMAP.md). M1 is an internal pilot. M2 is a closed beta. D28 replaces the older destination inventory with Globe and Photos, supported by Add and Settings. The original milestone table below is retained for traceability; retired AI/story/capsule creation entries are not current commitments. The current product is a website.

| Capability | First production release | Later delivery |
| --- | --- | --- |
| Accounts and groups | One invite-only friend group of 8-10 people, membership roles, expiring invitations, account recovery. | Growth beyond this cohort is undecided; cross-group discovery remains excluded. |
| Import and review | Manual images and common video formats, resumable transfers, immediate group sharing, post-import review. | Native Apple library access is a deferred M4 proposal requiring new scope approval. |
| Archives | Validated WhatsApp, Messenger, and Discord user-export formats, each with a visible support matrix. | Discord server integration at M4, separately gated. |
| Media identity | Exact duplicate handling, reviewed near-duplicate suggestions, retained variants and provenance. | More expensive video similarity only after a measured need. |
| Memories | Editable date/place facts, reviewed event relationships and the shared viewer. | Historical M7 story/sub-event authoring is retired under D28; eligible stored creations retain reads/deletion. |
| Discovery | Globe/Photos browsing, keyword search, date/source/place filters, source conversations and simple capture-year recap. | Original M4/M5 production gates remain separate; the historical M6 answer proposal is retired under D28. |
| Access | Sign-in and active group membership on every read. All imported content has the same group audience. | Private staging and individual/component audience controls are deferred. Recognition at M5 needs its own decision. |
| Operations | Audit events, export, deletion, recovery drill, quotas, alerts, accessibility, monitored production. | Historical generated recaps/video and capsule creation are retired; existing capsule locks and authorized deletion remain. |

The local event notebook retains previously saved story recollections as reads beside imported chat excerpts. D28 retires its story-writing operation; authorized own-recollection withdrawal is available through Past creations. Independent live conversations retain their separate comments API and ownership rules. The [event notebook decision](DECISIONS.md#event-notebook-decision-23-october-2026) records this owner-approved extension.

Keyword search covers group titles, user captions, and imported source text. It does not promise object recognition. On This Day excludes removed or technically unavailable material and uncertain anniversary dates.

## Primary journeys

The local application uses the owner-approved [D17 entry flow](DECISIONS.md#shared-code-entry-decision-14-october-2026) instead of the production-planning invitation journey below. Friends enter a shared code and unique visible name. Existing names resume immediately. New profiles see the introduction once; returning sessions open Globe and Settings retains replay. D28 relocates retained archive tasks without changing shared-code identity rules.

1. A group creator signs in, creates a private group, and sends a single-use invitation through their chosen channel. The recipient accepts before expiry. An expired or revoked invitation grants nothing.
2. A contributor selects files or an archive and sees the inventory, formats, size, and processing choices. Transfer and background progress survive interruption. Successful items remain reviewable if other items fail.
3. Each successfully ingested item enters the group archive automatically. Import UI explains this before submission and shows per-item progress and failures. The contributor can review dates, duplicates, source context, and warnings afterward; there is no audience selector or Publish action.
4. A member opens a memory through Globe, Photos, Photos search or Annual recap. All active group members can see the same available contributions and their imported context. Deleted, withdrawn, cross-group, or technically unavailable evidence contributes no results or counts.
5. A member contributes a better copy of an existing image. As it becomes available, group-scoped reconciliation can improve the rendition for the whole group while preserving contributed files and origins.
6. A contributor withdraws or deletes a contribution under the proposed lifecycle policy. Future access stops according to the [revocation contract](PRIVACY.md). Independently contributed copies remain, but the removed contributor's context does not.

## Navigation

| Surface | Current responsibility |
| --- | --- |
| Globe | Returning-session landing, place/year exploration and direct opening of the shared viewer. |
| Photos | Individual photographs grouped by month, newest first, year navigation, compact filters, Undated and integrated search. |
| Add | Upload, source connections, progress/history, continuation/recovery and focused duplicate/event correction queues. |
| Settings | Current-circle membership and administration, account, sign-out, export/departure, About/replay and retained discovery/identity/processing preferences. |
| Annual recap | A selected capture year's available photographs, oldest first by month, using the Photos browser and shared viewer. |
| Past creations | Conditional Settings entry to eligible stored stories/capsules with reads, exports and authorized deletion; server capsule locks remain authoritative. |

Search is an action within Photos, not a separate destination. Photograph matches lead; independently eligible source conversations are secondary. Photo-only date/place/label filters must not be represented as matching text-only conversations. Source records require exact identities and bounded current-access reads; [the source contract](CONTRACTS.md#retained-source-conversation-reads) owns limits and continuation behavior.

Standalone Home, Timeline, Memories, Discover, Search, Places & sources, Archive review, Our circle, About and AI destinations leave active navigation. Useful old year/query/filter/photo/record selections translate to the retained task or show an honest unavailable state; identifiers must not be guessed. The approved [simplification specification](APP_SIMPLIFICATION_SPEC.md) owns the final route compatibility work, tracked in [PR #161](https://github.com/dodoscoding/Mazi/pull/161).

The viewer shows the complete photograph first, with previous/next navigation. Conversation context, facts, corrections, sources and contribution actions are contextual. Back/Escape returns to the originating view, filters, position and opener. Photos chronology may use resolved sharing evidence with an explicit label; Annual recap requires reliable capture-year evidence and excludes unknown, ambiguous or conflicting capture evidence.

## Product rules

- Import automatically shares each successfully ingested item with the group, including available context and metadata. Technical processing is not a human publication gate.
- Current active group membership governs previews, originals, context, location, identities, memory metadata, and discovery. Individual audience controls are deferred.
- A memory and its children must belong to the same group; hierarchy cannot expose withdrawn, deleted, or cross-group content.
- Source dates and capture dates remain separate. A guessed capture date remains visibly uncertain.
- Approximate duplicate and event suggestions require review. Rejection and undo remain available.
- Retained optional local discovery processing requires explicit existing consent; recognition and external providers stay disabled. Answer generation and its consent writes return 410 through the application API. Basic archiving and source reads do not require answer consent.
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
| Retrieval usefulness | Beta members find an agreed event in the available archive using Photos browsing or search. | At least 80% of a 30-task set at M3. |
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

## Historical independent group plans increment

The P1 delivery introduced photo-independent plans and attendance with bounded reads, transactional retries, membership cleanup and authored export. Its API and ownership contract remains in [Contracts](CONTRACTS.md#group-plans-and-attendance-api). Earlier Grubumuz/Ekle entry points are historical under D28; they do not add another primary destination or override the final simplification specification. Stored plan data is not purged by navigation retirement. The five-friend task tour and physical-phone acceptance remain separate.

## Native conversations backend

The C1 comments backend gives each permanent photo and fully visible approved memory its own flat conversation. A member may write separate messages, edit their own message with version checks or remove it. Creation time belongs to the server and remains unchanged when text is edited. Lists page by creation time and stable identity. Current target visibility, active authors, request replay and deletion tombstones apply consistently to text, totals and authored export.

[The comment API](CONTRACTS.md#photo-and-approved-memory-comments-api) is implemented for SQLite and hosted PostgreSQL. [The privacy policy](PRIVACY.md#native-conversation-contributions) distinguishes current-ledger restoration checks from a full stale-backup recovery guarantee. Historical notebook recollections remain readable; D28 retires their authoring and retains authorized withdrawal. The lazy [conversation interface](CONTRACTS.md#conversation-interface) implements separate photo/memory comments, reactions and in-memory retryable drafts. The social Home delivery record is historical under D28; it does not create another active primary destination.

## Native reactions backend

The C1 backend lets a current member set or remove a reaction from the closed set `👍`, `❤️`, `😂`, `🎉` on a visible permanent photo, approved memory or native comment. It returns current counts, the member's own state and bounded current member-name lists. Desired-state writes and retained request receipts prevent duplicate taps and delayed retries from changing a later choice.

[The reaction API](CONTRACTS.md#native-reactions-api) includes a bounded, fully authorized batch read for conversation pages. SQLite and hosted storage enforce uniqueness, group relationships, departure cleanup and comment-delete cascades. Reaction tombstones suppress stale rows while the current deletion ledger is retained. Authored export participates in the existing final admission checks. Historical notebook reads and imported source reactions remain preserved under D28. Browser controls use one bounded batch for the visible comment page and preserve exact retry identity. The social Home delivery record is historical under D28; it does not create another active primary destination.

## Manual photo declarations backend

The F1 backend adds independent human-presence, screenshot and AI-use declarations to permanent photo IDs. Old data defaults to unknown. It separates effective presence derived from permitted confirmed people from a member's own declaration, version and attribution. It does not infer labels from source names, image size or automatic recognition.

[The bounded labels API](CONTRACTS.md#photo-declarations-api) supports current reads and all-or-nothing corrections of at most 50 photographs. Each changed dimension requires its expected revision. Clear and departure cleanup advance retained versions, request replay cannot restore older values, and authored export participates in the existing final admission check. SQLite and hosted schemas enforce group relationships and update discovery generations. Atlas payloads and Search predicates are not changed by this backend slice. Contextual label editors, badges and combined Photos filters reuse these contracts; [Photos/search evidence](APP_SIMPLIFICATION.md#implementation-status) records synthetic delivery.

## Historical social Home backend and retained selected detail

The H1 read API highlights a current upcoming plan, otherwise the latest visible conversation, otherwise one authorized photo. It returns at most three real actions and supports a first plan with an empty archive. Social action timestamps remain separate from photo capture/share evidence. The private activity list uses stable time/identity cursors and current actor, source, hide and deletion rules.

[The bounded read contract](CONTRACTS.md#bounded-social-home-and-activity-reads) limits source candidates, metadata and preview size. It stores no copied feed and does not load full Atlas to produce a summary. A separate selected-memory endpoint reuses the Atlas projector for a selected asset set, preserving permanent photo links, evidence, source fingerprints and compact labels. The lazy frontend adopts these reads: initial Home and direct photo detail make zero full Atlas/notebook requests. The [interface contract](CONTRACTS.md#social-landing-and-selected-detail-interface) and synthetic two-session evidence cover empty planning, attendance, real photo intake, conversations, reactions and next-day return. Physical-device and friend-study acceptance remain separate.
