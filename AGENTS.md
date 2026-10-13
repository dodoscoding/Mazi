# Repository Guidelines

## Project Structure & Module Organization

Mazi is a private, invite-only memory archive with production planning, a local Atlas prototype, and a separate Python memory-loop experiment under `phase1/`. These use synthetic fixtures; production authentication, ingestion and infrastructure remain unimplemented.

- `README.md` indexes planning and prototype run instructions.
- `src/` contains the React/TypeScript interface and procedural Fiber/Three atlas; `public/media/` holds generated synthetic photographs and provenance.
- `tests/` contains Playwright browser contracts; `docs/PROTOTYPE_STACK.md` records the experiment boundary.
- `PROJECT_PLAN.md` preserves the initial project plan; reconcile differences through `docs/DECISIONS.md` before implementation.
- `docs/` contains the specification, roadmap, architecture, domain contracts, privacy policy, import design, and acceptance plan.
- `docs/source/PRODUCT_BRIEF.md` is the preserved source brief; keep it unchanged.
- `work/poteto/product-plan/` contains the planning checklist, decision trail, verification evidence, and document checker.

## Build, Test, and Development Commands

Run commands from the repository root:

- `python3 work/poteto/product-plan/verify_docs.py`: checks document structure, local links, requirement mappings, milestones, and acceptance IDs using Python's standard library.
- `git diff --check`: checks patch whitespace; preserve existing Markdown hard-break spaces in the source brief.

- `npm ci`: installs exact locked dependencies; use Node 22.12+ (developed on 24.15.0).
- `npm run dev`: starts the local Vite prototype.
- `npm run build`: typechecks and builds the prototype.
- `npx playwright install chromium` then `npm test`: runs desktop and phone-emulation contracts.
- `python3 -m unittest discover -s phase1/tests`: runs the separate Python experiment's behavior tests after installing `phase1/requirements.txt`.

These commands validate synthetic experiments, not production milestone acceptance. No linter or coverage threshold is configured.

## Coding Style & Naming Conventions

Use one top-level title per Markdown document, descriptive headings, relative links, and concise actionable prose. Match existing uppercase planning filenames, such as `TEST_PLAN.md`. Keep traceability IDs stable: `B01`–`B30`, `M0`–`M7`, and `T01`–`T15`. Python helpers use four-space indentation and descriptive snake_case names. Prettier formats the prototype TypeScript/CSS; no linter is configured.

## Testing Guidelines

Run the document checker after planning changes. It verifies structure, not application behavior. Playwright covers the prototype; no code-coverage threshold is configured. Future implementation must satisfy the applicable scenarios in `docs/TEST_PLAN.md`, including denied-access and recovery cases. Record exact revisions, commands, fixtures, environments, results, and evidence locations. Use synthetic fixtures; retain personal archives in restricted storage.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commits, including `docs(plan): define product roadmap and delivery contracts`. Use imperative messages and one coherent behavior per commit. For implementation, expose the contract with tests before the smallest fix or feature; add regression coverage where needed.

PRs should explain the change and risk, link the relevant roadmap item or decision, list verification and limitations, and include screenshots for UI changes. Call out schema, security, privacy, and deployment impacts. Update canonical contracts when behavior changes; distinguish proposals from implemented safeguards.
