# Spec and correctness review

Verdict is PASS+NOTES for code head `9ea646f2d4a041b592e370aa57e2abf5cdc249c5` against base `034921da3e5849f7b45c982ac0704a8d8bcdf380`.

The reviewed comparison is `git diff 034921da3e5849f7b45c982ac0704a8d8bcdf380...9ea646f`. Its stable patch ID is `c569fcf8bf4064e1ef7ef89a7586c502f0af12b1`.

No actionable correctness, regression, security, scope-creep, or code/spec mismatch was found. The retained generator advances only with the committed checkpoint. Cancellation, withdrawal, membership loss, competing scans, failed transactions, store close, and exhausted inventory release its workspace. Reconstructed scans validate the archive manifest and fail explicitly when the saved checkpoint exceeds the inventory. Bulk insertion preserves the existing ordinal uniqueness and transactional fence. Upload and sharing consent remain unchanged.

Independent verification passed.

- `.venv/bin/python -m unittest discover -s tests/backend/imports -t .` passed 45 tests.
- `node --test tests/dom/imports.test.mjs` passed 16 tests.
- `git diff --check 034921da3e5849f7b45c982ac0704a8d8bcdf380...9ea646f` passed.
- Replayed `PYTHONPATH=. .venv/bin/python work/poteto/import-performance/benchmark.py`. The mixed fixture scanned in 0.3160 seconds with one inventory invocation and 60 inserts. All 223 attachments became available after confirmation. The 30,000-record fixture scanned in 1.4822 seconds. Fake hosted scanning used two GETs and transferred 538,805 bytes. Timing varies from the recorded run; operation counts agree.

Acceptance remains partial at the release boundary. PLAN.md line 32 requires “create a PR, merge, deploy the existing service, and verify the deployed revision.” These actions are intentionally owned by the parent and are not established by this code review. VERIFICATION.md line 30 correctly records the pending integration onto the existing deployed runtime.

The refresh from `eb01a82` changes browser fixtures only. The 600,000-byte ZIP entry ensures a second chunk still exists under the new 512 KiB size. Resume offsets and visibility gating now match that boundary. No coverage was removed. Browser completion remains pending in the parent's full-suite run. Reviewed the current PROTOTYPE_STACK.md addition and VERIFICATION.md. No material false claim was found; both preserve synthetic and deployment limitations. The active virtual environment reports Python 3.14.7 as documented.

The hosted benchmark uses SQLite and a fake object transport. It proves storage operation reductions but does not prove PostgreSQL latency or warm scan reuse across deployed worker requests. The release smoke test should establish that reuse and deterministic cleanup before claiming the deployed speedup. Processing itself is unchanged, as explicitly reported in VERIFICATION.md line 18. No new processing-throughput claim is supported.
