# Issue 147 — Shared photograph viewer acceptance

## Scope and revisions

Implements #147 against the approved simplification specification and decision D28.
Worktree: `/tmp/mazi-simplification-147`, branch `codex/simplification-147`.
Started from integration `485bcabe83f8da3a9bc635fe0c9646a45a1a43da`;
merged current integration (including Add and Settings) in `c68c9be`.
No schema, storage, server authorization, deployment or production acceptance changes.

## Behavior

- Globe's photo/open action enters the canonical photograph viewer directly; the redundant portal is bypassed. Existing portal deep links remain compatible for later route translation.
- Photograph identifiers and selected indices remain in detail URLs. Existing whole-image fitting, previous/next controls, photo keyboard navigation and evidence are retained.
- The originating screen remains hidden while the viewer is open, preserving React and imperative gallery state, query/filter selections, scroll position and opener focus. The Globe keyboard handler is suspended outside its route. Existing invalidation subscriptions stay active; access/session/group/archive changes discard the retained screen immediately.
- Back, explicit Close, Escape and browser Back return to the origin. Imported Conversation context is collapsed until requested. Social discussion and source/date/place evidence remain available.
- The implementation is independent of the later Photos/search/recap compositions; their ordinary photograph links can reuse origin capture.

## Agreed seam and red evidence

Uses the existing real-app integrated Playwright boundary, desktop Chromium and Pixel 7 phone emulation. The existing temporary archive fixture now includes two synthetic imported source messages alongside its three generated JPEGs. No component harness or internal mocks were added.

`MAZI_UNIFIED_PORT=8117 npx playwright test --config playwright.unified.config.ts -g 'shared viewer opens'` failed on both projects before implementation: no `.viewer` after one Globe open action (`319a6ee`). The initial environment-only missing Chromium failure was excluded from behavioral red evidence.

The individual-photo gallery contract failed on both projects before explicit Close existed (`842b762`); subsequent runs exposed URL canonicalization and opener-focus loss, which were corrected while preserving the existing gallery's filter state.

The optional imported Conversation contract failed on both projects because the first imported quote was visible before expansion (`823bb8b`).

## Verification

- Final post-merge command: `MAZI_UNIFIED_PORT=8117 npx playwright test --config playwright.unified.config.ts -g 'one authenticated shell|shared viewer'` — 10/10 passed (30.5s), including the retained unified shell journey.
- Focused shared-viewer suite: 8/8 passed before merging integration; 8/8 passed again after merging integration.
- Real API session logout followed by ordinary visibility revalidation removes viewer, retained gallery tiles, evidence and Conversation DOM; unauthorized detail HTTP read returns 403.
- Build/typecheck runs as part of each integrated server launch. `npm run typecheck` passed independently.
- `npm run lint` passed. `git diff --check` passed.
- Post-merge existing unified shell journey initially exposed an overly broad image selector now matching the retained hidden Globe image; scoped it to the actual viewer in the existing unified and journey contracts.

## Evidence and limits

- `viewer-context-desktop.png` and `viewer-context-phone.png`: whole photograph with expanded imported context and retained evidence; visually inspected phone rendering.
- `viewer-return-desktop.png` and `viewer-return-phone.png`: restored conventional browsing screen.
- Synthetic fixtures validate application behavior only. Full Photos/search/recap implementation, final navigation and write retirement remain with their assigned slices. Sound, rendering and reduced-motion infrastructure are unchanged.
- Existing historical portal-specific tests will need their expected opening presentation reconciled when the obsolete portal route is retired; compatible old portal links are retained here.
