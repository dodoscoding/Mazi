# Vercel deployment

The app can run on Vercel Hobby with the [hosted archive](SUPABASE_SETUP.md). Vercel serves the built interface from its CDN. One Python Vercel Function, `api/index.py`, serves `/api/*`, `/health` and `/land.geojson`. All durable records and bytes live in Supabase PostgreSQL and private Storage. This is a hosting path for the existing app, not milestone acceptance.

## Deploy

Install the Vercel CLI, then link the repository root to a project:

```sh
vercel link
```

Set these environment variables for the project. Values come from your private `.env.supabase`; never use `VITE_` names for them.

| Variable                   | Value                                                                     |
| -------------------------- | ------------------------------------------------------------------------- |
| `MAZI_BACKEND`             | `supabase`                                                                |
| `MAZI_DATABASE_SCHEMA`     | The initialized private schema.                                           |
| `MAZI_DATABASE_URL`        | Session-pooler URL with `sslrootcert=infra/hosted/prod-ca-2021.crt`.      |
| `MAZI_SUPABASE_URL`        | The project's HTTPS origin.                                               |
| `MAZI_SUPABASE_SECRET_KEY` | The complete server Storage secret.                                       |
| `MAZI_STORAGE_BUCKET`      | The matching private bucket.                                              |
| `MAZI_IMPORT_DATA_DIR`     | `/tmp/mazi`                                                               |
| `CRON_SECRET`              | A long random value. Vercel sends it to the daily cron as a bearer token. |

Deploy with `vercel deploy`, or `vercel deploy --prod` for production. [vercel.json](../vercel.json) builds `dist`, routes the API paths to the function, rewrites the app routes to `index.html`, and runs the function in `fra1`, next to the Frankfurt database. `.python-version` selects Python 3.12. The function bundles `mazi/` and the provider CA certificate.

## Background work

Vercel has no always-on process. Imports still queue durably, but they progress only when something asks. An open, signed-in tab calls `POST /api/work`. Each call runs queued work for about 20 seconds on a second database connection. The tab calls again at once while work remains and otherwise every minute. A daily cron calls `GET /api/work` with `CRON_SECRET`.

Imports therefore advance while a signed-in tab is open, including when an Imports or Circle tab is hidden, plus once a day. Other pages clear their signed-in view when hidden and stop polling until visible again. Browsers may throttle or suspend background tabs, so hidden-tab progress is not guaranteed. Closing every tab pauses them; reopening the app resumes them. Several instances may drain at once. Item claims use leases and scans commit each batch once, so concurrent drains do not duplicate work. The local `python -m mazi` server keeps its worker thread and answers `mode: "thread"`, which stops the tab from polling.

## Limits

- Fluid compute must stay enabled. It streams Python responses, which keeps the Atlas response and export ZIPs clear of the 4.5 MB non-streamed response limit.
- Request bodies are capped at 4.5 MB. Import and source uploads send requests of at most 768 KiB, and capsule photos are limited to 2 MiB.
- `/tmp/mazi` holds per-instance scratch only. It disappears when an instance stops and is never a source of truth.
- Requests in one instance share one database connection and run one at a time.
