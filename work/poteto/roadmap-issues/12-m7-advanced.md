Planning status on 2 October 2026. Assignee is dodo ([@dodoscoding](https://github.com/dodoscoding)).

Source is [docs/ROADMAP.md](https://github.com/dodoscoding/Mazi/blob/codex/product-roadmap/docs/ROADMAP.md) M7. Depends on the M4 and M6 program exits. Individual features use only their real dependencies. Estimates are redone per feature. This issue tracks the split. It is not permission to build every feature in one change.

Accountable role is the product lead.

## Outcome

Annual recaps, collaborative stories, time capsules, richer sub-events, slideshows, and generated video ship as separate increments. Each one has its own quality bar, cost limit, and export rule before implementation. Notifications are a separate opt-in increment.

## Scope, in the roadmap's order

1. Annual recaps and collaborative stories that use approved memories only.
2. Server-enforced time capsules. Run T15 before any capsule launch.
3. Richer sub-events and slideshows.
4. Generated video, with quality, processing cost, and export controls defined first.
5. Notifications as their own opt-in increment.

Do not start a capsule until author access and edit rules are specified. That choice is open in `docs/DECISIONS.md`.

## UI steps

Treat each increment as its own shape. Do not design one "advanced memories" screen that contains all of them.

Recap and story.

1. The member starts from approved memories only. Staged and revoked media are absent.
2. More than one member can contribute to a story. Contribution does not publish anyone else's private staging.
3. The result can be reviewed before anyone else sees it.

Capsule.

1. Before the unlock time, search, thumbnails, AI, export, notifications, and direct URLs reveal nothing about the locked bytes or metadata.
2. A removed member does not gain access by waiting for unlock.
3. The member's device clock does not unlock a capsule. Server time and current grants do.

Slideshow and generated video.

1. The member can tell a slideshow of existing media from a generated video.
2. Export and deletion follow the same authorization rules as the source memories.
3. Cost and processing state are visible before the member commits to generation.

Notifications.

1. Off until the member opts in.
2. A notification reveals no more than the destination it opens.

States to design with dodo, per increment.

- Empty year with too little approved media for a recap.
- A story draft, a published story, and a contributor who lost access.
- Capsule locked, unlocked, and opened by a direct URL while locked.
- Generation failed, limit reached, and provider off. The underlying memories remain.
- Reduced motion for slideshow playback.

## Design discussion with dodo

Visitor mode is **Operate** for creation and review. A recap can be more expressive than Timeline, and it still cannot become a feed or a ranking.

Impeccable path. Run `$impeccable shape` once per increment after the design-kickoff issue. Close this tracking issue only when each increment has its own issue or a recorded deferral. Do not let this body become the visual spec for all of them.

### Starting brief

The group wants a kept story or a scheduled reveal made from memories they already approved. Success for a capsule is that every locked path stays locked. Success for a recap is that it contains only approved, still-authorized media.

### Open decisions for dodo

1. Which increment is first after M4 and M6. The roadmap says annual recaps and collaborative stories.
2. Capsule author access and edits. Unspecified today. Implementation cannot start while that is open.
3. Whether generated video is in the first M7 release or a later one. Define the cost ceiling before saying yes.

## Exit

Each shipped increment has its own acceptance evidence. T15 passes before any capsule launch. No increment publishes staged media, ranks members, or notifies people who did not opt in.
