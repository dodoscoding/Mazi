# A2-read independent shipping review

Verdict: FAIL at the reviewed head. One reproducible metadata-budget bypass blocks shipping. Existing targeted date, budget and DOM tests otherwise pass.

- Reviewer: GPT-6.1 Sol, high reasoning, independent from the patch author.
- Base: `88830a78e09ed537804f59a30998e2c8a868ad92`.
- Head: `1e3eeb5f5cda14ce185bbb5a0f7fede24adb77fd`.
- Stable patch ID: `bb9ff19882bd17a47d08c6a8108ad6f4ad51306e`.
- Diff: `git diff 88830a7...1e3eeb5`.
- Scope: A2 date-based Search reads. Correction writes, editor concurrency and reviewed-place export remain the separate A2-write slice.

## Standards

No actionable documented-standard violations or meaningful Fowler smell findings. The pure matching/provenance helpers and the current-access context reader gather the relevant rules. There are no newly introduced suppression directives or constraint comments. The module docstrings describe ownership; no comment deletion or reshape is required. No application files were changed by this reviewer.

## Spec

### P2. Keep new sharing-context reads inside the bounded reference/index budget

Affected code is `mazi/discovery/discovery.py:414` and `:427`. `_bounded_document` still checks only the selected photo's own metadata, then calls `_document(user, asset)` without a context. The new `_document` default constructs `SharingContext(..., bounded=False)`. If that selected photo has an unresolved raw day/month timestamp, context resolution reads every current origin in the import run and parses its payload without the new per-origin, per-photo or request byte/origin limits.

The public large semantic similar-image path calls `_bounded_document` at `discovery.py:739` before its bounded document scan. Index batches also call it for before/after vector reads at `:491` and `:509`. A neighboring origin that has nothing to do with the selected photo therefore bypasses the guard on those reads. The context scan can parse more than the allowed 64 KiB per origin and can consume request work outside the shared counters. Its timer also starts afresh in the default context rather than using the original request's timer.

Independent reproduction uses the existing synthetic DateBasisTests fixture:

```python
import json
from tests.backend.discovery.test_date_basis import DateBasisTests
from tests.backend.archive.test_capacity import ArchiveCapacityTests
from mazi.capacity import CapacityExceeded

case = DateBasisTests()
case.setUp()
try:
    ArchiveCapacityTests.seed_projection(case, 1001)
    case.set_evidence('capacity-00000', share='04/05/2024, 21:00')
    row = case.store.db.execute(
        "SELECT id,payload FROM archive_origins WHERE asset_id='capacity-00001'"
    ).fetchone()
    payload = json.loads(row['payload'])
    payload['context'] = [{'text': 'x' * 70000, 'shared_at': '23/05/2024, 10:00'}]
    with case.store.transaction():
        case.store.db.execute('UPDATE archive_origins SET payload=? WHERE id=?',
                              (json.dumps(payload), row['id']))
    doc = case.store._bounded_document(case.alice, 'capacity-00000')
    print(doc['evidence']['chronology']['start'])
    case.store.search(case.alice, case.group, date_basis='chronology')
finally:
    case.tearDown()
```

The supposedly bounded document call succeeds and prints `2024-05-04`, proving that the oversized neighboring context was read and used. The normal Search call then raises `CapacityExceeded: Words & filters metadata exceeds the 64 KiB per-origin limit` against the same archive. The selected photo itself is small and passes the existing aggregate guard.

Avoid resolving sharing chronology for vector-only/index reads that never consume it, or pass the original request-scoped bounded context and shared counters through every path that needs it. A regression must prove an oversized neighboring context is not fetched/parsed through a bounded reference read and that the public reference/index path cannot evade request limits. A selected-photo-only aggregate check is insufficient after adding cross-photo date-order context.

Other reviewed date behavior matches the scoped plan. Matching happens before result selection in both document paths. Omitted API basis keeps legacy capture behavior. Explicit sharing considers every reliable share, while chronology uses capture or the earliest reliable share. Conflict matching uses actual evidence days rather than filling gaps, and represented range bounds are inclusive. Calendar days preserve recorded offsets. Raw WhatsApp proof is scoped by import and conversation and excludes hidden/departed origins. The main streamed context reader charges extra evidence to the request counters before parsing. Fresh UI sends chronology; old dated bookmarks preserve the blank legacy choice through pagination. Unsupported context categories are explicitly excluded while date filters are active. The first photo page does not require Atlas or People management.

