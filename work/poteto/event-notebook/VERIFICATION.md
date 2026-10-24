# Event notebook verification

## Revision and environment

Base c9b580406e0ead1072bd556f5c239dba357fc4a1 from origin/main. Feature branch codex/event-notebook in an isolated managed worktree. Existing unrelated checkout files were left untouched. Local dependencies reuse the existing locked install and virtual environment through ignored symlinks. All fixtures and screenshots use synthetic content.

## Before implementation

- `npm run build` passed at the pinned base.
- `.venv/bin/python -m unittest tests.backend.memories.test_memories tests.backend.memories.test_memories_http` passed, 7 tests.
- `before-desktop.png` captures the existing sample memory at 1440 × 1024 with reduced motion. It shows the photo-first detail and the existing expandable conversation.
- `python3 work/poteto/product-plan/verify_docs.py` passed after the owner decision and scope were recorded.

## Architecture and review

Two independent sketches compare direct story APIs and an event-scoped capability. The parent and independent judge selected the event capability. Existing serialized transactions support atomic first note creation without new schema or locks. See [brief and synthesis](BRIEF.md), [sketch A](sketch-a.md), [sketch B](sketch-b.md), and [judgment](design-judgment.md).

Implementation and review are separate roles in one model family. They are not a cross-family panel.

The Standards and Spec reviewers independently found one P2 draft-loss bug when a selected note disappeared before conflict refresh. Commit `6a65c3e` retains fresh notes and the draft, allows a fresh save when no other own note exists, and otherwise gives an explicit copy/cancel/reselect recovery. The focused check failed 3 cases before the fix and passed afterward. Both reviewers marked that finding resolved. The visual finish disposition is `ship` for the pictured desktop/phone reading and editor states. The documentation pass preserves the incumbent system and records pre-existing drift.

## Acceptance evidence

Application head `6a65c3ed1ee865755a135ba5ddd08b76c2516a30`.

- `npm run test:backend` ran 509 tests: 497 passed and 12 skipped in 369.901 seconds. Existing Python resource warnings remain in unrelated fixture paths. The new notebook cases include a real two-connection SQLite first-save race and rollback.
- `npm run test:dom` passed 130 tests.
- `npm run test:unit` passed 20 tests.
- `npm run build`, `npm run typecheck`, `npm run lint`, `npm run check:docs`, `npm run check:budgets`, and `git diff --check` passed.
- Full `npm test` passed 124 Chromium cases and skipped 18 opt-in evidence cases. All 142 Firefox cases failed at browser launch with `Could not find profile folder`, before app interaction. Minimal launch probes reproduced it with default, alternative temp paths and a fresh isolated browser install; Firefox remains unverified.
- Final `npm run test:app` passed 56 integrated desktop/phone cases in 1.3 minutes at `6a65c3e`.
- Final `MAZI_PYTHON=.venv/bin/python MAZI_BROWSER_RESULTS_DIR=work/poteto/event-notebook/domain-results npm run test:domains` passed 40 cases with 2 learned-model cases skipped, in 1.1 minutes at `6a65c3e`.
- The 22 focused notebook cases passed before the final expanded copy/cancel assertions. All four removed-note combinations subsequently passed on desktop and phone, 8 cases. Those expanded cases also passed in the final full integrated run.

The broad backend, DOM, unit and initial Chromium run started at `7892934`; the recovery follow-up changes only the notebook client and its browser contracts. The final integrated/domain runs and final build/format checks cover `6a65c3e`. The pictured reading/editor structure has no style changes between those two revisions.

The first integrated run exposed a selector that assumed the first reviewed event was the known fixture, plus an overlapping-output trace error from two harness invocations. Exact event-scoped selectors and serialized harness ownership resolved these. The final full integrated run is clean.

## Limits

This feature links existing approved photographic events and their bounded imported chat context. It does not import complete transcripts, infer topics, or create text-only events. Note storage reuses existing story contributions and their visibility, author and departure rules. Synthetic local checks do not establish physical-device or production release acceptance. No merge or deployment is included.

Observed local runtimes are Node v24.15.0, Python 3.14.7 and Playwright 1.63.0.

Runtime inspection confirms the app now pins the night theme in `src/theme/useTheme.ts`. The older DESIGN.md day-toggle description is not current UI behavior. This feature preserves the shipped night theme; screenshots cover desktop and phone in that theme. No design-system drift repair is included.

## First visual inspection

At UI head `7892934`, the lead inspected `desktop.png`, `mobile.png`, both `*-arrival.png` captures, and both `*-editor.png` captures together. They show the correct page, loaded synthetic images, complete source text and saved note content. The arrival captures demonstrate title focus above both text origins. Full-page captures start at document top; viewport captures intentionally record title arrival/editor states. Mobile fixed navigation occupies its usual viewport position in full-page screenshots.

`capture.mjs` uses synthetic Atlas text and existing synthetic sample photos, with real notes saved through the event API against a disposable synthetic archive. It does not claim a complete transcript import. `visual-checks.json` records zero axe violations, no page errors and no horizontal overflow on desktop and phone.

The one required mechanical detector run reported three findings, all already present at the base revision in unchanged viewer CSS. They are the width animation on photo dots and two photo-control colour literals. The notebook additions use existing tokens. No mechanical finding applies to changed code; no unrelated CSS changes were made.

## Commit sequence

- `c09a290` test(memories): define event notebook persistence contract.
- `42d8552` feat(memories): persist event notes atomically with story revisions.
- `9dacc8a` test(notebook): define in-place persistence and ownership flow.
- `9edab43` test(notebook): cover ownership races and request boundaries.
- `87de29b` fix(notebook): require an existing own note for saved targets.
- `7892934` feat(notebook): read and edit event recollections in place.
- `6a65c3e` fix(notebook): retain drafts when saved recollections disappear.

The domain runner resolved its relative output directory beneath `tests/browser`; those generated results were moved into this task's ignored `domain-results/` directory after the run. Existing tracked screenshot/report files changed by repository tests were restored to their base contents.

## Main integration, 24 October 2026

The conflict-resolution pass merges main at `2eccda3` and aligns notebook retention with newer D24. Its checks, updated lifecycle contract and independent review are recorded in [merge verification](merge-20261024/VERIFICATION.md). Earlier clear-on-hide evidence above remains historical.
