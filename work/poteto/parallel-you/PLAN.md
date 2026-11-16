# Parallel You work plan

> **For agentic workers:** use superpowers:subagent-driven-development or superpowers:executing-plans to carry out one slice at a time. Steps use checkbox (`- [ ]`) syntax. Write each test before the code it covers and watch it fail first.

**Goal:** a members-only Parallel You space inside Mazi: branching AI-written fictional chapters, a multiverse map, and endings, with no archive data involved.

**Architecture:** a lazily loaded React route in `src/parallel/`, pure TypeScript domain modules with unit tests, browser storage per member, and one Python endpoint in `mazi/parallel/` behind the shared-code session that calls Claude with structured outputs, enforces limits and stores no story text.

**Tech stack:** Vite, React 19, TypeScript, plain CSS on `src/styles/tokens.css`, SVG; Python 3.12, the `anthropic` SDK with Pydantic models; `node --test`, `unittest`, Playwright, axe.

The product decisions, contracts and acceptance IDs (PY-A1 to PY-A12) live in [docs/PARALLEL_YOU.md](../../../docs/PARALLEL_YOU.md). Placement is decided: members-only inside Mazi. This plan also assumes the recommended options for the open choices: browser storage, roles instead of names, Mazi's night look. If the owner picks differently, revise the affected slice before starting it.

## Owner decisions, 1 November 2026

- Add Parallel You as an addition to Mazi.
- Hybrid direction C with the game side slightly stronger.
- Members-only inside Mazi, behind the shared-code session, not a separate public app.
- Plans go into a new pull request first. Everything else is open; see the decisions list in the plan document.

## Stack

| PR | Slice | Owns | Depends on |
| --- | --- | --- | --- |
| 1 | PY-S1 story core | `src/parallel/{model,tree,layout,storage,request,fixtures}.ts`, `tests/unit/parallel-*.test.ts`, CI line for `test:unit` | None |
| 2 | PY-S2 screens on fixtures | `src/parallel/*.tsx`, `src/styles/parallel.css`, `App.tsx` branch, `Shell.tsx` entry, `vercel.json`, `mazi/server.py` `APP_PATHS`, `scripts/check-budgets.mjs`, `tests/parallel.spec.ts`, `playwright.config.ts` | 1 |
| 3 | PY-S3 story endpoint | `mazi/parallel/*`, `api/index.py`, `mazi/server.py` chain, requirements, hosted migration, `tests/backend/parallel/*`, `tests/backend/test_vercel_bridge.py` | None |
| 4 | PY-S4 live generation | `src/parallel/api.ts`, notice and error states, `tests/parallel-live.spec.ts` | 2, 3 |
| 5 | PY-S5 game layer | endings counter, twist tag, compare endings, motion, phone pass | 4 |
| 6 | PY-S6 evaluation and release | `mazi/parallel/evaluate.py`, `tests/backend/parallel/scenarios.json`, `package.json` script, docs, evidence | 3, 5 |

PR 1 and PR 3 can run at the same time in separate worktrees under `~/Desktop/Ales/Mazi-wt/`. They touch no common file.

## Verification for every PR

- `npm run typecheck`, `npm run build`, `npm run lint` and `npm run check:budgets` pass.
- `npm run test:unit` and `npm run test:dom` pass; `npm run test:backend` passes when Python changes.
- `npm test` passes for the desktop and phone projects when the interface changes.
- `npm run check:docs` and `git diff --check` pass when docs change.
- Screenshots at 1440 and 390 wide for interface changes, plus 320 for the map.
- Record commands and results in `work/poteto/parallel-you/VERIFICATION.md`. GitHub Actions jobs do not start on this account, so local runs are the evidence.

## PR 1: PY-S1 story core

Pure modules, no React, no network. Runtime imports between them use explicit `.ts` extensions (allowed by `allowImportingTsExtensions` in `tsconfig.json`) so `node --test` can load them, as `tests/unit/atlas-model.test.ts` does.

### Task 1.1: model constants and types

**Files:** create `src/parallel/model.ts`.

- [ ] Write the types from the data model section of the plan document, plus these constants:

```ts
export const METERS = ["finances", "relationships", "freedom", "wellbeing"] as const;
export type Meter = (typeof METERS)[number];
export type Meters = Record<Meter, number>;
export const CHOICES_AT_DEPTH = [3, 2, 2, 0] as const;
export const MAX_DEPTH = 3;
export const MAX_DELTA = 15;
export const TOTAL_ENDINGS = 12;
export const LIMITS = { about: 280, whatIf: 280, label: 80, description: 200, universes: 20 } as const;
```

