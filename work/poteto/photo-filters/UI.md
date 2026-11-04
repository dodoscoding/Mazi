# F2 filter presentation handoff

## Scope and revision

The reviewed authoritative API was merged separately as PR131/main `27b51d2`; this branch includes it through merge `43dbe7a`. UI commits start with `2177da8`/`3c6c706`, followed by URL/copy/recovery fixes. Current main's later H1 API/ordering/Atlas-copy work is not duplicated here. Parent owns the accepted H1 lazy-route merge and independent UI review.

Shared controls use current server facts for OR within a dimension and AND across dimensions. Gallery renders only matched child IDs while preserving original photo indices. Search preserves mode, pagination filters and complete bookmarks. Both show an explicit full-visible counter denominator and a separate filtered total. Photo-only predicates exclude unsupported context types. Reset, empty, hidden-refresh and retry states retain honest scope; filenames never classify content. Existing F1 atomic-edit/lazy-selection cancellation behavior remains intact.

## Red and green

- `2177da8`: a selected Gallery child must retain its original `photo=1` link rather than rendering both siblings. Shared filter selection/URL controls satisfy it.
- Real desktop/phone execution caught restored view-button ARIA state after reload; `1fe2109` synchronizes controls with restored view/order.
- `f6b668d`: while a changed Gallery query is pending, the old two thumbnails incorrectly remain. `da8a657` clears them and the filtered total, retains the filter and adds an explicit retry. Unknown counters show a dash when no successful denominator is available.
- Existing source/sharer/context tests now require explicit unsupported-category exclusion rather than memory-level sibling matching. Capacity, recovery and startup assertions remain behavioral and use the requested Turkish copy.

## Verification

- Root independently reviewed the API and ran 65 backend tests; see the separate [backend boundary](BACKEND.md). No backend behavior was changed in this UI slice.
- Focused DOM suites cover photo filters, Gallery limits/stale lazy imports, label-editor receipts/conflicts, Search date/source/startup/capacity, mobile view/order and A1 gallery/Viewer evidence.
- `MAZI_TEST_PORT=5300 MAZI_UNIFIED_PORT=8160 npx playwright test --config playwright.unified.config.ts -g 'same-photo filters survive|photo label editing|date bases find'`: **6 passed** (desktop and 320 px phone for F2; adjacent A1/A2/F1 journeys preserve their existing viewports). Real synthetic API fixtures verify zero sibling matches, one correct match after chip removal, original `photo=2` links, reload/view restoration and hiding the target on refresh. A2 legacy-date and explicit sharing/chronology behavior stays green.
- Build/typecheck/lint/docs and full branch whitespace are checked for handoff. No dependencies, schema migration, push or deployment.

## Budget dependency

Current pre-H1 build: Globe **242.9/256 KiB**, entry **152.5/150 KiB (fails)**, CSS **37.0/40 KiB**, total scripts **408.5/420 KiB** gzip. The entry failure is explicitly a dependency on H1's separately owned lazy FeaturePage/detail/Home seam (`66de8d9` in that workstream). This branch does not duplicate the App split or raise a ceiling. Parent will recheck the final combined immutable head after that dependency is accepted and merged.

## Evidence and limits

[Desktop Search](desktop-search-filtered.png), [phone Search](phone-search-filtered.png), [desktop Gallery](desktop-gallery-filtered.png), [phone Gallery](phone-gallery-filtered.png). The phone result was visually inspected; the synthetic matched child is retained and no sibling appears. The final combined run can refresh these shots after the lazy-route integration.

Physical-phone and five-friend checks remain external gates. Hosted filter read behavior reuses existing schema/transactions; no hosted suite was rerun for the UI. Independent functional review may begin now; entry-budget acceptance must wait for the stated dependency.
