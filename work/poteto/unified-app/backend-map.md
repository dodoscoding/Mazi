# Unified app backend map — candidate A

## Grounding and recommendation

Source inspected: every `phase1`–`phase7` HTTP handler, the cumulative store constructors, import engine/adapters, review timeline, discovery search/people, answer engine, and advanced memories. Applied the pinned Poteto wrapper, Codex adapter, `how`, and `architect` instructions. This is one independently scoped grounding/design candidate for the parent synthesis; no implementation changed.

Use the existing Python domain logic with the React Atlas UI on one origin. Rename packages by capability, preserve store inheritance initially, and replace the handler inheritance/static-screen chain with one HTTP entry point. This is a relocation and UI integration, not a schema rewrite. A `MemoryStore` already exposes all earlier capabilities:

`Store → ImportStore → ReviewStore → SourceStore → DiscoveryStore → AnswerStore → MemoryStore` plus `AdvancedMixin`.

Proposed ownership under `server/mazi/`:

| Module | Existing source | Responsibility |
| --- | --- | --- |
| `identity.py` | phase1/core.py | accounts, cookie sessions, groups, invitations, component grants, original pilot uploads/memories, audit |
| `imports.py`, `adapters.py` | phase2/engine.py, adapters.py | transfer/checksum, normalized provenance, scanning, durable leases/retries, deduplication, archive media |
| `review.py`, `operations.py` | phase3/review.py, ops.py | corrections, duplicates/renditions, accepted events, timeline, exports, backup helpers |
| `sources.py`, `discord.py` | phase4/sources.py, discord.py | source permission/generation fences, Apple resource transfer, Discord bot polling, places |
| `discovery.py`, `embeddings.py`, `clip_encoder.py`, `clip_manifest.py` | phase5 equivalents | people/identity, hiding/suppression, processing consent, keyword/semantic search |
| `answers.py` | phase6/answers.py | extractive answers, live evidence, consent and request limits |
| `memories.py`, `advanced.py` | phase7 equivalents | recaps, collaborative stories/revisions, capsules, subevents, frame/video export, notifications |
| `http.py`, `__main__.py`, `worker.py` | all server handlers + phase4 worker | one route dispatcher, React build serving, process lifecycle, worker connection |

Keep a single final `MemoryStore` façade. Do not introduce pass-through repositories/services or change transaction boundaries during relocation. Rewrite all internal `phaseN` imports, runtime assets, helper/test imports and model references before deleting prototypes. Preserve `phase4/macos` as a native companion under a named `tools/apple-photos/` directory; it is not a second browser app.

## Runtime and preservation

One Python process binds loopback and serves React `dist/` plus `/api/*`; a background worker owns a separate SQLite connection to the same root. During development Vite proxies `/api` to that process so browser cookies and Origin checks remain same-origin. Use one documented launch command and one port; preserve `MAZI_IMPORT_DATA_DIR`/`MAZI_IMPORT_PORT` as compatibility aliases if naming new settings.

Default current Phase 7 root is `.mazi-imports`, containing `mazi.sqlite3`, `originals/`, `previews/`, `uploads/`, `archives/`, `archive-objects/`, and `source-resources/`. Capsule photographs are SQLite BLOBs. Constructors apply cumulative `CREATE TABLE IF NOT EXISTS` schemas and departure triggers; imports enable WAL and a 5-second busy timeout. Keep table/column/key names unchanged, including stored file keys and IDs. Preserve complete data directories, SQLite WAL state, users/sessions/membership, audit, leases/checkpoints, provenance, grants, corrections, hidden/suppressed state, consent, stories and capsules. Never seed or overwrite the existing root on normal launch.

`.mazi-pilot` is the separate Phase 1 default. Do not silently merge it into `.mazi-imports`: overlapping schemas do not establish identity equivalence. Document an explicit selected root; any later merge needs a separate migration contract. Stop writers and use the existing backup approach before moving data. Tests must reopen the same root under the renamed final store and verify IDs, original/preview bytes, permissions and advanced records.

The worker currently constructs `SourceStore`, sufficient for import/resource processing and Discord. It does not automatically run discovery indexing, which is explicit via the index API. Discord requires `MAZI_DISCORD_BOT_TOKEN`, an allowlist in `MAZI_DISCORD_SOURCES`, permission verification and rate-limit handling. Learned search optionally uses `MAZI_EMBEDDING_MODEL_DIR`; fallback keyword/baseline behavior must survive. Do not download model weights as part of ordinary startup.

