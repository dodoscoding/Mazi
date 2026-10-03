Planning status on 2 October 2026. Assignee is dodo ([@dodoscoding](https://github.com/dodoscoding)).

Source is [docs/ROADMAP.md](https://github.com/dodoscoding/Mazi/blob/codex/product-roadmap/docs/ROADMAP.md) M3 product work. Depends on the M2 beta. Tests are T05 for similarity, T06 for timestamp review, T10, and the scaled part of T08.

Visual and event models stay optional. Launch can use reviewed deterministic time and place suggestions without cloud AI.

## Outcome

Members can review near-duplicate and event suggestions, correct dates and places, browse a large timeline, and open an approved On This Day entry. Nothing in this issue publishes itself.

## Scope

- Perceptual duplicate suggestions, explicit merge review, split and undo, and authorized rendition selection.
- Explainable event suggestions from time, permitted location, and available grouping metadata.
- Improved timestamp review, place normalization, approved On This Day, and virtualized timeline views.

People, semantic search, Map, and Memory AI are separate issues.

## UI steps

Duplicates.

1. The member sees a suggestion that two items may be the same picture. The reason is visible.
2. They compare authorized renditions and choose what eligible viewers should see.
3. They can merge, reject, split, or undo. Rejection sticks. Undo restores variants, grants, and memory links.
4. A private original still does not change the group's image until it is published.

Events and dates.

1. An event suggestion explains the time, permitted place, and grouping metadata that produced it. Private evidence is not a reason shown to someone who cannot see it.
2. The member can accept, reject, or split a candidate that mixes neighboring trips.
3. Timestamp review shows the raw assertion and the selected capture estimate. Unknown dates stay undated. Share time stays separate.
4. On This Day shows only approved memories with a sufficiently precise date. Staged items and uncertain anniversaries stay out.

Timeline.

1. Year, month, day, memory, sub-event, and media still work as the archive grows.
2. The virtualized timeline remains usable with a keyboard and a screen reader.

States to design with dodo.

- Suggestion with a clear reason, a wrong merge, and the undo result.
- Conflicting dates and a missing timezone.
- On This Day with nothing eligible. The empty state teaches the rule. It does not invent an anniversary.
- A long timeline on a phone and on a wide window.

## Design discussion with dodo

Visitor mode is **Operate**. Suggestions are review tasks. The member is judging evidence, not watching the product organize itself.

Impeccable path. Shape merge review, event review, and On This Day after the design-kickoff issue. Each needs a reason the member can inspect. Decorative grouping is out of scope.

### Starting brief

The reviewer is looking at a near-duplicate or a proposed event and deciding whether the group should see one memory or several. Success is an explicit decision with undo, and an On This Day entry that only appears when the date is approved and precise enough.

### Open decisions for dodo

1. How the merge review shows two audiences at once when the copies were shared with different people (T05).
2. How much of the suggestion reason is a sentence versus the underlying time and place fields.
3. Where On This Day lives inside Today, and how it stays distinct from the M1 review queue.

## Exit

T05 similarity, T06 archive date cases, and T10 pass. Rejection is durable. Shared suggestions use shared evidence only. No automatic publication.
