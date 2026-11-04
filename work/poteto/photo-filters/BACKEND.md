# F2 authoritative photo matcher boundary

Base `b3efcf7` plus accepted F1 dependency `dbbc351`. Backend implementation `ad429ec`, regression coverage through `f0dc5da`; UI changes remain uncommitted for the subsequent slice.

Red: `6389f24` fails because Search has no screenshot argument. Green: shared `PhotoFilter` applies same-photo AND and within-dimension OR before Search counting/pagination and matches-ID projection. Gallery endpoint returns exact authorized IDs and explicit full-visible counter denominator. Existing source-city/country Search semantics and source/sharer D24 counters are preserved.

Verification: new matching/HTTP/large-query tests plus the legacy shared-place regression: 6 passed. A2 date-basis plus initial filter contract: 14 passed. Existing discovery/keyword-byte/remaining-capacity/shared-by run: 47 passed and one legacy shared-place failure from the first draft; the place contract was restored and that regression passed separately. The capacity run covered 10,000 photos and strict per-origin/request boundaries without partial totals. Existing SQLite ResourceWarnings occur in capacity fixtures.

No schema, dependency or deployment changes. Canonical contracts and test plan record the additive wire. Parent owns independent review and PR/merge. The next UI slice currently measures above the hard entry-script limit and is unfinished; no ceiling is changed.
