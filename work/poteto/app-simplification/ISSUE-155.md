# Issue 155: Settings membership and account

## Scope and baseline

Implemented against approved simplification spec and D28, starting from integration
`485bcabe83f8da3a9bc635fe0c9646a45a1a43da` (verified ancestor). Worktree:
`/tmp/mazi-simplification-155`, branch `codex/simplification-155`.

The agreed seams are the integrated real-app desktop/phone journeys and targeted
HTTP contracts. Fixtures contain synthetic photographs, shared-code profiles and a
private circle. Environment: Darwin arm64, Node v24.15.0, Python 3.14.7,
Playwright Chromium v1243; isolated `MAZI_UNIFIED_PORT=8125`.

## Retained behavior

- `/settings` is a real supported route and account-menu destination. The existing
  membership workspace retains its server-backed role checks, removal confirmation,
  current-circle selection and shared-code joining explanation.
- Settings contains Account, the existing sign-out confirmation, About and
  introduction replay. Replay returns to Settings; first-profile onboarding still
  uses the existing completion endpoint and identity rules.
- Settings uses the existing selected-circle context and suppresses the shell's
  duplicate selector on that surface. Legacy Circle, About and introduction entry
  points remain available until navigation consolidation.
- Session revalidation removes the entire authenticated Settings screen after
  session loss. No schema, storage, processing or deployment behavior changed.

## Red and green

1. Test commit `566e097` exposed the Settings journey before implementation.
   `MAZI_UNIFIED_PORT=8125 npx playwright test -c playwright.unified.config.ts tests/entry.spec.ts -g 'Settings retains'`
   failed on desktop and phone because the Settings heading did not exist. An
   earlier attempt only exposed the missing Chromium installation and was not
   counted as a behavioral red.
2. Implementation commit `f98c3ac` made the same command pass, 2/2.
3. Regression coverage exercises admin cancellation and actual removal, a member's
   denied removal HTTP request, the removed member's denied group read, signed-out
   Settings gating, and live session-loss cleanup. Existing first-time onboarding,
   cross-browser identity resumption, legacy About replay, and access-loss tests
   remain in the same suite.

## Verification

- `MAZI_UNIFIED_PORT=8125 npx playwright test -c playwright.unified.config.ts tests/entry.spec.ts`: 14/14 desktop/phone pass (includes build/typecheck).
- `npm run lint`: pass.
- `npm run test:unit`: 23/23 pass.
- `.venv/bin/python -m unittest tests.backend.identity.test_core tests.backend.identity.test_shared_entry`: 22/22 pass.
- `npm run check:budgets`: pass, total scripts 417.5 KiB gzip / 420 KiB.
- `git diff --check`: pass.
- `git merge codex/app-simplification`: already up to date at the baseline.
- React checklist: retained lazy feature boundary, no added hooks/effects, native
  links/buttons and existing accessible confirmation dialogs. Desktop/phone
  screenshots inspected; reduced motion avoids capturing unfinished transitions.

Evidence: [browser results](issue-155-browser-results.json),
[desktop Settings](screenshots/settings-desktop.png),
[phone Settings](screenshots/settings-phone.png).

## Limits

Synthetic local acceptance only; no production acceptance or deployment. Multiple
circle management retains the existing implementation; this fixture has one circle.
The final navigation switch and other Settings migrations belong to their tickets.
The existing large Globe chunk warning remains, with the configured budget passing.
