# Phase 2 local verification

Historical experiment record. The active application now runs with `python -m mazi`; source and test links below point to their consolidated locations. Original acceptance claims and evidence remain historical.

Implementation date: 6 October 2026. Base revision: `14602f7` (`feat(pilot): add resumable uploads and lifecycle controls`). Changes are an uncommitted working-tree patch; [code hashes](evidence/code-sha256.json) identify the verified implementation. No remote CI, deployed service, consented real archive or beta group acceptance is claimed.

## Environment and commands

macOS arm64, Python 3.11, Pillow 12.3.0, the repository's locked Node dependencies, Playwright 1.63.0 and Chromium 153.0.8010.12. Desktop Chrome configuration and Pixel 7 emulation use the same Chromium engine. The Python virtual environment and synthetic databases are local/temporary and ignored by Git.

Commands run from the repository root:

```sh
.venv/bin/python -m unittest discover -s phase2/tests -v
.venv/bin/python -m unittest discover -s phase1/tests -v
MAZI_PYTHON="$PWD/.venv/bin/python" npm run test:imports:browser
npm run lint
npm run build
npm run check:docs
git diff --check
```

This environment supplies Node through the bundled runtime rather than a global npm installation. The npm script equivalents were executed with that Node binary and the installed package CLIs. Browser binaries were downloaded to `/private/tmp/mazi-browsers`, set through `PLAYWRIGHT_BROWSERS_PATH`. HTTP/browser tests ran with the local socket permission required by the sandbox. No personal archive was accessed.

## Results and fixture evidence

| Check | Result and boundary |
| --- | --- |
| Python Phase 2 suite | 26 passing adapter, engine and actual HTTP checks; [log](evidence/python-tests.log). |
| Existing Phase 1 suite | 10 passing regression checks. Its old staging policy remains separate. |
| Browser journey | 2 passing journeys: desktop and Pixel 7 emulation. Inventory, real upload/worker/media, missing/unsupported accounting, source-text escaping, report download, repeat import and withdrawal. |
| Accessibility | No axe violations in the tested completed-report state on either layout. A phone scroll-region keyboard issue was found and fixed. This does not replace screen-reader or physical-device acceptance. |
| Visual review | [Desktop report](evidence/desktop.png) and [phone report](evidence/phone.png) inspected. Synthetic green test image is intentionally a generated pixel fixture. |
| Type/build | TypeScript and Vite production build pass; existing Atlas bundle-size warning remains. Phase 2 is the separate Python/local UI and is not in that Vite bundle. |
| Formatting/docs | Prettier, canonical documentation checker and patch whitespace checks pass. |

Synthetic fixture version 1 lives in the tests, with fixed ZIP metadata for exact-manifest replay. It covers Android/iOS-shaped WhatsApp messages, two explicit date orders and ambiguous dates, multiline Unicode, repeated text/filenames, missing media, unsupported formats, Messenger participants/reactions/Unicode, and Discord sent-message CSV/channel/URL references. It does not establish compatibility with an actual released exporter version.

## Acceptance mapping

| Scenario | Local evidence | Remaining production evidence |
| --- | --- | --- |
| T03 | Interrupted byte transfer, restart/checkpoint recovery, identical manifest replay, stable source IDs with conflicting payload rejection, byte dedupe with separate occurrences, ambiguous partial exports, independent groups. A 20,000-record missing-reference manifest replays without extra items or origins. | Provider pipeline and representative overlapping real exports; full 20,000-item successful-media replay and measured cost. |
| T04 | Independent worker connections; expiring leases and rejected stale completion; retry backoff/attempt cap; restart after durable object writes; rejected post-commit replay; cancellation of a 20,000-item run preserves its successful prefix and accounts for the other 19,999. | OS-level worker kill during large real media processing, provider failures, production reconciliation and restore. |
| T06 | Separate capture EXIF/share evidence; unknown timezone remains without UTC; explicit/ambiguous date ordering; raw source evidence preserved. | Real exporter timezone/DST/metadata variants and production timestamp correction UI. |
| T07 | Traversal, duplicate entries, symlinks, nested archives, expansion ratio, malformed source, unsupported codecs, missing media and disabled remote fetching. All discovered items receive an outcome. | Consented representative exports, video/codec fixtures before enabling video. |
| T09 | Owner-only import mutations; active-member media and origin reads; outsider/other-group denial; withdrawal, member departure and rejoin; late worker output rejected; independent contributions survive. | Provider access, retention/purge, database/object recovery and derived production reads. |

The engine deliberately implements no automatic remote attachment fetcher, no cloud processing, no video decoder and no production deployment. The roadmap retains M1/M2 acceptance checkboxes as open. D01's production integration and the confirmed friend-group beta remain necessary before real use.
