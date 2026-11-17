# Parallel You plan

On 1 November 2026 the owner asked to add Parallel You to this repository as an addition to Mazi. Parallel You is an AI alternative-life simulator: a member changes one decision, a model writes a short fictional chapter of the life that might have followed, and every new choice opens a branch on a "multiverse map". The owner chose the hybrid direction (C) with a stronger game side. [The preserved blueprint](source/PARALLEL_YOU_BLUEPRINT.md) is the source; [PY-D1](DECISIONS.md#parallel-you-experiment-1-november-2026) records the request.

This document records the original proposed plan. On 14 November 2026 the owner requested implementation while keeping external AI disabled. The local sample implementation now covers the story core, screens, branching map, endings, browser persistence, fake-provider API, notice, quotas and lock isolation. See [implementation verification](../work/poteto/parallel-you/VERIFICATION.md) for tested scope and remaining live-provider work. No external model provider, keys, paid services or deployment are enabled. The step-by-step implementation plan is in [the Parallel You work plan](../work/poteto/parallel-you/PLAN.md).

## Summary

- **What ships first:** a members-only Parallel You space inside the Mazi website, loaded only when opened. The owner chose this placement on 1 November 2026. A member writes a "What if...", reads chapters, picks among three choices and then two, and explores branches on a 2D map. Depth stops at three decisions; the chapter after the third decision is an ending.
- **What changes from the blueprint:** the product and data model stay. The stack follows this repository instead of Next.js: the existing Vite and React app, a Python story endpoint behind the shared-code session, a hand-drawn SVG map instead of React Flow, and no Tailwind, Zustand, Zod or Motion dependency.
- **What it never touches:** v0.1 reads nothing from the archive. Fiction never enters memories, Atlas, Timeline, Search, Ask, notebooks or exports, and every Parallel You screen says it is fiction.
- **Delivery:** six slices, PY-S1 to PY-S6, about 13 working days for one developer. The first two slices need no AI and no owner decision. Live generation (PY-S3 onward) waits for the owner decisions listed at the end.

## Fit with Mazi

Mazi is a private archive of real memories for one 8-10 person circle, now evolving toward a private social space ([D25](DECISIONS.md#private-social-space-direction-1-november-2026)). Parallel You is invented fiction about one member's own choices. The two connect in useful ways and conflict in risky ones.

| | Mazi today | Parallel You | Consequence |
| --- | --- | --- | --- |
| Content | Real photographs, chats, dates and places with provenance | Model-written fiction | Fiction must be visibly separate and never stored with archive content. |
| Truth rules | Evidence links, visible uncertainty, scores never called probabilities ([CONTRACTS](CONTRACTS.md)) | Fictional meters from 0 to 100 | Meters are labelled fictional, never compared between members, never called likelihoods. |
| AI | Memory answers are local and extractive; no external provider is selected ([PRIVACY](PRIVACY.md)) | Needs a hosted language model | Parallel You would be the first external model call. It needs its own provider decision and recorded terms. |
| Audience | Signed-in circle only; signed-out visitors see the login screen ([D17](DECISIONS.md)) | Blueprint assumed no accounts | Inside Mazi it is members-only. A public version would be a separate app. |
| Browser storage | Authorized archive data is never written to browser storage ([D24](DECISIONS.md#keep-the-view-in-the-background-24-october-2026)) | Blueprint stores universes in localStorage | Fiction the member wrote is not archive data, but PY-D1 records the exception explicitly. |
| Social direction | Comments, reactions and events proposed under D25 | Endings could later be shared with the circle | Sharing is a later slice with its own contracts; v0.1 is single-player. |

A later bridge, such as starting a "What if" from a real shared memory, would send archive content to a provider. [PRIVACY](PRIVACY.md) requires separate purpose controls and every contributor's consent for that, so it stays out of this plan.

## Reconciling the blueprint with this repository

| Blueprint choice | Plan in this repository | Reason |
| --- | --- | --- |
| Next.js monolith | A lazy route in the existing Vite SPA (`src/parallel/`) | One framework, one build and one Vercel project. `vercel.json` already declares the Vite framework. |
| Tailwind CSS | Scoped CSS on the existing tokens in `src/styles/tokens.css` | The repository has no Tailwind; tokens already cover type, spacing, motion and reduced motion. |
| React Flow (`@xyflow/react`) | HTML buttons for nodes, SVG paths for edges, about 20 lines of layout code | React Flow measures about 60 KiB gzip. The total script budget has about 21 KiB of headroom ([budgets](PERFORMANCE_BUDGETS.md)). A tree of at most 22 uniform nodes needs no pan or zoom engine. |
| Motion | CSS transitions, SVG `stroke-dashoffset` for edges, the existing View Transitions helper | The app already animates without a library; Motion would cost 30-45 KiB gzip. |
| Zustand | `useReducer` and a storage effect | One screen's state; Zustand adds a dependency for no new capability. |
| Zod | Pydantic on the server (installed with the provider SDK); a small hand-written guard for stored browser data | Model output is validated where it enters, on the server. |
| Structured-output LLM | Claude through the official Anthropic Python SDK with structured outputs | Python is the repository's server language; the key never reaches the browser. |
| localStorage | localStorage, versioned and keyed per member, with delete controls | Keeps v0.1 free of new archive tables for story content. |
| Vitest and Playwright | `node --test` units, Python `unittest`, Playwright desktop and phone projects | Reuse the existing test runners and CI jobs. |
| Vercel | The existing Vercel project and Python function | One deployment; see the request lock below. |
| Space Grotesk, Inter, new palette | Mazi's self-hosted Geist and Instrument Serif, Parallel You accents scoped to its screens | Fonts must be self-hosted; a second font family adds weight for little gain. |
| No accounts | The Mazi shared-code session | Protects the paid endpoint and keeps the space private to the circle. |

## Placement options

| Option | What it means | For | Against |
| --- | --- | --- | --- |
| 1. Members-only route in Mazi (chosen) | `src/parallel/` loaded with `import()` from a branch in `App.tsx`; `mazi/parallel/` adds `/api/parallel/*` to the handler chain | Existing session, CSP, tokens, tests and deploy. The paid endpoint is never public. Fits D25's private social space. | Must stay inside the script budget. The model call must not hold the bridge's request lock. Only circle members can play. |
| 2. Second HTML entry in the same project | `parallel/index.html` as another Vite input, served beside Mazi | Mazi's entry bundle is untouched; could be public. | Changes Vite input, static serving in `mazi/server.py`, rewrites and budget checks. A public paid endpoint needs its own limiter. |
| 3. Separate app, ideally its own Vercel project | Own folder, build and TypeScript function | Blueprint stack usable as written; no effect on Mazi. | Duplicate tooling and CI, no Mazi session, and a public paid endpoint that needs IP rate limits, a daily cap store and abuse handling. |

On 1 November 2026 the owner chose option 1. Option 3 remains the path if a public, shareable product is wanted later. It would add one Vercel WAF rate-limit rule (Hobby allows one), a daily cap in a small store such as Upstash, and a hard monthly spend limit at the provider. Vercel Hobby is for non-commercial use only.

## Product design

### Screens

1. **Parallel You home.** "What if you chose differently?", the member's universes as cards, and one primary action, Begin a universe. A permanent line says these are AI-written fictional stories, not predictions.
2. **Origin.** Three short fields and a tone: who you are now, the year of the turning point, and "What if..." (each at most 280 characters), then Realistic, Cinematic or Chaotic. Three example origins fill the form in one tap. The first visit shows the privacy notice before the first generation.
3. **Chapter.** Title, year, place and role, about 150 words, four fictional meters with animated changes, one to three key events, and choice cards. The first chapter offers three doors; the next two offer a fork of two. A twist chapter carries an "Unexpected" tag. At depth three the chapter is an ending: an ending title, a one-line epilogue and no choices.
4. **Multiverse map.** Chapters are nodes; choices not taken are faint "paths not taken" stubs. Selecting a chapter opens it; selecting a stub generates that branch. The chosen path glows. A list view gives the same tree as nested headings and links for screen readers and narrow phones.
5. **Compare endings (P1).** Two endings side by side: their paths and meters. The meters already exist, so this is cheap once endings ship.

### Game loop

One visit takes three to six minutes: origin, three decisions, an ending. The fixed shape (three doors, then two forks of two) gives every universe exactly 12 endings and at most 22 chapters, so the counter is honest and the map always fits. The replay hook is the map. Each universe shows "Endings found: 2 of 12" and its unexplored stubs, so going back to an earlier chapter and taking the other path is the natural next move. This follows the branch flowcharts in Detroit: Become Human and Zero Escape, where the chart is both a record and the way back to a decision.

Game levers stay small in v0.1:

- **Meters:** finances, relationships, freedom and wellbeing, each 0-100 and labelled fictional. Changes are shown; there is no winning score.
- **Twists:** the server marks some chapters as twists and asks the model for an unexpected event. Realistic uses 15 percent, Cinematic 30 percent and Chaotic 50 percent.
- **Endings:** depth three always ends. An ending has a title the member can collect.
- **Balance:** no choice is presented as the right one, and both upsides and costs appear in every chapter. Research on AI "future self" agents suggests one-sided presentation can shift real decisions.
- **Not in v0.1:** points, streaks, leaderboards, member comparisons ([SPEC](SPEC.md) excludes rankings), images, sound beyond the existing optional cue, and sharing.

### Writing rules

The blueprint's seven story rules stay: no contradiction of earlier events, no automatic success or failure, plausible time steps, a new conflict or opportunity in each chapter, 120-200 words, meaningful choices (fixed here at three, then two), and the fiction stays explicit. The plan adds four:

- People appear by role ("your co-founder", "a friend from university"), never by a real name, including names typed into the origin.
- The story is written in the language of the member's "What if", Turkish or English; the interface stays in English like the rest of Mazi.
- Sensitive topics such as illness, grief or divorce are allowed in a gentle register with no graphic detail. Self-harm or suicide in the input returns a support card with crisis resources instead of a chapter.
- Nothing claims to predict the member's real future or the real probability of an outcome.

## Story engine

### Request and response

`POST /api/parallel/chapter` is the only new endpoint for generation. The browser sends everything the model needs; the server keeps no story content.

```json
{
  "origin": { "about": "Software engineering student", "startYear": 2022, "whatIf": "I had studied in Japan instead of Denmark", "tone": "cinematic" },
  "path": [{ "title": "The First Winter", "year": 2022, "choice": "Join the robotics lab", "keyEvents": ["Moved to Sendai"] }],
  "state": { "location": "Sendai", "career": "Exchange student", "finances": 40, "relationships": 55, "freedom": 70, "wellbeing": 60 },
  "choice": { "label": "Accept the startup offer", "description": "Leave the lab for a two-person company." },
  "depth": 2
}
```

```json
{
  "title": "Night Shift at Shibuya",
  "year": 2024,
  "narrative": "...",
  "location": "Tokyo",
  "career": "Startup engineer",
  "state": { "finances": 31, "relationships": 60, "freedom": 78, "wellbeing": 52 },
  "deltas": { "finances": -9, "relationships": 5, "freedom": 8, "wellbeing": -8 },
  "keyEvents": ["Shipped the first prototype", "Missed a family wedding"],
  "twist": false,
  "choices": [{ "label": "Raise money", "description": "..." }, { "label": "Stay small", "description": "..." }],
  "ending": null
}
```

The application owns identity and structure, as the blueprint requires. The browser creates node identifiers, parent links and depth; the server checks depth, computes `state` from the submitted state and clamped changes, and returns choices without identifiers. The browser numbers them by position.

### Server rules

- **Input limits:** `about` and `whatIf` at most 280 characters, choice labels at most 80, descriptions at most 200, `path` at most three entries, body at most 8 KiB, depth 0 to 3. Control characters are stripped. Member text is passed to the model as quoted data, never as instructions.
- **Output schema:** a Pydantic model passed to the SDK's structured-output parser. After parsing, the server rejects narratives outside 80-260 words, clamps each change to plus or minus 15 and each meter to 0-100, keeps the year between the parent's year and six years later, and requires three choices at depth 0, two at depths 1 and 2, and none at depth 3. One malformed result is retried once; a second failure returns an error and creates no node.
- **Model:** `claude-opus-5-5` with structured outputs, `effort` set to `low` and tuned with the evaluation in PY-S6, and the SDK's server-side refusal fallback. The owner may choose a cheaper model; that is a cost decision, recorded in PY-D1's follow-up.
- **System prompt:** fixed text holding the writing rules, safety rules and output contract, so it can be cached. Volatile content goes in the user message.
- **Errors:** feature off returns 404; signed out or notice not accepted returns 403; invalid input returns 400; quota reached returns 400 with code `parallel_quota`; a refusal or sensitive input returns 422 with code `parallel_declined` and the support card; bad output after a retry returns 502; provider timeout or overload returns 503. The browser treats 401 and 403 like every other feature: access lost.
- **Logging:** never log member text or generated text. Log request id, latency, token usage, outcome code and model.

### The request lock

`api/index.py` serves every request in an instance under one lock, because the store holds one database connection. A chapter takes roughly 10-30 seconds; holding the lock that long would stall Atlas, Search and session checks for everyone served by that instance. The endpoint therefore runs in three phases: authorize and reserve one unit of quota under the lock, call the provider with the lock released, then settle usage under the lock. PY-S3 changes the bridge for this route only and adds a test proving a slow chapter does not block `/api/session`.

### Quota, cost and budget

Usage is a per-member, per-day counter in a new `parallel_usage` table that copies the `answer_usage` pattern in `mazi/answers/answers.py`, plus `parallel_notice` for the accepted notice version. Hosted Postgres needs a migration in `infra/hosted/supabase/migrations/`, applied by the owner. No story text is stored server-side.

Estimates use list prices of 1 November 2026 ($4 input and $20 output per million tokens for `claude-opus-5-5`) and about 1,800 input and 1,200 output tokens per chapter. They are planning figures, not measurements.

| Unit | Estimated cost |
| --- | --- |
| One chapter | about $0.03 |
| One universe with all 12 endings explored (22 chapters) | about $0.66 |
| Proposed member limit, 30 chapters a day | at most about $0.90 per member per day |
| Proposed circle limit, 150 chapters a day | at most about $4.50 per day |

The circle limit is enforced server-side; a hard monthly spend limit at the provider is the backstop. The €75 monthly ceiling in [DECISIONS](DECISIONS.md) was set before any model provider existed; the owner decides whether model spend counts against it or gets its own figure.

## Data model

The blueprint's model stays, with fields for endings and twists. Types live in `src/parallel/model.ts`.

```ts
type StoryTone = "realistic" | "cinematic" | "chaotic";
type Meter = "finances" | "relationships" | "freedom" | "wellbeing";

interface Universe {
  id: string;
  origin: { about: string; startYear: number; whatIf: string; tone: StoryTone };
  rootNodeId: string;
  createdAt: string;
}

interface StoryNode {
  id: string;
  universeId: string;
  parentId: string | null;
  choiceIndex: number | null;
  depth: 0 | 1 | 2 | 3;
  year: number;
  title: string;
  narrative: string;
  location: string;
  career: string;
  meters: Record<Meter, number>;
  deltas: Record<Meter, number>;
  keyEvents: string[];
  twist: boolean;
  choices: { label: string; description: string }[];
  ending: { title: string; epilogue: string } | null;
}
```

- **Tree rules:** a node's children are keyed by `choiceIndex`. Choosing a path that already has a child opens it instead of generating again, so a branch is never duplicated or overwritten. One generation per universe is in flight at a time.
- **Storage:** one key per member, `mazi.parallel.v1.<memberId>`, holding `{ version: 1, universes, nodes }`. At most 20 universes; the oldest is not removed silently, the member is asked. Loading validates every record and drops invalid ones with a notice. Home offers delete per universe and Delete all.
- **Separation:** nothing under `src/parallel/` imports archive modules, and no archive module imports Parallel You. Archive endpoints never receive Parallel You data.

## Privacy and safety

- **Input:** only what the member types in Parallel You. No memories, photographs, chats, people, places or member names are read or sent.
- **Notice:** before the first generation the member accepts a short notice: the text goes to the named AI provider, stories are fiction, do not include other people's real names or sensitive details, and stories stay in this browser. Acceptance is recorded per member and notice version on the server.
- **Provider terms:** [PRIVACY](PRIVACY.md) requires the provider's retention and training terms to be recorded and accepted before any external model is enabled, with no unverified zero-retention promise. PY-D1 keeps that gate.
- **Sensitive input:** a server-side check runs before the model call. Self-harm or suicide terms return the support card. Model refusals return the same card style without a chapter.
- **Fiction labelling:** "AI-written fiction" appears on Parallel You home, each chapter footer and the map. Meters say "fictional".
- **Report:** each chapter has "This chapter feels wrong", which stores nothing server-side in v0.1 and offers to regenerate or delete the chapter.
- **Shared devices:** stories stay in the browser profile under the member's key. Logout keeps them; Delete all removes them. The owner can choose to clear them on logout instead.

## Design

Parallel You uses Mazi's night theme, fonts, spacing, durations and easings ([DESIGN](../DESIGN.md)). Its own accents are scoped to its screens:

- Parallel violet `#7569F5` for choices and branches; text on a violet fill uses the void color, because light text on violet falls below 4.5:1.
- Timeline teal `#36C7BE` for the current path and the chosen edge.
- The single primary action uses Mazi's existing warm accent, keeping the Warmth Rule. Fate amber is not added.
- Panels use Mazi's tone plus a one-pixel line. There is no glassmorphism.
- The chosen edge draws in over 600 ms with `stroke-dashoffset`; new nodes fade and rise. Reduced motion leaves a short fade.
- Targets are at least 44 px, 48 px on phones; nothing scrolls sideways at 320 px; the map has its list equivalent.

## Delivery plan

| Slice | Scope | Depends on | Decision needed | Days |
| --- | --- | --- | --- | --- |
| PY-S1 | Story core: types, tree operations, meter clamping, storage, a fixture story engine, unit tests | None | None | 2 |
| PY-S2 | Screens and map on fixture stories: home, origin, chapter, map and list, Playwright desktop and phone, budget line | PY-S1 | Script budget line | 3 |
| PY-S3 | Story endpoint behind a feature flag: validation, prompt, provider adapter with a fake, quota, notice, lock split, migrations | None | Provider terms before the flag is turned on | 3 |
| PY-S4 | Live generation in the interface: notice, loading, errors, refusal card, retry | PY-S2, PY-S3 | None | 1.5 |
| PY-S5 | Game layer and polish: endings found, twists, compare endings, motion, phone pass | PY-S4 | None | 2 |
| PY-S6 | Story evaluation and release: fixed scenarios, one approved paid run, Vercel environment, deploy | PY-S3, PY-S5 | Spend approval for the run; release go-ahead | 1.5 |

PY-S1 and PY-S3 can run in parallel in separate worktrees; they share no files. The [work plan](../work/poteto/parallel-you/PLAN.md) lists files, tests and verification for each slice.

The Parallel You chunk gets its own budget line, proposed at 24 KiB gzip, and the total script budget rises by the same amount. The chunk loads only when a member opens Parallel You, so Mazi's entry and Atlas budgets do not change. [Performance budgets](PERFORMANCE_BUDGETS.md) requires this to be recorded as a decision.

## Acceptance

| ID | Scenario |
| --- | --- |
| PY-A1 | A member enters a "What if", receives chapter 1, picks a choice, reaches chapter 2, returns to chapter 1 on the map, picks another choice, gets a second branch, reloads, and sees both branches. |
| PY-A2 | A provider timeout shows an error with Retry and creates no node. |
| PY-A3 | Malformed model output is rejected and retried once; a second failure shows an error and creates no node. |
| PY-A4 | Over-long input is blocked in the form and rejected by the server. |
| PY-A5 | Depth 3 returns an ending without choices; the server rejects depth 4. |
| PY-A6 | Signed-out requests get 403; with the feature off the route is hidden and the endpoint returns 404. |
| PY-A7 | At the daily limit the member sees a clear message and no provider call is made. |
| PY-A8 | Self-harm input and model refusals show the support card and create no node. |
| PY-A9 | Parallel You content never appears in Atlas, Timeline, Search, Ask, notebooks or exports, and the fiction label is visible on every Parallel You screen. |
| PY-A10 | Phone widths of 390 and 320 px work, axe reports no violations, reduced motion is respected, and the map's list view matches the tree. |
| PY-A11 | A slow chapter does not delay `/api/session` served by the same function instance. |
| PY-A12 | Changes are clamped and meters stay within 0-100 whatever the model returns. |

These IDs are local to Parallel You. They do not extend Mazi's B01-B30, M0-M7 or T01-T15 series.

## Risks

| Risk | Mitigation |
| --- | --- |
| Fiction mistaken for real memories | Separate route, storage and API namespace; labels on every screen; PY-A9. |
| Model spend grows unnoticed | Feature flag, member and circle limits, provider spend limit, token usage in logs. |
| Stories feel repetitive or inconsistent | Structured state, ancestor events in every request, twists, tone rules, PY-S6 evaluation. |
| 10-30 second waits feel broken | A cinematic loading state with the chosen card held in place; streaming is a later option. |
| Script budget breach | Hand-drawn map, no new runtime dependencies in the browser, a recorded budget line. |
| One slow call stalls the archive | Three-phase lock handling and PY-A11. |
| Harm from sensitive "What if" prompts | Input check, support card, gentle register, refusal handling, report control. |
| Name collision | "Parallel You" is already used by at least one public prototype; the owner may rename before any public release. |
| Scope creep | 3D, image generation, accounts, Life Book, sharing and Random Universe stay out of v0.1. |

## Owner decisions

Decided:

1. **Placement:** members-only inside Mazi, chosen on 1 November 2026.

Open:

2. **Provider and model:** Anthropic Claude with `claude-opus-5-5` at low effort (recommended), or a cheaper model. Record the provider's retention and training terms before enabling.
3. **Spend:** member limit (30 chapters a day proposed), circle limit (150 a day proposed) and a monthly provider limit.
4. **Storage:** browser-only per member (recommended for v0.1), or server storage now.
5. **Logout:** keep stories in the browser (recommended) or clear them.
6. **Names:** roles only (recommended), or allow names the member types.
7. **Look:** Mazi night with scoped violet and teal (recommended), or the blueprint's own palette and fonts.
8. **Budget:** approve a 24 KiB Parallel You budget line.

## Verification of this plan

Three Sonnet scouts read `main` at 665902b and current external sources on 1 November 2026: repository integration, product and privacy rules, and libraries, Vercel limits and comparable products. Library sizes were measured with the bundlejs service and may differ from a Vite build. Costs are estimates from list prices. No code ran, no provider was called, and no budget was measured for Parallel You. `npm run check:docs` and `git diff --check` verify this document's structure only.