## HTTP conventions

All domain routes below are already inherited by Phase 7. Retain URLs to avoid needless contract changes. GET media and exports independently authorize every read. Mutations require JSON and validate Origin; responses include `no-store`, `nosniff` and CSP. Authentication uses `mazi_session` HttpOnly, SameSite=Strict, Path=/ cookie with 24-hour Max-Age; logout expires it. Existing denial is 403, bad input 400, conflicts 409, storage failure generally 503. Do not make the Atlas synthetic fixture state an authorization source.

In tables, `g` means query/body `group`, optional fields are marked `?`, identifiers are strings, offsets/revisions are numbers and enabled/confirmed flags are booleans. Unless stated, successful mutation returns `{ok:true}`. GET lists are arrays except pagination/state results explicitly described.

## Identity, memberships and original pilot media

| Method/path | Parameters/body | Result |
| --- | --- | --- |
| POST `/api/register`, `/api/login` | email,password | ok; register 201, login sets session |
| POST `/api/logout` | {} | ok, clears session |
| GET `/api/groups` | none | member groups |
| GET `/api/members` | g | members |
| POST `/api/group` | name | 201 `{id}` |
| POST `/api/invite` | g | 201 `{token}` |
| POST `/api/accept` | token | `{group}` |
| POST `/api/invite/revoke` | g,token | ok |
| POST `/api/member/remove` | g,user | ok; all cumulative departure behavior applies |
| GET `/api/upload/:id` | none | upload status |
| POST `/api/upload/start` | g,filename,size,sha256,caption?,capture_date? | 201 `{id}` |
| POST `/api/upload/chunk` | id,offset,data(base64) | `{received}` |
| POST `/api/upload/finish` | id | `{id}` |
| POST `/api/upload` | g,filename,data(base64),caption?,capture_date? | 201 `{id}` |
| GET `/api/owned-media`, `/api/owned-memories` | g | owned objects |
| GET `/api/media/:id`, `/api/memory/:id` | none | authorized view |
| GET `/api/media/:id/preview`, `/original` | none | JPEG / original bytes |
| POST `/api/media/publish` | id,components,audience,recipients?,version | ok |
| POST `/api/memory` | g,title,media_ids | 201 `{id}` |
| POST `/api/memory/publish` | id,audience,recipients?,version | ok |
| POST `/api/media/revoke`, `/delete`; `/api/memory/revoke`, `/delete` | id | ok |
| GET `/api/timeline` | g,q?,offset?,limit? | inherited timeline; prefer `/api/review/timeline` because the cumulative override signature differs from phase1's positional call |
| GET `/api/export` | g | original pilot JSON export |

Pilot media and archive assets are separate tables and permission models. Retain these APIs/data but use archive routes for the main Atlas photo workflow. A UI that promises all retained behavior needs a clear original-upload sharing management surface rather than pretending pilot objects are archive assets.

## Import/archive contract

| Method/path | Parameters/body | Result |
| --- | --- | --- |
| GET `/api/imports` | g | own runs: id,source,state,withdrawn,created_at |
| GET `/api/imports/:id` | offset? | id,source,state,received,size,checkpoint,scan_complete,withdrawn,error,discovered,counts,items,next_offset,coverage,unique_assets |
| POST `/api/imports/start` | g,source,namespace,size,sha256,options? | 201 `{id}`; sources manual/whatsapp/messenger/discord, ZIP <=128 MiB; options `{date_order?:DMY\|MDY}` |
| POST `/api/imports/chunk` | id,offset,data(base64) | `{received}`; resumable |
| POST `/api/imports/finish`, `/confirm`, `/cancel`, `/withdraw` | id | ok |
| POST `/api/imports/retry` | id,item | ok |
| GET `/api/archive` | g,offset? | assets: id,width,height,origins,origin_count,next_origin_offset |
| GET `/api/archive/:id/origins` | offset? | `{items,total,next_offset}` normalized source evidence |
| GET `/api/archive/:id/preview`, `/original` | none | JPEG / original bytes |

Import items include id,ordinal,outcome,reason,attempts,asset_id,filename,locator,warnings,shared_at. UI polls runs through transfer → scanning → confirmation → processing; distinguish retained/no-preview, failures, duplicate assets and provenance. Chunk bodies are limited to 768 KiB total JSON, so encode byte chunks smaller than that. Withdrawal removes an owner's origin, not necessarily a deduplicated asset with another active origin.

## Archive review

