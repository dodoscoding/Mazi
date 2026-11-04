# Idle browser connection regression

## Problem and mechanism

The loopback server could accept a browser's idle preconnection and then wait for its first request line. Python's synchronous `HTTPServer` could not accept another connection while waiting. A reload therefore could receive HTML and CSS but leave its scripts pending.

The downloaded PR #113 desktop import-workspace trace timed out during `page.reload` on `/review` after 180 seconds. Its final network records contain successful HTML and CSS responses, followed by unfinished `theme.js` and the entry-script requests. [Sanitized network extract](ci-reload-network.json) records the artifact hash, response status and duration without request headers or cookies. The trace alone does not identify the blocked socket. The accepted-socket regression test reproduces that mechanism directly.

## Structural choice

`AppServer` now uses `ThreadingHTTPServer`. Each accepted connection can read its headers independently. A lock created inside each server's constructor wraps GET and POST dispatch through a handler subclass. The lock covers complete handler execution and response delivery, preserving single-request access to the shared store. The queue size stays 128. Request-body reads remain inside their existing handlers.

Plain threaded dispatch was rejected. Running the concurrent GET and POST test with unguarded `ThreadingHTTPServer` fails with `POST overlapped the active store read`. [Rejected alternative output](unsafe-threading.txt) records the observed overlap. A pre-read socket deadline was also rejected because synchronous acceptance would still delay ready requests until that deadline, and a connection-wide timeout would change upload behavior. No upload deadline was added.

Vercel imports the original `handler_for` directly and keeps its existing request serialization. The background worker retains its separate store connection. No schema, membership, origin, export or audience behavior changes.

## Revisions and contract

Base `49f1f218ead0c64e3af1e027d5edd5a40fb49bb4` contains N1. Test commit `6b76b0b` changes the existing server fixture to exercise the real `AppServer` and adds two contracts. Fix commit `696e0f8` changes only the server class and its stdlib import.

The idle test waits for the server to accept a TCP connection that sends no HTTP bytes. It then makes a separate `/health` request while the idle connection remains open. The response must arrive before its one-second socket deadline.

The serialization test pauses a real authenticated group read inside the store. A concurrent introduction POST must finish parsing its headers but cannot enter its store method until the read releases. Events control the test sequence. A bounded event wait detects overlap without a sleep.

Failing before, on Python 3.14.7:

```text
test_idle_accepted_connection_does_not_block_health ... ERROR
TimeoutError: timed out
Ran 1 test in 1.571s
FAILED (errors=1)
```

Passing after, on Python 3.14.7:

```text
Ran 7 tests in 4.161s
OK
```

[Full red output](red.txt), [green output](green.txt) and [Python 3.11 output](python311.txt) retain the exact commands' test names and results.

## Verification

Checks ran on macOS with Node 24.15.0, Python 3.14.7 and Python 3.11. The browser fixture used synthetic data and port 8134. Builds and browser runs in this worktree were serialized.

| Command | Result |
| --- | --- |
| `.venv/bin/python -m unittest tests.backend.test_server -v` | Seven passed on Python 3.14.7. |
| `python3.11 -m unittest tests.backend.test_server -v` | Seven passed. |
| `.venv/bin/python -m unittest tests.backend.test_vercel_bridge -v` | 21 passed, including the existing request-lock and disconnection contracts. [Output](vercel-bridge.txt). |
| `MAZI_UNIFIED_PORT=8134 npx playwright test --config playwright.imports.config.ts` | 19 passed and one inapplicable desktop phone test skipped. Includes repeated reloads across workspaces, narrow layouts, phone gallery controls, transfers and background retention. [Output](import-workspace.txt). |
| `npm run build` | Passed as the browser fixture's startup command. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed. |
| `npm run check:budgets` | Passed. |
| `npm run check:docs` | Passed. |
| `git diff --check` | Passed. |

This fixes the local accepted-idle-connection stall and preserves serialized dispatch. It does not establish hosted performance or production milestone acceptance. Independent review, PR publication and merge remain with the parent delivery workstream.
