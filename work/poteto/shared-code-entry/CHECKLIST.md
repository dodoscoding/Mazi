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

- Blocking first steps. Preserve the user's main checkout and use the unified application at 120c16d in an isolated worktree. Resolve identity storage and app gating before implementation.
- Independent workstreams. Two design candidates write separate files. One implementation owner edits the connected API and UI. Review follows the implementation.
- Shared mutable state. Only the implementation owner writes application files. Tests use temporary archives, never the user's .mazi-imports directory.
- Smallest safe decomposition. One implementation owner keeps profile, session, membership, and onboarding contracts aligned across Python and React.

## Progress

- [x] Ground in the unified application's current source and the earlier access investigation.
- [ ] Architect: Ground, Sketch, Agree, Implement, Scrap if needed. Agreement is automatic because the user explicitly authorized the settled design.
- [ ] Arena: Frame, Fan out, Cross-judge, Pick, Graft, Verify. Two designs, one model family, isolated candidate files.
- [ ] Record accepted behavior in canonical decisions before application edits.
- [ ] Add and run missing behavior tests before implementation.
- [ ] Implement and run focused checks.
- [ ] Review the diff independently and resolve actionable findings.
- [ ] Run build, formatting, backend, browser, document, and whitespace checks appropriate to the change.
- [ ] Inspect desktop and phone screenshots.
- [ ] Record evidence and coherent commits.
- [ ] Evaluate PR step against the local-only request and current branch dependency.

## Acceptance

- Signed-out users see only a dedicated name and shared-code login screen. The introduction and archive require a valid session.
- A valid shared code plus a new normalized visible name creates one persistent profile and active membership in the configured circle.
- The same code plus an existing normalized name resumes that profile immediately, including on a fresh browser. The owner explicitly accepts impersonation by other code holders.
- No email or personal password is required in the user flow.
- The browser remembers a server-issued session. Returning sessions open the Atlas without a login form.
- The short introduction is completed once per profile and stays available through About.
- Existing Atlas, Timeline, Search, My Imports, and Our circle remain usable.
- Preserve existing .mazi-imports data, existing identities, membership boundaries, and synthetic sample testing without creating a public login bypass.
