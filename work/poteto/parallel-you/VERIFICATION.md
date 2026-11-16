# Parallel You sample implementation verification

Implementation began 14 November 2026; final verification completed 15 November 2026. Base revision: `eeaf138` on `claude/parallel-you-plan`. Implementation branch: `codex/parallel-you`, in the isolated `.worktrees/parallel-you` checkout. All story fixtures are synthetic. External AI is disabled by the owner's choice; no paid call, hosted migration or deployment was performed.

## Implemented behavior

Members can begin a fictional universe, follow three decisions to an ending, revisit existing branches, generate untaken branches from a map or list, reload browser-stored stories, compare endings, and regenerate or delete a chapter and its descendants. The fixed tree has 22 chapters and 12 endings. Storage is member-keyed, bounded to 20 universes, validated on load, and explicitly disclosed as persisting after sign-out.

The fake-provider API enforces access, a versioned sample notice, bounded request/output contracts, sensitive-input refusal, and transactional member/circle daily caps. The hosted bridge releases its request lock during generation and rechecks session access before returning the result. No story text is stored server-side or passed to archive APIs. Normal operation is feature-flagged off; signed-in browser fixture mode is explicitly selected with `?demo=1`.

## Environment

macOS arm64, Node 24.22.1 from the desktop bundled runtime, npm 11.6.2 used only as a local package-manager tool, exact `package-lock.json` dependencies installed with `npm ci`. Python uses the existing local virtual environment. Browser checks use installed Chrome with Playwright desktop and Pixel 7 emulation. The sample map is also checked at 320 px. Firefox and hosted Postgres are not claimed as verified.

## Verification results

- Core unit suite: 25 tests passed, including 5 new Parallel You tests.
- DOM suite: 151 tests passed.
- Parallel contract, HTTP and hosted bridge regression suite: 29 tests passed; the focused Parallel suite includes 8 tests.
- Evaluation: 12 scenarios, 48 structurally valid sample chapters, no network provider.
- Build and TypeScript: passed.
- Prettier: passed.
- Budget checker: Parallel You 7.8 KiB gzip against 24 KiB; all scripts 394.5 KiB against the unchanged 400 KiB ceiling.
- Document checker: 18 documents and 250 local links passed. `git diff --check` passed.
- Full desktop/phone browser suite: 138 passed, 18 conditionally skipped, including 10 Parallel You scenarios. Axe checks and 320 px overflow checks passed.
- Full backend suite: 565 tests run in 461.489 seconds; 552 passed, 12 skipped, 1 unrelated baseline failure. `tests.backend.test_places.GpsTests.test_pil_rational_strings_become_signed_degrees` compares `28.974999999999998` to `28.975` using exact equality. Both `mazi/places.py` and its test are unchanged from base `eeaf138`; the isolated test reproduces the failure. No GPS implementation or fixture was changed.

Commands used the declared npm scripts or their direct CLI equivalents because `node` and `npm` were initially absent from PATH. The first browser attempt lacked a downloaded Playwright Chromium; installed Chrome was used. A first full backend attempt was interrupted because sandbox socket restrictions prevented HTTP tests. Those attempts are not passing evidence. A temporary local Playwright config selects Chrome for the existing desktop and phone suite without changing production browser defaults.

## Screenshots

Visually inspected [desktop home](evidence/desktop-home.png), [desktop ending](evidence/desktop-ending.png), [phone ending](evidence/phone-ending.png), and [320 px map](evidence/map-320.png). The map exposes a list view with full chapter and choice labels. These screenshots use the compiled build with its self-hosted fonts.

## Remaining work

The Anthropic adapter, provider-specific schema and prompt, retention/training notice, live-language/writing evaluation, paid run, hosted migration application, and production release require the later provider/release decision. The structural fake evaluation intentionally cannot establish story quality or Turkish generation. The supplied migration has not been tested against a hosted database. Storage keys do not provide encryption against someone controlling the browser profile.


## Reproduce locally

From the implementation worktree after `npm ci` and `npm run setup`:

```sh
npm run build
npm run lint
npm run test:unit
npm run test:dom
npm run check:budgets
npm run check:docs
npm run eval:parallel
npm run test:backend
npm run test:parallel
```

`test:parallel` serves the compiled build and uses Chromium by default. On this host, `MAZI_TEST_CHROME=1 npm run test:parallel` uses installed Chrome. The full browser run used the existing `playwright.config.ts` with a temporary wrapper selecting only desktop/phone projects and Chrome; that wrapper was removed afterward. Logs below retain exact results. The initial shell required bundled Node on PATH and a temporary npm shim; no machine-wide runtime configuration changed.

## Saved evidence

- [Full browser run](evidence/browser.log): 138 passed, 18 skipped.
- [Focused browser run](evidence/parallel-browser.log): 10 passed.
- [Full backend run](evidence/backend.log): one unchanged GPS exact-equality failure described above.
- [Bridge and Parallel tests](evidence/bridge.log): 29 passed.
- [Unit tests](evidence/unit.log) and [DOM tests](evidence/dom.log): 25 and 151 passed.
- [Build](evidence/build.log) and [format check](evidence/lint.log): passed.

Final screenshot recapture also reran the branching/compare/delete scenario on desktop and phone: both passed. The fixed phone navigation is captured at the first viewport boundary in full-page images; the page remains scrollable underneath it.

## Review corrections, 16 November 2026

Addressed the five review findings on PR #162: merge generation into current state and discard responses for deleted nodes; provide accurately scoped member deletion even when configuration is unavailable; pause opening, choice and regeneration submissions after refusal; require session completion before releasing a blocked provider in the bridge test; inspect normalized raw input before stripping controls.

Validation on macOS with Node 24.22.1 and installed Chrome: build passed; 18 desktop/phone Parallel You browser tests passed; 29 focused Python contract/HTTP/bridge tests passed; formatting, document checker, whitespace and script budgets passed (394.6 KiB gzip total). The new sensitive-input regression failed before the fix. Temporarily retaining the bridge request lock made the strengthened concurrency test fail with `Session blocked behind generation`; the production implementation was restored and the suite passed. No archive data or external provider was used.

GitHub Actions on PRs #162 and #164 did not start due to the account payment/spending-limit error. PR #110's previous backend failure was the floating-point GPS assertion already corrected on main; that existing correction is being propagated through this PR chain. Local checks do not establish hosted or production acceptance.
