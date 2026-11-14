# Mazi app deletion and simplification plan

Prepared on 14 November 2026 from the owner discussion and source inspection.
[D28](DECISIONS.md#app-simplification-14-november-2026) records the confirmed
product choices. The [implementation specification](APP_SIMPLIFICATION_SPEC.md)
is published as [issue #146](https://github.com/dodoscoding/Mazi/issues/146)
with the `ready-for-agent` label. No application changes have been implemented
or deployed.

## Confirmed direction

The owner defines Mazi's primary purpose as: **Relive shared history in a simple
but fun way.** Importing and organizing the archive support that purpose.

The owner confirmed the following scope choices during the discussion:

- Keep the globe as the opening experience, with an easy Photos view.
- Remove AI answers, collaborative stories, and time capsules from the active
  product.
- Keep simple annual recaps.

The owner also confirmed the following structure:

| Surface | Responsibility |
| --- | --- |
| Globe | Default playful exploration of the archive. |
| Photos | Easy conventional browsing of the same archive, including year navigation. |
| Search | Easy-to-reach action with results in Photos, rather than a separate primary destination. |
| Add | Imports, connected sources, progress, and a focused correction queue. |
| Settings | Circle members, account, archive export, and About. |
| Annual recap | A simple year in photos, revisiting dated memories chronologically by month. |
| Past creations | Access to existing collaborative stories and capsules, under Settings and shown only when content exists. |

Separate Timeline, Memories, Discover, Places & sources, Archive review,
Our circle, and About destinations retire as their retained responsibilities
move into this structure. Dates and places can be corrected from memory
detail. Annual recaps have no story editor, generated narration, or video
creation workflow.

Past creations retains reading and owner deletion without creation tools.
Sealed capsules retain their existing opening dates. Feature retirement does
not authorize deleting stored content.

Photos shows individual photographs grouped by month, newest first, with year
navigation and an explicit Undated section. Opening a photograph goes directly
to the shared viewer at that photograph. Conversations appear as optional
context in the viewer and as secondary search results, including conversations
without photographs. The owner confirmed these browsing choices.

## Observed complexity

Code inspection found eleven general navigation destinations in the current
shell. Home, Timeline, and Memories offer overlapping archive browsing.
Search and Discover share a feature implementation. Places & sources combines
map exploration with source management. Archive review combines correction
with rediscovery, contribution management, export, and departure controls.
Memories combines a photograph grid with stories, recaps, and time capsules.
These findings come from source inspection, not a live usability test.

## Final product shape

- Globe is the default destination. Its markers lead to the same photograph
  viewer used by Photos. Keep the existing visual world, optional sound,
  reduced-motion behavior, and conventional fallback; their removal was not
  requested. Avoid an extra preview step when opening a photograph.
- Photos is the conventional browser. Remove the By moment / All photos choice
  and the competing standalone Timeline. Show year navigation, month groups,
  search, and a compact filter control rather than a permanently expanded
  collection of tools. Preserve visibility of uncertain and undated material.
- One viewer serves Globe, Photos, search, and recaps. Lead with the entire
  photograph and previous/next controls. Make conversations, date/place
  information, sources, corrections, and contribution actions available
  contextually. Back returns to the originating view, position, and filters.
- Search is an action available from either primary view. Photo results lead;
  matching conversations are secondary. A conversation-only result opens its
  source context without pretending that it has an associated photograph.
- Add contains upload, source connections, import history/progress, failure
  recovery, and a focused correction queue for duplicates and event suggestions.
  Review stays optional after automatic group sharing.
- Settings contains circle members and membership administration, account,
  archive export, departure, About/introduction replay, existing discovery and
  processing preferences, and Past creations when applicable.
- A year card in Photos opens the year-in-photos collection using the same
  browser and viewer. The normal browser is newest first; the recap is oldest
  first by month. Only confidently attributable capture years enter a recap.
  Unknown or conflicting dates remain available elsewhere without invented
  chronology. No generated summaries, ranking, editor, or video workflow.

## Delete and relocate

| Current surface or control | Proposed disposition |
| --- | --- |
| Standalone Timeline | Remove its destination and duplicate browsing state; year/month browsing moves to Photos. |
| Standalone Memories | Replace with Photos; extract the useful grid, filters, and recap before removing the old combined page. |
| Discover | Remove the separate destination; retain ordinary archive search and useful empty-state suggestions in Photos. |
| Standalone Search | Replace with an action opening Photos search; keep conversation results and keyword/filter behavior. |
| Places & sources | Remove the combined page and duplicate map; Globe owns place exploration, Add owns source connections, and the viewer owns location correction. |
| Archive review | Remove the broad destination; correction queues move to Add, item edits to the viewer, export/departure to Settings, and rediscovery to the primary views. |
| Our circle | Move membership controls into Settings; remove the standalone destination. |
| About | Move its content and introduction replay into Settings; preserve onboarding for new profiles. |
| Ask your archive | Remove its page, entry points, prompts, answer-generation controls, and associated active runtime work. |
| Answer evidence page | Remove the AI-specific presentation; retain archive source context needed by viewer and conversation search. |
| Story and capsule creation/editing | Remove forms, buttons, writing workflows, generated-media exports, and active creation entry points. |
| Existing stories and capsules | Retain under Past creations with reading and authorized owner deletion; capsule locks and opening times still apply. |
| Repeated navigation | Replace Archive tools and the long More list with Globe, Photos, Add, and Settings access appropriate to screen size. |
| Repeated group selectors | Use the current circle consistently; keep any necessary circle management in Settings rather than repeating selectors through every surface. |

## Proposed component work

This is a relocation plan, not permission to delete directories containing
retained functions. Inspect dependencies before removing shared code.

| Code | Planned treatment |
| --- | --- |
| `src/Shell.tsx`, `src/App.tsx`, `src/featureRoutes.ts`, `src/features/index.tsx` | Replace the destination inventory and route composition; retain authentication and lifecycle/access cleanup. |
| `src/Home.tsx`, `src/atlas/Portal.tsx` | Keep Globe and useful exploration; route photograph opening into the canonical viewer and remove redundant preview presentation if it creates an extra step. |
| `src/browse/Timeline.tsx`, `src/Browse.tsx` | Retire the separate Timeline composition after month/year behavior moves to Photos; retain any useful shared helpers. |
| `src/features/memories/gallery.js`, `template.html`, `mount.js` | Extract Photos and the simple recap. Extract existing-content access before retiring the monolithic Memories presentation and creation controls. |
| `src/MemoryView.tsx`, `src/memory/Viewer.tsx` | Reuse one detail/viewer flow with source context, corrections, and correct return navigation. |
| `src/features/discovery/` | Reuse search and result logic within Photos; remove Discover-only composition and AI calls-to-action. Preserve necessary identity/discovery controls in Settings. |
| `src/features/imports/`, `src/features/places/`, `src/features/archive/` | Extract uploads, source connection, recovery, and review capabilities into Add; move account/contribution controls to their agreed homes before removing old compositions. |
| `src/features/answers/`, `src/features/evidence/` | Retire AI page registrations and unused presentation modules. Extract any still-needed source-context renderer first. |
| `src/About.tsx`, `src/entry/` | Fold About into Settings while preserving entry, first-profile introduction, and replay. |
| `mazi/answers/` | Remove answer-generation dispatch from the active product; remove code only after checking server imports, callers, and shared evidence dependencies. |
| `mazi/memories/` | Retain recap, existing-content reads, capsule unlocking, and authorized deletion; retire creation/editing and generated-format endpoints from active use. |

No database-table drops, stored-content purge, storage-format changes, backend
rewrite, or hosting migration are part of this simplification. Merely hiding
creation buttons is insufficient: retired write operations must also become
unavailable through the application API while required read/delete operations
continue to enforce access rules.

## Existing links and content

The following route names are proposed for implementation. Preserve useful
query parameters and selected photograph identifiers when translating links.

| Old link | Proposed destination |
| --- | --- |
| `/`, `/atlas` | Globe. |
| `/timeline`, `/memories` | Photos, retaining a selected year/item where possible. |
| `/search`, `/discover` | Photos with search state. |
| `/imports` | Add. |
| `/circle` | Settings membership section. |
| `/review` | Add correction queue, or Settings for a specifically linked export/departure action. |
| `/places` | Globe for place/map links; Add for source-connection links. |
| `/about`, `/introduction` | Settings About/replay, preserving first-time onboarding separately. |
| `/memory/:id` | Existing canonical detail, retaining photograph selection. |
| `/ask` | Photos search with a short feature-retired message; do not reinterpret an old question as an answer. |
| `/answer-evidence` | Available source context when the identifier supports it; otherwise an honest retired/unavailable state. |
| Existing story/capsule links | The matching Past creations record, subject to access and capsule timing. |

Do not manufacture a source mapping if an old identifier is ambiguous. A missing
or inaccessible record gets a clear state without exposing its content or
silently dropping the user's selection.

## Delivery sequence

1. Reconcile the confirmed scope with Product, Specification, Roadmap, and
   interaction contracts. Add focused synthetic contracts for the new navigation,
   photo opening/return, and retained-content behavior before application changes.
2. Build Photos from the existing gallery with month groups, year navigation,
   Undated, integrated search, and the shared viewer. Keep the current app
   usable while replacing overlapping browse surfaces.
3. Assemble Add and Settings from retained workflows. Provide Past creations
   reads/deletion and the simple recap; verify them before retiring old pages.
4. Switch desktop and phone navigation, translate old links, and connect Globe
   directly to the same viewer. Retire AI and creation APIs and entry points.
5. Delete unused compositions, imports, styles, prompts, and obsolete tests
   after retained behavior has coverage. Keep detailed, coherent commits and
   record evidence; deployment is a separate action.

## Acceptance and verification

- A returning member opens Globe, switches to Photos, opens a photograph, reads
  available conversation context, and returns without losing their place.
- Photos shows individual photographs by month and handles year filters,
  uncertain/unknown dates, empty results, loading, and failure recovery.
- Search finds photographs and secondary conversation-only results without AI
  answer controls or retired destinations.
- A recap contains the appropriate year's available photographs in month order,
  with honest uncertainty and no fabricated highlights or generated text.
- A member imports, sees progress, recovers from failure, connects a source,
  and handles review suggestions through Add. Moving controls must preserve
  automatic sharing and existing continuation/recovery contracts.
- Settings preserves membership, export, departure, discovery preferences, and
  access to eligible Past creations. Empty Past creations adds no menu item.
- Existing stories remain readable and deletable under existing ownership
  rules. Sealed capsules remain unreadable before their opening times.
- Denied access, withdrawal, session loss, and deletion still remove content
  from views, search, counts, recap, and export as applicable.
- Legacy links reach their retained content or a clear unavailable state;
  none resurrects removed creation or AI workflows.
- Complete the small-memory flow on desktop and phone with keyboard and
  reduced-motion support; capture screenshots of the new navigation and views.

During implementation, run focused domain/DOM/browser tests for each move,
then the relevant build, lint, unit, backend, and integrated app checks. Record
the revision, commands, fixtures, environment, results, and evidence locations.
Documentation checks alone do not establish application acceptance.

## Review status

The owner confirmed the product choices above, requested publication as a
specification, and confirmed the existing integrated desktop/phone browser
tests plus targeted HTTP contracts as the testing boundaries. Issue #146 is
ready for agent implementation. Application implementation has not started.
Source inspection is the basis for the component map; dependency analysis
during implementation determines exact safe file deletions.
