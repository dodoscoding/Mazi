# Archive ordering regression verification

Runtime correction `50af688` is integrated with main `abf1238` at reviewed head `adbcbfd672fd452ad5ce21e913425dea055f6287`. The three-line change adds explicit ordering to normal person-tag and reviewed-event reads so they match the existing bounded export order. No test assertion, authorization, schema, source data or API shape changed.

## Diagnosis

The Python 3.11 full CI run on `8aa0302` reported four archive regressions. A tight command running the exact four tests passed plan `75727e0` in 2.53 seconds and failed new main in 2.28 seconds. The two export failures were actual people.json byte mismatch and mixed accepted/rejected memory ordering when timestamps tied.

First-parent bisection of the export pair pinned `921799d` (C1 comments), whose required composite foreign-key indexes changed query plans. The previous reads depended on implicit SQLite order. Bounded export already explicitly sorted person asset IDs and events by descending update time, ascending status, then local insertion order or hosted event ID. Applying those same sort keys to the normal reads restores the established parity rather than changing export output or weakening tests.

The other two failures were isolated separately: A1 merge `88830a7` added enough legitimate evidence to expose JSON assembly's memory peak (fixed in #133 without raising the 4 MiB cap), and F1 summary hydration incorrectly applied a 10,000-query bound to whole Atlas projections (fixed in #134 with internal bounded batches).

## Acceptance evidence

- Exact export parity, mixed-status tie and reverse personal-action contracts: three passed on Python 3.11 after the correction.
- `tests.backend.archive.test_export_capacity`, `tests.backend.discovery.test_discovery`, `tests.backend.social.test_comments`, `tests.backend.test_atlas`: **85 passed in 24.45 seconds** on Python 3.11. Output retained locally at `/tmp/mazi-export-order-verification.log` during delivery.
- After integrating the independently reviewed memory and label fixes, the original complete four-regression command passes in **1.92 seconds** on Python 3.11.
- Independent review at `adbcbfd`: **30 Python 3.11 checks**, **14 Python 3.14 checks**, and targeted reverse-unordered-selects plus hosted-marked ID ordering controls pass. Complete patch whitespace passes. The independent report is retained in the delivery audit.

No debug instrumentation or bisection state remains in this worktree. All fixtures were synthetic and local. Final full-product regression and production rollout remain separate.