| Method/path | Parameters/body | Result |
| --- | --- | --- |
| GET `/api/review/timeline` | g,offset?,q? | `{items,total,next_offset}` items id,title,date,place,date_basis,origin_count,anniversary |
| GET `/api/review/duplicates`, `/reviewed-pairs` | g | suggested/reviewed pairs |
| GET `/api/review/events`, `/accepted-events`, `/reviewed-events` | g | suggested/accepted/reviewed events |
| GET `/api/review/on-this-day`, `/my-contributions`, `/metrics` | g | live anniversary/contribution/metrics projections |
| GET `/api/review/export` | g | ZIP archive |
| GET `/api/review/rendition/:id` | none | JPEG selected rendition |
| POST `/api/review/correct` | asset,title?,capture_date?,place?,anniversary? | ok |
| POST `/api/review/pair` | g,left,right,action | ok; merge/dismiss/undo |
| POST `/api/review/rendition` | g,asset,selected | ok |
| POST `/api/review/event` | g,assets,title?,decision | `{id}`; accept/reject/undo; 2–100 distinct assets |
| POST `/api/review/delete-contribution` | origin | ok |
| POST `/api/review/leave-group` | g | ok |
| GET `/health` | none | `{status:ok\|unavailable}` |

Keep corrections and source assertions distinct. Event approval is required before story creation. Timeline omits inaccessible assets and caps visible photos at 1,000. Render unknown/conflicting dates honestly.

## Places and continuous sources

| Method/path | Parameters/body | Result |
| --- | --- | --- |
| GET `/api/places` | g,country?,city?,paths=1? | `{points,countries,cities,paths}`; points reference origin/asset and shared coordinates/day |
| POST `/api/places` | origin,country?,city?,latitude?,longitude?,day? | ok |
| GET `/api/sources` | g | source rows with parsed scope |
| GET `/api/sources/resources` | connection | resource/outcome rows |
| GET `/api/sources/original` | id | authorized original bytes |
| POST `/api/sources/create` | g,kind,label,scope | 201 `{id}`; apple or discord |
| POST `/api/sources/state` | id,enabled,permission | ok |
| POST `/api/sources/begin` | connection,metadata,size,sha256 | resource row; HTTP transfer restricted to apple |
| POST `/api/sources/chunk` | id,offset,data(base64) | `{received}` |
| POST `/api/sources/finish`, `/withdraw` | id | ok |

Source scope includes start/end days. Apple scope includes albums and types (image/video); Discord includes guild and 1–20 channels. Permission state is unknown/authorized/limited/denied/revoked. Move `land.geojson`/attribution into appropriate assets/docs if still used. Atlas locations must derive from these shared-place projections; its built-in fixture points do not represent real group data. Preserve source generation fencing, bot allowlisting and permission checks.

## People, consent and search

| Method/path | Parameters/body | Result |
| --- | --- | --- |
| GET `/api/discovery/search` | g,query?,mode?,person?,place?,country?,object_query?,start?,end?,source?,similar?,offset?,limit? | `{items,total,next_offset,mode,model,unindexed,message}`; item id,title,date,place,score,basis,people |
| GET `/api/discovery/state` | g | `{people,memories,hidden_memories,hidden,suppressed,identities,settings}` |
| POST `/api/discovery/index` | g,limit? | `{indexed,discarded,remaining}` |
| POST `/api/discovery/person` | g,name | 201 `{id}` |
| POST `/api/discovery/tag` | person,asset,confirmed | ok |
| POST `/api/discovery/untag`, `/disassociate`, `/restore` | person,asset | ok |
| POST `/api/discovery/identity/propose` | person,account | ok |
| POST `/api/discovery/identity/confirm` | person | ok |
| POST `/api/discovery/nonmember-review` | person,asset,verified,restore? | ok; admin verified request |
| POST `/api/discovery/hide-memory` | g,event,enabled | ok |
| POST `/api/discovery/hide` | asset,enabled | ok |
| POST `/api/discovery/processing` | g,enabled,group_wide? | ok |

People include id,name,assets,count,is_me,verified,places,memories. Search people's nested rows also include can_remove. Recognition remains false: this is manual tagging/confirmed identity, not face recognition. Semantic mode requires consent and available encoder; keyword fallback is explicit. Similar-image search needs an indexed eligible reference. Processing settings represent group and own contribution consent separately.

## Memory answers and advanced memories

