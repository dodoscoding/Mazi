# Desktop view continuity verification

## Scope

The affected workstream is `codex/remaining-acceptance` at `34c8ebe`. Its entry gate, archive loader, and feature host each reset their view on visibility changes. Main already includes a broader fix in [PR #106](https://github.com/dodoscoding/Mazi/pull/106). This change targets the affected workstream and adapts only visibility behavior. It preserves the workstream's requirement to discard Memory answers and answer evidence when hidden.

The regression uses synthetic session, circle, archive, search, and answer responses. No personal archive, credentials, or production service is used. The data shape remains the existing entry and archive state objects. No database, storage format, dependency, or deployment configuration changes.

## Before

On `34c8ebe`, changing `document.hidden` and dispatching `visibilitychange` removes Timeline and Search. This is a view remount, with no document navigation.

The built app in installed Chrome failed both browser retention checks:

```text
2 failed
[desktop] timeline retains its order and mounted view during foreground access checks
[desktop] search retains its draft and controls when the desktop is hidden
```

Timeline expected year headings `2024, 2023, 2022`; it received no headings after hide. Search expected `Lake photograph`; its input no longer existed. The focused entry/archive hook tests also failed before implementation:

```text
# tests 28
# pass 12
# fail 16
```

The regression contracts were committed before production changes. The initial build passed. See the [hidden view before the fix](screenshots/before-fix-hidden.png).

## After

Environment: macOS, Node 24.15.0, Python 3.14.7, and installed Chrome 157.0.8103.51. Browser checks used the existing Playwright runner with temporary configurations that select the installed Chrome channel. The integration configuration uses the existing synthetic Python server. The bundled Playwright Chromium executable was unavailable. A fresh virtual environment was created only in the isolated fix worktree because the original worktree's Python link points to a removed Homebrew installation.

Tested application and test revision: `76c9ccd`. The ordered commits are `999ed7d` for the browser regression, `b3b9992` for the entry and archive contracts, `736b1af` for the fix, and `76c9ccd` for boundary coverage. Documentation follows separately.

| Check | Result |
| --- | --- |
| `npm run build` | Pass, including TypeScript. |
| `npm run test:dom` | 160 passed. |
| `npm run test:unit` | 20 passed. |
| `tests/visibility.spec.ts`, desktop and Pixel 7 emulation | 12 passed. |
| `tests/entry.spec.ts` and `tests/imports-workspace.spec.ts`, desktop and phone | 27 passed, one existing skip for the phone-only Memories test on desktop. |
| `npm run lint` and explicit Prettier checks for both changed DOM test files | Pass. |
| `npm run check:budgets` | All four bundle budgets pass. |
| `python3 work/poteto/product-plan/verify_docs.py` | Pass. |
| `git diff --check` | Pass. |

The browser checks retain Timeline's descending sort on desktop and selected year on phone, mounted DOM identity, Search drafts, and unfinished entry input. They also verify that foreground denial removes the private feature, delivered Memory answers disappear on hide, and a pending sign-in can finish after returning. The existing integration suite verifies uninterrupted uploads, hidden Imports entry, Circle retention, and identity-change cleanup.

Independent review found that quiet validation could abort a pending sign-in and retain `pending: true`. Six deferred-entry cases reproduced that defect before correction, with 19 passing and 6 failing tests. Active request metadata now distinguishes passive session checks from entry mutations. Quiet checks cannot supersede an active mutation, and completion releases only the request that still owns the active slot. The focused entry, archive, and answer suite then passed 59 tests. Review also checked malformed denials, late responses, access cleanup, and the answer privacy exception.

The reviewer inspected the correction and its deferred-entry tests, including explicit cleanup and successive quiet requests, and reported no remaining blockers. One narrative test comment was removed. No new code comments or suppressions remain.

The same original Timeline reproduction now passes:

```text
12 passed (5.9s)
```

See the [hidden view after the fix](screenshots/after-fix-hidden.png) and [phone view after return](screenshots/phone-after-return.png). These screenshots use the repository's explicit sample photographs with synthetic API responses.

The committed tests run through the repository configurations. The equivalent focused commands with installed Playwright browsers are:

```sh
npm test -- visibility.spec.ts --project desktop --project phone
npx playwright test --config playwright.unified.config.ts entry.spec.ts
npx playwright test --config playwright.imports.config.ts
```

## Acceptance boundary

Synthetic visibility transitions exercise the browser event that caused the reset. Native macOS desktop switching, Firefox, and browser suspension remain unverified. A network outage retains the last displayed ordinary view until a later successful check; confirmed denial still clears protected state. Memory answers and their evidence keep the existing background-disposal policy. Answer evidence uses the same disposal path but has no separate new browser scenario. Page closure and restoration retain the workstream's existing cleanup behavior. This is synthetic regression evidence, not production milestone acceptance. No deployment was performed.
