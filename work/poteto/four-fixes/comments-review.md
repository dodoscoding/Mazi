# Comment review

Scope is the working tree against `e95971f15a8ea651365aea75e6a4fd27ac5d508e`, plus untracked `src/memory/chronology.ts`. Application code was not changed by this review.

- Touched comment file is `src/memory/Viewer.tsx`.
- Recommended deletion count is one six-line comment block at lines 54–59. It narrates visible viewer composition, animation timing, and swipe behavior already expressed by JSX, `settle`, `fade`, and the pointer handlers. The changed crossfade line belongs to this existing touched block. The block does not define a public API contract or document an external constraint.
- MUST KILL flags are zero. The nearby implementation expresses the behavior without requiring a rename, extraction, or architectural change.
- Skips are pre-existing untouched comments, deleted comments, Markdown decision prose, and URL strings in fixtures. The new chronology module has no comments. No suppressions were added.