- [ ] `npm run typecheck`. Commit: `feat(parallel): add story model`.

### Task 1.2: tree operations

**Files:** create `src/parallel/tree.ts`; test `tests/unit/parallel-tree.test.ts`.

- [ ] Write failing tests:
  - `clampMeter` rounds and keeps 0-100 (`-4 -> 0`, `104 -> 100`, `55.6 -> 56`).
  - `applyDeltas` clamps each delta to plus or minus 15 before adding.
  - `addChild` rejects a second child for the same `(parentId, choiceIndex)`, a depth other than parent depth plus one, a depth above 3, a choice index outside the parent's choices, and a universe mismatch. It never mutates its input.
  - `pathTo` returns root to node in order and throws on a missing ancestor.
  - `stubs` lists every untaken `(parentId, choiceIndex)` in a universe; `endingsFound` counts depth-3 nodes.
- [ ] Run `node --test tests/unit/parallel-tree.test.ts`; expect failures for missing exports.
- [ ] Implement:

```ts
import { CHOICES_AT_DEPTH, MAX_DEPTH, MAX_DELTA, METERS } from "./model.ts";
import type { Meters, StoryNode } from "./model.ts";

export type Nodes = Readonly<Record<string, StoryNode>>;

export const clampMeter = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

export function applyDeltas(meters: Meters, deltas: Meters): Meters {
  const next = { ...meters };
  for (const meter of METERS) {
    const delta = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, deltas[meter]));
    next[meter] = clampMeter(meters[meter] + delta);
  }
  return next;
}

export const childOf = (nodes: Nodes, parentId: string, choiceIndex: number) =>
  Object.values(nodes).find((node) => node.parentId === parentId && node.choiceIndex === choiceIndex);

export function addChild(nodes: Nodes, node: StoryNode): Nodes {
  if (node.depth > MAX_DEPTH) throw new Error("Too deep");
  const parent = node.parentId === null ? null : nodes[node.parentId];
  if (node.parentId !== null && !parent) throw new Error("Unknown parent");
  if (parent) {
    if (parent.universeId !== node.universeId) throw new Error("Universe mismatch");
    if (node.depth !== parent.depth + 1) throw new Error("Wrong depth");
    if (node.choiceIndex === null || node.choiceIndex < 0 || node.choiceIndex >= parent.choices.length)
      throw new Error("Unknown choice");
    if (childOf(nodes, parent.id, node.choiceIndex)) throw new Error("Branch exists");
  } else if (node.depth !== 0 || node.choiceIndex !== null) throw new Error("Root must start at depth 0");
  if (node.choices.length !== CHOICES_AT_DEPTH[node.depth]) throw new Error("Wrong choice count");
  return { ...nodes, [node.id]: node };
}

export function pathTo(nodes: Nodes, id: string): StoryNode[] {
  let current: StoryNode | undefined = nodes[id];
  if (!current) throw new Error("Unknown node");
  const path: StoryNode[] = [];
  while (current) {
    path.unshift(current);
    if (current.parentId === null) break;
    current = nodes[current.parentId];
    if (!current) throw new Error("Missing ancestor");
  }
  return path;
}

export function stubs(nodes: Nodes, universeId: string) {
  return Object.values(nodes)
    .filter((node) => node.universeId === universeId)
    .flatMap((node) => node.choices.map((_, choiceIndex) => ({ parentId: node.id, choiceIndex })))
    .filter(({ parentId, choiceIndex }) => !childOf(nodes, parentId, choiceIndex));
}

export const endingsFound = (nodes: Nodes, universeId: string) =>
  Object.values(nodes).filter((node) => node.universeId === universeId && node.depth === MAX_DEPTH).length;
```

- [ ] Run the tests; expect PASS. Commit: `feat(parallel): add branching tree rules`.

### Task 1.3: map layout

**Files:** create `src/parallel/layout.ts`; test `tests/unit/parallel-layout.test.ts`.

- [ ] Write failing tests: a lone root sits at column 0; leaves (nodes and stubs) get distinct rows in depth-first choice order; a parent's row is the mean of its children's rows; the full 22-node tree has 12 leaf rows; output is stable for the same input.
- [ ] Implement leaf counting: walk depth-first from the root, treating each stub as a leaf; assign `x = depth`, `y = next leaf row` for leaves and `y = average of children` for parents. Return `{ id, kind: "node" | "stub", parentId, choiceIndex, x, y }[]` and the row count.
- [ ] Run tests; PASS. Commit: `feat(parallel): lay out the multiverse map`.