| Method/path | Parameters/body | Result |
| --- | --- | --- |
| GET `/api/answers/state` | g | group_enabled,contribution_enabled,usage |
| GET `/api/answers/evidence` | g,asset | id,title,date,dates,place,date_basis,url |
| POST `/api/answers/ask` | g,question | status supported/abstained,claims[{text,evidence_ids}],evidence,message,coverage,uncertainty,matching_records,shown,usage |
| POST `/api/answers/processing` | g,enabled,group_wide? | ok |
| GET `/api/memories/recap` | g,year | year,memories[{id,title,start,end,assets}],coverage,provider_cost_eur |
| GET `/api/memories/stories` | g | story list |
| GET `/api/memories/story`, `/export` | g,story | story object |
| POST `/api/memories/create` | g,event | story object |
| POST `/api/memories/write` | g,story,revision,text | updated story |
| POST `/api/memories/delete` | g,story,revision | ok |
| POST `/api/memories/subevents` | g,story,revision,sections[{title,assets}] | updated story |
| GET `/api/memories/frame` | g,story,asset | authorized normalized JPEG |
| POST `/api/memories/video` | g,story | MJPEG AVI bytes |
| GET `/api/memories/capsules` | g | [{id,unlock_at,locked,can_delete}] |
| GET `/api/memories/capsule` | g,capsule | id,title,text,unlock_at,has_photo,can_delete,locked=false |
| GET `/api/memories/capsule-export` | g,capsule | title,text,unlock_at,photo_jpeg_base64 |
| GET `/api/memories/capsule-photo` | g,capsule | JPEG |
| POST `/api/memories/seal` | g,title,text,unlock_at,photo?(base64) | id,unlock_at,locked=true,can_delete=true |
| POST `/api/memories/delete-capsule` | g,capsule | ok |
| GET `/api/memories/notifications` | g | `{enabled,items:[{id,message}]}` |
| POST `/api/memories/notifications` | g,enabled | ok |

Story object: id,event,revision,can_delete,contributions[{author,text,editable}],subevents[{title,assets}],notice. Contributions max 2,000 characters; empty string deletes own text. Sub-events max 20, with distinct photo subsets. Revisions must refresh on 409. Entire stories disappear if any original event asset becomes inaccessible; UI must clear stale content on denial/group switch/background and reload live data.

Capsules require timezone-aware future unlock within ten years, title <=200 and note <=4,000 characters; optional photo <=2 MiB normalized to 640×480. Locked content is unreadable even to author; only owner gets locked receipt/delete control. Unlocked content is current-group only. Caps: 100 stories/capsules per group. Notifications are in-app refresh projections, default off. Video is explicit silent AVI download, 1 fps/3 seconds each photo, <=20 photos/60 seconds/32 MiB; no MP4 or browser playback promise. Answers are local extractive claims, not a generative provider; preserve abstention, contributor consent, quotas, live delivery recheck and evidence attribution.

## Validation and risks

Baseline attempted: `python3 -m unittest discover -s phase7/tests` on system Python 3.14.7, 14 October 2026. Failed during collection (3 import errors) because `PIL` is absent; no behavioral result claimed. Existing required dependency is `Pillow==12.3.0`. Use the project's established virtual environment or install locked requirements in a task-local environment for actual acceptance. Run all phase suites after relocation, including optional learned-runtime tests under their supported fixture/model conditions; test imports currently manipulate sibling phase test paths and require rewrites.

Parent integration direction uses domain subpackages directly under `mazi/` (identity/imports/archive/sources/discovery/answers/memories), equivalent to the ownership map above. A final `MemoryStore` worker is reasonable provided its separate connection and existing source-processing fences remain intact. Parent reported 13 passing Phase 7 tests in its configured environment; that is separate evidence from this worker's failed system-Python collection.

Primary risks: legacy `/api/timeline` positional signature mismatch in inherited store; preserving two separate media models; unchanged authorization/withdrawal/consent through relocation; static CSP compatibility with Vite/Fiber assets; data-root ambiguity; accidental public binding; source/native companion endpoints hardcoded to old launch port; Python test helpers and model paths coupled to phase directory names. Keep HTTP API route tests, membership denial/races and storage restart contracts while replacing browser tests with one integrated Atlas flow. Production auth/deployment remains outside the local experiment contract.

Acceptance proof for candidate A: one launch command, one origin, no browser navigation to old standalone screens, all above actions reachable from Atlas; existing root opens without mutation of identifiers or source bytes; browser and Python regression tests pass; authorized previews/exports work while outsider, withdrawal, hiding, departed member and locked capsule cases deny; built frontend loads from final server and no imports reference retired phase packages.
