# Independent design judgment

I read both candidates end to end and checked the current Atlas projection, capture evidence selection, provenance helpers, Atlas model, browse grouping and Timeline Replay. This is a read-only judgment. No application code was changed.

| Criterion, 0 to 5 | A | B |
| --- | ---: | ---: |
| Preserves capture versus sharing semantics | 4 | 4 |
| Fixes Home and Timeline, including same-year Replay | 5 | 5 |
| Small coherent API and diff | 2 | 5 |
| Ambiguous and invalid data correctness | 4 | 3 |
| Testability | 5 | 5 |
| Total | 20 | 22 |

Choose B as the base. The API already supplies the authorized sharing observations, so the requested presentation and Replay policy can remain in one pure frontend module. A new serialized chronology contract adds a backend surface without an identified external consumer. Both candidates correctly keep capture fields intact and replace year-only Replay with memory stops. B also explicitly avoids mutating Memory.year and changing capture-only search grouping.

Graft A's coverage discipline into B. For a grouped memory, do not turn one valid sharing observation into a claim that every photograph was shared on that date. Check the sharing evidence per photo before collapsing it. A conservative implementation can require a valid sharing observation for every photo, use the range of each photo's earliest valid sharing observation, and label it as sharing evidence. If the product intentionally permits partial evidence to provide a Replay position, the label must say “First known share” and “Capture dates incomplete”, with the coverage limitation visible. It must not say “Shared on” for the whole memory or “Capture date unknown” when some capture dates are known. Prefer the conservative rule for this patch because it avoids adding another partial-evidence presentation state.

Concrete mislabel cases occur in the current API shape. mazi/atlas.py sets year to null whenever even one constituent asset lacks a capture date. It still puts known capture dates into Memory.date and appends “some dates unknown”. A two-photo card can therefore have a known 2019 capture date on one photo and no capture or sharing date on the other. Choosing the first photo's 2025 share date would incorrectly present the entire card as shared in 2025. It also asserts that the capture date is unknown despite known partial capture evidence. A second case has sharing dates for both photos in different years; selecting the earliest alone is the first observed share, not a single date on which the whole memory was shared. A third case has conflicting capture evidence, which also yields year null. That is uncertain capture chronology, not evidence that the photographs lack a capture date. Sharing may still position Replay when clearly labeled, but it cannot resolve that conflict.

Reject A's proposed mixed per-asset effective range labeled with a single shared basis. A range containing both capture dates and sharing dates is neither a capture range nor a sharing range. The label would need an explicit mixed basis and per-asset evidence to make it interpretable. That complexity is unnecessary for the requested fallback policy. Choose complete existing capture chronology first, otherwise a complete sharing chronology, otherwise unknown.

Retain B's strict calendar validation, raw-date rejection, source-local calendar order, stable tie order and immutable Memory inputs. Validate the capture sort date too. A leading ISO-looking string must not create an impossible day or contradict the supplied year. Year-only sample capture can sort by year without inventing a displayed date. Preserve all raw sharing provenance even when it cannot position Replay.

Keep the public module small, but make the data distinguish the ordering key from the visible evidence. A sharing range must not get compressed into one “Shared on” label. Home, Timeline, Portal and Viewer should all consume that same evidence label. Atlas can receive an explicit effective-year selector or chronology entries while the current capture-only buildAtlas remains available to its existing tests and consumers.

Verification must demonstrate two sharing-only memories in one year advancing independently on Home and Timeline, pause and restart, unknown exclusion, mixed grouped coverage, capture conflict, invalid dates and stable ties. Browser tests must assert the selected memory or active article, not merely an incremented year. For uncropped photos, test synthetic portrait and panoramic edge markers through Portal, Viewer and photo transitions on desktop and phone. Computed object-fit alone does not prove that an ancestor mask or scale is absent.

The existing backend evidence is sufficient for B's conservative grouped-sharing rule because provenance remains attached to each photo. It is insufficient for A's per-photo capture fallback without adding per-photo capture evidence. That is the decisive boundary advantage for B.
