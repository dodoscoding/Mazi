# Search source and Shared by filters

Branch `feat/source-and-sender-filters`, cut from `origin/main` 548ba3f on 24 October 2026. All data below is synthetic. Nothing was deployed and production was not touched.

## What changed

- Atlas cards and photo provenance now report the import source (`whatsapp`, `discord`, `apple`, `manual`). They read `origin['source']`, but import payloads store it as `source_type`, so every card said `archive`.
- `GET /api/discovery/search` accepts `shared_by`, returns `sources` and `shared_by` on each photograph, and returns `facets` (sources and sharers with photo counts) over every photograph the viewer can currently see.
- The Search page shows Source chips and a Shared by choice under the search bar. Both apply at once to photographs, memories, chats and places. Photo cards say "Shared by Ana · WhatsApp".
- The query, place, country, object, date range, source and sharer live in the URL (`#/search?q=lake&by=Ana`), so Back from a result restores the search.

"Shared by" is the chat sender recorded by the source, otherwise the importing member's display name. That is the name the card's "Shared by" line already shows. It is separate from the tagged Person filter (D19).

## Measured

| Gate | Result | Evidence |
| --- | --- | --- |
| Atlas source repro, before the fix | 2 failures: `{'Blue': 'archive', 'Red': 'archive'}` and `'archive' != 'discord'` | [atlas-source-before.txt](evidence/atlas-source-before.txt) |
| Atlas source repro, after the fix | 21 tests OK | [atlas-source-after.txt](evidence/atlas-source-after.txt) |
| New DOM tests without the client change | 3 of 3 fail | [dom-filters-before.txt](evidence/dom-filters-before.txt) |
| `npm run build` | exit 0 (existing chunk-size warning only) | |
| `npm run lint` | exit 0, all files formatted | |
| `npm run test:dom` | 134 tests, 134 pass | [test-dom.txt](evidence/test-dom.txt) |
| `npm run test:backend` | 526 tests OK, 12 skipped (baseline before this branch: 520 OK, 12 skipped) | [test-backend.txt](evidence/test-backend.txt) |
| `npm run check:docs` | passes | |
| `git diff --check` | clean | |
| Playwright `features-redesign.spec.ts` "Search photographs stay usable…" (desktop, unified config) | 1 passed | [playwright-features-redesign.txt](evidence/playwright-features-redesign.txt) |

### Built app in headless Chromium

[seed_serve.py](evidence/seed_serve.py) seeds a local archive: a WhatsApp export imported by Alice with photographs sent by Ana and Deniz, and a Discord bot channel connected by Ben with photographs posted by Mehmet and Selin. It serves the built `dist/` on port 8350. [drive.mjs](evidence/drive.mjs) signs in as Alice and drives `#/search` at 1440×1000. Its full output is in [drive-desktop.txt](evidence/drive-desktop.txt) and the server's seed output is in [seed-output.txt](evidence/seed-output.txt).

| Step | Observed | Screenshot |
| --- | --- | --- |
| Open Search | Chips All, Discord, WhatsApp. Shared by: Anyone, Ana, Deniz, Mehmet, Selin. 4 photographs, each with a "Shared by … · source" line. | [01](evidence/desktop-01-filters-offered.png) |
| Search "lake", include memories | 20 results: 4 photographs, 4 memories, chats from both sources. URL `#/search?q=lake`. | [02](evidence/desktop-02-lake-all.png) |
| Click Discord | 8 results: 2 Discord photographs (Mehmet, Selin), 2 memories, chats from Mehmet and Selin only. URL `#/search?q=lake&source=discord`. | [03](evidence/desktop-03-source-discord.png) |
| All, then Shared by Ana | 6 results: 1 photograph and 1 memory, both Ana's. Chat snippets come from that memory's conversation, which also quotes Deniz. URL `#/search?q=lake&by=Ana`. | [04](evidence/desktop-04-shared-by-ana.png) |
| Open the memory | `#/memory/photo-…`, heading "Photo shared by Ana". | [05](evidence/desktop-05-opened-memory.png) |
| Browser Back | URL `#/search?q=lake&by=Ana`, query "lake", Shared by Ana, the same single photograph. The last search request carried `query=lake&shared_by=Ana`. No page errors. | [06](evidence/desktop-06-back-restored.png) |

## Privacy reasoning

- Facets are counted in the same loop as results, over documents that already passed membership, non-withdrawn origins, current-member owners and the viewer's personal hides. A backend test hides Ana's photograph for Ben: Ana leaves Ben's options and results and stays for Alice. Removing Ben from the circle removes Discord and Ben from Alice's options. An outsider is denied.
- A sharer is either a sender label already shown on the card and in the memory's "People in the evidence", or a member display name already shown as "Shared by" or "Added to archive by". No new field is exposed.
- Memories, chats and places are filtered in the browser from the authorized Atlas response, so they cannot include anything the viewer could not already open.
- The URL fragment holding the search is never sent to the server. It does stay in that browser's history, which D22 records.

## Not verified

- Production data (305 WhatsApp and 153 Discord photographs) and the hosted PostgreSQL path. The new SQL is a `LEFT JOIN shared_profiles` that the Atlas query already uses on PostgreSQL, but `npm run test:postgres` was not run.
- `tests/browser/discovery.spec.ts` was edited (the Source select it chose no longer exists) but not run, because its config starts every domain server. The full `npm test`, `npm run test:app` and `npm run test:domains` suites were not run.
- Phone viewport and Firefox were not driven.
- After Back, the optional memories, chats, places and people groups stay unloaded until "Include memories, chats, places and people" is pressed again; photographs, query and filters are restored. Person and search mode are not restored from the URL.
- A memory mixing chat and manual photographs is filtered by its chat senders only, while its individual photographs fall back to the importing member.
