# Interface clarity

Implement requests 1, 3 and 5 from D25 after merging documentation PR #109. Keep the private-group scope and existing archive capabilities.

## Feature workflow

- [x] 1. `how` over the affected subsystem. Grounding traced route, archive, feature and browser ownership.
- [x] 2. `architect` for parallel design exploration. Two candidates and an independent cross-judge selected the directory; [rationale](DESIGN_RATIONALE.md) records the decision.
- [x] 3. Write the throughput checkpoint as four todo items.
- [x] 4. Delegate code-writing to a subagent. One owner handled source and delegated disjoint existing-test migrations.
- [x] 5. Verify on the matching surface. Final [desktop/phone/browser receipts](VERIFICATION.md) include UI, history, notebook and Discord paths.
- [x] 6. Rebase into small, ordered commits. Stack follow-ups. `276fd91` exposes the contract, `1802104` implements it, `c08b1c6` adds boundary coverage. No rebase needed; fetched main still equals the recorded base.
- [x] 7. If the design is contested, `interrogate` before shipping. skip: both parent and independent judge selected A; no unresolved design dispute.
- [ ] 8. Run **Opening a PR**.

## Throughput checkpoint

- [x] Blocking first steps. Independently review and merge #109. Ground route, state and feature ownership. Choose the navigation and Home shape before implementation.
- [x] Independent workstreams. Two candidates wrote separate scratch artifacts. One implementation owner handled coupled UI and delegated old test migrations. The parent owned canonical docs; an independent reviewer exercised the result.
- [x] Shared mutable state. Use branch `codex/interface-clarity-20261101` in its own worktree. The default checkout and unrelated worktrees stay untouched. One writer owns UI files.
- [x] Smallest safe decomposition. Home, route selection, parent-tab highlighting and feature entry links form one behavior. One owner handled source changes. Browser suites now serialize against the shared generated `dist` directory after a concurrent build interrupted one preliminary check.

## Design exploration

- [x] Ground
- [x] Sketch
- [x] Agree. Proceed under existing authorization; no human checkpoint requested.
- [x] Implement
- [x] Scrap. skip: no repeated architecture failure. A reproduced navigation bug needed a nullable contextual-return record, not a redesign.

## Acceptance

- [x] Main navigation exposes exactly Home, Keşfet and Grubumuz on desktop and phone. Contribution remains visible through Ekle.
- [x] Home presents one featured memory, at most three archive memories and clear next actions without the Atlas control stack. No unsupported recency/activity claim.
- [x] Atlas, timeline, Search, People, stories, recaps, capsules, questions, review, imports, sources and group controls remain reachable through visible links appropriate to their role.
- [x] Existing route URLs, selected memory/photo/notebook links, demo, browser history, background state and Discord callback behavior remain valid.
- [x] Keyboard, small-screen overflow, touch targets, reduced motion and relevant access controls are verified with synthetic data.
- [x] Update canonical product/design/decision contracts and record exact verification evidence.
- [ ] Create a ready implementation PR. Do not merge the implementation PR without a further request.

## Independent review

The reviewer returned PASS+NOTES at source/test head `c08b1c6`. Main Home navigation versus contextual Back was reproduced, corrected and rechecked independently. No remaining application blocker was found. The comment pass found no introduced comments or suppressions requiring changes. Review used one model family; physical-device and production gates remain open.

## Shipping #109

- [x] Independent reviewer returned PASS at head `a5c2231` and base `3e79ad7` with stable patch-id `aff2923ad1a5d96239b5e8b01ada44bfc057580a`. Documentation and synthetic reproduction passed. No CI statuses were reported.
- [x] Rechecked the unchanged patch and mergeability. Squash merge confirmed by GitHub at `665902b4a6aba9a71539888568a7e9ca95d87b27`. Fetched main and based this worktree on that revision.
- [x] Connector capabilities replace upstream CLI/cloud assumptions. No review comment was posted because the host restricts unsolicited messages.

## Principles applied

- Model the Domain. Choose a typed navigation table for tab membership and feature destinations before code.
- Subtract Before You Add. Remove the Atlas control stack from the default Home before adding clearer entry links.
- Separate Before Serializing Shared State. Keep candidates and implementation writes isolated.
- Sequence Work into Verifiable Units. Expose the navigation contract first, implement it, then verify the connected journeys.
- Prove It Works. Use the running UI and existing browser fixtures, not build success alone.
