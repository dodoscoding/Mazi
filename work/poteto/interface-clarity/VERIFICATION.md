# Interface clarity verification

Completed on 1 November 2026 against source/test head `c08b1c627921745429098c6fb5d8a0b291be9277`, based on merged investigation revision `665902b4a6aba9a71539888568a7e9ca95d87b27`. [D26](../../../docs/DECISIONS.md#interface-clarity-1-november-2026) defines scope. [The plan](PLAN.md) tracks acceptance and [the rationale](DESIGN_RATIONALE.md) records the chosen directory design.

The commits are `276fd91` for the failing navigation contract, `1802104` for implementation and migrated journeys, and `c08b1c6` for focused feature/route regressions. The final documentation commit adds contracts and evidence without changing application source.

## Result

Home has one featured memory, direct event-note access and at most three other archive memories. It does not mount Atlas. Desktop and phone use Home, Keşfet and Grubumuz, with Ekle and Search in the header. Keşfet exposes twelve named destinations. Group management exposes five shortcuts after its heading. Atlas retains its existing behavior at `/atlas`, including legacy root-selection entries.

New Home/navigation copy is Turkish; existing workspaces remain English. No activity feed, classifier, comments/reactions domain or future-event domain was added.

## Baseline

The original Home mounted Atlas and exposed five navigation destinations on each screen size. `npm run build` passed. Baseline captures use the synthetic Sample profile, `?demo=1`, Chromium, reduced motion, desktop 1440 by 1024 and Pixel 7. The flat-map option was selected deliberately and finite animations completed before capture.

- [Desktop before](before-home-desktop.png)
- [Phone before](before-home-phone.png)

## Behavioral contract

`MAZI_TEST_PORT=18272 npx playwright test tests/interface-clarity.spec.ts --project=desktop --workers=1` failed before implementation. Actual primary labels were Home, Timeline, Search, My Imports and Our circle. Expected labels were Home, Keşfet and Grubumuz.

## Final verification

Environment: macOS 27.0, build 26A428, arm64; Node 24.15.0; Python 3.14.7; Playwright 1.63.0; Chromium 153.0.8010.12. Dependencies use the existing locked project installation through local `node_modules` and `.venv` symlinks. No dependencies changed.

| Command | Observed result |
| --- | --- |
| `MAZI_TEST_PORT=18275 MAZI_FIREFOX_EXECUTABLE=/tmp/mazi-interface-clarity-20261101-firefox/firefox npx playwright test --workers=2 --output=/tmp/mazi-clarity-sample-final --reporter=line` | 286 passed; 34 browser/viewport-specific skips; 2.4 minutes. All four configured projects ran. |
| `MAZI_UNIFIED_PORT=18276 npx playwright test --config playwright.unified.config.ts --output=/tmp/mazi-clarity-unified-final --reporter=line` | 72 passed, desktop and Pixel 7, 1.4 minutes. Includes real temporary archive bytes, notebooks, section entry/recovery, background state and access loss. |
| `MAZI_PYTHON=.venv/bin/python MAZI_DOMAIN_PORT_BASE=18320 npx playwright test --config tests/browser/playwright.config.ts tests/browser/discord-return.spec.ts --project=sources-desktop --project=sources-phone --output=/tmp/mazi-clarity-discord-final --reporter=line --workers=1` | 16 passed in 8.5 seconds. Direct `/places` callbacks exchange once across session/feature changes and do not wait for the archive overview. |
| `npm run test:dom` | 153 passed. |
| `npm run test:unit` | 20 passed. |
| `.venv/bin/python -m unittest tests.backend.test_server` | 5 passed, including literal direct `/explore` delivery. |
| `npm run build` | Typecheck and production build passed. Existing large lazy-Globe chunk advisory remains. |
| `npm run lint` | Project Prettier check passed. |
| `npm run check:budgets` | Globe 242.9/256 KiB, entry 145.4/150 KiB, CSS 36.7/40 KiB, all scripts 388.3/400 KiB gzip. |
| `python3 work/poteto/product-plan/verify_docs.py` | 17 authored documents, 236 local links, B01-B30, M0-M7 and T01-T15 passed. |
| `git diff --check` | Passed. |

Full logs are in `/tmp/mazi-clarity-{sample-final,unified-final,discord-final,dom-final,unit-final,backend-final,build-final,lint-final,budgets-final}.log`. The documentation count measures the registered planning documents, not application correctness.

Stock bundled Firefox failed before application startup with `Could not find profile folder.` Firefox 155.0 ran through the existing [isolated-branding procedure](../m0-acceptance/FIREFOX_ENVIRONMENT.md), regenerated under `/tmp/mazi-interface-clarity-20261101-firefox`. The cache browser and user profile were not edited. Firefox phone coverage is a 390 by 844 touch-enabled desktop viewport, not Android GeckoView. Chromium uses desktop 1440 by 1024 and Pixel 7 emulation.

## UI evidence

The rerunnable [UI driver](verify-ui.mjs) uses `tests.browser.memories_server` with its temporary archive, profile Ben and synthetic shared code. Start that fixture with `MAZI_IMPORT_PORT=18273 .venv/bin/python -m tests.browser.memories_server` after a build, then run `node work/poteto/interface-clarity/verify-ui.mjs`. `MAZI_EVIDENCE_URL` overrides its origin. The driver closes its browsers.

[UI results](ui-results.json) record source head `c08b1c6`. Both screen sizes have exactly three main labels, twelve directory entries, four focused feature sections, zero page errors and zero axe violations on Home, Keşfet and the account menu. The 320px width checks passed. Reduced motion and finite-animation settlement were enabled. The parent inspected the final captures, including corrected heading typography and group-heading placement.

| View | Desktop | Phone |
| --- | --- | --- |
| New Home with existing fictional sample media | [Home](after-home-desktop.png) | [Home](after-home-phone.png) |
| New Home with real temporary archive projection | [Archive Home](after-home-archive-desktop.png) | [Archive Home](after-home-archive-phone.png) |
| Keşfet directory | [Keşfet](after-explore-desktop.png) | [Keşfet](after-explore-phone.png) |
| Grubumuz and visible management links | [Grubumuz](after-group-desktop.png) | [Grubumuz](after-group-phone.png) |
| Preserved Atlas, flat-map option | [Atlas](after-atlas-desktop.png) | [Atlas](after-atlas-phone.png) |

## Review and corrections

An independent reviewer returned PASS+NOTES at `c08b1c6`, within one model family. The review compared Atlas against the original Home; its functional differences are the export name and three canonical portal URLs. The separate comment pass found no introduced comments or suppressions requiring changes. The parent reviewed the complete source/test diff and applied the React component/hooks/accessibility checklist.

The reviewer reproduced an explicit main Home click restoring an old card position. The nullable return record now distinguishes explicit navigation from browser Back. Independent final browser checks observed Back restoring scroll 349 on desktop and 541 on phone, while main Home reset to zero and focused the heading. Focused regressions preserve both behaviors.

Parent visual review also corrected invalid heading token names and moved group shortcuts after the existing group heading. These fixes preceded the final runs and captures. The final build and budget receipt were refreshed after the reviewer noticed an older build log; asset names match the final source.

One preliminary Discord case failed because a concurrent Vite build briefly removed `dist`. Builds and browser suites were then serialized; the final sixteen callback cases all passed. Historical screenshot files regenerated by existing tests were restored, and this increment's captures live here. [Worker checks](IMPLEMENTATION.md) distinguish earlier partial runs from final parent acceptance.

## Limits

Only temporary synthetic archives and existing fictional sample media were used. No personal archive, schema, audience, processing-consent or storage policy changed. The `/explore` SPA rewrite is included, but no deployment was initiated for this implementation. Physical Android devices, stock Firefox launch acceptance, live hosted-provider behavior, manual screen readers and production milestone acceptance remain open. Automated axe checks are not accessibility certification.
