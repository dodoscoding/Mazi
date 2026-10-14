# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See also `AGENTS.md` (conventions, commit/PR rules) and `README.md` (document index). All data and fixtures are synthetic; production auth, ingestion and infrastructure are not implemented.

## Architecture

The repo holds several independent experiments plus planning docs. They are not one deployed app:

- **Atlas prototype** (`src/`, Vite + React 19 + react-three-fiber): client-only, fictional memories in `src/memories.ts`, generated photos in `public/media/`. Playwright specs in `tests/*.spec.ts` (desktop, phone, Firefox projects).
- **Python archive stack** (`phase1/` → `phase7/`, package `mazi/`): each phase is a stdlib `http.server` loopback app that **inherits the previous phase's handler** (e.g. `phase7.server` imports `phase6.server.handler_for`), so a later server serves all earlier routes. `phase1/core.py` holds shared primitives (`Conflict`, `Denied`). Domain logic lives in `mazi/{imports,archive,sources,identity,discovery,answers,memories}`; backend tests in `tests/backend/<domain>` and `phaseN/tests`. Each phase has a `README.md` and `VERIFICATION.md` that distinguish implemented behavior from production acceptance. Phase 2+ also have their own `playwright.config.ts` browser tests.
- **Supabase/M0** (`supabase/`, `tests/m0/*.test.mjs`): migrations, policies and a local access experiment; `npm run m0:start` needs the Supabase CLI/Docker.
- `tools/apple-photos`: macOS Photos companion (Phase 4).
- **Planning** (`docs/`, `PROJECT_PLAN.md`): `docs/DECISIONS.md` reconciles differences with the preserved plan; `docs/source/PRODUCT_BRIEF.md` must stay unchanged. Keep IDs stable (`B01`–`B30`, `M0`–`M7`, `T01`–`T15`). Update canonical contracts when behavior changes.

Authorization is a recurring invariant in the Python phases: every list/read/write/export rechecks membership, approval, personal hiding and asset visibility; don't cache authorized data.

## Commands

```sh
npm ci                      # Node 22.12+
npm run dev                 # Atlas at http://127.0.0.1:5173
npm run build               # tsc -b && vite build
npm run lint                # prettier --check over an explicit file list in package.json
npm run format              # prettier --write (same list; add new files to both scripts)
npm test                    # Playwright (starts dev server); needs `npx playwright install chromium firefox`
npx playwright test tests/journey.spec.ts --project=desktop -g "<title>"   # single test
npm run check:docs          # planning doc checker (run after any docs change)
git diff --check

python3 -m pip install -r phase1/requirements.txt   # a .venv exists; phases 3–6 docs use .venv/bin/python
python3 -m unittest discover -s phase1/tests -v
python3 -m unittest phase7.tests.<module>.<Class>.<test>   # single Python test
npm run test:imports | test:archive | test:sources | test:discovery | test:answers | test:memories
npm run test:<name>:browser # per-phase Playwright
node --test tests/m0/*.test.mjs   # npm run test:m0
```

Dev servers: `python3 -m phaseN.server` (or `npm run dev:imports|archive|sources|discovery|answers|memories`); ports are 8002–8005 (see each phase README). Env: `MAZI_IMPORT_DATA_DIR` (default `.mazi-imports`), `MAZI_IMPORT_PORT`, `MAZI_EMBEDDING_MODEL_DIR` for the optional CLIP model, `MAZI_FIREFOX_EXECUTABLE` for Firefox tests.

CI (`.github/workflows/verify.yml`) runs lint, build, docs check and Playwright for the prototype, plus per-phase Python and browser jobs.
