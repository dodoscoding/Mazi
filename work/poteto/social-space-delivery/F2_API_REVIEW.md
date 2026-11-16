# F2 authoritative filter API review

Root independently reviewed the worker-authored backend boundary `78c1c37366368e985c329f3a078fa374aa6a95d4` from `dbbc351`, then integrated current main in a separate clean worktree. Reviewed publication head is `65e82c9bf911003cd4fbac76440ca0e0de659c91`, base `8aa03020aa8003160fa98e082e9232b7febcd9dc`, stable patch `2d32d2dbe8fbf9cd08922c82eae55c29590062e1`. The original worker's uncommitted UI changes were excluded.

## Standards

PASS. One normalized `PhotoFilter` supplies both Search modes and Gallery's matches endpoint. It reuses existing authorized evidence and compact-label/approved-person queries. Matching occurs before counting and pagination; no duplicated client predicate or persistence model is added. The extra closed dimension values and bounded array parsing remain within the existing query contract. No actionable documented-standard violation, new misleading comment, suppression or necessary refactor was found. Existing private store seams are a coupling consideration, not a mandatory abstraction change.

## Spec

PASS for the read/API boundary. Different dimensions match the same photo, OR is confined within each selected dimension, unknown is explicit, suppressed/departed people do not enter facts, and full-visible facets remain separate from the filtered total. Source/sharer and old omitted capture-basis bookmarks retain their contracts. Gallery receives authorized asset IDs without sibling inflation. Keyword/semantic modes share attribute semantics while semantic relevance remains separate. Existing scan budgets raise capacity errors instead of partial totals. UI chips, URL restoration and filtered Gallery projection remain the next independently reviewed slice.

## Independent verification

- On integrated head, `.venv/bin/python -m unittest tests.backend.discovery.test_photo_filters tests.backend.discovery.test_api tests.backend.discovery.test_discovery tests.backend.discovery.test_keyword_budgets tests.backend.discovery.test_remaining_capacity tests.backend.discovery.test_shared_by tests.backend.discovery.test_date_basis`: **65 passed in 175.1 seconds**. Covers same-child negatives, effective presence, unknown, HTTP validation, suppression/hide/withdrawal, exact 1,001-photo match totals, constant fact queries and existing real 10,000-photo scan budgets.
- An independent temporary fixture with two distinct approved people and one generated screenshot confirms person OR plus all three content dimensions returns exactly that one photo. The other person's sibling does not satisfy screenshot, denominator stays two, and an outside member is denied. Fixture cleanup ran.
- Docs checker and full-branch whitespace pass. Merge of current main was automatic and introduced no filter changes.

Existing SQLite ResourceWarnings in capacity fixtures were observed; all assertions passed. No schema, dependency, vector fingerprint or deployment change. No production mutation was performed.
