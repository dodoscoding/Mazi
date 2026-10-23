# Production deployment verification, 22 October 2026

Mazi runs at https://mazi-three.vercel.app on Vercel Hobby (`fra1`, Fluid compute, Python 3.12) against the Frankfurt Supabase project from D18. This record covers [D20](../../../docs/DECISIONS.md#vercel-production-runtime-22-october-2026). The deployed revision was this branch merged locally with `claude/photos-companion-entry` (deployment `mazi-oya06tg6x`).

## Platform facts checked before the design

Vercel documentation, read on 22 October 2026, states a 4.5 MB request and non-streamed response body limit, an exemption for streamed responses, a 300 second Hobby maximum duration, and once-a-day Hobby crons. Python functions have no after-response background work. These facts produced the streaming bridge and the request-driven drain.

## Local checks on the branch

- `npm run test:backend`: 416 run, OK, 11 environment skips. Includes 11 bridge tests and a concurrent-scanner regression.
- `npm run test:dom`: 111 pass. `npm run test:app`: 34 pass against the thread-mode server.
- `npm run lint`, `npm run build`, `npm run check:docs` and `git diff --check` pass.
- `vercel build` output marks the function `supportsResponseStreaming: true` and bundles `mazi/**` and the provider CA certificate.

## Live checks without a session

Run from this Mac with `curl` after deployment.

| Check | Result |
| --- | --- |
| `/`, `/atlas` | 200 HTML with the CSP and `nosniff` headers |
| `/health` | 200 `{"status": "ok"}`, median 133 ms over five calls |
| `/land.geojson` | 200, 138,160 bytes |
| `/api/session` signed out | 403 `Sign in required`, median 156 ms |
| `/api/entry` with a wrong code | 403 `The shared code is incorrect`, which proves the function reached hosted PostgreSQL and received the original path after the rewrite |
| `GET /api/work` without or with the cron secret | 401, then 200 `{"pending": false}` |
| `POST /api/work` with a foreign Origin | 403 |

## Live signed-in journey

The owner signed in to the production circle in the browser pane. A 12-photo synthetic manual ZIP was generated in the page; no private archive was uploaded. The requests below are the ones the Imports UI makes, sent from the signed-in page. The pane's embedded page reported `document.hidden` outside each tool action, so the shell itself stayed on its loading screen; the owner's separate sign-in in their own browser loaded normally.

| Step | Result |
| --- | --- |
| Upload | 12,812,919 bytes in 25 chunk requests, median 868 ms, maximum 1,139 ms, 27.4 s total |
| Scan and processing through `POST /api/work` | `COMPLETED`, 12 `AVAILABLE_TO_GROUP`, 12 unique assets, about 107 s from first byte |
| Atlas | 200, 6,674 bytes, 405 ms |
| Gallery | 200, 12 items, 334 ms |
| Preview and original | 200, 855,233 and 1,067,608 bytes, both decoded at 1100x1100 |
| Keyword search | 200, total 12, 550 ms |
| Export | 200 `application/zip`, 12,827,982 bytes with valid ZIP start and end records, 4.5 s |
| Withdraw | 200; afterwards gallery 0, Atlas 0, run `withdrawn: true` |

The export exceeds the 4.5 MB non-streamed limit by almost three times, which confirms streaming on the platform.

## Not verified

- Deletion of the withdrawn objects from private Storage. Reading the production schema to confirm it was blocked by the session's permission policy.
- Cold-start latency. One early page load stayed on the loading screen for several seconds before entry appeared; it was not timed.
- Behavior under concurrent members, large hosted archives, and phone hardware.
- Import progress with every tab closed, apart from the daily cron. This is the accepted D20 tradeoff.