### Task 1.4: browser storage

**Files:** create `src/parallel/storage.ts`; test `tests/unit/parallel-storage.test.ts`.

- [ ] Write failing tests with an in-memory `Storage` stub:
  - Key is `mazi.parallel.v1.<memberId>`; two members never see each other's universes.
  - A missing key loads an empty store; malformed JSON loads empty and reports `corrupt`.
  - Records failing the guard (bad depth, meters outside 0-100, unknown universe, too-long text) are dropped and counted.
  - `save` refuses a 21st universe with `limit`, and quota errors from `setItem` return `full` instead of throwing.
  - `removeUniverse` deletes its nodes; `clear` removes the key.
- [ ] Implement with a hand-written `isNode` and `isUniverse` guard. No Zod.
- [ ] Run tests; PASS. Commit: `feat(parallel): keep universes in browser storage`.

### Task 1.5: request builder and fixture engine

**Files:** create `src/parallel/request.ts` and `src/parallel/fixtures.ts`; test `tests/unit/parallel-request.test.ts`.

- [ ] Write failing tests: `buildChapterRequest(universe, nodes, parentId, choiceIndex)` returns the JSON shape in the plan document, `path` holds at most three ancestors with their titles, years, taken choice labels and key events, and depth equals parent depth plus one; the root request has `choice: null` and depth 0. `fixtureChapter(request)` is deterministic, follows `CHOICES_AT_DEPTH`, and returns an ending at depth 3.
- [ ] Implement both. Fixture text is short, fictional and labelled as a sample.
- [ ] Run tests; PASS.
- [ ] Add `- run: npm run test:unit` after `npm run test:dom` in `.github/workflows/verify.yml`.
- [ ] Commit: `feat(parallel): build chapter requests and fixture chapters`.

## PR 2: PY-S2 screens on fixtures

### Task 2.1: route and lazy chunk

**Files:** modify `src/App.tsx` (branch before the `isFeaturePath` branch near line 112), `src/Shell.tsx` (one navigation entry), `vercel.json` (rewrite for `/parallel`), `mazi/server.py` (`APP_PATHS`); create `src/parallel/ParallelPage.tsx`.

- [ ] Write a failing Playwright test in `tests/parallel.spec.ts` that signs in, opens `/parallel`, sees "AI-written fiction" and "Begin a universe", and confirms no `/api/atlas` request was made. Add the spec to `testMatch` in `playwright.config.ts`.
- [ ] Load the page with `lazy(() => import("./parallel/ParallelPage"))`, as `src/atlas/AtlasStage.tsx` loads the globe. The branch skips archive loading like feature paths do.
- [ ] Run `npx playwright test tests/parallel.spec.ts --project=desktop`; PASS. Commit: `feat(parallel): open Parallel You from the shell`.

### Task 2.2: screens

**Files:** create `src/parallel/{Home,Origin,Chapter,MultiverseMap,MapList}.tsx`, `src/parallel/useParallel.ts` (reducer plus storage effect), `src/styles/parallel.css`.

- [ ] Extend the spec first: fill the origin, receive the fixture chapter, pick choice 2, return through the map, pick choice 1, reload, and see both branches (PY-A1 on fixtures). Over-long text is blocked with a visible message (PY-A4, client half).
- [ ] Build the screens from the plan document. Nodes are `<button>` elements positioned from `layout.ts`; edges are one SVG `<path>` each; stubs use a dashed outline and the label "Path not taken". The list view renders the same tree as nested lists of links.
- [ ] Style with existing tokens. Violet and teal are new custom properties scoped to `.parallel`. No new fonts.
- [ ] Run the spec on desktop and phone; add axe checks for home, chapter and map (PY-A10). Commit: `feat(parallel): add story screens and map`.

### Task 2.3: budget line

**Files:** modify `scripts/check-budgets.mjs` and `docs/PERFORMANCE_BUDGETS.md`.

- [ ] Add `{ name: "Parallel You chunk", pattern: /^ParallelPage-.*\.js$/, max: 24 * 1024 }` and raise "All scripts" by 24 KiB only if the owner approved decision 8. Record measured values.
- [ ] `npm run build && npm run check:budgets`; PASS. Commit: `chore(budgets): add the Parallel You chunk`.

