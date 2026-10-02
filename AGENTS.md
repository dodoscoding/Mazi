# Repository Guidelines

## Project Structure & Module Organization

Mazi is a private, invite-only memory archive currently in product planning. No application, infrastructure, test suite, or media assets have been implemented.

- `README.md` indexes the planning documents.
- `PROJECT_PLAN.md` preserves the initial project plan; reconcile differences through `docs/DECISIONS.md` before implementation.
- `docs/` contains the specification, roadmap, architecture, domain contracts, privacy policy, import design, and acceptance plan.
- `docs/source/PRODUCT_BRIEF.md` is the preserved source brief; keep it unchanged.
- `work/poteto/product-plan/` contains the planning checklist, decision trail, verification evidence, and document checker.

## Build, Test, and Development Commands

Run commands from the repository root:

- `python3 work/poteto/product-plan/verify_docs.py`: checks document structure, local links, requirement mappings, milestones, and acceptance IDs using Python's standard library.
- `git diff --check`: checks patch whitespace; preserve existing Markdown hard-break spaces in the source brief.

Build, development-server, lint, and application-test commands do not exist yet. Establish them during M0 scaffolding and update this guide with verified commands.

## Coding Style & Naming Conventions

Use one top-level title per Markdown document, descriptive headings, relative links, and concise actionable prose. Match existing uppercase planning filenames, such as `TEST_PLAN.md`. Keep traceability IDs stable: `B01`–`B30`, `M0`–`M7`, and `T01`–`T15`. Python helpers use four-space indentation and descriptive snake_case names. No formatter or lint configuration is installed.

## Testing Guidelines

Run the document checker after planning changes. It verifies structure, not application behavior. No testing framework or code-coverage threshold is configured. Future implementation must satisfy the applicable scenarios in `docs/TEST_PLAN.md`, including denied-access and recovery cases. Record exact revisions, commands, fixtures, environments, results, and evidence locations. Use synthetic fixtures; retain personal archives in restricted storage.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commits, including `docs(plan): define product roadmap and delivery contracts`. Use imperative messages and one coherent behavior per commit. For implementation, expose the contract with tests before the smallest fix or feature; add regression coverage where needed.

PRs should explain the change and risk, link the relevant roadmap item or decision, list verification and limitations, and include screenshots for UI changes. Call out schema, security, privacy, and deployment impacts. Update canonical contracts when behavior changes; distinguish proposals from implemented safeguards.
