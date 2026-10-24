# Event titles and notes discovery

The owner could not find the event notebook after its release. This fix gives title anchors a persistent underline and adds explicit View notes links on Home, the portal, grouped Memories and the detail toolbar. The notes heading is now Notes from your circle. Opening the notebook focuses and scrolls to that heading. Repeating the jump works without another history entry.

## Before and after

Base `b56ac7509675e93bd24559d927a24c676552948a` has global link styling that removes decoration. The title selectors changed underline thickness without enabling an underline. Detail has no explicit notes link, and its notebook effect uses the event heading ref instead of the notebook ref.

The coordinator reproduced the detail path in Chromium with a disposable synthetic archive on port 8037. Both desktop and Pixel 7 emulation exposed no notes link and focused H1. Baseline screenshots are [desktop](before-desktop.png) and [phone](before-phone.png).

Worker commit `57618c6` captures the missing contract before the implementation. The failure output was:

```text
Locator: locator('#notebook-heading') Expected: focused Received: inactive
getByRole('link', { name: 'View notes', exact: true }) ... Error: element(s) not found
```

Implementation commit `6264005` corrects the links and focus. The first phone check exposed the existing toolbar intercepting a separate notes link. Moving the link into the toolbar fixed that observed overlap. The final regression tests also cover repeated jumps, real title navigation, persistent underlines, demo guards and Back/Escape behavior.

## Verification

- `MAZI_UNIFIED_PORT=8037 npm run test:app` passed 62 integrated desktop and phone cases.
- After the final Portal demo guard, the complete notebook file passed 28 cases and the focused Portal history cases passed all 4 cases. Both harnesses rebuilt and typechecked the app.
- `npm run lint` passed after the final source change.
- The coordinator inspected the actual patch and screenshots, then confirmed focus and in-viewport arrival on desktop and phone. No page errors or horizontal overflow occurred.
- The no-comments review found zero added comments, suppressions or actionable flags. Existing unmodified comments stayed outside scope.
- The Impeccable detector found one existing width-transition warning and two existing color advisories, all on unchanged lines. It found no new issue in this patch.

The coordinator's final captures are [Home desktop](after-home-desktop.png), [Home phone](after-home-phone.png), [detail desktop](after-detail-desktop.png), [detail phone](after-detail-phone.png), [notes desktop](after-notes-desktop.png) and [notes phone](after-notes-phone.png). All are Playwright screenshots of this local build with synthetic fixtures. Solid green images are deliberately synthetic archive media. Capture sizes are 1440 by 1024 CSS pixels and Pixel 7 emulation at 412 by 839 CSS pixels. Home captures wait for the globe's ready marker. Notes captures show the actual destination after View notes, without a manual scroll.

## Scope and limits

The existing event discriminator and notebook query flag remain the data model. No API, schema, authentication, permission, storage or deployment configuration changed. Individual photos and demo mode do not expose private note controls. Existing note lifecycle and ownership tests still pass.

This evidence covers Chromium and phone emulation with synthetic data. Physical devices and signed-in production archives were not exercised. The prior GitHub Actions runs were billing-blocked before execution, so hosted CI cannot replace these local checks. Independent final review and release receipts are recorded separately after the patch is frozen.
