# Remaining issue completion

## Workflow

- [x] Read the Principles section of the poteto-mode skill.
- [x] Phase A: Frame.
- [x] Phase B: Design the workflow.
- [x] Phase C: Run the loop.
- [x] Finish workspace UI and phone controls from PR 81 for issues 39 and 80.
- [x] Implement bounded larger-archive indexing, related search and review for issue 59.
- [x] Complete bounded export capacity and metadata handling for issue 72.
- [x] Independently review each implementation, create or update its PR, and merge without waiting for CI as requested.
- [x] Exercise merged application through real browser user journeys and record screenshots and failures.
- [x] Repair CI after product verification and rerun affected checks.
- [x] Reconcile issue 62 against actual acceptance evidence and close only satisfied issues.
- [x] Phase D: Keep the audit trail.
- [x] Phase E: Verify and hand back.

## Completion predicate

The bounded implementation issues have reviewed, merged resolutions with passing behavioral evidence. The broader acceptance ledger remains open for external production and live-library evidence. The merged application passes actual desktop and phone browser journeys. Repository CI defects are repaired after those journeys. The user accepted local verification after GitHub blocked job startup for account billing. External credentials, physical hardware and hosted execution requirements must have actual evidence or remain explicitly open; local results cannot stand in for them.

## Scope and throughput

Five issues and one existing draft PR form three implementation tracks plus integration and acceptance. UI owns src and browser contracts on its worktree; capacity owns discovery/review algorithms; export owns archive delivery. Root owns acceptance records, shared integration and final CI changes. Each track has a separate branch and worktree. Independent review follows implementation in bounded waves within four active-agent slots.

The data model is an authorized archive projection. Larger operations must retain complete evidence, stable ordering, live policy revalidation and explicit resource budgets. Export artifacts are private completed files admitted only after current policy comparison. No guard will be removed without measured bounds and regression coverage.

## Rigor and overrides

Use focused red-first regression checks, local typechecking, independent review and real browser checks. Run the combined full suite at integration. User explicitly authorizes PR creation and merging without awaiting CI, followed by user-journey verification and CI repair. Remote CI is not a pre-merge gate for this task. No production deployment or private-data mutation is inferred.

## Skill adaptations

Poteto figure-it-out and show-me-your-work govern this run. Independent agents use the configured worker/reviewer roles in isolated local worktrees. Review is within one available model family. Existing issue URLs supply the specification; no issue-tracker setup is needed. Architect alternatives are scoped to actual new algorithm boundaries, not the settled visual design. No recurring monitor is needed.

## Final disposition

The user accepted phone-browser evidence and local verification. Issue #62 retains the external production/live-library acceptance boundaries. The completed loops, initial failures, repairs, provider cleanup and exact revisions are recorded in [VERIFICATION.md](VERIFICATION.md).