## PR 3: PY-S3 story endpoint

The provider is behind an adapter so tests never reach the network. `MAZI_PARALLEL_ENABLED` defaults off; `MAZI_PARALLEL_PROVIDER` is `fake` or `anthropic`; `ANTHROPIC_API_KEY` is read only by the adapter.

### Task 3.1: request and output validation

**Files:** create `mazi/parallel/__init__.py`, `mazi/parallel/contract.py`; test `tests/backend/parallel/__init__.py`, `tests/backend/parallel/test_contract.py`.

- [ ] Write failing tests: limits from the plan document (280, 80, 200 characters; path of at most three; depth 0 to 3; body at most 8 KiB); control characters stripped; deltas clamped to plus or minus 15 and meters to 0-100; narrative outside 80-260 words rejected; wrong choice count for the depth rejected; year earlier than the parent or more than six years later rejected.
- [ ] Implement a Pydantic `Chapter` output model and plain validation for the request. The server computes the new state from the submitted state and the clamped deltas.
- [ ] `npm run test:backend`; PASS. Commit: `feat(parallel): validate chapter requests and output`.

### Task 3.2: prompt and provider adapter

**Files:** create `mazi/parallel/prompt.py`, `mazi/parallel/provider.py`; test `tests/backend/parallel/test_provider.py`.

- [ ] Write failing tests with a fake client: the system prompt is byte-identical across requests (cacheable); member text appears only inside the user message, quoted; twist probability follows tone (15, 30, 50 percent) with an injected random source; a parse failure retries once and then raises `BadOutput`; a `refusal` stop reason raises `Declined`; timeouts raise `Unavailable`.
- [ ] Implement the Anthropic adapter with the official SDK. Call `client.messages.parse(model="claude-opus-5-5", max_tokens=16000, output_config={"effort": "low"}, output_format=Chapter, ...)` and check `stop_reason` before reading `parsed_output`. Enable the server-side refusal fallback (`fallbacks="default"` with the `server-side-fallback-2026-07-01` beta) after confirming the binding against the SDK documentation; the parse helper may need the beta client. Set a 60-second timeout and `max_retries=1`.
- [ ] Add `anthropic` at an exact version to `requirements.txt` and `mazi/requirements.txt`. Confirm the function bundle on a preview deploy.
- [ ] Run tests; PASS. Commit: `feat(parallel): write chapters with Claude structured outputs`.

### Task 3.3: limits, notice and the route

**Files:** create `mazi/parallel/engine.py`, `mazi/parallel/server.py`; modify `mazi/server.py` (handler chain); create `infra/hosted/supabase/migrations/<timestamp>_parallel_usage.sql`; test `tests/backend/parallel/test_http.py`.

- [ ] Write failing HTTP tests with `handler_for` and the fake provider: feature off returns 404 (PY-A6); signed out returns 403; notice not accepted returns 403 with code `parallel_notice`; `POST /api/parallel/notice` records the version; the 31st chapter in a UTC day returns 400 `parallel_quota` without calling the provider (PY-A7); the circle limit applies the same way; self-harm terms return 422 `parallel_declined` without calling the provider (PY-A8); a fake malformed output returns 502 and records no usage beyond the reservation (PY-A3); depth 4 returns 400 (PY-A5).
- [ ] Copy the `answer_usage` pattern from `mazi/answers/answers.py`: a `SCHEMA` string with `parallel_usage(group_id, "user", day, chapters)` and `parallel_notice(group_id, "user", version, accepted_at)`, `initialize_schema`, and a departure trigger. Write the matching Postgres migration.
- [ ] Split the work into `reserve(store, user)`, `generate(request)` and `settle(store, reservation, outcome)`. Only `reserve` and `settle` touch the store.
- [ ] Run tests; PASS. Commit: `feat(parallel): add the chapter endpoint with limits`.

### Task 3.4: release the request lock during generation

**Files:** modify `api/index.py`; test `tests/backend/test_vercel_bridge.py`.

- [ ] Write a failing test: with a fake provider that sleeps two seconds, start a chapter request and then `GET /api/session` on the same app; the session answer arrives before the chapter finishes (PY-A11).
- [ ] For `POST /api/parallel/chapter` only, run `reserve` under `_request_lock`, call `generate` without it, and run `settle` under it again. Every other route keeps today's behavior.
- [ ] The local server in `mazi/server.py` is single-threaded. Use the fake provider locally by default and document that a real local call blocks the local server while it runs.
- [ ] Run `npm run test:backend`; PASS. Commit: `fix(api): keep the archive responsive during story generation`.

