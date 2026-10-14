# Mazi import specification

All imports use the normalized contract in [Contracts](CONTRACTS.md). The shared ingestion pipeline makes each successfully ingested item visible to all active group members automatically under [D14](DECISIONS.md). Adapters translate source data; they do not implement a separate access policy or processing pipeline. Review and corrections follow sharing.

M0 accepts a narrowed manual JPEG/PNG pilot. The matrix distinguishes intended future support from verified input support. No representative real chat archive has been tested. M2 must collect consented fixtures before promising an export format.

The [Phase 2 local engine](history/imports/README.md), added 6 October 2026, implements the normalized adapters, ZIP safety limits, queue/recovery, group-visible ingestion and outcome UI against synthetic fixtures. Its [fixture format matrix](history/imports/README.md#fixture-scope-and-format-matrix) lists exact accepted shapes and local limits. This does not expand production support or complete the real-export fixture gate. Video and unverified codecs remain explicit unsupported outcomes.

## Manual pilot limits

[M0 acceptance](M0_ACCEPTANCE.md) fixes the M1 pilot at 10 members, 10,000 logical items, 20 GiB of originals/previews per group, and 5 GiB per contributor within the group cap. Input selection supports JPEG/PNG only. Existing synthetic WebP display assets do not prove input validation. Synthetic manual fixtures belong in `tests/m0/fixtures`; personal archives remain outside Git.

WhatsApp, Messenger, and Discord exports remain M2 goals. Their rows below are conditional support, not accepted M0 promises. Collect consented, redacted representative exports in restricted storage before selecting parser scope. Document missing fields and reduce the support claim when fixtures cannot establish it.

## Source capability matrix

| Source | Intended path and milestone | Preserved when present | Limits and required evidence |
| --- | --- | --- | --- |
| Manual files | Browser upload, M1 | Original bytes/name, capture EXIF, GPS, dimensions, uploader and import time. | JPEG/PNG only within M0 limits. No invented source conversation. Validate signatures and decoded pixel limits; reject other formats explicitly. |
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

The accepted M0 matrix allows manual JPEG/PNG only: 100 files/run, 25 MiB/file, and a 24-million-pixel decoded-image target. Archive size, expanded archive bytes, and video duration are 0 supported. HEIC, video, archive ZIP, and other inputs return UNSUPPORTED. M2 sets archive and codec limits only after representative fixtures and pipeline acceptance. Unsupported files have an explicit outcome and cannot appear as successfully playable media. Temporary byte retention is an operational recovery detail, not contributor-private archive staging.

## Context and identity

WhatsApp and other text-based exports can contain multiline messages, system notices, ambiguous date ordering, repeated participant names, and text that resembles an attachment marker. Parsers must preserve the source line/record location and report ambiguity.

The proposed context window is up to two messages before and after a media message in the same conversation, capped at 2,000 characters. Successfully ingested context is automatically visible to the group. Explain that before submission. The exact extraction window remains a product default to test, not a claim about the source format. Later corrections and contribution removal follow the group lifecycle policy; there is no context-specific audience selector.

A source display name does not establish a platform account, Mazi membership, attendance, or face identity. Mapping source participants to known people requires a reviewable assertion. Reactions preserve their source meaning and available author/count detail without inventing missing actors.

## Apple companion scope

This is a deferred future proposal. The confirmed current product is website-only under D13; native work requires a new scope decision.

The native companion requests authorization and presents the authorized library for selection. It inventories metadata before large transfers where APIs permit. It offers album, date, media-type, screenshot, and favorite filters when available. People-based selection is excluded until an actual supported API is demonstrated.

The first supported native platform is a decision if native work is later approved. The proposed macOS-first approach supports bulk review and long foreground transfers. iOS behavior is designed and tested separately. The product does not promise unrestricted background synchronization.

Incremental sync records device/library/source asset identity and resource version. Library changes, edited assets, limited-library changes, permission withdrawal, and iCloud download failure each produce explicit outcomes. Deleting an item from Apple Photos does not automatically delete Mazi's retained copy; mirror deletion needs a separate user-selected policy.

Apple's [PhotoKit entry point](https://developer.apple.com/documentation/photokit) and [limited-access guidance](https://developer.apple.com/documentation/photokit/delivering-an-enhanced-privacy-experience-in-your-photos-app) are the implementation references. Full API behavior remains a deferred native experiment because the documentation renderer exposed only partial content during this planning run.

## Required fixtures and acceptance

| Fixture set | Cases | Evidence required before support claims |
| --- | --- | --- |
| Manual | M1 JPEG/PNG, exact duplicate, corrupt image, rotated image, missing EXIF; explicit unsupported HEIC/video/archive inputs. Later playable-format tests are conditional. | Expected byte hashes, metadata, sanitized preview, playable or explicit unsupported outcome. |
| WhatsApp | At least one iOS and one Android export, two date locales, multiline Unicode, omitted media, repeated names/files, partial overlap containing only the second of two identical same-time messages. | Hand-reviewed expected messages, context, links, ambiguity warnings, and exact-manifest replay counts. No uncertain cross-export collapse. |
| Messenger | Representative JSON archive, missing attachment, reactions, participants, non-ASCII text, encrypted-history sample if promised. | Coverage inventory and exact expected normalized items for each supported format. |
| Discord export | Sent-message package, channel mapping, missing/dead attachment reference, replay, repeated content. | Report limited to supplied records, no invented full-conversation context. |
| Discord server | Two selected channels, one unselected channel, removed permission, rate limit, interrupted backfill. | No unselected-channel reads; bounded retry; no new data after permission loss. |
| Apple | Selected subset, remote iCloud asset, Live Photo, edited resource, permission reduction, interrupted upload. | On-device evidence, stable incremental identity, no outside-selection upload. |

Keep synthetic regression fixtures in the implementation repository. Store consented real archives in restricted storage with a retention date. Public CI must not download personal fixtures or contact live accounts. Each adapter documents its tested export versions, limitations, and latest fixture verification date.
