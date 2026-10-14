# Local app architecture

Mazi combines the Atlas interface and the complete local archive engine in one app as of 14 October 2026. This supersedes the separate Atlas and numbered phase runtimes. Production architecture and acceptance in D01 remain separate.

## Runtime

`npm run dev` supervises a Vite interface and a loopback Python API/worker. Vite forwards `/api`, `/health` and `/land.geojson` without rewriting the browser Host, preserving Origin validation. The browser uses one origin and one HttpOnly session cookie. `npm start` builds the interface and serves both assets and APIs from Python.

`python -m mazi` is the backend entry point. The app stores data in `.mazi-imports`, with the existing SQLite schema and original/preview file keys. The background worker uses a separate connection. No database conversion or automatic sample seeding occurs. The historical `.mazi-pilot` archive remains separate.

## Ownership

| Directory | Responsibility |
| --- | --- |
| `src/App.tsx`, `src/Atlas.tsx` | Shared navigation, Atlas selection, memory detail, timeline and renderer recovery. |
| `src/useArchive.ts`, `mazi/atlas.py` | Live authorized Atlas cards, consistent projection, request cancellation and private-state invalidation. |
| `src/features/` | Imports, review, places/sources, discovery, answers/evidence and advanced memories in the shared shell. |
| `mazi/identity/` | Accounts, sessions, groups, invitations and original pilot contracts. |
| `mazi/imports/`, `mazi/archive/` | Resumable ingestion, provenance, correction, duplicates and accepted memories. |
| `mazi/sources/`, `tools/apple-photos/` | Source intake, shared places, Discord and the macOS Photos companion. |
| `mazi/discovery/`, `mazi/answers/` | People, hiding, consent, search and evidence-based answers. |
| `mazi/memories/` | Recaps, stories, revisions, capsules, subevents, slideshows, video and notices. |
| `tests/backend/`, `tests/browser/`, `tests/unified.spec.ts` | Domain regression contracts, fixture servers and integrated app journeys. |

React owns routes and feature lifecycles. Existing feature workflows are scoped DOM modules with imported HTML fragments. Each mount owns its requests, timers and object URLs and disposes them on navigation or backgrounding. They are bundled application modules, without standalone pages, script injection or iframes. The migrated imperative modules remain JavaScript; the shared lifecycle, registry and Atlas code are TypeScript. Converting individual forms to React can happen within these feature boundaries.

## Atlas data and appearance

Atlas retains Libre Caslon Text, Source Sans 3, navy/ivory/copper colors and the procedural Fiber/Three chart. The chart displays at most three current memory planes. It is a chronological visual index, not inferred geography. Private textures are owned and disposed by the mounted scene. Keyboard/touch HTML controls and flat-view recovery remain available.

The server builds cards from authorized photographs and fully visible approved events. Cross-year and undated records remain available with honest date labels. It never borrows fictional messages or dates. A hidden or partially inaccessible event cannot expose its title through Atlas. The explicit `?demo=1` sample uses checked-in synthetic fixtures; a new personal archive stays empty.

## Local scope

Imports support the existing synthetic archive formats and JPEG/PNG validation. People use manual associations and confirmed identities. Related search has an offline baseline and optional local CLIP model. Answers are extractive and preserve abstention, consent and live evidence checks. Capsules use server UTC unlock. Video remains a silent, bounded MJPEG AVI download. Notifications remain opt-in and in-app.

These integrations do not establish production authentication, hosted storage, provider compatibility, physical-device performance or production milestone acceptance. See [the consolidation evidence](../work/poteto/unified-app/VERIFICATION.md) and [README](../README.md) for commands.