### Task 3.5: contracts

**Files:** modify `docs/PRIVACY.md`, `docs/CONTRACTS.md`, `docs/DEPLOYMENT.md`, `docs/DECISIONS.md`.

- [ ] Add a Parallel You section to PRIVACY (inputs, provider, notice, retention terms once recorded), the endpoint contract to CONTRACTS, the environment variables to DEPLOYMENT, and the owner's provider decision as a PY-D1 follow-up.
- [ ] `npm run check:docs`; PASS. Commit: `docs(parallel): record the story endpoint contracts`.

## PR 4: PY-S4 live generation

**Files:** create `src/parallel/api.ts`, `src/parallel/Notice.tsx`, `src/parallel/Support.tsx`; modify the reducer; test `tests/parallel-live.spec.ts` (added to `testMatch`).

- [ ] Write failing Playwright tests that mock `/api/parallel/*` with `page.route`: the notice appears once and is accepted; a 15-second response shows the loading state with the chosen card held in place; 503 shows Retry and creates no node (PY-A2); 502 shows an error (PY-A3); 422 shows the support card (PY-A8); 400 `parallel_quota` shows the limit message (PY-A7); 403 dispatches `mazi:access-lost` like other features.
- [ ] Implement `api.ts` with `fetch`, a 75-second abort, and one in-flight request per universe. Fixtures remain available behind `?demo=1`.
- [ ] Run desktop and phone projects; PASS. Commit: `feat(parallel): generate chapters live`.

## PR 5: PY-S5 game layer and polish

- [ ] Tests first for each item in `tests/parallel.spec.ts` or unit tests:
  - "Endings found: n of 12" on home cards and the map (unit test for the count, browser test for the label).
  - The "Unexpected" tag on twist chapters.
  - Compare endings: pick two endings, see both paths and meters side by side, with the fictional label.
  - Edge draw-in and node rise use token durations; with `prefers-reduced-motion` only a short fade remains (browser test with emulated reduced motion).
  - No horizontal scroll at 320 px; targets at least 44 px, 48 px on phones.
  - "This chapter feels wrong" offers regenerate or delete; delete removes the node and its descendants after confirmation.
- [ ] Implement, then capture screenshots at 1440, 390 and 320 wide.
- [ ] Commit per feature, for example `feat(parallel): count endings found`.

## PR 6: PY-S6 evaluation and release

### Task 6.1: evaluation harness

**Files:** create `mazi/parallel/evaluate.py`, `tests/backend/parallel/scenarios.json`; modify `package.json` (`eval:parallel`).

- [ ] Write 12 scenarios: four origins (two Turkish, two English, one touching grief) in each of the three tones. Each runs root, one choice and one ending.
- [ ] Automatic checks per chapter: schema valid, word count, choice count for depth, meters in range, year order, no proper names from the origin, story language matches the origin, no "will happen" style predictions. Exit non-zero on failure, like `mazi/answers/evaluate.py`.
- [ ] With the fake provider the harness runs in `npm run test:backend`. A real run needs `MAZI_PARALLEL_EVAL_LIVE=1`, costs about $1.10 at list prices (36 chapters), and runs only after the owner approves the spend. Save outputs and a short human rubric (consistency, balance, tone) under `work/poteto/parallel-you/evidence/`.
- [ ] Tune `effort` from the results. Commit: `test(parallel): evaluate story quality`.

### Task 6.2: release

- [ ] The owner adds `ANTHROPIC_API_KEY`, `MAZI_PARALLEL_PROVIDER=anthropic` and `MAZI_PARALLEL_ENABLED=1` in the Vercel project, sets the provider's monthly spend limit, and applies the hosted migration in the Supabase SQL Editor.
- [ ] Follow the existing release procedure: clean worktree at `main`, `vercel deploy --prod --skip-domain`, smoke `/api/parallel/notice` and one chapter with `vercel curl`, then promote.
- [ ] Record the run, cost and screenshots in `VERIFICATION.md`. Commit: `docs(parallel): record release evidence`.

## Not done here

- Server-side story storage, sharing endings with the circle, and comments or reactions on stories. They follow D25's social contracts.
- Any use of archive memories, photographs, chats, people or places as story input.
- Images, 3D, sound beyond the existing optional cue, Life Book and Random Universe.
- Streaming chapters as they are written.
