# Issue 159 — Final navigation and destination retirement

## Scope and revisions

Implements [issue #159](https://github.com/dodoscoding/Mazi/issues/159) under
[D28](../../../docs/DECISIONS.md#app-simplification-14-november-2026) and the
[approved specification](../../../docs/APP_SIMPLIFICATION_SPEC.md). Started from
integration `deac243149f13982d8cd8bdc8a554d82be191863` in the isolated
`codex/simplification-159` worktree. The source checkout was not edited.

The core switch is `f0bc3f3`; isolated explicit samples are `c8d299d`; retained
photo/query navigation is `86eba5a`, `361f8db`, `cf82fe9`, and `312d595`.
Canonical actions and compact recap context are `fd0e06e` and `e75d7f0`.
Current People/evidence compatibility is `4e6b32d`; document/hash compatibility is `118e456`. Canonical documentation and
sample browser migration were merged from integration with explicit merge
messages. Final integration review and deployment are separate.

## Implemented behavior

- Returning members open Globe. Desktop and phone expose Globe, Photos, Add,
  Settings and a shared Photos search action. Root archive loading, sound,
  keyboard guards, active navigation and heading focus move together.
- Timeline/Memories/Search/Discover legacy browsing links reach Photos. Useful
  year, keyword, photo predicates and opaque bookmark parameters survive routing,
  Gallery URL updates, and viewer return. Old place/country/object predicates
  use the existing keyword read boundary and remain removable in compact filters.
- Existing story/capsule selections reach Past creations. People tasks reach
  Settings. Source connections reach Add; review queues reach Add, while old
  export/departure tasks reach Settings. Plan records get an honest retired
  state; foreign or unknown records never open a guessed photograph.
- Discord's outer query is captured before route canonicalization and is never
  copied into the hash. `/places` remains a real document callback path. Python
  also serves the final Photos, Add and Past creations document paths.
- Explicit unknown/empty memory selections and invalid photograph indices have
  clear unavailable states. Viewer Escape consumes its event before returning,
  preserving the exact origin even when a retained legacy Portal is mounted.
  Keyboard activation restores its actual opener.
- Explicit `?demo=1` uses the same fictional photographs in Globe, Photos and
  the viewer. Its local read adapter makes no live archive reads. Approximate
  sample memory dates do not become asserted photo capture dates; unsupported
  photo metadata predicates produce no fabricated matches. Sample authoring,
  source and account operations are scoped out with an explanation.
- Deleted obsolete Home/SocialHome/Explore/Browse/Timeline/plan compositions,
  standalone discovery and combined Memories mounts/templates and unused styles.
  Shared gallery, source context, import/source/review mounts, About in Settings,
  viewer, historical notebook, social comment API and stored domains remain.

## Test reconciliation

The current app script runs unified, conversations, Add sources, Add queues,
Photos/search/retired evidence, recap and Past creations suites. Removed social
Home and plan UI configs asserted destinations that no longer exist; their
access/ownership/domain APIs remain covered by backend tests. The final
navigation contracts cover honest old plan links. No global selector weakening,
coverage threshold reduction or new skip was introduced. The conversations suite
retains its pre-existing phone skip for one two-session scenario; its other
phone conversation, denial and recovery tests continue to run.

Retired moment/order controls, standalone semantic/indexing screens and category
inventories are no longer asserted. Their retained photo predicates, authority,
retry, stale-response, label editing, privacy clearing and source-context
behavior is checked at Photos or the shared viewer. Existing review capacity,
correction draft, Discord, session, membership and HTTP tests remain active.

## Validation evidence

Environment: macOS, Node 24.15.0, locked shared `node_modules` and `.venv`
symlinks; synthetic temporary archives only. Integrated browser port `8129`.
The ordinary desktop Chromium and Pixel 7 projects were used.

| Command / boundary | Result |
| --- | --- |
| Initial `playwright.unified` final-navigation contract at `af61538` | Red: returning root still showed Home; no opening Globe |
| Navigation and sample tracer, desktop + phone | 6 passed after core/demo changes |
| Legacy predicates DOM tracer `14cc87a` → `cf82fe9` | Red missing place predicate, then 5 Photos search contracts passed |
| Whole-query tracer `0a161b3` → `312d595` | Red truncated literal `?` query, then all route cases passed |
| People route tracer → `4e6b32d` | Red interim unavailable route, then retained Settings route cases passed |
| `MAZI_UNIFIED_PORT=8129 npm run test:app`, unified portion from `031891a` | 104 passed across desktop and phone |
| Same script, conversations | 21 passed; one unchanged baseline phone skip |
| Same script, Add sources / Add queues | 6 passed / 6 passed |
| Same script, Photos/search/evidence | 24 passed, 2 evidence-state failures; stopped the chained script |
| Scoped evidence rerun after dedicated compatibility fix `4e6b32d` | 2 passed; existing inaccessible/foreign/ambiguous states retained |
| `playwright.recap.config.ts` | 8 passed |
| `playwright.past-creations.config.ts` | 2 passed |
| Final settled Globe / invalid selection browser contracts at `4e6b32d` | 4 passed desktop + phone |
| `npm run test:unit` | 23 passed |
| Selected existing social Home, plans, comments and server HTTP suites | 15 passed; no social API retirement |
| `npm run build`, `npm run typecheck`, `npm run lint` | Passed |
| `npm run check:budgets` | All scripts 392.1 KiB gzip / unchanged 420 KiB; entry 90.8/150, Globe 242.9/256, CSS 16.0/40 |

Execution logs are `/tmp/mazi159-*.log` in this working session. The root
integration pass records final immutable-candidate validation after supporting
privacy, document-link and domain-browser work is merged. The earlier chained
app failure is recorded above rather than described as a fully green command.

## Visual evidence

Inspected the settled rendered Globe and Photos captures, including the phone
bottom navigation. Solid-colour photographs are synthetic fixture media.

- [Desktop Globe](screenshots/159-desktop-globe.png)
- [Phone Globe](screenshots/159-phone-globe.png)
- [Desktop Photos](screenshots/159-desktop-photos.png)
- [Phone Photos](screenshots/159-phone-photos.png)

## Limits

No deployment, production acceptance, provider/model setup, schema or storage
migration, data purge, or change to the parent issue is included. Historical
planning IDs and the preserved source brief remain intact. Original social
records and APIs remain stored even though plan and activity destinations have
retired. Explicit sample mode provides fictional photo browsing and keyword
search, without live archive administration or invented capture chronology.

## Final compatibility follow-ups

- `66d2d1c`: canonical person-filter assertion reconciled; complete DOM run
  passed **158/158**, with no skips (`/tmp/mazi159-dom-final3.log`).
- `4e6b32d`: People legacy browser tasks passed **6/6** desktop/phone
  (`/tmp/mazi159-people-browser.log`).
- `e3a4a50` → `118e456`: two additional real-app tracers first failed, then
  passed **4/4** desktop/phone. A photo index without a selected memory is
  explicitly ambiguous; navigating from a real `/settings` document to `#/add`
  uses the active hash, rather than retaining the old pathname's Settings mode.
  The removed inventory's stale heading reference and unused landing stylesheet
  were also removed. Existing import and FeaturePage contracts remain green.
- Settled screenshots wait for scene readiness, rather than capturing the Globe
  loading overlay. The four linked images were visually inspected.
