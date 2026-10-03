Planning status on 2 October 2026. Assignee is dodo ([@dodoscoding](https://github.com/dodoscoding)).

Source is [docs/ROADMAP.md](https://github.com/dodoscoding/Mazi/blob/codex/product-roadmap/docs/ROADMAP.md) M1, journeys 3 through 6, and the Today, Timeline, and Search rows in [docs/SPEC.md](https://github.com/dodoscoding/Mazi/blob/codex/product-roadmap/docs/SPEC.md). Depends on M0, membership, and private upload. This is the internal pilot surface.

Tests for this issue are T02, T05, T06, T08, and T09. The pilot demo also needs T01, T03, and T04 from the sibling M1 issues.

## Outcome

Two members can privately stage a memory, choose an audience, publish a preview that matches what recipients will see, revisit it, and revoke or delete access. An outsider cannot. The pilot stays internal.

## Scope

- Private staging, audience selection, and independent controls for context, location, and identity display.
- Share preview, publication, revocation, and deletion.
- Manual memories and manual sub-events.
- Basic Today, a paged Timeline, media detail, and keyword search over titles and captions.
- Core audit events, migration checks, minimal export, error monitoring, and an internal recovery drill.

Map, People, On This Day, perceptual duplicates, and archive text search are later milestones. Keyword search does not promise object recognition.

## UI steps

Review and publish.

1. The contributor opens a staged memory. They see media, capture time with its uncertainty, exact duplicates, source context, and warnings.
2. The default is no shared context and no precise location.
3. They choose recipients. A private sub-event can sit under a memory the group can see. Parent access does not reveal the private child's title or existence.
4. The share preview shows the selected audience and only the metadata that will travel with the share.
5. They confirm publication. Until that confirmation, the group image does not change.
6. They can revoke sharing or delete the contribution. Future access stops. An independent copy from someone else remains. The removed contributor's context does not.

Revisit.

1. Another member opens Today, Timeline, or Search and finds the shared memory.
2. They see only authorized media and evidence. Source badges and participant counts exclude hidden contributions.
3. Unknown dates stay in an explicit undated view. Share time and capture time stay separate.
4. Search covers authorized titles and captions. It does not search hidden source text.
5. Media detail does not hand over the original file, embedded GPS, source text, or person associations merely because the photo is visible.

Pilot evidence the interface must support.

- Ten photos, one exact duplicate, one rejected file, one hidden location, and a later revocation.
- The same flows without a mouse, with a screen reader, on narrow and wide layouts, and with reduced motion (T08).

States to design with dodo.

- Empty Today for a new group, and a review queue that contains only the member's own staged work.
- Preview before publish, including a hidden location and hidden context.
- Published memory, revoked memory, and a derived memory whose last visible child disappeared.
- Undated media.
- Search with no hits. An empty result does not mean the event never happened.
- Loading, item failure, and permission denied. Denied must not leak counts.

## Design discussion with dodo

Visitor mode is **Operate**. Three tasks share one memory, and they must not share one crowded screen. Review is a decision. Timeline is retrieval. Detail is inspection.

Impeccable path. Finish the design-kickoff issue, then `$impeccable shape` Today, the review preview, Timeline, and media detail as related surfaces. Read the Operate reference before visual edits. Attach screenshots to the implementation PR.

### Starting brief

The reviewer needs to know who will see the photo and which facts travel with it. The group member needs to find that shared moment later. Success is a preview that matches the recipient's view, then a Timeline row that shows capture time and source history without hidden context.

### Open decisions for dodo

1. How the preview shows omitted GPS, omitted conversation, and omitted identity without telling the recipient that something was removed.
2. Whether audience choice is inline on the memory or a distinct confirm step. The specification requires a share preview before publication. A modal is not the default answer. Prefer a step the member can review.
3. What basic Today contains at M1. The specification says recent approved memories and the member's own review queue. On This Day waits for M3.
4. How an uncertain date looks in the timeline so it cannot be read as a fact.
5. Departure copy. D06 is proposed. Do not write interface copy that promises a policy M0 has not accepted.

## Exit

Two members and one outsider pass T02, T05, T06, T08, and T09, with T01, T03, and T04 green from the sibling issues. Demonstrate the ten-photo memory with one duplicate, one rejected file, a hidden location, and revoked access. Keep the pilot internal.
