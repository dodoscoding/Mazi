# Issue 149 - Photos keyword search and retained Conversation context

## Scope and source-reader finding

Implements #149 under D28 on `codex/simplification-149`, starting from integration
`b062483`. Current integration `6914553` was merged in `368f048`; recap, contribution
controls and Past creations remain intact. No schema, storage, hosting, indexing,
model, provider or background-processing changes were introduced.

The existing discovery secondary chats were derived only from photo-backed Atlas
messages. The old answers evidence endpoint returned photographs and required
answer-processing consent. Neither could read a retained zero-photo conversation.
The implementation therefore adds a small read-only normalized source-record reader,
independent of answer processing, rather than fabricating a photo relationship or
using AI as retrieval. The public boundary, access rules, filters and scan limits
are recorded in [the canonical contracts](../../../docs/CONTRACTS.md#retained-source-conversation-reads).

## Implemented behavior

- Globe's search entry and keyboard shortcut open search inside Photos. Keyword and
  ordinary photograph filters use the existing match/filter API and shared gallery.
- Photograph results lead; their links retain the real record and selected index.
  Closing the ordinary viewer restores query, filters, position and opener focus.
- Secondary source-message results include confirmed text-only imports. A result
  opens its exact normalized source reference and bounded recorded messages in a
  dismissible Photos region. Imported strings render as text, including HTML-like
  source content. No photograph or verified account identity is invented.
- Conversation filters use query, recorded source and historical sender. The UI
  explicitly distinguishes photo-only year/capture/place/label filters; unsupported
  conversation API filters return 400. Sharing timestamps remain source evidence.
- New search, refresh and access changes clear old source context. Closed/context
  requests use revision checks so delayed responses cannot reopen stale content.
  Annual recap hides ordinary search because it represents the entire capture year.
- Source list/context reads check current reader and contributor membership,
  unwithdrawn confirmed runs, live attached origins and current photo/event hides.
  Zero-photo records retain their own source dependency. Add exposes the existing
  withdrawal action for eligible zero-photo imports as well as photo imports.
- A page scans at most 256 candidates and returns at most 50 results, with explicit
  continuation and completion. An empty first page does not claim that the unsearched
  tail has no matches. Records are capped at 64 KiB and scans at two seconds.

## Agreed seams and red/green evidence

Tests use the existing real temporary archive server, desktop Chromium and Pixel 7
emulation, plus targeted public HTTP access contracts. The richer Photos fixture
adds a real normalized two-message WhatsApp export containing no photographs.
Additional UI cases ingest their own zero-photo archives through the real API;
owner confirmation and withdrawal also execute the existing Add controls.

- `53ffdd7`: both projects failed because Globe search still opened `/search`.
  `d8bb5ad` made the Photos keyword/filter/selected-photo return journey green.
- `3c75779`: the source read HTTP contract failed with 404 and the integrated
  secondary result region was missing. `b99d7fc` made photo-first and real text-only
  source context green without answer consent or answer dispatch.
- `33b3c5c`: an open withdrawn source context stayed visible during a gated reload,
  and Add hid the withdrawal control for zero-photo imports. `cf69079` made context
  clearing immediate and retained the owner's control.
- Subsequent public contracts cover unconfirmed inventory privacy, zero-photo run
  withdrawal and contributor/reader removal, wrong-circle denial, personal hides,
  source/sender filtering, 503 recovery, empty results, session loss and continuation
  across 300 real source records. Selection checks compare the public selected link
  index and the known photograph identity; event asset order is not assumed fixed.

## Verification

All commands ran in `/tmp/mazi-simplification-149` with linked locked dependencies,
Node 24 and Python 3.14 on macOS; browser data/media are synthetic.

- `MAZI_UNIFIED_PORT=8119 npx playwright test --config playwright.photos.config.ts`:
  20/20 passed after merging current integration (23.7s), including the ordinary
  Photos eight-case regression and twelve search cases across both projects.
- `MAZI_UNIFIED_PORT=8119 npx playwright test --config playwright.recap.config.ts`:
  8/8 passed after merging integration (10.4s).
- `MAZI_UNIFIED_PORT=8119 npx playwright test --config playwright.unified.config.ts -g 'one authenticated shell|shared viewer'`:
  10/10 passed (27.4s); the retained shell search assertion now follows Photos.
- `.venv/bin/python -m unittest tests.backend.test_conversation_search tests.backend.test_atlas tests.backend.test_atlas_projection`:
  49/49 passed (17.8s), including six new public source-reader contracts.
- `npm run test:unit`: 23/23 passed. Build/typecheck passed in each integrated launch.
  `npm run lint`, `git diff --check` and the document checker passed.
- Screenshot inspection found a mobile flex-basis gap in the search form; the scoped
  mobile rule was corrected and the desktop/phone source-context screenshots refreshed.

## Evidence and limitations

`search-context-desktop.png` and `search-context-phone.png` show photo-first results
and the actual text-only source reference/messages; the phone rendering was inspected.

`npm run check:budgets` reports a temporary total-script overage of 424.3/420 KiB.
Globe (243.0/256), entry (93.2/150) and stylesheet (19.7/40) caps pass. No ceiling was
raised; the following legacy retirement slice must recover the 4.3 KiB overage.

The source reader searches retained normalized windows, not absent provider history
or a complete original transcript. It preserves the existing archive's availability
and source identity instead of adding new ingestion guarantees. Legacy AI/navigation
retirement remains with #158/#159. No deployment or production milestone acceptance
is claimed by these synthetic checks.
