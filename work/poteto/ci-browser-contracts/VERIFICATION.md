# Browser contract integration verification

## Scope and base

Base: `1a0234a` (PR 139). Branch: `codex/ci-browser-contracts-20261104`. This change edits synthetic browser contracts and their fixture only. Production runtime, dependencies, model, consent defaults and budgets are unchanged. Remote was verified as `https://github.com/dodoscoding/Mazi.git`; nothing was pushed or published.

The original learned CI evidence is run 41850083898, job 126643736705: real CLIP runtime and evaluation passed, then both browser cases expected `0 results` while the accepted UI rendered `0 sonuç`. Remaining accepted indexing/status copy is translated; model identity is now checked directly in the authorized real settings response (`Local CLIP`, learned and ready) alongside semantic result ordering and the original consent/fallback/privacy assertions.

The photo-evidence fixture now explicitly matches its two stable synthetic asset IDs through `/api/discovery/matches`. No general matching semantics are invented in the shared archive mock. The original per-photo date/place assertions remain intact.

Entry contracts retain groups and Atlas denial with navigation to the endpoint's owning route. The stale Atlas-denial race remains unchanged except for its exact translated selector. A separate Home 403 contract checks private projection removal after a real archive-change event while the session remains valid. Canonical `docs/CONTRACTS.md`, bounded social Home/selected reads, requires social projection clearing on access replacement; it does not equate a scoped resource denial with session invalidation. The test asserts the explicit denied message, no featured/activity/private title content, and a still-valid session. Actual session/group denial remains covered by the original entry and notebook tests.

Notebook links and selected-target withdrawal follow the accepted H1 parent: a selected 404 unmounts the conversation, displays `Anı bulunamadı`, and leaves no private quote, textarea, comment or reaction controls. Deletion and actual source withdrawal operations remain in the test.

Search retains no initial optional context read, usable photo facets with their full visible denominator, disabled editing before context, filtered photo readiness, an explicit photo-only exclusion, retry after removing that exclusion, and the actual person-tag write. Domain tests use the existing Ekle intake helper and exact Turkish grouping/recovery labels. The 1,001-row pagination, request equivalence, metadata capacity, no-partial and privacy assertions remain.

## Shared fixture consent

`memories_server.py` already enabled Alice's local processing and both members' answer processing. It now also explicitly enables Ben's local processing. The selected-photo correction test restores the metadata values but correctly becomes their latest author. `mazi/answers/answers.py` requires that annotation author's membership, local processing and answer processing (`local_annotation` and `answer_annotation`, line 248 at base). Without Ben's synthetic consent, random UUID selection can make the corrected Bicycle photograph disappear from later answer evidence. This fixture configuration authorizes both intended correction/answer participants without changing production defaults or denied/withdrawn tests.

## Commands and evidence

Node 24.15.0, Python 3.14.7, installed Playwright Chromium/Firefox. Local model: `/Users/altanesmer/Desktop/Ales/Mazi/.models/clip-vit-base-patch32`, verified existing ONNX files; installed onnxruntime/tokenizers. All archives, users and groups are temporary synthetic fixtures, local backend only.

- Photo red: `MAZI_TEST_PORT=5316 npx playwright test tests/memory-detail.spec.ts --grep 'photo facts stay'`; Chromium desktop/phone exposed zero gallery matches; Firefox initially failed before execution because the macOS profile directory workaround was missing. See `PHOTO_RED.txt`.
- Photo green: same command with `CFFIXED_USER_HOME=/tmp/mazi-firefox-cf-home-ci-20261104` (directory created first): all four projects passed, 5.2 seconds. `PHOTO_GREEN.txt`.
- Learned green: `MAZI_DOMAIN_PORT_BASE=18240 MAZI_PYTHON=.venv/bin/python MAZI_EMBEDDING_MODEL_DIR=/Users/altanesmer/Desktop/Ales/Mazi/.models/clip-vit-base-patch32 npx playwright test --config tests/browser/playwright.config.ts --project discovery-desktop --project discovery-phone --grep 'learned model'`: both actual CLIP paths passed, 10.7 seconds. `LEARNED_GREEN.txt`. An intermediate actual run exposed the stale `Local CLIP` UI assertion after indexing; no model or semantic assertion was removed.
- Entry final: both projects, all ten cases passed, 11.0 seconds. `ENTRY_GREEN.txt`.
- Actual source withdrawal: both conversation projects passed, 3.6 seconds. `WITHDRAWAL_GREEN.txt`.

