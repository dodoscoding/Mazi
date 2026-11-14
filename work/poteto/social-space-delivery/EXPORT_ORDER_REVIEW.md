# Export ordering independent review

## Artifact and verdict

**PASS** at head `adbcbfd672fd452ad5ce21e913425dea055f6287`, base/merge-base `abf1238c87efc241d0332a43839334a8e967e70e`, stable patch ID `9882ffccc37e80487ce6de96c189d3ed777cfd31`. Reviewed immutable three-dot diff in `archive-regressions`. Runtime change is exactly three added/replaced lines across two files, from `50af688`; final head merges current main. No app edits or publication performed by reviewer.

## Standards

No findings. The fix uses the existing `insertion_order` helper locally and native `id` on hosted event tables, matching established export code rather than introducing another ordering abstraction. No introduced comments or suppression directives. No speculative generality, meaningful duplication, mysterious names or other actionable smell identified in this narrowly scoped change.

## Spec

No findings. Ordinary People tags now explicitly sort by `t.asset`, matching `_export_rows`' ascending asset key. Ordinary reviewed events now sort by `updated_at DESC,status ASC` followed by local row insertion order or hosted `id ASC`, exactly matching `_export_personal(..., hidden_memories)`. Accepted-event People memory lists have constant status, so their tie order also matches `_export_person_memories`. This removes query-plan-dependent ordering introduced by additional indexes while preserving all selection, authorization, membership, hidden/suppression and export-admission predicates.

The hosted path correctly avoids `_mazi_order` for review events, whose schema uses native IDs. A direct independent ordinary `reviewed_events` check against the existing hosted-marked database fixture returned `event-a,event-b` on equal timestamps, matching the export helper. The small status tie-order change is deliberate and required by the existing mixed-status parity contract; it does not alter event timestamps, statuses or payloads. No schema, data, permission or migration change.

## Independent verification

- Python **3.11.15**, `/tmp/mazi-social-regression-311/bin/python -m unittest tests.backend.discovery.test_people_export tests.backend.archive.test_export_capacity tests.backend.test_export_postgres_order`: **30 passed in 17.737s**. Includes exact People/personal JSON bytes, overlapping tags and hidden events, mixed statuses with equal timestamps, reverse personal actions, file/bytes/HTTP equivalence, final admission/privacy races, bounded retention and 10,000-record completeness.
- Python **3.14.7**, repository venv with the two focused People parity methods plus `tests.backend.archive.test_export_capacity` and `tests.backend.test_export_postgres_order`: **14 passed in 15.792s**.
- Additional independent Python 3.11 checks: ordinary hosted-marked reviewed-event native-ID tie order passed; mixed-status exact export parity with `PRAGMA reverse_unordered_selects=ON` passed.
- `git diff --check abf1238...adbcbfd`: passed. Only the two intended runtime files differ; no assertions were weakened or replaced.

The hosted-marked fixture validates SQL column/order compatibility and is not a new live PostgreSQL run. Existing full CI and live hosted rollout remain delivery-owned gates; no production mutation was performed.
