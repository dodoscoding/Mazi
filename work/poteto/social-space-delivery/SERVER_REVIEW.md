# Independent idle-connection review

Verdict: FAIL at `1b7b191b0dfcc12a218a9a97388122854f6fa64e`. The idle-connection fix works, but local shutdown can close the store while a request still uses it.

Reviewer is GPT-6.1 Sol with high reasoning. This is independent review within one model family.

- Base: `49f1f218ead0c64e3af1e027d5edd5a40fb49bb4`.
- Head: `1b7b191b0dfcc12a218a9a97388122854f6fa64e`.
- Stable patch ID: `d92ff225c1950f7241365d6a6c3c19701e2012f1`.
- Scope: `git diff 49f1f21...1b7b191`.

## Standards

One evidence correction is needed. `work/poteto/idle-connections/VERIFICATION.md` says that base `49f1f21` contains N1. That commit merges the GPS test fix. N1 merged later at `8d6a746`. Remove the claim that this base contains N1. The exact base SHA itself is correct.

No new application/test comments or suppressions were introduced. Two obsolete comment lines were removed. No actionable code-style finding remains in the changed runtime code.

## Spec

P2. Preserve safe store shutdown when enabling connection threads. `mazi/server.py:20` now inherits `ThreadingHTTPServer`, whose daemon request threads are not joined by `server_close`. The unchanged `main` cleanup at lines 148-149 calls `server.server_close()` and then `store.close()`. A running or queued GET/POST can therefore touch the closed database after cleanup returns. The previous synchronous HTTPServer finished its current dispatch before its serving loop ended.

I reproduced the race through the actual public HTTP handler with a synthetic MemoryStore. Pause an authenticated `/api/groups` request inside `store.groups_for`, then call `server.shutdown(); server.server_close(); thread.join()`. The close returns while the request future remains running. Calling `store.close()` as main does and releasing the paused read produces:

```text
server_close returned with store request still running: True
sqlite3.ProgrammingError: Cannot operate on a closed database.
request after close failed: RemoteDisconnected
```

The fix needs a server closing state that waits for active store dispatch and prevents queued parsed handlers from entering after store cleanup. It must still permit idle header-reading connections to terminate without hanging close. Setting non-daemon request threads alone would reintroduce a shutdown hang on an idle preconnection. Add a regression that holds an active request, queues a parsed request, closes the server, and proves safe completion/rejection before store closure.

## Independent checks

- `.venv/bin/python -m unittest tests.backend.test_server tests.backend.test_vercel_bridge -v` passed all 28 tests on Python 3.14.
- `python3.11 -m unittest tests.backend.test_server -v` passed all seven tests.
- The new idle-socket contract and GET/POST serialization contract exercise actual socket requests and pass.
- `git diff --check 49f1f21...HEAD` passes.
- Inspected the sanitized CI trace extract and recorded browser output. The author run passed 19 import-workspace cases with one inapplicable skip in 47.1 seconds. I did not rerun that browser suite because this review adds a distinct shutdown reproduction at the socket/store boundary.
- Vercel bridge code is unchanged and its independent 21-test run passes.

The shutdown race is the only runtime blocker found. No production data, migration or deployment was accessed. The reviewed worktree remained clean.

## Reverification at 5b880ca

Latest verdict: PASS. The preceding FAIL remains the record of the initial patch and is superseded by this review.

- Base: `49f1f218ead0c64e3af1e027d5edd5a40fb49bb4`.
- Head: `5b880cab06097b76bc74969269cfdce8f221dd21`.
- Stable full-branch patch ID: `f6eba178200f63cdd47c019253840b29d1b9bf7b`.
- Fix reviewed: `git diff 1b7b191...5b880ca` plus the complete branch whitespace check.

### Standards

No remaining findings. The base description now correctly says that `49f1f21` merges the GPS assertion fix. No explanatory application/test comments or suppressions were added. Full branch whitespace passes.

### Spec

The closing gate resolves the P2 shutdown race. `server_close` takes the same lock as GET/POST dispatch, waits for active dispatch, marks the server closed and closes its listener. Each later GET/POST checks that closed state under the lock and responds 503 before invoking the original handler. Idle threads waiting for headers do not hold the dispatch lock and do not delay close. A queued request that wins the lock before close may finish safely; one that enters after close is rejected. In neither case can cleanup close the store underneath active dispatch.

I reran the original paused-store reproduction independently through authenticated `/api/groups`. Close now waits while the read is paused, the read returns 200 after release, and only then can store cleanup proceed. The probe printed:

```text
PASS: server close waits for active store request
active request status: 200
PASS: store cleanup follows completed dispatch
```

### Independent checks

- `.venv/bin/python -m unittest tests.backend.test_server tests.backend.test_vercel_bridge -v` passed all 30 tests on Python 3.14, including the active-close/queued-POST and idle-header/late-GET contracts.
- `python3.11 -m unittest tests.backend.test_server -v` passed all nine tests.
- `git diff --check 49f1f21...HEAD` passes.
- Inspected the narrow runtime change and shutdown regression tests. Existing Vercel bridge remains unchanged and all 21 bridge tests pass.

No remaining runtime or validation blocker was found in this scoped review. I did not rerun the browser suite because the correction changes only server dispatch shutdown and the original browser reload fix remains exercised by the socket regression. This verdict is independent within one model family. No production data or deployment was accessed.
