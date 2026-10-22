# Source metadata evidence

Unit 3 exposes preserved source sharing evidence without changing capture chronology or stored imports. It adds optional typed per-photo `provenance` arrays to Atlas. Each entry carries source sender, source kind, and raw or normalized share time with precision and ambiguity. Numeric raw timestamps become strings. Empty source evidence adds no field, so existing samples and legacy payloads keep their shape.

Untitled photos use a derived `Photo shared by …` heading and caption. Reviewed titles and approved memory titles win. Source dates never fill capture `date`, `year`, date basis, chronology, anniversary, or year filters. The existing authorized origin stream supplies the compact fields, deduplicates matching evidence, and excludes withdrawn origins and departed owners. No archive rewrite, reimport, date-order decision, storage format change, or schema migration is required.

The Home index and featured card, Portal, Timeline, legacy gallery helpers, and memory detail show explicitly labeled shared dates when capture dates are unknown. Source senders appear as `Shared by`. When source evidence exists, archive uploader names appear separately as `Added to archive by`. Details retain all distinct source share evidence. Ambiguous raw dates show `date order unclear`; malformed and otherwise unresolved timestamps use `date unresolved`. Known local dates retain their source calendar day without assigning a timezone. A synthetic screenshot was visually inspected.

## Red and green checks

Test commit `b651747` adds three source metadata contracts. They failed before implementation with one heading assertion and two missing-provenance errors. The tests cover an unknown capture date with a known share date, reviewed title/date precedence, multiple senders, duplicate evidence, numeric timestamps, withdrawal, and removed membership. Later assertions also cover an untitled photo with multiple senders, malformed timestamps, and approved memory title precedence.

The following focused checks passed:

```sh
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m unittest tests.backend.test_atlas tests.backend.test_atlas_projection
npm run test:unit
npm run typecheck
MAZI_TEST_PORT=5198 npx playwright test tests/memory-detail.spec.ts -g 'source sharing' --project=desktop --project=phone
git diff --check
```

Results: 24 backend tests, 16 unit tests, and two browser tests passed. The backend run includes existing fixed query budgets, policy checks, exact legacy payload comparisons, and large-context allocation checks. Browser tests follow Home card to Portal to detail to Timeline on desktop and phone. They assert source labels, uploader distinction, uncertainty text, and absence of inferred capture years. An initial browser invocation found port 5173 occupied; the successful invocation used the isolated port 5198.

## Synthetic screenshots and limits

[Desktop detail](evidence/source-sharing-desktop.png) and [phone detail](evidence/source-sharing-phone.png) use the repository's explicit sample photograph and invented source metadata. They contain no personal archive photographs or messages.

The parent owns full-suite checks, real authenticated browsing, and existing-archive verification. This worker made no production mutations or deployment changes. The 111 unresolved production source dates remain unresolved; this change only displays their preserved evidence honestly.
