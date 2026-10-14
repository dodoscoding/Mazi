# Unified browser verification

Command: `npm run test:app` (final complete suite after privacy lifecycle fixes).

Result: **6 passed (13.7s)** on Chromium desktop (1440×1024) and Pixel 7 emulation. The Playwright config builds the actual React bundle, then starts `tests.browser.memories_server` on loopback port 8017 with a disposable synthetic archive.

Verified both viewports:

- One shell, one main navigation, no iframe, no phase links, no horizontal overflow, same root pathname during feature navigation.
- Seeded real Our summer Atlas detail uses API photographs and advances through three photos.
- Collaborative recollection edits render text safely; sub-events, slideshow, JSON and AVI downloads work.
- Future capsules remain sealed and disclose neither title nor note; notification opt-in is live.
- Search retrieves the seeded bicycle; answers show its date and navigate to a live supporting record.
- Places and sources creates a paused source; archive review reads three actual records.
- Leaving and returning to stories preserves data; one save produces exactly one write request, checking listener cleanup.
- Signout clears the active feature and denies subsequent authenticated group reads.
- A fresh account creates a group, inventories/imports a generated two-photo ZIP, and sees it in review.
- Header circle selection propagates to feature dropdowns and removes prior stories; delayed authorized Atlas bodies delivered after circle/navigation changes or logout do not restore private content.
- Explicit supporting record queries cannot retain the previous circle’s record after header selection changes.
- Access loss removes unsaved private capsule drafts and recap contents, offering sign-in recovery.

Evidence: `browser-results.json`, `browser-desktop.png`, `browser-phone.png`, `browser-privacy-verification.md`. Screenshots focus the main content before capture. Runtime page errors were absent from the complete seeded journey. Failed first attempts were test assumptions (capsule ten-year limit, signup under imports, responsive imports link outside main nav); tests were aligned to observed controls before this successful rerun.

These contracts verify a local synthetic archive, not production infrastructure or physical phone behavior. No commits were created.