## Independent verification

Commands ran in `/Users/altanesmer/Desktop/Ales/Mazi-wt/photo-search-corrections` with synthetic fixtures.

- `.venv/bin/python -m unittest tests.backend.discovery.test_date_basis tests.backend.discovery.test_keyword_budgets tests.backend.discovery.test_keyword_scaling tests.backend.discovery.test_shared_by tests.backend.discovery.test_api` passed 30 tests. An unclosed-SQLite ResourceWarning was emitted by an existing scaling fixture; the tests completed successfully.
- `node --test tests/dom/search-date-basis.test.mjs tests/dom/search-filters.test.mjs tests/dom/search-startup.test.mjs` passed 12 tests.
- `git diff --check 88830a7...1e3eeb5` passed for the committed branch.
- The direct reproduction above confirms the budget defect on actual code.

Browser reruns were not required to establish this backend blocker and were not run by this reviewer. The author records two real import/browser journeys and adjacent capacity checks in `work/poteto/photo-search-corrections/VERIFICATION.md`. This review does not claim those author runs as independent evidence. Atlas helper extraction, legacy result fields and unchanged fingerprint construction were inspected, but the full Atlas suite was not rerun in this pass.

## Limits and next check

Fix the bounded reference/index path and add its regression before requesting a new shipping verdict. Then rerun the date/budget/parity tests and the focused browser date journey as appropriate. The full integrated suite, correction/export write slice, production, physical-phone and five-friend acceptance remain separate. No schema, writer or ownership change is introduced here.

Standards findings: zero. Spec blockers: one P2 metadata-budget bypass.


## Reverification after the vector-read budget fix

Current shipping verdict: PASS at `fb83745cfbaeb67bb41faf261ed84c7f1935f609`. This supersedes the earlier FAIL verdict for shipping purposes. The failed-head evidence above remains accurate and is preserved.

- Base remains `88830a78e09ed537804f59a30998e2c8a868ad92`.
- Current head is `fb83745cfbaeb67bb41faf261ed84c7f1935f609`.
- Current stable full-PR patch ID is `b5a9131b93809b84e585a11658b00eb6c542f99c`.
- Focused review delta is `git diff 1e3eeb5...fb83745`.

The fix removes sharing projection from vector-only `_document` reads by default. Only the user Search paths pass an explicit sharing context or enable streamed photo evidence. Both index candidate selection and the final remaining-count scan explicitly disable the photo evidence projection. Bounded reference and before/after index documents therefore cannot load neighboring sharing-date context. The selected photo's existing own-origin aggregate limits still apply.

I reran the original reproduction. `_bounded_document` now returns no chronology evidence and executes no cross-photo context query. The user-facing Search still rejects the 70 KiB neighboring origin through its normal 64 KiB guard. The public large similar-image regression additionally observes fetched oversized rows and requires their payloads to be null before parsing. The public index regression forbids any sharing-context load, requires an oversized own-origin scan to reject atomically without vectors, then verifies a valid index operation succeeds.

The two user Search document paths still resolve evidence before date matching. Their explicit contexts remain request-scoped. Vector content, source inputs and fingerprint construction are unchanged. The existing streamed/live vector-document parity test passes with photo evidence disabled on the vector scan.

Independent focused verification passed 21 tests in 4.6 seconds:

```sh
.venv/bin/python -m unittest tests.backend.discovery.test_date_basis tests.backend.discovery.test_keyword_budgets tests.backend.discovery.test_remaining_capacity.RemainingCapacityTests.test_stream_fingerprints_and_eligibility_equal_live_document tests.backend.discovery.test_remaining_capacity.RemainingCapacityTests.test_complete_semantic_index_events_and_places_at_ten_thousand
```

`git diff --check 88830a7...fb83745` passed. The direct reproduction also confirms that Search retains its origin guard. The worktree remains clean and the reviewer made no app edits.

I initially selected the complete remaining-capacity module as well. That broader run was interrupted during the unrelated real 10,000-image import fixture setup, before its result, then replaced with the focused command above. The interrupted stress run is not a passing or failing result. The seeded 10,000-photo behavior and complete fingerprint parity checks did run and pass. No UI files changed in this fix, so the prior DOM checks remain applicable; the browser journey was not repeated by this reviewer.

Current Standards findings: zero. Current Spec blockers: zero. The reported P2 bounded reference/index context bypass is resolved.
