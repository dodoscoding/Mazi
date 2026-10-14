# Consolidate Mazi into one app

- [x] Read the Principles section of poteto-mode.
- [x] Phase A: Frame
- [x] Phase B: Design the workflow
- [x] Phase C: Run the loop
- [x] Phase D: Keep the audit trail
- [x] Phase E: Verify and hand back

## Acceptance

One documented command opens one Atlas application. Imports, membership, archive review, sources and places, discovery, evidence answers, recaps, stories, subevents, slideshows, video export, capsules and notifications remain available from its navigation. Atlas and timeline read the same authorized archive as the other features. Existing local data remains readable. Runtime source uses domain names rather than numbered phases. No iframe or separate prototype servers are needed.

## Workflow

1. Inventory the backend contracts and UI workflows independently. Compare retaining the Python engine with a full TypeScript port.
2. Record the chosen module and runtime shape. Capture existing behavior using the Python and browser suites.
3. Move backend modules and tests into domain packages. Add a single entry point and verify existing contracts.
4. Move feature screens under the Atlas shell with explicit initialization and cleanup. Connect Atlas to authorized archive data.
5. Verify workflows through the single origin on desktop and phone. Check sign-out, group switching, stale requests and denied access.
6. Independently review the resulting diff and evidence. Resolve findings, update run instructions, and leave the app running.

## Throughput checkpoint

The work spans seven backend packages, seven feature screens, the Atlas data model and the app launcher. Parallel work is limited to exclusive file sets. Backend migration, feature-screen integration and Atlas integration can proceed independently after the interface contract is fixed. The bottleneck is preserving lifecycle and authorization behavior during navigation. Automated browser contracts will test that integration directly.

## Review rubric

Grade design candidates on complete feature preservation, unchanged stored-data format, one user-facing app and launch command, domain ownership, and migration verification cost. Use independent same-family workers because only one model family is available. External publication and PR creation are skipped for this local application request.
