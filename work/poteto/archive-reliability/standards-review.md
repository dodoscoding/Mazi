# Archive reliability standards review

## Immutable verdict

**PASS** for the release code patch. No actionable correctness, regression, security, or documented-standard findings remain.

- Base: `cf26a7d9a3e342108079c1cd05829d9154f12ad4`.
- Final code head: `f93a8a28f00356d6cceb99f512d9e649af708ed1`.
- Stable patch fingerprint: `11d3b1d72be053b37a4d27797c47fd36c7053c07`, from `git diff cf26a7d...f93a8a2 | git patch-id --stable`.

Reviewed the full immutable release diff, then independently checked `1685a79..f93a8a2` is solely the private helper docstring deletion. No implementation files were edited by this reviewer. This verdict applies to this release patch; a core backport needs its own exact base/head check.

## Standards

No actionable documented-standard violations or baseline smell findings. Sources were repository `AGENTS.md`, design/plan and investigation, the full code-review smell baseline, pinned Poteto adapter/no-comments/deslop guidance, and React best-practices guidance. Test-before-fix commits preserve coherent behavior boundaries and archive compatibility. Evidence distinguishes synthetic verification from hosted acceptance.

The final comment pass found one private helper narration at `mazi/archive/review.py:258` in `1685a79`; `f93a8a2` removes it. Remaining added persistence docstrings define exported failure/read-transaction contracts; the simple-query comment explains the verified external psycopg protocol constraint. No new lint or TypeScript suppressions exist.

React additions derive provenance from props during render, preserve hook order, render imported text as escaped text, and retain existing accessibility structure. Changed conditional expressions are strings or booleans, so they do not render accidental zero values. Repeated compact provenance scans do not justify additional state or caching. The supplied synthetic phone screenshot was visually inspected.

## Correctness and security

No substantive findings. Reviewed lazy connection startup/error classification, transaction completion, WSGI ownership, shared-reader/exclusive-writer policy fencing, authorized batched origins, preview fallback/hiding, and route invalidation. The SQLite preview contention regression is fixed by `_projection_transaction()` (`mazi/archive/review.py:275`).

Metadata stays inside the authorized origin stream (`mazi/atlas.py:79–140`), preserves reviewed titles, and leaves capture date/year/basis unchanged. `src/memory/provenance.ts:31–59` formats source calendar days and labels unresolved raw evidence; chronology/filtering continue using capture fields.

## Verification and limits

Independent immutable `1685a79` export: `/tmp/mazi-standards-1685a79.zt06t5`, Python 3.14.7, existing locked dependencies. Final follow-up is comment-only.

- Focused backend suites: **110 passed**, 21.640 seconds.
- All unit tests: **16 passed**; archive-hook DOM tests: **6 passed**.
- Document checker and final patch whitespace: **passed**.

SQLite fixture resource warnings occurred without failures. Parent separately reports 491 backend tests with 12 skips and 122 DOM tests passing; its full browser run and live acceptance remain separate evidence. No hosted mutation or authenticated production timing was independently repeated here.
