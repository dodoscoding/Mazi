Planning status on 2 October 2026. Assignee is dodo ([@dodoscoding](https://github.com/dodoscoding)).

Source is [docs/ROADMAP.md](https://github.com/dodoscoding/Mazi/blob/codex/product-roadmap/docs/ROADMAP.md) M1. Depends on M0 storage decisions and on membership authorization. Tests are T03, T04, T05 for private isolation, and T06 for capture time.

## Outcome

A member can upload images and video into private staging. The transfer survives interruption. Originals, source appearances, capture-time evidence, and exact duplicate identity are preserved inside the permitted scope. A second account cannot read the stored object. Import does not publish.

## Scope

- Private object storage.
- Resumable manual image and video upload.
- Per-item validation and visible progress.
- Originals, source appearances, capture-time evidence, and exact duplicate identity.
- Rejection of unsupported files with a reason the member can read.

Archive parsers, perceptual duplicates, and native Apple sync are later issues.

## UI steps

1. The contributor chooses files. The screen lists what will be sent, the formats, and the size before the transfer starts.
2. Progress stays visible and is announced for assistive technology. Leaving the page or losing the network does not silently drop a finished item.
3. The member can resume. Already stored items stay stored. The retry does not create a second appearance for the same bytes and stable identity.
4. A rejected file stays in the list with a plain reason. Supported siblings remain reviewable.
5. Nothing on this screen publishes to the group. The next step is private review.

States to design with dodo.

- Empty selection.
- Mixed batch with one duplicate, one rejected file, and several accepted files. The M1 demo uses a ten-photo memory with one duplicate and one rejected file.
- Interrupted upload, resumed upload, and a worker failure after some items succeeded.
- Uncertain or missing capture time. The raw evidence remains, and the uncertainty is visible.
- Reduced motion. Progress cannot depend on a decorative animation.

## Design discussion with dodo

Visitor mode is **Operate**. The member is waiting on a transfer and deciding whether the inventory is right. Show the queue, the item result, and the resume action. Do not hide failure inside a toast that disappears.

Impeccable path. Shape this surface after the design-kickoff issue. Progress announcements are part of the design, not a later accessibility patch.

### Starting brief

The contributor is adding personal files that friends must not see yet. Success is a private inventory where every file has a visible result and a finished file can be reviewed even when a neighbor failed.

### Open decisions for dodo

1. How a duplicate inside the same private upload is labeled before any merge review exists. M1 identity is exact. Perceptual suggestions are M3.
2. How much file metadata is on the row versus inside the item. Filename is not the same as a caption, and embedded GPS is not yet a sharing decision.
3. The sentence for an unsupported codec. It must name the limit from the M0 format decision rather than a generic failure.

## Exit

T03 and T04 pass for manual upload. T06 passes for the manual capture-time cases. A private original does not change any shared rendition. The ten-photo demo can include one duplicate and one rejected file.
