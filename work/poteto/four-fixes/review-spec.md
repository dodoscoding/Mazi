# Spec review

Compared the current working tree, including `src/memory/chronology.ts`, with immutable production baseline `e95971f15a8ea651365aea75e6a4fd27ac5d508e`. Scope: the four requested fixes, explicit sharing-date fallback, date provenance, uncropped photos and verification. No application edits or independent browser runs.

## Closure verdict

Both previously reported P2 findings are closed in the inspected code.

- **Approximate capture labels restored.** `src/browse/Timeline.tsx:369` now calls `dateLabel(memory)`, preserving the existing “About” and readable capture date behavior (`src/browse/model.ts:83-93`). The new `manual timeline navigation resets the paused replay cursor and keeps approximate capture labels` browser test asserts “About” for an approximate ISO capture date.
- **Manual year navigation now synchronizes Replay.** `src/browse/Timeline.tsx:147-153` pauses playback, sets `activeMemory` to the target year's first chronology entry, then changes the year. Both step buttons and the scrubber use this path. The new browser regression pauses in 2020, navigates to 2025, checks the active card, resumes, and checks advancement to 2026. This directly covers the stale-cursor failure previously reported.

The Portal now renders each provenance sharing observation separately at `src/atlas/Portal.tsx:210-216`, retaining raw unresolved/ambiguous sharing evidence alongside the conservative chronology label. Capture data and capture-only search semantics remain separate from sharing-based Replay. Portal, current Viewer photo, outgoing photo and view-transition image use containment; the Portal mask and image enlargement were removed. The batched keyword search path and its access/filter tests remain present.

**No remaining actionable Spec findings identified.** Final full-browser-suite success remains the parent's deployment gate; this review does not independently attest to that pending run or production behavior.
