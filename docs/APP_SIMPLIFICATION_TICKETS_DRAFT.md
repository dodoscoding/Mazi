# Mazi simplification published ticket breakdown

Parent: [spec #146](https://github.com/dodoscoding/Mazi/issues/146).

Status: approved and published on 14 November 2026. All 13 tickets are GitHub
sub-issues of #146, labeled `ready-for-agent`, with 15 verified native blocking
relationships. The parent body, title, and open state are unchanged. Numbers
01–13 below identify the approved breakdown order; linked issue numbers are
GitHub identifiers. Application implementation has not started.

Initial unblocked tickets: [viewer #147](https://github.com/dodoscoding/Mazi/issues/147),
[Add #151](https://github.com/dodoscoding/Mazi/issues/151), and
[Settings #155](https://github.com/dodoscoding/Mazi/issues/155).

Use integrated desktop/phone Playwright journeys as the primary acceptance
boundary and existing targeted HTTP contracts where required by the parent
spec. Each slice owns its behavioral tests, applicable loading/error/access
states, and safe extraction of shared functionality. No table drops, archive
purge, backend rewrite, or deployment is included.

The initial viewer slice is a behavioral prefactor delivered through the
existing interface. Add and Settings can start independently. All old
capabilities must retain a working route while their replacements are built.
Annual recap and contextual corrections do not gate the navigation switch:
they are still required before the parent specification can be considered done.

## 01: Open photographs in one viewer and restore the originating view

**Published issue:** [#147](https://github.com/dodoscoding/Mazi/issues/147).

**What to build:** From the existing Globe and browse flows, open the selected photograph directly in the shared viewer and return to the exact prior browsing state. This is the initial behavioral prefactor that makes later Photos, search, and recap work reuse one proven path.

**Blocked by:** None (can start immediately).

**Parent user stories:** 12, 13, 14, 15, 16, 17, 18, 19.

**Status:** ready-for-agent.

### Acceptance criteria

- [ ] Opening a photograph retains its identifier and selected photo index and shows the whole image with previous/next controls.
- [ ] Available Conversation context and date/place/source evidence remain accessible without dominating the photograph.
- [ ] Back, close, and Escape restore the originating view, selection, filters, and position rather than always returning to Globe.
- [ ] Globe retains its visual world, optional sound, reduced-motion behavior, and conventional fallback; eliminate any redundant preview step before photo opening.
- [ ] Unavailable content and access/session loss produce a clear state without stale evidence or media.
- [ ] Demonstrate this behavior through the existing integrated desktop/phone app tests, including keyboard and reduced-motion cases.

## 02: Browse individual photographs by month in Photos

**Published issue:** [#148](https://github.com/dodoscoding/Mazi/issues/148).

**What to build:** Provide a working Photos destination for the same available archive as Globe, showing individual photographs by month with year navigation and compact filtering. Selecting a photograph uses the shared viewer and returns to the same browse position.

**Blocked by:** [#147](https://github.com/dodoscoding/Mazi/issues/147).

**Parent user stories:** 2, 3, 6, 7, 8, 9, 10, 11, 50.

**Status:** ready-for-agent.

### Acceptance criteria

- [ ] Photos is reachable from Globe while existing supporting workflows remain usable during the transition.
- [ ] Individual photographs appear in month groups, newest first, without a By moment / All photos choice.
- [ ] A year picker and compact filters work against available archive content and survive opening/closing a photograph.
- [ ] Unknown or unreliable dates remain accessible through Undated or an explicit uncertainty presentation; sharing evidence never silently becomes capture evidence.
- [ ] Globe and Photos respect the same current-circle and withdrawal/access rules.
- [ ] Loading, empty, failed, and unavailable states provide clear next actions.
- [ ] Integrated desktop/phone tests demonstrate grouping, filters, uncertainty, selected-photo opening, and return state.

## 03: Search photographs and conversations within Photos

**Published issue:** [#149](https://github.com/dodoscoding/Mazi/issues/149).

**What to build:** Make search reachable from Globe and Photos, show photograph results first and matching conversations second, and let text-only conversations open their actual source context without requiring an associated photograph.

**Blocked by:** [#148](https://github.com/dodoscoding/Mazi/issues/148).

**Parent user stories:** 21, 22, 23, 24, 25, 26.

**Status:** ready-for-agent.

### Acceptance criteria

- [ ] Search opens within Photos and preserves the query and applicable structured filters through result opening and return.
- [ ] Photograph results use the shared viewer with the correct selected photograph.
- [ ] Secondary conversation results include available conversations with no photographs and open trustworthy source context.
- [ ] Keyword/filter retrieval works without generating an AI answer or adding an AI fallback prompt.
- [ ] Empty/error/loading states remain clear, and inaccessible or withdrawn results/context do not appear.
- [ ] Retain source-context rendering needed by search before AI-specific evidence presentation is retired.
- [ ] Integrated desktop/phone tests cover both photo and conversation-only retrieval with retained state and access denial.

## 04: Revisit a selected year through a simple Annual recap

**Published issue:** [#150](https://github.com/dodoscoding/Mazi/issues/150).

**What to build:** From a year card in Photos, revisit that year's available photographs chronologically by month using the same browser and viewer.

**Blocked by:** [#148](https://github.com/dodoscoding/Mazi/issues/148).

**Parent user stories:** 38, 39, 40, 41.

**Status:** ready-for-agent.

### Acceptance criteria

- [ ] The Annual recap includes the selected year's eligible available photographs and orders them oldest first within chronological month groups.
- [ ] Reliable capture-year attribution governs inclusion; unknown/conflicting years do not enter the recap through guessed dates or substituted sharing dates.
- [ ] Excluded uncertain photographs remain accessible in normal Photos browsing.
- [ ] Opening/closing a recap photograph restores the year and recap position.
- [ ] Do not add a manual publication/review gate, generated highlights, narration, editor, or video workflow.
- [ ] Integrated desktop/phone tests demonstrate year eligibility, ordering, access filtering, empty years, and viewer return.

## 05: Import and recover contributions through Add

**Published issue:** [#151](https://github.com/dodoscoding/Mazi/issues/151).

**What to build:** Provide a working Add destination where a contributor uploads an existing supported archive, follows progress/history, and uses retained failure recovery while successful items become shared automatically.

**Blocked by:** None (can start immediately).

**Parent user stories:** 27, 28, 29, 30.

**Status:** ready-for-agent.

### Acceptance criteria

- [ ] Existing supported uploads, inventory/start flow, progress, history, cancellation, reports, and recovery actions work in Add.
- [ ] Successful ingestion shares available items automatically with the active circle; review does not become a publish gate.
- [ ] Moving the workspace preserves existing worker/visibility, session validation, cancellation, and access-loss contracts without promising continuation through new conditions.
- [ ] A completed import becomes visible in the existing Globe/archive browsing flow.
- [ ] Introduce Add alongside remaining legacy capabilities where necessary; do not remove membership/source/review functions before their replacements exist.
- [ ] Integrated desktop/phone import tests and focused existing HTTP recovery contracts verify the relocated workflow.

## 06: Connect sources and inspect transfer outcomes inside Add

**Published issue:** [#152](https://github.com/dodoscoding/Mazi/issues/152).

**What to build:** Manage existing supported source connections and inspect transfer outcomes within Add, without detouring through Places & sources.

**Blocked by:** [#151](https://github.com/dodoscoding/Mazi/issues/151).

**Parent user stories:** 27, 29.

**Status:** ready-for-agent.

### Acceptance criteria

- [ ] Retained connection, disconnection, permission, transfer, failure, and recovery actions are available in Add for already-supported sources.
- [ ] Connection state and transfer outcomes use the same current circle as imports.
- [ ] Place exploration continues through Globe and is not duplicated as a source-management map.
- [ ] Preserve source evidence and existing contribution/withdrawal semantics while moving controls.
- [ ] No new source provider, format support, or authentication model is introduced.
- [ ] Integrated desktop/phone tests cover an existing connection/transfer path plus denied access and recoverable failure using synthetic fixtures.

## 07: Correct photograph metadata and manage contributions from the viewer

**Published issue:** [#153](https://github.com/dodoscoding/Mazi/issues/153).

**What to build:** Let an authorized member correct dates/places and use retained contribution-removal actions alongside the opened photograph, with changes reflected in the archive.

**Blocked by:** [#147](https://github.com/dodoscoding/Mazi/issues/147).

**Parent user stories:** 20, 53.

**Status:** ready-for-agent.

### Acceptance criteria

- [ ] Applicable date and place corrections are discoverable from the shared viewer and preserve original assertions, source evidence, and visible uncertainty.
- [ ] Authorized contribution-removal actions remain discoverable from the viewer; independent eligible contributions retain their existing behavior.
- [ ] Saved corrections affect existing archive views through their ordinary refresh/update contracts.
- [ ] Withdrawal removes the withdrawn contribution and its context from subsequent reads while preserving independent eligible copies.
- [ ] Access, ownership, rejected writes, failure recovery, and unavailable-record states remain enforced.
- [ ] Integrated viewer tests and targeted existing HTTP contracts demonstrate correction, withdrawal, and denied operations; later Photos/search/recap tickets inherit these domain rules.

## 08: Resolve duplicate and event suggestions in Add

**Published issue:** [#154](https://github.com/dodoscoding/Mazi/issues/154).

**What to build:** Provide focused duplicate and event-suggestion queues in Add, preserving review decisions and available rejection/undo behavior without the broad Archive review destination.

**Blocked by:** [#151](https://github.com/dodoscoding/Mazi/issues/151).

**Parent user stories:** 31, 32.

**Status:** ready-for-agent.

### Acceptance criteria

- [ ] Contributors can find, inspect, and resolve the existing supported duplicate and event suggestions in Add.
- [ ] Existing decisions, evidence, rejection, and available undo behavior survive the move.
- [ ] The queue provides meaningful empty, loading, failed, and access-denied states.
- [ ] Review remains post-import correction and never gates automatic group visibility.
- [ ] Keep export, departure, and individual photograph editing in their agreed homes rather than rebuilding a second timeline within Add.
- [ ] Integrated desktop/phone tests verify a complete suggestion decision and recovery/undo where already supported, with focused HTTP access checks.

## 09: Manage circle membership and account information in Settings

**Published issue:** [#155](https://github.com/dodoscoding/Mazi/issues/155).

**What to build:** Provide Settings with existing circle/member administration, account/sign-out controls, About, and introduction replay while preserving first-time onboarding and one consistent current-circle context.

**Blocked by:** None (can start immediately).

**Parent user stories:** 33, 34, 35, 36, 54.

**Status:** ready-for-agent.

### Acceptance criteria

- [ ] Settings exposes retained member information and only the membership actions allowed by the current role.
- [ ] Account and sign-out behavior works without changing shared-code entry or profile identity rules.
- [ ] About and introduction replay are accessible within Settings; new-profile onboarding remains intact.
- [ ] Use one current-circle context without repeating selectors across migrated surfaces; retain any necessary management choice within Settings.
- [ ] Existing legacy entry points remain usable until the final navigation switch.
- [ ] Integrated desktop/phone tests demonstrate member access, applicable role restrictions, sign-out, onboarding/replay, and session-loss cleanup.

## 10: Export, withdraw, and manage discovery preferences in Settings

**Published issue:** [#156](https://github.com/dodoscoding/Mazi/issues/156).

**What to build:** Complete Settings with retained archive export, contribution/departure controls, and applicable discovery/identity/processing preferences so Archive review and Discover can retire safely.

**Blocked by:** [#155](https://github.com/dodoscoding/Mazi/issues/155).

**Parent user stories:** 34, 37, 53.

**Status:** ready-for-agent.

### Acceptance criteria

- [ ] Archive export remains explicit and includes only currently accessible eligible originals, context, and evidence under existing limits.
- [ ] Applicable contribution-management and departure actions are discoverable in Settings and preserve existing withdrawal/ownership behavior.
- [ ] Retained discovery, identity, and processing choices remain usable without enabling recognition or new processing by default.
- [ ] Access or session loss prevents further reads/exports/mutations and clears unavailable content.
- [ ] Settings handles empty, failed, cancelled, and denied operations clearly.
- [ ] Integrated desktop/phone tests and targeted existing HTTP/domain checks demonstrate export, retained preferences, and withdrawal/departure behavior.

## 11: Preserve Past creations and retire story and capsule writing

**Published issue:** [#157](https://github.com/dodoscoding/Mazi/issues/157).

**What to build:** Expose existing stories and capsules under Settings / Past creations with reading and authorized deletion, and remove their creation/editing workflows throughout the app and its API.

**Blocked by:** [#155](https://github.com/dodoscoding/Mazi/issues/155).

**Parent user stories:** 42, 43, 44, 45, 46, 47.

**Status:** ready-for-agent.

### Acceptance criteria

- [ ] Past creations appears only when the member has eligible existing content; matching existing story/capsule links reach that record.
- [ ] Existing stories and unlocked capsules remain readable under current membership and ownership rules.
- [ ] Sealed capsules remain unreadable before their existing server opening times, including to their authors and through read/export/media operations.
- [ ] Existing authorized deletion remains available; unauthorized read/delete operations remain denied.
- [ ] Story/capsule creation and editing stop working through direct application API calls as well as removed forms, buttons, and prompts.
- [ ] Retire generated-story media workflows without dropping stored content, original media, required read/unlock/delete behavior, or ordinary archive export.
- [ ] Extract retained creation-independent readers before removing the old combined presentation; do not break the still-used photo grid.
- [ ] Integrated desktop/phone tests plus existing HTTP capsule/ownership contracts cover empty/eligible content, unlocking, deletion, and retired writes.

## 12: Retire AI answers while retaining archive source access

**Published issue:** [#158](https://github.com/dodoscoding/Mazi/issues/158).

**What to build:** Remove Ask your archive and AI generation from active use while preserving conversation/source retrieval and honest behavior for old Ask/evidence links.

**Blocked by:** [#149](https://github.com/dodoscoding/Mazi/issues/149).

**Parent user stories:** 26, 47, 49.

**Status:** ready-for-agent.

### Acceptance criteria

- [ ] No active AI answer page, generation controls, prompts, fallback cards, or generation dispatch remains in the member journey.
- [ ] Direct application API calls cannot trigger retired answer generation.
- [ ] Old Ask links reach Photos search with a clear feature-retired state rather than a fabricated answer.
- [ ] Old evidence links reach available source context only when their identifiers support a trustworthy mapping; otherwise show an honest unavailable/retired state.
- [ ] Photograph evidence and conversation-only search continue to work under current access rules.
- [ ] Remove only unused AI-specific presentation/runtime dependencies; do not purge archive evidence or rewrite shared retrieval infrastructure.
- [ ] Integrated search/old-link tests plus targeted HTTP retirement and denial checks demonstrate the result.

## 13: Switch to the final navigation and retire remaining duplicate destinations

**Published issue:** [#159](https://github.com/dodoscoding/Mazi/issues/159).

**What to build:** Present Globe and Photos as the primary views with Add and Settings supporting them, remove the remaining duplicate destinations, and preserve useful old links across desktop and phone.

**Blocked by:** [#149](https://github.com/dodoscoding/Mazi/issues/149), [#152](https://github.com/dodoscoding/Mazi/issues/152), [#154](https://github.com/dodoscoding/Mazi/issues/154), [#156](https://github.com/dodoscoding/Mazi/issues/156), [#157](https://github.com/dodoscoding/Mazi/issues/157), [#158](https://github.com/dodoscoding/Mazi/issues/158).

**Parent user stories:** 1, 4, 5, 48, 49, 50, 51, 52, 54.

**Status:** ready-for-agent.

### Acceptance criteria

- [ ] Returning sessions open Globe; desktop and phone offer clear Globe, Photos, Add, and Settings access with easy search.
- [ ] Standalone Timeline, Memories, Discover, Search, Places & sources, Archive review, Our circle, About, and AI destinations disappear from active navigation.
- [ ] Translate retained legacy tasks and record/year/query/filter selections to their working new homes; ambiguous or unavailable identifiers get clear states rather than guessed mappings.
- [ ] Remove redundant More/Archive tools inventories, per-surface circle selectors, and obsolete compositions/styles only after their retained responsibilities are in use elsewhere.
- [ ] Preserve the completed viewer, Add, Settings, source/context, Past creations, entry, and existing accessibility behavior during the switch.
- [ ] Each contributing slice has desktop/phone and applicable denial/recovery coverage; this ticket checks cross-destination navigation and old-link compatibility rather than replacing those tests.
- [ ] Reconcile product/specification/roadmap/interaction records with D28 while preserving historical traceability, and record screenshots plus exact validation evidence.
- [ ] Do not deploy, purge content, change storage formats, or modify/close the parent issue as part of this ticket.

