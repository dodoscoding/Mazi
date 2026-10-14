# Phase 7: advanced memories

Historical experiment record. The active application now runs with `python -m mazi`; source and test links below point to their consolidated locations. Original acceptance claims and evidence remain historical.

These local M7 increments extend the Phase 6 app. It is not M7 production acceptance. Recaps and stories use reviewed, accepted archive events; they do not require AI consent or an external provider.

## Run

Install the existing Python dependencies from `mazi/requirements.txt`, then run from the repository root:

```sh
python3 -m mazi
```

Open `http://127.0.0.1:8005/memories`; sign in through Imports. The default data directory remains `.mazi-imports`; `MAZI_IMPORT_DATA_DIR` and `MAZI_IMPORT_PORT` override it. Existing Phase 2–6 routes are retained. Approve a memory in Archive review before creating a story.

## Implemented contract

- Annual recaps include accepted memories only when every original photo is currently visible and every recorded date belongs to the chosen year. Missing/conflicting dates and memories spanning years are omitted with an explicit coverage explanation. Dates and titles are read live, never copied into a cached recap.
- Current group members can start stories and contribute one editable recollection each (2,000 characters). Empty text removes their own contribution. Members cannot edit another member's contribution. The creator can delete the story. A group supports at most 100 stories; inherited timeline limits remain 1,000 visible photographs.
- Stories use the approved memory's live title. Recollections are explicitly labeled as member statements, not verified archive facts. Imported text and contributions are rendered as text and never become instructions or executable markup.
- Writes use database transactions and optimistic revision checks. Conflicts require refresh. Removing a member deletes their contributions, increments affected revisions, and deletes their created stories and attached contributions.
- Every list, direct read, write, and explicit JSON export rechecks membership, memory approval, personal hiding, and all original asset visibility. Losing any original photo suppresses the entire story, including prose that could describe it. Re-approval or restoring visibility can make a retained story visible again.
- JSON export includes only the currently authorized story and live asset references; no photo bytes. Exports are user-initiated and not persisted server-side. Downloaded copies cannot be revoked. Responses use inherited `no-store` headers. Backgrounding clears rendered data and returning reloads it.
- There is no external generation, provider cost, email/push delivery, or automatic narration. Infrastructure cost is not measured. Live reads are serialized with local writes; this loopback experiment does not establish distributed production authorization guarantees.

## Capsules, sub-events, slideshows, video and notifications

- Capsules accept a new note and optional JPEG/PNG up to 2 MiB / 24 megapixels. The optional photograph is normalized to a 640×480 JPEG without source metadata; this is a keepsake rendition, not preservation of the original upload. They live in separate database tables, never in import/search/AI indexes. Choose an opening time within ten years. The local group limit is 100 capsules.
- Sealing is immutable: nobody, including the author, reads content before server UTC unlock. Only the author sees an ID/time receipt while locked and may delete the capsule. The author’s departure deletes it. Current group members can open/export after unlock; no browser clock or request parameter overrides server time. Photo reads and JSON exports independently authorize access. Unlocked capsules remain separate from normal search and AI.
- Stories support up to 20 ordered sub-events, each with a title and distinct photo subset from the parent memory. Group members can add or clear sections using revision checks. Slideshow/video order follows the sections and then remaining photos. A subsection never grants additional access. Departure removes sections last authored by that member.
- Slideshow is manually advanced; every frame is authorized and normalized on request. No automatic motion or music is enabled. Private images are cleared on backgrounding or group changes.
- Explicit video export creates a silent 640×480 MJPEG AVI montage (1 fps, 3 seconds/photo, maximum 20 photos / 60 seconds / 32 MiB). It uses only current story photographs, without generative AI or external providers. Reads are checked before each frame and again before delivery. No generated file is saved server-side. AVI is intended for download to a compatible player; in-browser video playback and MP4 are not implemented. Infrastructure cost and export latency are not measured.
- Notifications default off and require each member to opt in for each group. They appear only in the open app, listing currently unlocked capsules. They are recomputed on refresh, with no background push/email delivery or persistent notification cache.
- Capsule/story exports and videos are explicit downloads. Downloaded copies cannot be recalled. The server uses the existing no-store response policy. UI background clearing is not a remote deletion mechanism.

The [continuation decision](../../DECISIONS.md#phase-7-continuation-contract-14-october-2026) records the local author/edit and generated-format contract. Production T15, deployment, representative usability, and physical-device acceptance remain open. Local features do not establish a production release.

## Verify

```sh
python3 -m unittest discover -s tests/backend/memories -t . -v
MAZI_PYTHON=python3 MAZI_CHROME_CHANNEL=chrome npx playwright test --config tests/browser/playwright.config.ts --project memories-desktop --project memories-phone
```

See [verification](VERIFICATION.md) for the actual local environment and evidence.
