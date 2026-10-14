# Mazi

A private, invite-only archive for one friend group of 8-10 people. Mazi connects media, source conversations, people, places, and memories. Imported content becomes available to the whole signed-in group automatically; review supports later corrections.

Mazi runs as one local application. The Atlas interface reads the same authorized archive as imports, review, people, places, answers, recaps, stories and capsules. React/TypeScript lives in `src/`; the Python archive engine lives in `mazi/` under domain names. The numbered prototype folders have been retired. Historical evidence lives in [docs/history](docs/history).

This is a local application with synthetic verification. Production hosting, provider integration and milestone acceptance remain separate work.
Start with the [confirmed product context](PRODUCT.md), [roadmap](docs/ROADMAP.md), and [product specification](docs/SPEC.md). The product direction and Atlas choice were confirmed on 3 October 2026.

The existing [project plan](PROJECT_PLAN.md) is preserved. M0 reconciles its technology choices in the [decision register](docs/DECISIONS.md) and [acceptance record](docs/M0_ACCEPTANCE.md); the original plan remains preserved.

| Document | Purpose |
| --- | --- |
| [Product context](PRODUCT.md) | Confirmed audience, website scope, sharing, navigation, design ambition, and open decisions. |
| [Visual direction proposal](docs/DESIGN_PROPOSAL.md) | Selected Atlas concept and historical direction exploration. |
| [Implemented design](DESIGN.md) | Atlas colors, typography, layout, components and motion extracted from the prototype. |
| [Prototype stack](docs/PROTOTYPE_STACK.md) | Chosen experiment stack, alternatives, scope and run instructions. |
| [Prototype verification](work/design/atlas/VERIFICATION.md) | Runtime checks, screenshots, review and remaining limits. |
| [Home-to-memory interactions](docs/HOME_MEMORY_INTERACTIONS.md) | Responsive layout, meaningful 3D, navigation, motion, recovery, and prototype evidence requirements. |
| [Roadmap](docs/ROADMAP.md) | Delivery order, dependencies, staffing assumptions, estimates, and release gates. |
| [Two-developer plan](docs/TWO_DEVELOPER_PLAN.md) | Parallel task ownership, dependency handoffs, and acceptance gates for two developers starting at M0. |
| [Product specification](docs/SPEC.md) | User journeys, release scope, navigation, and traceability to the brief. |
| [Architecture](docs/ARCHITECTURE.md) | Proposed components, data flow, scale, and operational design. |
| [Contracts](docs/CONTRACTS.md) | Domain relationships, publication rules, import states, and retry semantics. |
| [Privacy](docs/PRIVACY.md) | Access matrix, consent, revocation, retention, and deletion. |
| [Imports](docs/IMPORTS.md) | Adapter behavior, source limitations, fixtures, and platform evidence. |
| [Test plan](docs/TEST_PLAN.md) | Acceptance scenarios, proposed budgets, and production evidence. |
| [Decisions and risks](docs/DECISIONS.md) | Proposed defaults, alternatives, open decisions, and risk owners. |
| [Source register](docs/SOURCES.md) | External evidence and limits of verification. |
| [Original product brief](docs/source/PRODUCT_BRIEF.md) | Unchanged source supplied by the user. |

Milestone status is owned by the roadmap. Privacy policy is owned by the privacy document. Technical choices remain proposals until their listed evidence gates pass. Future implementation should update these documents when it changes a contract.

## M0 delivery boundary

M1 accepts manual JPEG/PNG for up to 10 members and 10,000 items, within a 20 GiB group cap. Production uses Next.js, PostgreSQL, Supabase Auth/private Storage, and one worker with database leases. The current local app uses React, Python and SQLite; it does not implement that production deployment. Chrome and Firefox on desktop and Android are the selected targets; iOS is deferred. Archive exports, HEIC, and video require later fixture-based acceptance.

Dev A owns shared migrations, authentication, policies, APIs, deployment configuration, and CI. Dev B owns normalization, worker stages, adapters, UI, fixtures, and browser/device evidence. `npm run build` includes typechecking; `npm test` runs Playwright; `npm run check:docs` checks planning documents. `npm run lint` checks Prettier formatting, and `npm run typecheck` checks TypeScript. See [M0 acceptance](docs/M0_ACCEPTANCE.md) for limits, policy, cost allocations, verified evidence and limits, and the two-developer estimate.

## Run Mazi

Use Node 22.12+ and Python 3.11+.

```sh
npm ci
npm run setup
npm run dev
```

Open http://127.0.0.1:5173. One command starts the interface and archive worker. Sign in or create an account in **My Imports**, then create or join a circle. Import a ZIP, inspect its inventory, and start importing. Photographs appear in Atlas and Timeline. **Archive review** lets you correct metadata and approve memories. **Memories** contains annual recaps, shared stories, sub-events, slideshows, AVI exports, sealed capsules and in-app notifications. **Search**, **Places & sources**, and **Ask your archive** use the same circle and session.

The sample Atlas remains available at `/?demo=1`. Its fictional photographs are separate from your archive. An empty archive shows an invitation to import photographs.

For the built app, use `npm start`. It builds the UI and serves it with the API at http://127.0.0.1:5173. Stop the development server first. `npm run preview` previews static assets only; use `npm start` to exercise the complete app.

The data directory remains `.mazi-imports`. Existing accounts, archive files, corrections, permissions, stories and capsules retain their IDs and storage format. Set `MAZI_IMPORT_DATA_DIR` to select another complete data directory. `MAZI_IMPORT_PORT` changes the backend port; development keeps the browser on 5173. `MAZI_PYTHON` selects a Python interpreter. Normal startup never seeds demo data or merges the separate historical `.mazi-pilot` directory.

```sh
npm run test:backend
npx playwright install chromium firefox
npm test
npm run test:app
npm run build
npm run lint
npm run check:docs
git diff --check
```

The unified browser tests use a temporary synthetic archive. Optional learned search requires a separately installed local model; keyword search works without it. Existing source companion, consent and format limits are documented in [the historical guides](docs/history) and [the local app architecture](docs/PROTOTYPE_STACK.md).

## Run the M0 access experiment

Use Docker or OrbStack and run from this checkout. The project `mazi-m0-experiment` contains only synthetic users, records and objects. It is separate from the Atlas interface and any hosted Supabase project.

```sh
npm run m0:start
npm run test:m0
npx supabase db advisors --local --type security --fail-on error
npm run m0:stop
```

To replay the migration in this dedicated synthetic database, run `npx supabase db reset --local` after starting it, then rerun `npm run test:m0`. Schema lives in `supabase/migrations`, bucket setup in `supabase/seed.sql`, provider tests and fixture inventory in `tests/m0`, and evidence in [M0 verification](work/poteto/m0-acceptance/VERIFICATION.md). Dev A owns migrations; Dev B proposes dependent changes. Never link or deploy this experiment configuration as production policy.

The selected macOS environment cannot launch stock bundled Firefox because of its shared profile directory. [Firefox reproduction](work/poteto/m0-acceptance/FIREFOX_ENVIRONMENT.md) creates a temporary launcher without changing the installed browser or user profile. Set `MAZI_FIREFOX_EXECUTABLE` to that launcher when running `npm test`. Linux CI uses the bundled default. Firefox phone checks use a narrow touch-enabled desktop engine, not Android GeckoView. Physical Android Chrome/Firefox checks precede M1 pilot acceptance.

CI runs formatting, build/typechecking, browser checks, document checks and the actual local provider suite. The GitHub run is reported by the PR; local verification does not claim its remote result.
