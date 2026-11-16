# Issue 152 — Source connections in Add

## Scope and revisions

Implements #152, specification stories 27 and 29, and decision D28. Branch `codex/simplification-152` in `/tmp/mazi-simplification-152` starts at integration `8d4c5b5` (ancestry confirmed). Remote verified as `https://github.com/dodoscoding/Mazi.git` before commits.

- `4992dfa`: integrated source connection/transfer contract.
- `aa44d93`: relocate retained source management into Add.
- `a5c8649`: source-read recovery, access denial, and Discord return regression coverage.
- `d3a0874`: merge current integration `445d3da`, including the shared viewer. Verification below was repeated after merging.

## Behavior and stable interfaces

`/add` retains imports. `/add?section=sources` renders existing Apple Photos and Discord connection controls, source evidence summary, permission state, pause/enable actions, transfer outcomes, original downloads, and contribution withdrawal. Add-local Imports and Source connections links switch the mounted workspace without duplicate document IDs. The current circle remains the lifecycle/shell circle used by imports; there is no new circle picker.

The sources-only presentation uses the existing Places source mount with `root.dataset.surface = "add"`. It hides place exploration and avoids map/origin-place loading. Existing `/places` remains intact for staged migration. Source connections have a visible Refresh connections action, including honest source/server load-failure recovery text. Imports' companion connection link returns to Add sources; the sources workspace links back to imports.

No new provider, format, authentication model, source permission, transfer policy, or storage/schema change is introduced. Apple Photos authorization and interrupted-transfer continuation remain in the macOS companion; pausing preserves completed contributions. Existing withdrawal semantics remain unchanged.

## Discord callback contract for issue 159

The configured provider callback URI remains `/places`. Do not change provider configuration or discard its `code`, `state`, or `error` query parameters during old-link translation. Route source callbacks to `/add?section=sources` while preserving the original query until the existing application-owned `createDiscordReturn` controller captures it. Preserve its account binding, single exchange promise, cancellation, effect-refresh behavior, and access-loss invalidation. The retained source mount consumes the captured parameters and removes the browser query after return.

The new integrated test starts Discord connection in Add, retains the provider callback pathname, and exercises the existing query/controller with the Add sources hash. Automatic legacy callback route translation belongs to #159. Existing legacy callback and hidden-tab lifecycle regression tests remain unchanged and pass.

## TDD and verification

Owner-confirmed seams: existing actual-app desktop and Pixel 7 Playwright journeys, plus retained source HTTP/domain contracts. `playwright.add-sources.config.ts` extends the unified configuration and uses the existing `tests.browser.sources_server` fixture, including synthetic Apple transfer outcomes and the synthetic Discord provider. It is included in `npm run test:app`; no mocked component harness was introduced.

Red: `MAZI_UNIFIED_PORT=8122 npx playwright test --config playwright.add-sources.config.ts` before implementation: **2 failed**, both waiting for the absent Source connections link in Add.

Green after integration merge:

- `MAZI_UNIFIED_PORT=8122 npx playwright test --config playwright.add-sources.config.ts`: **6 passed**. Covers Add-local navigation, map omission, retained completed/partial transfer outcomes and downloads, source enable/pause, new paused Apple connection and permission instructions, failed source-read retry, access-loss clearing, and Discord return/channel-scoped paused-source creation.
- `MAZI_UNIFIED_PORT=8122 npx playwright test --config playwright.unified.config.ts -g 'Add imports|Add preserves'`: **4 passed**. Retains Add import/recovery, automatic sharing, Globe availability, cancellation/history, and session clearing.
- `.venv/bin/python -m unittest tests.backend.sources.test_api tests.backend.sources.test_sources tests.backend.sources.test_discord`: **63 passed**. Retains native resume/revocation, source scope and permission denial, Discord binding/single-use/expiry, worker access fencing, resource restore/export, and source withdrawal behavior. Existing Python ResourceWarnings remain non-failing.
- `node --test tests/dom/discord-return*.test.mjs tests/dom/places*.test.mjs tests/dom/feature-page.test.mjs`: **29 passed**, including Discord effect lifecycle, independent overview loading, refresh/disposal, and hidden feature lifecycle behavior.
- `npm run lint`, `git diff --check`: passed. The browser fixtures run `npm run build`, which passed with the existing bundle-size warning.

## Evidence and limits

Screenshots: [desktop source connections](sources-desktop.png), [phone source connections](sources-phone.png). Phone screenshot inspected; existing layout is responsive and shows Add-local source controls without a map.

Synthetic local verification does not establish production milestone acceptance. Existing macOS companion/provider integration requirements and transfer limits remain. No push, deployment, individual PR, archive purge, or migration occurred.
