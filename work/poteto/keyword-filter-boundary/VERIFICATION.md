# Keyword filter boundary verification

Base is main `2b4b09d`. Existing 10,001-photo keyword pagination fails before the correction at `PhotoFilter`'s newly introduced whole-archive 10,000 cap. The full 700-test Python 3.14 run and Linux Python 3.11 CI both reported this as their only error; all other application contracts passed or were explicitly skipped.

Red `4050725` adds a declaration on the final photo and requires both filtered Search and Gallery matching to return that photo with an exact 10,001 visible denominator. The test fails in 0.23 seconds before fix `d167f7b`. The fix removes the unintended keyword archive cap and batches approved-person queries at at most 10,000 authorized IDs. Label hydration already batches. Keyword metadata byte/time/origin checks and the separate semantic 10,000-photo guard remain unchanged. The request clock starts before fact preparation. No schema, API shape, dependency or authorization change is introduced.

## Verification

- Python 3.11 keyword scaling, filter, metadata-budget and remaining-capacity modules: 28 passed in 179.22 seconds, including real 10,000-photo capacity profiles.
- Python 3.14 exact final pages, new filtered matches boundary and shared filter contracts: six passed in 1.86 seconds.
- Independent review at `d167f7b`: 19 Python 3.11 scaling/filter/budget checks, 14 date/semantic-boundary checks, and seven Python 3.14 checks pass. An extra fixture confirms approved-person queries split 10,000 + 1 IDs, exact full-visible counters, hidden boundary-photo removal and the unchanged semantic rejection at 10,001.
- Complete patch whitespace passes. Canonical contracts now distinguish keyword readable boundaries from semantic limits instead of claiming a shared photo cap.

The full backend suite is being rerun against the corrected implementation. Final UI integration, release review and deployment remain with the delivery coordinator. No production mutation occurred.