Focused no-build runs used temporary copies of the canonical configs only to avoid deleting an active runner's dist, with separate local ports. One initial broad attempt was accidentally invalidated by a concurrent build, stopped, and excluded from acceptance. Canonical clean-build verification follows below. No temporary config is committed.

## Full-matrix fixture isolation

The final domain run passed 40 cases with two explicit learned-model opt-in skips (1.4 minutes); the separate model-enabled run above proves both real CLIP paths. `DOMAINS_GREEN.txt` records all imports, source/OAuth, discovery, answer and memory paths.

A second shared-fixture leak appeared only after desktop unified workflows preceded the phone projects: the named-import/privacy-race test deleted its authored story but left its approved memory grouping over the archive. Gallery legitimately showed a photo in both that grouping and the original memory, breaking later exact badge counts. The test now undoes only its owned synthetic grouping before logout, after capturing the held private Home response. The late-response privacy assertions remain intact. The retained feature slideshow still uses `Next photo`; its assertion is scoped to that story, while the Atlas Viewer retains `Sonraki fotoğraf`. Approved-person facets can grow after a prior project creates a tag; the readiness assertion now checks a nonempty collection and every checkbox's enabled state.

Focused unified shell workflow (both projects, all six cases) passed in 37.2 seconds before the cleanup-only addition. The canonical clean-build whole-config run at the final behavior head is recorded below. Typechecking, changed-test Prettier checks and the documentation structure checker pass. The final diff changes tests, synthetic fixture configuration and acceptance evidence only.

The focused re-review cases at behavior head `c2695af` passed all four desktop/phone paths in 16.0 seconds (`REVIEW_CASES_GREEN.txt`): Search retry and the named-import/late-Home-response race. The person-facet assertion establishes attachment rather than visibility because refinement is deliberately closed; it then checks every checkbox is enabled. The logout test captures the real bounded response's private featured title before holding it, then asserts that neither that title nor any Home feature/plan/activity container reappears after the delayed response is released. Session/code and denied-group checks remain.

The two F2 integrated cases now read an independent unfiltered `/api/discovery/matches` snapshot before editing. Only the exact full-visible denominator, unfiltered tile count and retry summary total use that baseline. Known target asset IDs, original child links, same-child conjunction, filtering and no-partial assertions remain fixed. This accepts legitimate imports left visible by earlier workflows without deriving expected values from the UI. All four focused cases passed in 9.5 seconds (`FILTERS_GREEN.txt`).

The final held-Home race setup removes the extra document reload that previously aborted the captured request. It captures the response from the current Home navigation, waits for that page's heading, and waits for the imports destination heading to receive its normal route focus before opening the account menu. UI logout, the same held private response, late delivery, session clearing, private title/container absence and group denial remain required. Both focused projects passed in 12.6 seconds at `cebb2ac` (`RACE_GREEN.txt`). Independent re-review also passed these cases and the growing-fixture F2 cases (six cases, 20.0 seconds).

## Final acceptance

At immutable behavior head `cebb2ac`, `MAZI_UNIFIED_PORT=8194 npx playwright test --config playwright.unified.config.ts` performed its canonical clean build and passed **all 94 desktop/phone cases in 2.6 minutes**, with no skips or failures. `UNIFIED_GREEN.txt` is the complete final log. No other build or runner changed this worktree's dist during that run.

Final gates: `npm run typecheck`, `npm run lint`, `python3 work/poteto/product-plan/verify_docs.py`, and whole-branch `git diff --check 1a0234a...HEAD` pass. Budgets pass unchanged: entry 92.6/150 KiB gzip, all scripts 417.3/420, stylesheet 19.7/40, Globe 243.0/256. The runtime/dependency diff against `1a0234a` is empty. The parent separately owns the accepted About-copy delta and production publication/deployment; this branch did not publish or deploy anything.

Regenerated legacy screenshots and result JSON were restored. Only explicitly authored tests, the one synthetic fixture consent setting and this task's text evidence are committed. Hosted runtime and physical-device acceptance remain outside this local synthetic CI correction.
