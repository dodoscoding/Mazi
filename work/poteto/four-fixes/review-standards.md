## Standards

No actionable documented-standard, correctness, security, or regression findings in the reviewed change.

The shared chronology module keeps sharing dates separate from capture assertions and date-search filtering, consistent with D09 and the new decision in `docs/DECISIONS.md:157`. Search preserves small-archive large-metadata compatibility and retains the existing larger-archive budgets and live membership/visibility joins. Uncropped framing is scoped to opened portal/detail images; thumbnails retain existing framing. Synthetic regression coverage checks SQL work, privacy/filter output, sharing-date chronology, same-year Replay controls, and image fitting.

No Fowler baseline heuristic warrants an action request. The duplicated Replay progression in Home and Timeline is small and coupled to different navigation/scroll behavior; extraction would not currently reduce a demonstrated correctness risk.

Validation boundary: review is static, against `git diff e95971f15a8ea651365aea75e6a4fd27ac5d508e` plus `src/memory/chronology.ts`. The parent owns running suites and browser verification. Timeline’s globe deliberately remains a year overview (`src/browse/Timeline.tsx:253`), so same-year Replay changes the active card rather than globe centering; this is consistent with the component’s existing year-overview model, not a reported regression.

Standards: 0 actionable findings; no hard violations.

## Final integration note

The implementation subsequently synchronized the Timeline globe with the active Replay memory. The focused desktop and phone Replay regressions passed after this change.
