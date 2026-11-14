# Mazi

<img src="public/mazi-logo.png" alt="Mazi logo" width="160">

Mazi is a private memory archive for one small circle of friends. Its current product contract is **Globe** and **Photos**, supported by **Add** and **Settings**: relive shared history in a simple but fun way.

Everyone in the circle uses a shared entry code and a visible name. Imported content becomes available to the signed-in circle automatically as it is ingested. Review and correction remain optional afterward.

## What you can do

- Explore the archive in Globe or browse individual photographs by month in Photos, with year navigation, compact filters and an explicit Undated collection.
- Search photographs and secondary source conversations in Photos. Read exact recorded conversation context without requiring a photograph or an AI answer.
- Open the same full-photo viewer from either primary view and return to the originating selection, filters and position.
- Import, connect sources, follow progress, recover failures and review suggestions through Add. Correct individual date/place facts and manage eligible source contributions contextually.
- Use Settings for membership, account/sign-out, export, departure, About/introduction replay and applicable discovery preferences.
- Revisit a simple capture-year Annual recap. Read eligible historical stories/capsules in Settings / Past creations, with existing time locks and authorized deletion.

AI answers, story/capsule writing and generated-story media workflows are retired from the application API and interface. Original media, existing creations, source context, independent live conversations, ownership and access restrictions remain preserved.

The [D28 specification](docs/APP_SIMPLIFICATION_SPEC.md), [ticket plan](docs/APP_SIMPLIFICATION_TICKETS_DRAFT.md) and [PR #161](https://github.com/dodoscoding/Mazi/pull/161) track the simplification. Per-slice synthetic evidence is linked from the [delivery record](docs/APP_SIMPLIFICATION.md). Final navigation integration and its acceptance gate are tracked separately from public deployment and production milestone acceptance. See the [roadmap](docs/ROADMAP.md) and [privacy contract](docs/PRIVACY.md) for release gates and limits.

## Run locally

Use Node 22.12+ and Python 3.11+. Run these commands from the repository root for a fresh local archive.

```sh
npm ci
npm run setup
MAZI_BACKEND=local .venv/bin/python -m mazi.identity.setup_shared \
  --root .mazi-imports --admin-name "Your name"
npm run dev:local
```

Open http://127.0.0.1:5173. Enter your name and the shared code printed by setup. The app starts with an empty archive. Import a ZIP to add photographs.

New names create member profiles. An existing name resumes that profile on any device. Anyone with the code can resume any profile, including the owner. The code does not verify a person's identity.

For an existing archive, setup requires its circle UUID and explicit profile mappings. Follow the [development guide](docs/DEVELOPMENT.md) before running setup against existing data. That guide also covers code rotation, sessions, archive paths, and runtime settings.

To run the built app, stop the development server and run:

```sh
npm run start:local
```

The built app uses the same browser address. `npm run preview` serves static assets only.

For fictional sample photographs, open `http://127.0.0.1:5173/?demo=1` after shared-code entry. Samples remain separate from your archive.

## Use a hosted archive

The app can use hosted Supabase PostgreSQL and private Storage while the interface and worker run on your computer. Follow [hosted setup](docs/SUPABASE_SETUP.md) for configuration, explicit archive transfer, and recovery.

When `.env.supabase` exists, `npm run dev` and `npm start` automatically use its hosted configuration. The `dev:local` and `start:local` commands above keep SQLite and files in `.mazi-imports`. Startup never transfers your local archive.

## Check changes

Run the relevant checks for your change:

```sh
npm run check:docs
npm run build
npm run lint
npm run test:backend
npx playwright install chromium firefox
npm test
npm run test:app
git diff --check
```

Browser checks use synthetic fixtures. See [Firefox setup on macOS](work/poteto/m0-acceptance/FIREFOX_ENVIRONMENT.md) if the bundled browser cannot launch. The separate [M0 access experiment](work/poteto/m0-acceptance/VERIFICATION.md) records provider checks and their limits.

## Read more

| Guide                                                                                          | What it covers                                                |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [Product context](PRODUCT.md) and [specification](docs/SPEC.md)                                | Who Mazi serves and how the archive works.                    |
| [Development guide](docs/DEVELOPMENT.md) and [hosted setup](docs/SUPABASE_SETUP.md)            | Run the app and manage an archive.                            |
| [Vercel deployment](docs/DEPLOYMENT.md)                                                        | Host the interface and API on Vercel with the hosted archive. |
| [App architecture](docs/PROTOTYPE_STACK.md)                                                    | React interface, Python domains, storage, and current limits. |
| [Roadmap](docs/ROADMAP.md) and [decisions](docs/DECISIONS.md)                                  | Delivery gates, accepted choices, and open risks.             |
| [Contracts](docs/CONTRACTS.md), [privacy](docs/PRIVACY.md), and [imports](docs/IMPORTS.md)     | Data rules, access, consent, and supported sources.           |
| [Design](DESIGN.md) and [interaction guide](docs/HOME_MEMORY_INTERACTIONS.md)                  | Atlas appearance and behavior.                                |
| [Test plan](docs/TEST_PLAN.md) and [prototype verification](work/design/atlas/VERIFICATION.md) | Acceptance scenarios and recorded evidence.                   |
| [Performance budgets](docs/PERFORMANCE_BUDGETS.md)                                            | Release ceilings and measured hosted and real-archive results. |
| [Historical guides](docs/history)                                                              | Earlier experiments, source companions, and format limits.    |

The [original project plan](PROJECT_PLAN.md) and [source brief](docs/source/PRODUCT_BRIEF.md) remain preserved. The [decision register](docs/DECISIONS.md) records changes to the plan.
