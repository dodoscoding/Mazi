# Luminous night redesign plan

Mazi moves to the Luminous night visual world for every screen, in a dark default theme and a paper-atlas light theme, on desktop and phone. The owner chose direction A on 14 October 2026 from the Claude Design canvas at <https://claude.ai/artifact/Y8Em8hzT3gZ6NB3CyTGRGb> (page "Round 2 · Luminous night, every screen"). The canvas is the measured contract. Its artboards are HTML, so values are copied from their source rather than estimated from pixels.

The work lands as eight stacked pull requests, each reviewable and testable on its own.

## Owner decisions, 14 October 2026

- Direction A, Luminous night, with the round 2 sheets as the spec for every screen and state.
- The space theme is approved. This revises D15 and the HELIOS note in PRODUCT.md.
- Delivery is a stack of pull requests, one per stage.
- Ambient sound is built. It stays off by default behind a visible toggle.
- People lines show evidence only. Contributors show as "shared by" and chat participants as "in the conversation". Nothing claims that a person was present.
- Night is the default theme for everyone. A header toggle switches to day, and the browser remembers the choice.

## Data shapes

- `Memory` gains `place: Place | null` and `people: { shared: string[]; conversation: string[] }`.
- `Place` is `{ name: string; country: string; latitude: number; longitude: number }`. Coordinates come from `shared_places`, which already stores city-level latitude and longitude. A memory whose assets disagree on a city has no single place and goes to the "No place recorded" shelf.
- Place agreement compares city names without case and within 50 km; the most common spelling is shown. Free-text review places are descriptions and never move coordinates.
- The globe reads one pure model, `buildAtlas(memories)`, which returns place nodes (memories grouped by place, with per-year counts), journeys (arcs between consecutive distinct places in date order), the year range, and unplaced memories.
- The theme is one value, `"night" | "day"`, stored under `mazi.theme` and applied as `data-theme` on the root element.
- Sound is one value, `"on" | "off"`, stored under `mazi.sound`, default `"off"`.
- Selection stays in the URL as `?selected=<memory id>`. The portal is `?selected=<id>&view=portal`, so Back and Esc close it.

## Stack

| PR | Stage | Owns | Depends on |
| --- | --- | --- | --- |
| 1 | Tokens, fonts, themes, shell, route split | `src/App.tsx`, `src/Shell.tsx`, `src/theme/*`, `src/ui/*`, `src/styles/*`, `index.html`, `package.json`, docs | None |
| 2 | Place and people data | `mazi/atlas.py`, `tests/backend/test_atlas.py`, `src/memories.ts` | None |
| 3 | Globe Atlas, portal and dossier, first-visit intro | `src/Home.tsx`, `src/atlas/*`, `src/styles/home.css` | 1, 2 |
| 4 | Memory detail | `src/MemoryView.tsx`, `src/Photo.tsx`, `src/styles/memory.css` | 1, 2 |
| 5 | Timeline, Search, Memories, Discover | `src/Browse.tsx`, `src/features/discovery/*`, `src/features/memories/*`, `src/styles/browse.css` | 1, 2 |
| 6 | Imports, circle, review, places, Ask, evidence, About | the other `src/features/*` folders | 1 |
| 7 | Entry and the introduction beats | `src/Entry.tsx`, `src/styles/entry.css` | 1 |
| 8 | Ambient sound | `src/sound/*`, small hooks in shell and Atlas | 1, 3 |

PR 1 and PR 2 run first and in parallel. PRs 3 to 7 then run in parallel in separate worktrees. Each owns disjoint files, so no two workers write the same file. PR 8 follows PR 3. Each new browser behaviour gets its own spec file to keep shared test files out of parallel work. Existing specs change only where a label truly changed.

## Verification for every PR

- `npm run typecheck`, `npm run build` and `npm run lint` pass.
- `npm test` passes for desktop and phone projects. `npm run test:backend` passes when Python changes.
- New behaviour has a Playwright spec that drives it the way a member would.
- Screenshots at 1440 and 390 wide, in night and day, compared against the matching artboards.
- Reduced motion and the 3D-unavailable path are exercised where the PR touches motion or the globe.
- Axe reports no violations on the screens the PR changes.

## Not done here

- Physical-device acceptance on mid-range Android stays open, as in M0.
- The ten-lane cloud swarm from the upstream plan template is not run. This host has local subagents only. Each PR gets one independent review instead.
