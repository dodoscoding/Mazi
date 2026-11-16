# Final Spec verification

Verified immutable `b6e315efff2ac6c9f2172741fbee5fe364562353` against `e2193ea7b5bd79e51bda1bd4ead525a1366b7206`. Both prior P2 resolutions remain intact. No concrete introduced privacy or in-flight-read regression found.

- **Visibility and retained Settings state:** `src/useArchive.ts:35–43` invalidates cached memories while preserving circle context. `:99–104` fetches Atlas when needed after returning to Globe. Independent real-app Chromium desktop/Pixel 7 journeys confirmed: previously loaded Globe → Settings hide → success notice, unsubmitted person-name draft and expanded administrator controls remain → Globe excludes the memory → Settings restore → Globe contains it again. The explicit empty legacy story selector still shows unavailable with zero creation cards.
- **Cancellation and access denial:** `src/useArchive.ts:106–136` includes `archiveVersion` in the Atlas effect dependencies, aborting a superseded request even when loading was already active. It checks the request signal both after response arrival (`:115`) and before publishing parsed memories (`:129`). Denial dispatches access loss (`:116–118`); existing session/group/access-loss handlers (`:85–98`) still clear or reload the full circle context. Demo ignores live archive invalidations (`:37`).
- **Verification:** independently ran `node --test tests/dom/archive-hook.test.mjs`: **13 passed, natural exit 0**. This includes aborting an in-flight Atlas request, ignoring its late stale response, fetching its replacement and clearing private context on denial. Reviewed the public draft/saved-feedback/reload-failure recovery test at `tests/entry.spec.ts:740` and the final receipt in `REVIEW_FIXES.md`.

The isolated real-app fixture on port 8291 was stopped. No repository edits, rebuild, commits or pushes.

**Count: 0 unresolved prior Spec findings; 0 new actionable findings.**
