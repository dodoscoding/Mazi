# Development guide

Advanced startup, archive setup, verification, and synthetic access experiments for the local Mazi application. For a fresh local archive, start with the [README](../README.md).

## Run Mazi

Use Node 22.12+ and Python 3.11+.

```sh
npm ci
npm run setup
npm run dev
```

If `.env.supabase` exists, normal startup uses its hosted archive and `.mazi-hosted` scratch. See [hosted setup](SUPABASE_SETUP.md) for server secrets and explicit archive transfer. `npm run dev:local` and `npm run start:local` retain SQLite/files; `MAZI_BACKEND=local` prevents automatic environment-file loading. A checkout without hosted configuration stays local. A fresh local archive first needs `.venv/bin/python -m mazi.identity.setup_shared --root .mazi-imports --admin-name "Your name"`.

Open http://127.0.0.1:5173. One command starts the interface and archive worker. Enter your visible name and the shared code printed by setup. New names create member profiles immediately; an existing name resumes that profile on any device. The introduction appears once per profile and remains available in **About**. Import a ZIP, inspect its inventory, and start importing. Photographs appear in Atlas and Timeline. **Archive review** lets you correct metadata and approve memories. **Memories** contains annual recaps, shared stories, sub-events, slideshows, AVI exports, sealed capsules and in-app notifications. **Search**, **Places & sources**, and **Ask your archive** use the same circle and session.

The synthetic sample Atlas at `/?demo=1` also requires shared-code entry. Its fictional photographs are separate from your archive. An empty archive shows an invitation to import photographs.

For the built app, use `npm start`. It builds the UI and serves it with the API at http://127.0.0.1:5173. Stop the development server first. `npm run preview` previews static assets only; use `npm start` to exercise the complete app.

For an existing archive, setup requires its circle UUID and explicit mappings. It never infers names from email addresses or changes ownership.

```sh
.venv/bin/python -m mazi.identity.setup_shared --root /path/to/archive --admin-name "Owner" --group-id GROUP_UUID --map-name "Owner=EXISTING_ADMIN_UUID" --map-name "Friend=EXISTING_MEMBER_UUID"
```

Repeated setup retains the code and mappings. `--rotate` generates a replacement entry code; it does not revoke existing sessions. Setup prints a generated code only on creation or rotation and stores only its digest in the configured database. Missing setup fails closed. Browsers retain a 30-day HttpOnly cookie; sign-out revokes that browser session. Anyone holding the code can resume any name, including the owner. This accepted D17 identity tradeoff does not establish a person's identity.

Local mode retains `.mazi-imports` and its compatible format. Hosted mode stores durable rows and bytes in Supabase, with separate `.mazi-hosted` scratch. Existing IDs are preserved only by explicit transfer; startup never copies the local archive. `MAZI_IMPORT_DATA_DIR` selects the local archive or hosted scratch directory for the chosen mode. `MAZI_IMPORT_PORT` changes the backend port; development keeps the browser on 5173. `MAZI_PYTHON` selects a Python interpreter. Normal startup never seeds demo data or merges the separate historical `.mazi-pilot` directory.

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

The unified browser tests use a temporary synthetic archive. Optional learned search requires a separately installed local model; keyword search works without it. Existing source companion, consent and format limits are documented in [the historical guides](history) and [the local app architecture](PROTOTYPE_STACK.md).

## Run the M0 access experiment

Use Docker or OrbStack and run from this checkout. The project `mazi-m0-experiment` contains only synthetic users, records and objects. It is separate from the Atlas interface and any hosted Supabase project.

```sh
npm run m0:start
npm run test:m0
npx supabase db advisors --local --type security --fail-on error
npm run m0:stop
```

To replay the migration in this dedicated synthetic database, run `npx supabase db reset --local` after starting it, then rerun `npm run test:m0`. Schema lives in `supabase/migrations`, bucket setup in `supabase/seed.sql`, provider tests and fixture inventory in `tests/m0`, and evidence in [M0 verification](../work/poteto/m0-acceptance/VERIFICATION.md). Dev A owns migrations; Dev B proposes dependent changes. Never link or deploy this experiment configuration as production policy.

The selected macOS environment cannot launch stock bundled Firefox because of its shared profile directory. [Firefox reproduction](../work/poteto/m0-acceptance/FIREFOX_ENVIRONMENT.md) creates a temporary launcher without changing the installed browser or user profile. Set `MAZI_FIREFOX_EXECUTABLE` to that launcher when running `npm test`. Linux CI uses the bundled default. Firefox phone checks use a narrow touch-enabled desktop engine, not Android GeckoView. Physical Android Chrome/Firefox checks precede M1 pilot acceptance.

CI runs formatting, build/typechecking, browser checks, document checks and the actual local provider suite. The GitHub run is reported by the PR; local verification does not claim its remote result.
