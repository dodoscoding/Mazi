# ISSUE-158 — Retire active AI answers

Implemented D28 on branch `codex/simplification-158`, based on integration `4c00802`. Implementation revisions: `be004e2`, `5bc6111`; canonical contract: `300ca37`. Synthetic local verification only; no deployment, schema migration, archive purge, provider, or index changes.

## Behavior and boundary

Active Ask navigation, prompts, discovery fallback, answer renderer and generation dispatch are removed. Both POST `/api/answers/ask` and `/api/answers/processing` return 410 after normal origin/body/auth/current-membership checks, before consent or usage changes. Historical state reads and stored answer data/offline domain evaluation remain.

Old Ask links become Photos keyword search, preserving meaningful query and applicable filters with an explicit retirement notice. Exact old evidence links require the explicit current circle and a verified selected asset; they open the ordinary photo viewer. Missing, foreign-circle, citation-only and ambiguous links show unavailable instead of guessing source identity. Ordinary evidence reads work without answer consent and enforce current access/personal hiding. Source conversations and normalized provenance remain inspectable.

## TDD evidence

Initial contracts failed because generation returned 200, old Ask stayed active, consent disabled ordinary evidence returned 403, discovery retained its Ask fallback, and legacy evidence did not open the actual photo viewer. Tests were committed before implementation (`d79a167`, `505c4d6`). Replacement regression contracts are in `e547ea9`.

## Verification

All commands ran in this worktree with shared locked dependencies; integrated browser port 8128 and synthetic Photos/search archive fixtures.

- `MAZI_UNIFIED_PORT=8128 npx playwright test --config playwright.photos.config.ts`: 26 passed, covering Photos, photo/text search, query/filter return, retirement, exact evidence and unavailable links on desktop/phone.
- `MAZI_UNIFIED_PORT=8128 npx playwright test --config playwright.photos.config.ts -g 'old Ask'`: 2 passed after evidence capture was added.
- `.venv/bin/python -m unittest tests.backend.answers.test_answer_http tests.backend.test_origins tests.backend.test_capacity_http tests.backend.test_conversation_search`: 11 passed; retired generation, unchanged usage/consent, invalid origin/body, ordinary evidence, hide/outsider denial, capacity, retained conversation access.
- `node --test tests/dom/capacity.test.mjs tests/dom/archive-hook.test.mjs`: 24 passed.
- `MAZI_UNIFIED_PORT=8128 npx playwright test --config playwright.unified.config.ts -g 'one authenticated shell|access loss clears retained|About states|PR 6 screens'`: 8 passed, including access loss and axe checks.
- `MAZI_PYTHON=.venv/bin/python MAZI_DOMAIN_PORT_BASE=18280 npx playwright test --config tests/browser/playwright.config.ts --project=answers-desktop --project=answers-phone`: 2 passed; retirement, literal query, native photo evidence, hide and no stale source content.
- `npm run build`, `npm run lint`, `git diff --check`: passed.
- `python3 work/poteto/product-plan/verify_docs.py`: passed, 19 documents and 349 local links.

## Evidence and remaining work

[Desktop retirement](ai-retired-desktop.png) and [phone retirement](ai-retired-phone.png) show the preserved query/year and retirement notice with an ordinary photo result. Images use intentionally synthetic solid-color media. Phone evidence was visually inspected.

`npm run check:budgets`: Globe 243.0/256 KiB, entry 93.3/150 KiB and stylesheet 19.7/40 KiB pass. Total scripts remain **421.3/420 KiB**, reduced from 424.2; the existing cap is unchanged. The final #159 obsolete composition cleanup owns the remaining 1.3 KiB and broader route/document reconciliation. No other scoped failure remains. Historical domain engine/data and still-used source helpers are intentionally retained.
