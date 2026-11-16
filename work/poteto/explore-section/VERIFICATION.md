# Explore section verification

Base revision: bc18f3f518aefc6ad795cfba366f0b2b31fc0921. Local branch: codex/explore-parallel-section.

Adds /explore and /explore/parallel inside the existing shell. Photo and conversation retrieval reuse discovery; chat matches open the event notebook. External AI remains disabled. No schema migration or deployment performed.

## Checks

Synthetic tests on macOS, Node 24.22.1, installed Chrome, 15 November 2026:

- npm run build: passed.
- npm run test:dom: 152 passed before the final notebook-link assertion was added.
- node --test tests/dom/search-filters.test.mjs: 4 passed, including the new source-notebook contract.
- MAZI_TEST_CHROME=1 npm run test:parallel: 12 passed (desktop and phone).
- Final Explore-only browser rerun with synthetic group/search responses: 2 passed.
- npm run check:budgets: passed, total scripts 394.7 KiB gzip / 400 KiB.
- python3 work/poteto/product-plan/verify_docs.py: passed.
- git diff --check: passed.

The new Explore DOM contract failed before implementation (discover view instead of search), then passed. Browser preview logged an unavailable local land.geojson proxy on the final Home navigation; these checks do not establish live Atlas map or production acceptance. Search covers approved imported snippets, not complete external chat transcripts.

## Screenshots

- [Desktop](desktop.png)
- [Phone](phone.png)

## Review fixes, 16 November 2026

Shell marks Explore active on /explore/parallel, the parallel sub-route keeps a single h1, and the section pills use theme tokens. Rerun after the fixes: npm run build, npm run lint, npm run check:budgets (394.8 KiB / 400 KiB) and git diff --check passed; npm run test:dom 153 passed; MAZI_TEST_CHROME=1 npm run test:parallel -- -g "Explore keeps" 2 passed (desktop and phone). GitHub CI did not start because of an account billing error.

## Integrated review fixes, 16 November 2026

Preserved the upstream Explore theme/navigation update at 7c29a07 and merged the five PR #162 corrections plus the existing main-branch GPS test precision correction. Final integrated build and all 20 desktop/phone Parallel You + Explore browser tests passed. The focused backend/bridge/GPS suite passed 38 tests. Script budgets passed at 394.8 KiB gzip total; document and whitespace checks passed. GitHub Actions remains externally blocked by account payment/spending-limit configuration. No production deployment or schema change was performed.

## Second review, 16 November 2026

On /explore/parallel the Explore title is a paragraph, so the route-change focus target was empty and focus stayed on the clicked link while Parallel You checked availability. The title now takes focus (tabIndex -1) when no h1 is present. A new browser test failed before the change (focus inactive) and passes after it. Rerun: npm run build, npm run lint, npm run check:budgets, npm run check:docs and git diff --check passed; npm run test:dom 153 passed; MAZI_TEST_CHROME=1 npm run test:parallel 22 passed (desktop and phone).
