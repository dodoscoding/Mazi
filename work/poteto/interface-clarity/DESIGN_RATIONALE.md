# Interface clarity design

## Problem

Home currently owns the Atlas controls, while tools live in different menus on phones and computers. The owner requested a quieter Home, three shared main destinations and visible access to existing capabilities. The underlying archive, source integrations and event notebook already work and keep their contracts.

## Usage

Home opens a full memory or its existing notes. Keşfet opens a directory with named, descriptive links. Grubumuz keeps group controls and exposes management and help. Ekle remains visible independently of the three main links. A friend follows Hikâyeler to the actual story section, rather than searching below a photo gallery.

## Shape

One typed navigation table defines primary entries and destination membership. The existing feature registry continues to own workspace mounting. The directory fetches no additional archive categories. Home uses the existing authorized memory projection and labels its bounded selection as archive memories, without implying recent contribution timestamps.

Atlas moves as one unit to `/atlas`, including selection, portal, scroll/focus and sound behavior. Existing root selection/portal URLs retain their meaning. Focused section queries belong to Memories and Discover, which own those controls. The shell does not coordinate feature DOM state. Browser history decides contextual Back; archive detail always highlights Keşfet.

## Synthesis decision

Two independent candidates produced designs. Candidate A used a dedicated directory. Candidate B put a persistent exploration rail around the existing workspaces. A separate reviewer scored A at 23/25 and B at 18/25 for clarity, discoverability, compatibility, maintenance and phone access. This used one model family, not cross-family validation.

Select A. Adopt B's visible phone Ekle, neutral Back wording and deterministic detail parent. Keep once-per-entry section focus and visible in-page links. Reject the permanent rail and phone More expansion because they add another layer of navigation and hide destinations again. No implementation bakeoff is needed after this sketch fixes the route and ownership boundaries.

## Tradeoffs

- Switching exploration tools can take a return through the directory. Named links and a small shared shell make that extra step explicit.
- New landing/navigation copy is Turkish. Existing workspace copy remains English; full localization is separate work.
- Archive memories and event notes provide the first group landing. Activity, comments, reactions and future events need their later domains.

## Verification

Expose the three-label contract before implementation. Then verify the running Home, directory, all named destinations, focused sections, legacy Atlas entry, memory return focus, background retention, denied access and Discord callback on desktop and phone. [Verification](VERIFICATION.md) records actual commands and limits.
