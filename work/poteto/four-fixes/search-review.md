# Search review

No actionable correctness or privacy regression found in d1e9beb..be981ae for the assigned two files.

The new public keyword route retains membership authorization and one transaction. The bulk projection excludes withdrawn origins, departed owners and viewer-hidden assets before matching or counting. People hydration keeps current tag actors, current verified identities and suppression rules. Filters, alphabetical ID order, complete counts and page boundaries agree with the old small-archive route in the independent comparison below.

The bounded_metadata switch preserves the prior policy. More than 1,000 visible assets still enforce per-origin, per-asset, per-request, origin-count and scan-time limits. At or below 1,000, the old implementation had no such metadata ceilings, and the new route preserves that compatibility. This leaves the prior resource-exhaustion risk for unusually large metadata in a small archive; the patch does not introduce or expand that policy. Large Messenger metadata remains searchable, which is covered by the added real-import fixture.

Validation passed. The keyword-scaling module ran 8 tests. The keyword-budgets module ran 6 tests, including UTF-8 byte ceilings, rollback, inclusive timing, the hosted octet_length branch and the 1,000-asset Messenger boundary. A separate comparison ran the two existing filter/privacy tests with the public search method loaded from immutable d1e9beb and the current bulk candidate. Both passed. The shim changes only zero-argument super binding so the old method can execute on the current store class. Reproduce with `.venv/bin/python /tmp/mazi-four-fixes/search-baseline-parity.py` from the repository root.

One maintenance gap remains. assert_parity now compares two calls into the same _keyword_search implementation. Those equality assertions no longer guard independent filter behavior, although the literal assertions and the independent baseline experiment still provide evidence for this patch. Replace the misleading parity oracle with literal expected IDs, counts and People output for representative combined filters and privacy states. Prioritize hidden/withdrawn/departed-origin exclusion and suppressed/departed People output. Do not retain a frozen legacy implementation in production solely for testing. This is a follow-up test-quality recommendation, not evidence of a behavioral regression.

Hosted production timing and a real PostgreSQL end-to-end run were outside this focused review. No application files were edited.

## Test-quality closure

Commit `1c04b80` replaced the redundant parity oracle with explicit expected IDs, totals, combined filters and People/privacy outcomes through the public search API. All eight scaling-contract tests passed afterward.
