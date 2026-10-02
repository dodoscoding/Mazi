# Mazi import specification

All imports enter private staging through the normalized contract in [Contracts](CONTRACTS.md). Adapters translate source data. They do not publish content or implement a separate downstream processing pipeline.

No real user archive or device has been tested in this planning task. The matrix below distinguishes intended support from verified platform documentation. M0 fixtures determine the exact formats that M2 can promise.

## Source capability matrix

| Source | Intended path and milestone | Preserved when present | Limits and required evidence |
| --- | --- | --- | --- |
| Manual files | Browser upload, M1 | Original bytes/name, capture EXIF, GPS, dimensions, duration, uploader and import time. | No invented source conversation. Validate actual file contents and supported codecs. |
| WhatsApp | User-exported chat text with supplied media or ZIP, M2 | Chat title, source sender labels, message time, nearby context, media links, export boundaries. | Locale, platform, truncation, filename mapping, multiline text, and missing media require fixtures. Reactions are not promised without source evidence. |
| Messenger | User-provided Meta archive, JSON first, M2 | Threads, participants, text, attachment paths, source times, reactions when supplied. | Export routes and encrypted-history coverage need real samples. HTML can remain unsupported initially with a clear report. No scraping. |
| Discord user export | Official account data package, M2 | Requester's sent messages, source IDs, channel mapping, timestamps, attachment references. | Not the whole group's messages. Attachment links may not produce retrievable bytes. Missing media remains an explicit outcome. |
| Discord server | Authorized bot, M4 | Selected channels/date ranges, accessible messages, attachments, source authors, supplied reactions. | Requires channel access and appropriate intents. Permissions and source availability can change during a run. Continuous ingestion is separately enabled. |
| Apple Photos | Native PhotoKit companion, M4 | Authorized selected resources, available capture/location metadata, albums and change observations. | Permission scope, iCloud availability, background runtime, Live Photos, edits, and incremental identity require real-device validation. Do not promise Apple People labels. |

Discord documents requester-sent messages and CDN attachment links in its [data package guide](https://support.discord.com/hc/en-us/articles/360004957991-Your-Discord-Data-Package). Message content and attachments are affected by [privileged intents](https://support-dev.discord.com/hc/en-us/articles/6207308062871-What-are-Privileged-Intents); channel permissions remain a separate check in its [permission reference](https://github.com/discord/discord-api-docs/blob/main/developers/topics/permissions.mdx).

## Adapter behavior

Each adapter supports inventory, normalization, checkpoint/resume, and an outcome report. A file-based adapter may implement these with ordinary functions over a bounded iterator. A plugin framework is unnecessary.

The inventory lists item counts, expected bytes where known, available date range, media availability, export coverage, and warnings before a large transfer. An export's oldest record is not necessarily the conversation's beginning. The adapter records explicit bounds and unknowns.

Normalization preserves source identifiers and raw evidence. It resolves a media reference to bytes, a missing reference, or an unsupported record. Remote fetching uses an allowlist, size/time limits, redirect validation, and rejection of local/private network addresses. Archive URLs never become a general server fetch API.

Retries reuse stable source IDs or the same manifest's record identity. An adapter upgrades its parsing without silently duplicating old appearances. Across overlapping exports without stable IDs, ambiguous matches remain retained records awaiting review. An ordinal among repeated messages is not a safe cross-export identity. Identical text lines and repeated attachment filenames cannot be collapsed just because their contents match. Source IDs are scoped to the account and conversation that produced them.

## Archive validation

ZIP processing rejects traversal paths, absolute paths, symlinks that escape extraction, excessive entry counts, excessive expanded size, high expansion ratios, unsupported encryption, and nested archives beyond the configured limit. It streams within a bounded workspace and cleans up after failure.

File validation checks signatures, parser limits, dimensions, duration, codec support, and declared versus actual size. The worker uses restricted media tools with no unnecessary network access. Active source content is never rendered as trusted HTML. Captions and filenames are escaped in the UI.

The M0 format matrix must publish maximum archive size, expanded size, per-file size, video duration, and supported containers/codecs. Proposed initial compatibility is JPEG, PNG, HEIC, and tested MP4/MOV codec combinations. Unsupported originals may be staged for owner export but cannot appear as successfully playable published media.

## Context and identity

WhatsApp and other text-based exports can contain multiline messages, system notices, ambiguous date ordering, repeated participant names, and text that resembles an attachment marker. Parsers must preserve the source line/record location and report ambiguity.

The proposed context window is up to two messages before and after a media message in the same conversation, capped at 2,000 characters. It stays private and reviewable. This is a product default to test, not a claim about the source format. The contributor can omit or narrow context before sharing.

A source display name does not establish a platform account, Mazi membership, attendance, or face identity. Mapping source participants to known people requires a reviewable assertion. Reactions preserve their source meaning and available author/count detail without inventing missing actors.

## Apple companion scope

The native companion requests authorization and presents the authorized library for selection. It inventories metadata before large transfers where APIs permit. It offers album, date, media-type, screenshot, and favorite filters when available. People-based selection is excluded until an actual supported API is demonstrated.

The first supported native platform is a decision at M0. The proposed macOS-first approach supports bulk review and long foreground transfers. iOS behavior is designed and tested separately. The product does not promise unrestricted background synchronization.

Incremental sync records device/library/source asset identity and resource version. Library changes, edited assets, limited-library changes, permission withdrawal, and iCloud download failure each produce explicit outcomes. Deleting an item from Apple Photos does not automatically delete Mazi's retained copy; mirror deletion needs a separate user-selected policy.

Apple's [PhotoKit entry point](https://developer.apple.com/documentation/photokit) and [limited-access guidance](https://developer.apple.com/documentation/photokit/delivering-an-enhanced-privacy-experience-in-your-photos-app) are the implementation references. Full API behavior remains an M0 experiment because the documentation renderer exposed only partial content during this planning run.

## Required fixtures and acceptance

| Fixture set | Cases | Evidence required before support claims |
| --- | --- | --- |
| Manual | Exact duplicate, corrupt image, rotated image, HEIC, supported/unsupported video, missing EXIF. | Expected byte hashes, metadata, sanitized preview, playable or explicit unsupported outcome. |
| WhatsApp | At least one iOS and one Android export, two date locales, multiline Unicode, omitted media, repeated names/files, partial overlap containing only the second of two identical same-time messages. | Hand-reviewed expected messages, context, links, ambiguity warnings, and exact-manifest replay counts. No uncertain cross-export collapse. |
| Messenger | Representative JSON archive, missing attachment, reactions, participants, non-ASCII text, encrypted-history sample if promised. | Coverage inventory and exact expected normalized items for each supported format. |
| Discord export | Sent-message package, channel mapping, missing/dead attachment reference, replay, repeated content. | Report limited to supplied records, no invented full-conversation context. |
| Discord server | Two selected channels, one unselected channel, removed permission, rate limit, interrupted backfill. | No unselected-channel reads; bounded retry; no new data after permission loss. |
| Apple | Selected subset, remote iCloud asset, Live Photo, edited resource, permission reduction, interrupted upload. | On-device evidence, stable incremental identity, no outside-selection upload. |

Keep synthetic regression fixtures in the implementation repository. Store consented real archives in restricted storage with a retention date. Public CI must not download personal fixtures or contact live accounts. Each adapter documents its tested export versions, limitations, and latest fixture verification date.
