# Candidate A: backend-owned chronology projection

## Grounded trace

`atlas_view` builds cards from authorized `_timeline_items` capture dates, then joins authorized live origins to attach per-photo sharing provenance. The final card assembly is the first place with both forms of evidence and already runs inside the authorization snapshot. Currently `year`/`date` only describe capture; `Home` obtains all scrubber years and place journeys from `buildAtlas`, advances Replay by distinct year, and disables below two years. `Timeline` independently groups and replays by year. `browse/model.dateLabel` sometimes substitutes a sharing label while its grouping still uses capture year. `memory/facts.chronology` parses a date label, and related memories use capture year. These separate paths explain inconsistent dates and no Replay for 300 sharing-only memories.

## Caller usage / public types

Keep `Memory.year`, `date`, `approximate`, and `dateBasis` as capture facts. Add a projected chronology object, never overwrite those facts:

```ts
type MemoryChronology =
  | { basis: 'capture' | 'shared'; start: string; end: string; year: number; approximate: boolean }
  | { basis: 'unknown'; start: null; end: null; year: null; approximate: true };
type Memory = { /* existing */ chronology?: MemoryChronology };
function chronologyOf(memory: Memory): MemoryChronology; // sample/legacy fallback from capture only
function replayMemories(memories: Memory[]): Memory[]; // valid chronology, ascending start/end/id
function chronologyLabel(memory: Memory): string; // shared visibly prefixed, unknown explicitly unknown
```

Backend private `_chronology(records, provenance)` returns the JSON object after origin assembly. Capture wins when the existing card has a complete, known capture chronology. Otherwise use each asset's earliest authorized, unambiguous `sharedAt.local`; include fallback only when every asset has a usable effective date. For mixed cards use capture per asset if available and shared otherwise, setting basis `shared` whenever the resulting range includes fallback, so label says `Shared-date chronology · capture dates partly unknown`. A grouped memory with any unresolved asset remains unknown unless every asset has an effective capture-or-sharing date; tests must pin this decision. Do not parse raw ambiguous strings or infer dates from filenames. Strict ISO date validation prevents malformed local values becoming fabricated years. Multiple origins deduplicate and pick earliest valid sharing date deterministically.

## Consumers

`src/atlas/model.ts` uses chronology year for Atlas years, place counts, journeys and first-of-year, through one shared accessor. Home readout explicitly says `Shared in 2025 · capture date unknown`, capture uses ordinary capture labels, fully unknown says `Date unknown`. Scrubber accessibility text includes basis. Existing capture filters in discovery, calendar/search and legacy feature modules stay capture-only.

Home Replay uses `replayMemories` by memory ID, not year. At least two dated memories enables Replay even one year or identical day. Start at first when selected is last/unknown, advance one memory per tick, stop after last. Pause/manual navigation semantics remain existing behavior. Timeline Replay likewise visits memory articles (add `data-memory-id`) with current memory ID, scrolling each entry; year scrubber can remain grouped navigation. Rename `Replay the years` to `Replay memories` and state that sharing dates fill unknown capture dates.

`browse/model.byYear`, Timeline labels and `memory/facts.chronology` use the same chronology accessor to avoid parsing visible strings. Related `Same year` should either remain capture-only or explicitly label fallback `Same sharing year`; do not quietly redefine it. Detail date chip should use chronologyLabel and retain photo provenance. Samples use legacy capture fallback until updated.

## Full photographs

Preserve thumbnail `cover`; add viewer-scoped `object-fit: contain` for track, ghost and transition image. Portal image needs `contain`, no scale, a rectangular rounded container instead of organic border-radius mask; retain atmosphere decoration behind the whole rectangle. Remove border-radius breathing/scale transforms from photo/container if they clip corners. Verify portrait and panoramic fixtures with contrasting edge markers through portal, detail viewer, arrow transitions and mobile.

## Alternatives and rationale

Replacing top-level year/date with fallback is smallest diff but changes an established capture-data contract and leaks chronology into capture filters. Deriving everything client-side avoids an API addition but duplicates origin evidence arbitration and raw-date validation across clients. Backend projection concentrates evidence selection and preserves capture semantics; a small pure client module owns only legacy/sample adaptation, sorting and presentation. The optional field provides compatibility with fixture-heavy tests and sample objects; backend always emits it.

## Required tests

Backend: capture preferred over earlier sharing; sharing-only; mixed grouped capture/shared; ambiguous/no dates; malformed local; duplicate authorized origins deterministic; withdrawn/unauthorized origin cannot supply chronology; existing query budget unaffected. Pure TS: complete order, equal-day deterministic IDs, unknown excluded, one-year multi-memory Replay enabled, legacy sample fallback, unknown labels. Browser: Home and Timeline actual timer advances two same-year sharing-only memories, stops/pauses/restarts, clearly labeled date basis; capture cases still work; unknown-only disabled explanation. Portal/viewer desktop and phone verify entire portrait and panoramic image via visible edge markers and computed contain/no clipping. Run backend, unit, Playwright and build before deployment.
