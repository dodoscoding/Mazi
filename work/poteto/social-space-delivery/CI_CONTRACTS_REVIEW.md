# CI contracts independent review

## Artifact and verdict

**PASS**. Base/merge-base `b3efcf7d1c300bb12173b58908b31106c32ea08f`; head `bc58ae52458a26edc3c1754083cd8fb4ec0b7d40`; stable patch ID `5e1873a5e5106c39b4c7b07ecf73c2916930c350`. Worktree `social-ci-contracts`. Exactly two files/two coherent commits: `112c69b` test expectation and `bc58ae5` CI prerequisite order. No runtime code, dependency or schema changes.

## Standards

No findings. Existing tests remain intact; the exact expected request gains `date_basis: chronology` rather than weakening comparison. Workflow retains all checks and prepares their existing Python dependency before use. No introduced comments to audit.

## Spec

No findings. Fresh Search explicitly uses chronology after A2; preserving that date basis during capacity recovery is the intended contract, while old dated bookmarks retain omitted/capture semantics in the separate regression. The P1 actual-archive DOM contract spawns `.venv/bin/python` in `tests/dom/social-plans.test.mjs:459`; `npm run setup` creates that environment and installs locked requirements. Moving setup ahead of DOM tests resolves the clean-runner prerequisite without skipping tests or mutating product behavior.

## Independent verification

`node --test tests/dom/discovery-keyword.test.mjs tests/dom/social-plans.test.mjs tests/dom/search-date-basis.test.mjs`: **23 passed** (including two actual-archive nested cases), covering exact recovery request, legacy bookmark basis and Python-backed hide/edit/unhide/unlink behavior. `git diff --check b3efcf7...bc58ae52458a26edc3c1754083cd8fb4ec0b7d40`: passed. Full Actions execution was not repeated locally; the workflow dependency ordering was inspected directly. No implementation edits or publication performed.
