# Photo search and correction verification

A2 is split into a read delivery and a subsequent correction/export delivery. At `88830a7`, new date-basis contracts fail with `TypeError` because Search does not accept `date_basis`. The first two regressions cover sharing-only Discord and conflicting capture evidence in both keyword and related search.

The read contract keeps omitted date basis on legacy capture behavior. Explicit capture and chronology use real evidence days; explicit sharing considers every reliable origin. New Search uses chronology while old dated bookmarks retain omitted-basis semantics until explicitly changed.

## A2-read implementation

Red commit `1ca9022` is followed by `39b4898`. Search uses the shared pure photo evidence before date matching in live related-search and streamed keyword/related paths. A lazy context reader resolves raw chat day order by import/conversation and current access. Context rows consume the same request byte/origin counters before parsing; its per-origin/per-photo/time checks remain bounded. Atlas now uses the same pure sharing-provenance formatter, and neither read changes stored payloads or fingerprints.

The first photo page receives `assetId` and the A1 `evidence` object without fetching Atlas. Fresh Search sends chronology. Dated bookmarks without a basis keep the legacy empty-basis choice through pagination until a member chooses one explicitly. Result text uses the shared photo formatter. Other context result categories are visibly outside a date-filtered search until their same-photo relation is supported.

## Passing read checks

All fixtures are synthetic. Commands run on macOS with the shared repository virtual environment and locked Node dependencies.

- `.venv/bin/python -m unittest tests.backend.discovery.test_date_basis` passed 10 contracts, including keyword/related, streamed metadata, later shares, conflicts, inclusive represented ranges, origin immutability, same-import/conversation proof, hidden proof, hidden-memory results/facets and combined context/request budget failure.
- `.venv/bin/python -m unittest tests.backend.discovery.test_api tests.backend.discovery.test_date_basis tests.backend.discovery.test_keyword_scaling` passed 19 tests before the final extra context/range cases. The HTTP boundary accepts the explicit basis and rejects an invalid one. Keyword scale and recovery remain complete.
- `.venv/bin/python -m unittest tests.backend.discovery.test_date_basis tests.backend.discovery.test_shared_by tests.backend.discovery.test_keyword_budgets tests.backend.discovery.test_remaining_capacity tests.backend.test_atlas` passed 60 tests during implementation. The synthetic 10,000-photo related/index passes measured 0.3323/0.7585 seconds on that run. These are local measurements, not production budgets.
- After the Search-local hidden-memory correction, `.venv/bin/python -m unittest tests.backend.discovery.test_date_basis tests.backend.test_atlas_projection tests.backend.test_atlas` passed 51 tests. The exact legacy projection, constant query ceilings and 4 MiB peak projection assertion remain intact.
- `node --test tests/dom/search-date-basis.test.mjs tests/dom/search-filters.test.mjs tests/dom/search-startup.test.mjs` passed 12 tests. A premature request-count assertion was replaced with waiting for the rendered date scope, so it checks the actual completed UI.
- `MAZI_UNIFIED_PORT=8142 npx playwright test --config playwright.unified.config.ts tests/clarity-workspaces.spec.ts --grep 'date bases find' --project desktop --project phone --reporter=list` passed both journeys. Each uploads and imports a sharing-only Discord ZIP through the real HTTP routes, checks legacy/explicit date behavior, reloads the bookmark and withdraws its synthetic import in cleanup.
- `MAZI_DOMAIN_PORT_BASE=18720 MAZI_PYTHON=.venv/bin/python npx playwright test --config tests/browser/playwright.config.ts tests/browser/discovery.spec.ts --grep 'HTTP-boundary fixture supports' --project discovery-desktop --project discovery-phone --reporter=list` passed both existing 1,001-result, pagination and capacity-recovery journeys.
- Typecheck, build through the browser server, lint, document checks, bundle budgets and `git diff --check` passed. Entry is 147.5 KiB gzip of 150 KiB; all scripts are 390.5 KiB of 400 KiB. Globe and CSS remain within their existing ceilings.

## Read screenshots

These captures show only synthetic fixture content. The phone result and date controls were visually inspected.

- [Desktop sharing result](screenshots/desktop-sharing-result.png)
- [Phone sharing result](screenshots/phone-sharing-result.png)
- [Desktop date controls](screenshots/desktop-date-basis.png)
- [Phone date controls](screenshots/phone-date-basis.png)

## Remaining A2 work

Selected-photo correction writes, the optimistic-concurrency snapshot, detail actions and the reviewed-place export gap belong to the next A2-write PR. A2-read introduces no schema, writer or ownership change. Physical-phone and five-friend acceptance remain separate. The coordinator owns independent review, merge, final full-suite verification and deployment.
