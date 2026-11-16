# Mazi app simplification specification

Published as [GitHub issue #146](https://github.com/dodoscoding/Mazi/issues/146)
with the `ready-for-agent` label on 14 November 2026.

## Problem Statement

Mazi should help one circle of friends relive shared history in a simple but fun way. Instead, members encounter overlapping Home, Timeline, Memories, Discover, and Search experiences, alongside places, sources, review, membership, AI answers, stories, and capsules. Members must understand the application's feature inventory before they can revisit a photograph.

The owner wants the playful globe to remain the front door, with an easy conventional Photos view. Simplification must preserve photographs, conversation context, sources, import recovery, corrections, membership controls, and previously created stories and capsules.

## Solution

Provide two primary views of the same archive: **Globe** and **Photos**, supported by **Add** and **Settings**.

- Globe opens by default and retains the existing visual character, optional sound, reduced-motion support, and conventional access to content.
- Photos displays individual photographs grouped by month, newest first, with year navigation, an explicit Undated section, search, and compact filters.
- One shared viewer opens photographs directly from either view, search, or a recap. It shows the entire photograph, supports previous/next navigation, and provides optional conversation context, source evidence, date/place information, and contextual corrections. Returning restores the originating view and browsing state.
- Search is easy to reach from either primary view. Results appear within Photos, with photographs first and matching conversations as secondary results. Conversations without photographs remain searchable and readable.
- Add contains imports, source connections, import progress and history, failure recovery, and focused correction queues.
- Settings contains circle members, account controls, archive export, departure, About, introduction replay, applicable discovery/processing preferences, and Past creations when existing content is available.
- An **Annual recap** is a simple year in photos, arranged chronologically by month using the same browser and viewer.
- Retire AI answers, collaborative-story creation/editing, and time-capsule creation. Preserve existing stories and capsules under **Past creations**, including existing access, ownership, deletion, and capsule opening-time rules.

Remove the competing standalone destinations and relocate their retained functions before deleting their obsolete presentations.

## User Stories

1. As a returning circle member, I want Mazi to open on Globe, so that revisiting our history feels playful and familiar.
2. As a circle member, I want Photos to be easy to reach from Globe, so that I can browse without manipulating a globe.
3. As a circle member, I want Globe and Photos to show the same available archive, so that switching views does not change what history I can access.
4. As a circle member, I want a short, consistent navigation with Globe and Photos leading and Add and Settings supporting them, so that I can understand the app quickly.
5. As a phone user, I want the same essential activities available in a compact navigation, so that I can use the archive comfortably on a small screen.
6. As a circle member, I want Photos to show individual photographs, so that I do not have to choose between moments, albums, and all-photo modes.
7. As a circle member, I want photographs grouped by month and ordered newest first, so that I can orient myself quickly.
8. As a circle member, I want to select a year, so that I can revisit a particular period without scrolling through the whole archive.
9. As a circle member, I want photographs without reliable dates to remain accessible in an Undated section, so that missing metadata does not hide my history.
10. As a circle member, I want uncertainty and conflicting dates to stay visible, so that the app does not imply that guesses are facts.
11. As a circle member, I want compact filters in Photos, so that I can narrow the archive without a permanent wall of controls.
12. As a circle member, I want selecting a photograph to open it directly, so that I can relive the moment with few steps.
13. As a circle member, I want the same viewer from Globe, Photos, search, and Annual recaps, so that I only need to learn one way of opening photographs.
14. As a circle member, I want the whole photograph visible when opened, so that the viewer does not crop out important details.
15. As a circle member, I want previous and next controls in the viewer, so that I can continue browsing without repeatedly closing it.
16. As a circle member, I want closing the viewer to restore my originating view, selection, filters, and position, so that I can continue where I left off.
17. As a circle member, I want relevant Conversation context available inside the viewer, so that a photograph retains the history of how it was shared.
18. As a circle member, I want Conversation context to be optional to expand, so that photographs remain the focus of everyday browsing.
19. As a circle member, I want to inspect date, place, and source evidence when needed, so that I can understand the photograph's context and uncertainty.
20. As a contributor, I want applicable date and place corrections available alongside the photograph, so that I do not need a separate review destination to fix one item.
21. As a circle member, I want search reachable from Globe and Photos, so that I can find a specific memory without navigating to another product area.
22. As a circle member, I want search results inside Photos with photographs leading, so that deliberate retrieval uses the same browsing experience.
23. As a circle member, I want matching conversations listed as secondary search results, so that our written history remains discoverable.
24. As a circle member, I want to open a conversation result with no photograph, so that text-only history remains accessible.
25. As a circle member, I want conversation-only results to open their actual source context, so that the app does not invent a photograph or association.
26. As a circle member, I want search to work without AI answer generation, so that finding existing archive content stays straightforward.
27. As a contributor, I want one Add area for uploads and source connections, so that bringing history into Mazi has one obvious home.
28. As a contributor, I want import progress and history in Add, so that I can understand what has arrived and what remains.
29. As a contributor, I want import failures and recovery actions to remain available, so that simplifying pages does not make interrupted imports harder to finish.
30. As a contributor, I want successfully ingested items to become shared automatically, so that corrections do not become a publication gate.
31. As a contributor, I want focused duplicate and event-suggestion queues in Add, so that archive maintenance remains possible without another broad browsing page.
32. As a contributor, I want retained review decisions and available undo behavior to survive relocation, so that a navigation change does not discard previous work.
33. As a circle member, I want member information and applicable membership controls in Settings, so that group administration has one predictable home.
34. As a circle member, I want account, sign-out, archive export, and departure controls in Settings, so that I can manage my participation without searching several pages.
35. As a circle member, I want About and introduction replay in Settings, so that help and product context remain available without separate destinations.
36. As a new profile, I want the existing first-time introduction preserved, so that simplification does not remove onboarding.
37. As a circle member, I want applicable discovery and processing preferences retained in Settings, so that consolidating discovery does not remove my existing choices.
38. As a circle member, I want an Annual recap for a selected year, so that I can revisit that period as a simple year in photos.
39. As a circle member, I want an Annual recap ordered chronologically by month, so that the year reads as a journey.
40. As a circle member, I want Annual recaps to use the ordinary browser and viewer, so that I do not need a separate editing or presentation workflow.
41. As a circle member, I want photographs with unknown or conflicting capture years kept out of an Annual recap until the year is reliable, so that the recap does not invent chronology.
42. As a member with an existing collaborative story, I want to read it under Past creations, so that retiring story creation does not erase earlier contributions.
43. As a member with an existing time capsule, I want it retained under Past creations, so that retiring capsule creation does not discard its content.
44. As a capsule author or reader, I want a sealed capsule to remain unreadable before its existing opening time, so that relocation does not break its original promise.
45. As an authorized owner, I want the existing deletion controls for retained creations, so that I retain control over content I previously created.
46. As a member with no eligible existing stories or capsules, I want Past creations omitted, so that empty legacy features do not add clutter.
47. As a circle member, I want retired AI, story-writing, and capsule-creation controls removed, so that the app consistently presents its simpler purpose.
48. As a person following an old link, I want to reach the retained content or its new home, so that navigation changes do not unnecessarily break access.
49. As a person following a retired or ambiguous link, I want a clear unavailable or retired state, so that the app does not silently open unrelated content.
50. As a circle member, I want loading, empty, failed, and unavailable states to explain what I can do next, so that a simpler interface remains understandable when something goes wrong.
51. As a keyboard or reduced-motion user, I want the complete browse, search, viewer, and small-import journey to remain usable, so that the visual experience does not prevent access.
52. As a circle member, I want session loss, denied access, withdrawal, and deletion respected across views, search, recaps, Past creations, and export, so that the simpler interface preserves the archive's existing access rules.
53. As a contributor, I want retained contribution-removal actions discoverable in the viewer or Settings, so that retiring Archive review does not remove my existing control over sharing.
54. As a circle member, I want my current circle used consistently without repeated selectors on every screen, so that navigation feels like one coherent archive.

## Implementation Decisions

- Retain the current React/TypeScript interface, Python archive domains, shared-code entry, existing storage compatibility, and current hosting arrangement. This is consolidation of the current app.
- Recompose the shared shell and route registry around Globe and Photos, with Add and Settings as supporting surfaces. Remove Archive tools and the long list of independent destinations.
- Replace separate Timeline and Memories compositions with Photos. Reuse the existing archive projection, photograph grid, filtering helpers, and chronology behavior where their external contracts fit.
- Remove the By moment / All photos browsing choice. Photos consistently represents individual photographs grouped by month, with newest-first default ordering, year navigation, and an explicit Undated section.
- Retain the distinction between capture chronology and sharing chronology. Sharing evidence must not silently become an asserted capture date or qualify an uncertain photograph for a capture-year recap.
- Retain Globe's established visual world, optional sound, reduced-motion behavior, and equivalent conventional access. Remove a redundant preview presentation if it imposes an extra step before opening a photograph.
- Reuse one canonical photograph viewer/detail flow. Opening must retain the selected photograph; closing must return to the originating Globe, Photos, search, or recap state rather than always returning to Globe.
- Keep source evidence and Conversation context accessible in the viewer. Reuse available source-context rendering for conversation-only search results without inventing a photo relationship.
- Integrate existing keyword search and structured filters into Photos. Retire Discover-only composition and AI calls to action. Preserve the ordinary archive retrieval capability.
- Assemble Add from retained import, source-connection, transfer, recovery, duplicate-review, and event-review capabilities. Preserve existing progress, cancellation, continuation, and access-loss behavior rather than introducing new guarantees.
- Keep successful ingestion automatically shared with the active circle. Review is correction and organization after availability.
- Move individual date/place edits and applicable contribution actions into the viewer. Place archive-wide export, departure, account, and membership administration in Settings.
- Preserve existing discovery, identity, and processing preferences in Settings where still applicable. Consolidation does not authorize enabling recognition or new processing.
- Define Annual recap as the selected year's dated photographs, ordered oldest first and grouped by month. Enter through a year card in Photos and reuse the ordinary browser/viewer. Do not introduce generated narration, highlight ranking, a story editor, or video production.
- Extract Past creations before retiring the combined Memories presentation. Retain currently eligible story/capsule reads and existing authorized deletion rules; remove creation and editing controls. Show its Settings entry only when eligible content exists.
- Preserve capsule opening times and server-side pre-unlock access denial, including for authors. Do not add a pre-unlock read/export bypass.
- Retire AI answer-generation entry points and dispatch. Retire story/capsule creation and editing operations in the application API as well as in the interface. Preserve required reads, source-context operations, unlocking, and deletion.
- Remove unused generated-story media/export workflows while retaining ordinary archive export and authorized access to original photographs and evidence.
- Preserve stored archive data, contribution ownership, original media, source records, existing creations, and deletion/access rules. No table drops, data purge, archive migration, or storage-format change is required.
- Extract retained functionality before deleting old compositions or shared modules. Exact safe deletions follow dependency inspection, not a blanket directory removal.
- Translate old Timeline and Memories links to Photos, Search and Discover links to Photos search, Imports links to Add, Circle links to Settings membership, and About/introduction links to Settings replay or first-time onboarding as appropriate.
- Translate old Review links according to their retained task: correction queue in Add or export/departure in Settings. Translate Places links according to place exploration in Globe or source connections in Add.
- Preserve existing photograph detail links and selected photograph identifiers. Preserve year, query, filters, and record selection in old links where they are meaningful.
- Send old Ask links to Photos search with an honest feature-retired state. Resolve old AI evidence links to accessible source context only when their identifiers support a trustworthy mapping; otherwise show a clear unavailable/retired state.
- Route existing story/capsule links to the matching Past creations record while enforcing current access and capsule timing. Never guess a record mapping or expose inaccessible content.
- Keep one current-circle context and remove redundant per-surface selectors. Retain any needed circle management within Settings.
- Reconcile product, specification, roadmap, and interaction records with the confirmed scope, retaining historical decisions and traceability rather than claiming earlier production milestones have been accepted.
- Deliver in coherent increments: behavioral contracts; Photos and viewer; Add/Settings/Past creations/recap; navigation and old-link translation plus retirement of write operations; removal of unused compositions and obsolete assertions. Deployment remains separate.

## Testing Decisions

- The owner confirmed one primary existing acceptance boundary: integrated Playwright journeys against the real app, using synthetic archive fixtures on desktop and phone.
- Use existing HTTP/domain contracts selectively where the interface cannot prove a property: retired mutation operations, ownership and membership denial, capsule opening times, and retained read/delete behavior.
- Test observable results and user journeys. Do not test private component structure, internal function names, exact module composition, or the implementation of month grouping in isolation when the integrated result proves the contract.
- Prefer the existing unified-app fixture, server, and browser helpers. Existing prior art includes authenticated shell navigation, shared-code entry, memory detail, integrated feature workflows, import recovery, backend access tests, and advanced-memory/capsule contracts.
- Exercise shell navigation, archive browsing/search, the shared viewer, Add, Settings, Annual recap, Past creations, and old-link handling through this shared app boundary. Do not add a separate mocked component harness for every relocated page.
- Verify a returning member can open Globe, switch to Photos, select a year, open a specific photograph, inspect Conversation context, and return with view/filter/scroll state preserved.
- Cover individual-photo month groups, newest-first browsing, year navigation, Undated and uncertain/conflicting dates, compact filtering, and loading/empty/error/unavailable states.
- Verify search returns accessible photographs and secondary conversation-only results, opens actual source context, and never resurrects AI answer generation.
- Verify Annual recap eligibility and oldest-first month order, access-filtered content, ordinary viewer use, and exclusion of unreliable capture years without removing those photographs from general browsing.
- Exercise an Add workflow through import, progress, retained recovery, a source connection, and focused review. Preserve meaningful existing continuation and automatic-sharing regression contracts.
- Verify Settings retains membership/account/export/departure behavior and applicable preferences. Verify Past creations appears only when eligible content exists.
- Verify existing stories and unlocked capsules remain readable, owners retain existing deletion rights, sealed capsules cannot be read before their server opening time, and unauthorized reads/deletes remain denied.
- Verify retired AI and creation/edit operations cannot be invoked directly through the app API; hiding buttons alone does not satisfy retirement.
- Verify withdrawal, session loss, membership loss, and deletion propagate to browsing, search, viewer context, recap, Past creations, and export as applicable.
- Cover translated links with meaningful selections and clear handling of ambiguous, missing, inaccessible, or retired records. Removed destinations must not reappear in navigation.
- Run desktop and phone journeys with keyboard and reduced-motion coverage; record screenshots of the simplified navigation and representative views.
- During implementation, run focused checks for each coherent change, followed by the relevant build, formatting, unit, backend, and integrated app checks. Record exact revisions, commands, fixtures, environments, results, and evidence. No new coverage threshold or milestone acceptance is implied.

## Out of Scope

- New AI answer generation, model/provider integration, recognition, or default processing enablement.
- New collaborative stories, story editing, time-capsule creation, generated narration, highlight ranking, video production, or new generated-media export features.
- Deleting existing stories, capsules, photographs, conversations, originals, source evidence, or database tables as part of simplification.
- Changes to capsule opening dates, author pre-unlock access, contribution ownership, automatic group sharing, membership authorization, or departure policy.
- A backend rewrite, framework migration, database/storage-format migration, hosting change, or new authentication model.
- Native apps, new import formats, new source providers, broader multi-circle product expansion, or new background-continuation guarantees.
- A new visual identity or removal of the existing globe, optional sound, accessibility, or reduced-motion behavior.
- Automatic deployment, production milestone acceptance, or claims that document checks establish application correctness.

## Further Notes

This spec synthesizes the owner's confirmed discussion of 14 November 2026 and product decision D28. The confirmed purpose is: **Relive shared history in a simple but fun way.** Annual recap, Conversation context, and Past creations use the domain glossary meanings.

The testing boundaries were explicitly confirmed by the owner. No further product interview is required for this spec. Detailed extraction order and final component boundaries remain implementation choices constrained by the observable contracts above.

The existing code exposes real API-backed workflows; these are not all placeholders. Removing a destination requires relocating its retained behavior first. Retiring AI generation or creation workflows does not imply destroying evidence or existing content.

The issue is ready for agent implementation of this bounded simplification. Publishing the specification does not claim that application changes, tests of those changes, deployment, or production acceptance have already occurred.

