# Photo evidence verification

## Red contract

At `75727e0`, four new `AtlasTests` contracts fail with missing `assetId` or `evidence` keys. The focused command selects the four `test_photo_evidence_*` and `test_unmapped_reviewed_place_*` methods. Synthetic fixtures cover reviewed İstanbul, Discord sharing-only dates, conflicting capture evidence, sibling place isolation, unchanged origin payloads, and unmapped review text.

## Delivery scope

A1 adds read-only per-photo evidence and renders its date/place facts. Search filtering and correction writes remain A2. Existing card fields and source fingerprints remain compatible.
