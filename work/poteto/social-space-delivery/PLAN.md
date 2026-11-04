# Social space delivery

## Workflow

- [x] Read the Principles section of the poteto-mode skill.
- [x] Phase A: Frame.
- [x] Phase B: Design the workflow.
- [x] Phase C: Run the implementation loops for all eight runtime slices.
- [x] Phase D: Keep the audit trail.
- [ ] Phase E: Verify and hand back.

## Acceptance predicate

PR #112 is merged. A1, A2, N1, F1, F2, P1, C1 and H1 are implemented in reviewed, independently verified PRs and merged. The complete local regression suite passes. Compatible hosted migrations precede production deployment. Production health and the deployed revision are verified. Synthetic acceptance remains separate from the five-friend usability pilot and physical-phone milestone acceptance.

## Throughput checkpoint

- Blocking first steps. Review and merge the plan, inspect CI failures, pin the shared photo model and social boundaries.
- Independent workstreams. Photo metadata and navigation can use separate worktrees. Social schema and HTTP work follows settled visibility and lifecycle contracts.
- Shared mutable state. Each implementation owner has a dedicated branch and worktree. Integration, PR creation, migrations and deployment serialize through the coordinator.
- Smallest safe decomposition. Deliver the eight named slices in order of dependencies. Split social reads, writes and reactions when a slice exceeds a coherent review boundary.

## Delivery

- [x] Review and merge #112. Merged at `75727e0`.
- [x] A1. Photo evidence and visible metadata. PR #116 merged.
- [x] A2. Search date basis and per-photo corrections. PRs #120 and #123 merged.
- [x] N1. Home and grouped task navigation. PRs #114 and #135 merged, including Turkish journey controls.
- [x] F1. Editable photo labels with lifecycle and export. Backend #121 and UI #128 merged.
- [x] F2. Combined per-photo filters. API #131, keyword boundary #137 and UI #139 merged.
- [x] P1. Plans and attendance. Backend #115 and UI #125 merged.
- [x] C1. Comments and reactions. Backends #118/#119, measured batch correction #124 and UI #130 merged.
- [x] H1. Bounded social Home and activity. API #132 and UI #138 merged.
- [x] Complete separate whole-change Standards and Spec reviews at runtime `1a0234a`.
- [x] Complete local whole-product regression and record qualified isolated hosted evidence: all 23 paths passed across exact-path reruns; combined pooler timeout remains explicit.
- [ ] Apply compatible hosted migrations and deploy merged production revision.
- [ ] Verify deployed health, revision and representative access checks.

All eight runtime slices are merged through #139 at `1a0234a1a41a78e46b60723748df6d7d089be4c2`. Production remains unchanged at this checkpoint. Local release suites pass; production migrations, deployment and live checks remain pending; the [delivery evidence](DELIVERY_EVIDENCE.md) records immutable revisions, original failures, superseding reviews and outstanding gates.

## Design and verification

Architect exploration compares two independent candidates before the shared shape is chosen. Reviewers use the configured reviewer role. Review independence uses one model family. Existing Playwright and Python contracts are the verification tools. Optional automatic classification is deferred by the plan until F2 and a source-verified pilot dataset exist.

The original checkout and its unrelated untracked files stay untouched. GitHub connector tools own PR publication and merge operations. CLI tools supply local Git and Actions log capabilities.
