# Desktop view retention

- [x] Reproduce synthetic hide/return in Chrome; distinguish remount from document reload.
- [x] Trace entry, archive, feature lifecycle owners and upstream PR #106.
- [x] Compare local retention with an App-owned access controller.
- [x] Expose regression before changing production code.
- [x] Apply local retention with quiet foreground access checks.
- [x] Verify browser reproduction, privacy cleanup, denial and stale-response safety.
- [x] Review and run relevant checks.
- [x] Create [PR #160](https://github.com/dodoscoding/Mazi/pull/160) against the affected workstream.

## Scope and throughput

Base: `codex/remaining-acceptance` at `34c8ebe`, which remains on the older lifecycle implementation. Main already includes the related fix in #106. This PR targets the affected workstream and ports only visibility behavior, preserving its Memory answer privacy contract.

Data shape remains the existing entry and archive state objects. Visibility is a revalidation trigger, not an authentication or route transition. Access loss, group change, navigation, and page closure retain their cleanup ownership.

The parent owns browser regression tests and integration. A worker owns the three lifecycle modules and hook tests. An independent reviewer checks access races and privacy. These disjoint write scopes avoid waiting on the same files. No runtime dependencies or schema changes.

## Design choice

Keep state in its current owners. An App-owned shared access controller would replace the existing event model and expand this fix unnecessarily. Preserve generation and abort protection, retain ordinary feature DOM, and dispose answer routes on hide.
