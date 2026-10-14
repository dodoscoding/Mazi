# Shared-code entry checklist

## Feature playbook

1. `how` over the affected subsystem.
2. `architect` for parallel design exploration.
3. Write the throughput checkpoint as four todo items.
4. Delegate code-writing to a subagent with a specific scope and named data shape.
5. Verify on the matching surface.
6. Rebase into small, ordered commits. Stack follow-ups.
7. If the design is contested, `interrogate` before shipping.
8. Run **Opening a PR**.

## Throughput checkpoint

- Blocking first steps. Preserve the user's main checkout and use the unified application in an isolated worktree. The investigated 120c16d content merged as 2a2f861 before implementation. Resolve identity storage and app gating first.
- Independent workstreams. Two design candidates write separate files. One implementation owner edits the connected API and UI. Review follows the implementation.
- Shared mutable state. Only the implementation owner writes application files. Tests use temporary archives, never the user's .mazi-imports directory.
- Smallest safe decomposition. One implementation owner keeps profile, session, membership, and onboarding contracts aligned across Python and React.

## Progress

- [x] Ground in the unified application's current source and the earlier access investigation.
- [x] Architect: Ground, Sketch, Agree, Implement, Scrap if needed. The user explicitly authorized the settled design. No discarded implementation was needed.
- [x] Arena: Frame, Fan out, Cross-judge, Pick, Graft, Verify. Two designs, one model family, isolated candidate files.
- [x] Record accepted behavior in canonical decisions before application edits.
- [x] Add and run missing behavior tests before implementation.
- [x] Implement and run focused checks.
- [x] Review the diff independently and resolve actionable findings. Final review at 1ec20e4 found no remaining defects after the stale-denial and test-isolation corrections.
- [x] Run build, formatting, backend, browser, document, and whitespace checks appropriate to the change.
- [x] Inspect desktop and phone screenshots.
- [x] Record evidence and coherent commits. The test-first commits intentionally expose missing behavior; subsequent fixes pass. No rebase was needed to preserve the ordered units.
- [x] Resolve the PR base and forge. The unified-app dependency merged into main. Origin could not resolve dodoscoding/Mazi, so use GitHub CLI. Open the PR after verification; do not deploy or merge.

## Acceptance

- Signed-out users see only a dedicated name and shared-code login screen. The introduction and archive require a valid session.
- A valid shared code plus a new normalized visible name creates one persistent profile and active membership in the configured circle.
- The same code plus an existing normalized name resumes that profile immediately, including on a fresh browser. The owner explicitly accepts impersonation by other code holders.
- No email or personal password is required in the user flow.
- The browser remembers a server-issued session. Returning sessions open the Atlas without a login form.
- The short introduction is completed once per profile and stays available through About.
- Existing Atlas, Timeline, Search, My Imports, and Our circle remain usable.
- Preserve existing .mazi-imports data, existing identities, membership boundaries, and synthetic sample testing without creating a public login bypass.
