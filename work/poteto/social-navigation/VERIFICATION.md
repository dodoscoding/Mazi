# N1 navigation acceptance

## Revision and scope

Base `75727e0b3e28d0fea384f1c0f5cfdc4e04ed4914` contains merged plan PR #112. Contract commit `34a5f0c` adds the failing legacy-entry tests. Implementation commit `e88f45e` supplies the single Home card, grouped task directory, canonical aliases, source-section ownership and focused settings entry. Boundary-test commit `eb9d3ab` checks that a People alias retains the search and outer sample-mode parameters while selecting the People section.

The primary links are Ana sayfa, Keşfet and Grubumuz on desktop and phone. Ekle remains separate. The photo, title and primary action on Home open one detail target. Event notes remain secondary. Keşfet groups the existing tools under Bul, Gez and Birlikte hatırla. Direct and hash People and Settings aliases replace the current history entry. Source management selects Grubumuz and focuses Kaynak bağlantıları after any Discord return completes.

No schema, API, audience, export, deletion or processing-consent behavior changes. Existing workspace body copy remains partly English. Social actions remain separate plan slices.

## Failing contract

`node --test tests/dom/route-history.test.mjs` failed five new cases before implementation. Both forms of `/people` still resolved to `/people`, both forms of `/settings` still resolved to `/settings`, and an in-app People alias failed to reach the canonical destination. [Captured red output](route-history-red.txt) records the literal mismatches.

After implementation the same command passes all 11 cases. The checks cover canonical target, preserved query, no extra history entry and the previous browsing destination.

## Environment and checks

The checks ran locally on macOS with Node 24.15.0, Python 3.14.7, locked npm dependencies and synthetic fixtures. Browser servers used isolated ports 5274 and 8118.

| Command | Result |
| --- | --- |
| `npm run typecheck` | Pass. |
| `npm run build` | Pass. |
| `npm run lint` | Pass. |
| `npm run check:budgets` | Pass. Entry script 146.0 KiB gzip, stylesheet 36.6 KiB, all scripts 388.9 KiB, globe 242.9 KiB. |
| `node --test tests/dom/route-history.test.mjs tests/dom/imports.test.mjs tests/dom/places.test.mjs tests/dom/places-recovery.test.mjs tests/dom/discord-return.test.mjs tests/dom/workspace-design.test.mjs` | 54 passed. Includes single-consumption Discord return and place recovery. |
| `MAZI_TEST_PORT=5274 npx playwright test tests/interface-clarity.spec.ts tests/theme-shell.spec.ts --project desktop --project phone` | 27 passed, one desktop-only-inapplicable mouse test skipped. Includes 320-pixel layout, keyboard account controls, reduced motion, Home return focus and axe checks. |
| `MAZI_UNIFIED_PORT=8118 npx playwright test --config playwright.unified.config.ts tests/clarity-workspaces.spec.ts tests/features-redesign.spec.ts --project desktop --project phone` | 38 passed. Includes both direct and hash legacy aliases, Back, source entry focus, retained source draft, existing feature journeys and axe checks. |
| `MAZI_UNIFIED_PORT=8118 npx playwright test --config playwright.unified.config.ts tests/unified.spec.ts tests/entry.spec.ts --project desktop --project phone` | 14 passed. Includes authenticated journeys, named-profile entry, delayed private responses, logout and access loss. |
| `MAZI_UNIFIED_PORT=8118 npx playwright test --config playwright.imports.config.ts` | 18 passed, one inapplicable desktop phone test skipped, one interrupted desktop test. The failed case passed on an isolated rerun below. |
| `MAZI_UNIFIED_PORT=8118 npx playwright test --config playwright.imports.config.ts --project desktop --grep 'working pages fit narrow'` | One passed. The initial run overlapped a local build, which briefly removed `dist` and caused the server to return “Atlas build unavailable” on `/review`. The rerun serialized the build and fixture. |
| `npm run check:docs` | Pass. 19 authored documents and 305 local links. |
| `git diff --check` | Pass. |

## Screenshots

These captures use sample-mode synthetic photographs. They are produced by the first `interface-clarity.spec.ts` test and were inspected after capture.

- [Desktop Home](home-desktop.png).
- [Phone Home](home-phone.png).
- [Desktop task directory](explore-desktop.png).
- [Phone task directory](explore-phone.png).

## Review preparation

The implementation diff adds no explanatory code comments or suppressions. Generated screenshots and result JSON from unrelated existing test directories were restored after verification. The parent coordinator receives the exact branch and commits for an independent standards and spec review.

## Limits

The five-friend first-click study and physical-phone acceptance have not run. Phone evidence uses Chromium emulation. The parent delivery workstream owns independent review, final full-suite verification, PR publication, merge and deployment. This document does not claim production milestone acceptance.
