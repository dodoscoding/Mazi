# Candidate B. Frontend chronology view model

## Problem and traced ownership

The API already preserves capture date in Memory.date/year/dateBasis and distinct sharing evidence in Photo.provenance.sharedAt. Home derives its selected year, year summaries, place representatives and Replay from Memory.year. atlas/model builds year counts and journeys from that same field. Timeline owns an independent Replay that walks year groups from browse/model.byYear. Both disable Replay below two distinct years. Existing displayDate, longDate, shortDate and browse/dateLabel show share labels for capture-unknown cards, but Home still says Undated. Therefore UI policy is inconsistent even though the source evidence is available.

## Usage

Home builds chronology once from memories. It derives selected display evidence from chronology.byId, passes effective-year Atlas data to its scrubber and map, and advances Replay through chronology.ordered memory IDs. Timeline uses the same ordered entries for groups and Replay. Viewer and Portal use the shared date display helper for evidence labels. Search capture filters continue receiving the unchanged original Memory and backend contract.

## Shape

Add a pure src/memory/chronology.ts module with two exported functions.

```ts
type ChronologyDate =
  | { basis: 'capture'; year: number; sortKey: string; label: string }
  | { basis: 'shared'; year: number; sortKey: string; label: string }
  | { basis: 'unknown'; year: null; sortKey: null; label: string };
type ChronologyEntry = { memory: Memory; date: ChronologyDate };
type Chronology = {
  entries: ChronologyEntry[];
  ordered: ChronologyEntry[];
  byId: Map<string, ChronologyEntry>;
};
function chronologyDate(memory: Memory): ChronologyDate;
function buildChronology(memories: Memory[]): Chronology;
```

Capture wins when the existing year is non-null. Parse its known ISO leading date for within-year ordering; sample human labels with year-only evidence use a year sort key without inventing a day in visible copy. Capture-unknown cards choose earliest resolved, unambiguous valid local sharing calendar date across deduplicated provenance. Label this “Shared on [date] · Capture date unknown”. Multiple share observations retain their existing detailed provenance labels in the source section. Unknown or ambiguous sharing evidence is excluded from timed Replay and displayed “Capture date unknown” with raw unresolved share evidence. Never parse a raw source string heuristically. Validate ISO dates using calendar roundtrip, so impossible days do not normalize silently. Local calendar order preserves the source date without guessed timezone conversion. Ties keep API order.

ordered contains only capture/shared entries, ascending. Replay eligibility is ordered.length >= 2. One timer advances by memory ID, with selected ID as dependency, rather than advancing by year. Start from first when at last or unknown, stop at end, support pause. Multiple memories on one day/year remain distinct stops. Home already uses selected-memory route changes without archive reload, so this does not require added transport state.

Atlas accepts chronology entries or an explicit effective-year selector for year aggregates and journeys. Prefer a chronology-specific buildAtlas entry point taking entries, while preserving capture-only buildAtlas for consumers that need the original contract. Avoid cloning Memory with year rewritten because that can leak sharing evidence into capture consumers. Home's representative, yearCounts, firstMemoryOfYear and arrow-year navigation must use the effective date consistently. Timeline needs chronology grouping local to that surface; do not change browse/model.byYear globally because search/filter callers may mean capture years. Timeline Replay scrolls li[data-memory-id] for each entry and tracks that entry as its active preview; year slider remains year navigation. Rename “Replay the years” to “Replay memories”.

This interface concentrates source selection, calendar validation, ordering and basis labels behind two operations. It avoids scattering fallback checks across React components. No backend/schema change is needed.

## Uncropped photos

Portal uses fixed 390x340 organic clipping, cover and scale(1.06). Keep decorative aura organic, make portal-window rectangular with subtle rounding, use contain, remove enlargement, and change photo-settle/portal-breathe effects so they cannot crop edges during motion. Viewer .photo-frame img needs a scoped contain override; viewer-ghost and view-transition image need matching contain. Stage rounded corners can still clip a touching landscape image, so give image a small safe inset or remove stage radius. Preview images already preserve aspect ratio; full uncropped does not imply original-byte resolution. Test portrait, landscape and square synthetic edge markers at desktop and phone widths.

## Alternatives

Backend timelineDate projection provides a stronger cross-client policy and parsing boundary, but requires a new serialized contract, Python tests and updated frontend fixtures. It is preferable if other clients need this chronology. Frontend derivation is narrower because all required evidence already arrives and this requirement changes presentation/Replay rather than capture truth. Mutating year/date with a fallback is shortest but erases basis semantics and risks capture filters. Keeping year-only Replay cannot satisfy multiple same-year shared photos.

## Tests and risks

Unit cases cover capture overriding earlier share date, resolved sharing fallback, ambiguous/raw-only rejected, invalid local days rejected, earliest of multiple sharing sources, source-local date retained, year-only sample capture, stable ties, unchanged input Memory, same-year multi-memory ordered stops. Existing capture-only atlas tests remain unchanged if introducing a separate adapter. Browser contracts cover Home and Timeline all-shared same-year Replay, pause/end/restart, clear basis labels, unknown disabled explanation, keyboard/manual selection interaction, portal and viewer uncropped edges during settled and transition states. Grouped memories with partially unknown capture dates use sharing fallback because API marks their capture year null; source capture evidence remains visible in provenance notes. Read-only candidate, no code or commits.
