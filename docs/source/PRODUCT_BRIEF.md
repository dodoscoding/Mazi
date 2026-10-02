# Private Memories Platform

## 1. Product Vision

Build a private, invite-only platform that reconstructs and preserves the shared history of a friend group.

The system must go significantly beyond a traditional photo gallery.

Its purpose is to combine photos, videos, locations, people, events, messages, reactions and source metadata from multiple platforms into a structured, searchable and AI-assisted memory archive.

The main product concept is:

> A private AI-powered archive of a group's shared life.

Users should be able to import years of historical data from sources such as:

- Apple Photos
- Discord
- WhatsApp
- Facebook Messenger
- manual file uploads
- future supported services

The platform should normalize these sources into one unified memory system.

---

# 2. Main User Experience

A user creates or joins a private friend group.

Example:

Cyprus Crew

Members:

- Altan
- Can
- Mehmet
- Ahmet
- Ali

Every member can independently import personal historical content.

The system analyzes imported content and identifies likely shared memories.

Example:

Input:

- 160 Apple Photos
- 46 Discord attachments
- 72 WhatsApp photos
- 14 Messenger photos

Output:

Copenhagen Weekend — September 2024

- 224 unique photos
- 18 videos
- 5 group members
- 9 locations
- 3 source platforms
- related messages and reactions

The system should merge duplicated media while preserving information about every source where the media appeared.

---

# 3. Core Navigation

The main application should initially contain six primary areas:

## Today

Personalized home screen.

Possible content:

- On This Day
- recently created memories
- new uploads from friends
- memories requiring review
- suggested event clusters
- newly discovered old memories

## Timeline

Chronological exploration.

Hierarchy:

Year  
→ Month  
→ Day  
→ Memory  
→ Sub-event  
→ Individual media

Users must be able to smoothly move between high-level years and individual media.

## Map

Interactive map of shared history.

Users should be able to:

- see memory locations
- select cities
- select countries
- view all memories from an area
- view travel history
- optionally visualize travel paths

## Search

Traditional and semantic search.

Examples:

- Copenhagen 2025
- beach
- photos with Altan and Can
- university
- birthdays

## People

Browse memories involving particular people.

Example:

Can

- memories together
- photos together
- places visited together
- first shared memory
- trips together

This must not become a social ranking system.

## Memory AI

Natural-language interface for querying the group's history.

Examples:

- When did we first visit Copenhagen together?
- Show all Cyprus summer trips.
- Find the restaurant where Can was wearing a white shirt.
- Show all memories where all five members were together.
- Create a summary of our university years.

---

# 4. Core Data Concept

The application must distinguish between:

1. physical media
2. historical source appearances
3. memories/events

These must not be represented as the same object.

Recommended conceptual model:

MediaAsset

Represents one unique photo or video.

Possible fields:

- id
- media_type
- master_object_path
- original_filename
- sha256
- perceptual_hash
- width
- height
- duration
- captured_at
- latitude
- longitude
- camera_metadata
- created_at

MediaOrigin

Represents a source where the media was discovered.

Fields may include:

- id
- media_asset_id
- source_type
- external_id
- imported_by_user
- source_timestamp
- sender
- conversation
- channel
- original_filename
- source_metadata
- contextual_text
- reactions
- original_download_reference

Source types:

- APPLE_PHOTOS
- DISCORD
- WHATSAPP
- MESSENGER
- MANUAL_UPLOAD

Memory

Represents a meaningful event.

Possible fields:

- id
- group_id
- title
- description
- start_time
- end_time
- primary_location
- memory_type
- confidence_score
- created_by
- creation_method

Creation method examples:

- MANUAL
- AI_SUGGESTED
- IMPORTED
- AUTO_CLUSTERED

MemoryMedia

Relationship between a Memory and MediaAsset.

Person

Represents an identified person.

PersonMedia

Links detected people to media.

Location

Normalized location information.

MemoryMember

Users who participated in a memory.

---

# 5. Import Architecture

Import must be treated as a major subsystem.

Do not implement platform imports directly inside controllers or UI components.

Create a generic adapter architecture.

Conceptually:

Import Service

→ ApplePhotosAdapter  
→ DiscordAdapter  
→ WhatsAppArchiveAdapter  
→ MessengerArchiveAdapter  
→ GenericFileAdapter

Each adapter should transform source-specific data into a normalized intermediate model.

Example:

NormalizedImportItem

- external_source
- source_item_id
- media_file
- sender
- timestamp
- textual_context
- location
- original_metadata
- conversation
- reactions

The downstream pipeline must not need to know which platform produced the item.

---

# 6. Apple Photos

Apple Photos should preferably use a native companion application on iOS/macOS rather than attempting full access through the browser.

Suggested implementation:

Web Application  
↕ authenticated communication  
Native Swift/SwiftUI Companion  
↕  
PhotoKit  
↕  
Apple Photos / iCloud Photos

The companion should:

- request user permission
- enumerate available assets
- read metadata
- retrieve selected photos/videos
- identify albums
- detect newly added items during later synchronization
- upload only authorized content

Whenever possible, scan metadata before transferring large files.

The system should allow filtering:

- date ranges
- albums
- photos/videos
- screenshots
- favorites
- specific people or locations if available
- minimum/maximum dates

Do not blindly upload a user's entire photo library.

---

# 7. Discord

Discord should support two import paths.

## Server Integration

For Discord servers where the group can install a bot/integration:

- select server
- select channels
- choose historical date range
- import media attachments
- preserve sender information
- preserve timestamps
- preserve message context
- preserve reactions
- optionally continue importing future content

The user must explicitly select which channels are monitored.

Do not automatically archive an entire server.

## Historical User Archive

Support imports from Discord user-exported data.

The importer should parse the archive and extract:

- conversations
- messages
- attachments
- sender information
- timestamps
- available context

Private DMs must not be crawled through unofficial means.

---

# 8. WhatsApp

WhatsApp historical content should initially use archive/chat export imports.

The importer must support:

- exported chat text
- attached media
- ZIP archives
- timestamps
- participant names
- message context near media
- group chat names

Example:

18/07/2024 21:14 - Can:
We're finally here 😂

18/07/2024 21:15 - Altan:
Send the photo.

18/07/2024 21:15 - Can:
<media>

The imported media should retain this nearby conversation context.

Do not simply import the image file.

Store both:

MediaAsset

and:

MediaOrigin.contextual_text

---

# 9. Messenger

Messenger should use user-exported Meta archive data.

Importer should extract where available:

- conversations
- participants
- messages
- images
- videos
- reactions
- timestamps

Map the result into the same normalized import format.

Do not depend on browser scraping.

---

# 10. Deduplication

Deduplication is a critical requirement.

The same media may exist on:

- Apple Photos
- WhatsApp
- Discord
- Messenger

The system must avoid displaying four copies as separate memories.

Use a multi-stage process.

## Stage 1 — Exact Matching

Calculate SHA-256.

If hashes match:

exact duplicate.

## Stage 2 — Perceptual Matching

Messaging platforms frequently recompress images.

Example:

Apple original:

4032 × 3024  
6.8 MB

WhatsApp copy:

1600 × 1200  
350 KB

The hashes differ but the visual image is nearly identical.

Use perceptual hashing and/or image embeddings.

Possible techniques:

- pHash
- dHash
- CLIP/image embeddings
- dimensions
- timestamps
- EXIF similarity

Create duplicate clusters.

Choose the highest-quality version as the master asset.

Do not delete source provenance.

Example:

MediaAsset #123

Master:

Apple Photos original

Origins:

- Apple Photos
- WhatsApp
- Discord

WhatsApp context:

"Send this to Altan 😂"

Discord reactions:

😂 × 6  
❤️ × 2

---

# 11. Timestamp Reconciliation

Source timestamps and capture timestamps must be separated.

Example:

Photo captured:

18 July 2022

Shared on WhatsApp:

12 March 2024

Uploaded to Discord:

3 January 2025

The primary timeline should normally use:

captured_at = 18 July 2022

But all later historical appearances must remain accessible.

Timestamp hierarchy may include:

1. EXIF capture time
2. Apple Photos metadata
3. source metadata
4. filesystem timestamp
5. message timestamp

The system should assign timestamp confidence.

Do not silently overwrite conflicting dates.

---

# 12. Memory Detection

The system should automatically detect possible events.

Potential signals:

- temporal distance
- geographical distance
- visual similarity
- common detected people
- source conversation
- upload grouping
- album membership
- captions
- semantic embeddings

Example:

Photos from:

10:04  
10:08  
10:12  
10:20

Location:

Nyhavn

People:

Altan, Can, Mehmet

Then:

13:30  
13:42  
13:52

Different location.

The system might infer:

Copenhagen Trip

Sub-event:

Morning — Nyhavn

Sub-event:

Lunch

The system should suggest memories rather than aggressively creating permanent events without user review.

---

# 13. AI Processing Pipeline

Recommended asynchronous pipeline:

Upload/import

→ Validate media

→ Generate cryptographic hash

→ Generate perceptual hash

→ Duplicate detection

→ Store original

→ Generate optimized preview

→ Extract EXIF

→ Timestamp resolution

→ GPS normalization

→ Face detection

→ Visual embedding

→ Scene/object description

→ Caption generation

→ Text/context embedding

→ Event clustering

→ Memory suggestions

Each stage should be independently retryable.

Avoid creating one giant blocking import process.

Use background queues/workers.

---

# 14. Semantic Search

The system should support multimodal search.

Search should combine:

- image embeddings
- textual embeddings
- faces
- locations
- timestamps
- source platform
- conversation text
- captions
- memory metadata

Example query:

"Find the picture from Cyprus where Mehmet was near a car."

Potential search signals:

Cyprus → location

Mehmet → person identity

car → visual embedding

The result should not depend on the user manually tagging "car".

---

# 15. Face Recognition

Face recognition should be optional and consent-based.

Possible workflow:

The system detects an unknown recurring face.

Person #12

Appears in:

483 photos

User can label:

Person #12 → Can

Future matching can reuse this identity.

Users must have controls to:

- disable face recognition
- remove their identity
- correct labels
- hide specific media
- remove themselves from association where appropriate

Do not automatically expose unknown faces to all group members.

---

# 16. Memory AI

The Memory AI should operate using retrieved group data rather than relying on general-model assumptions.

Example:

User:

"When was our first Copenhagen trip?"

Process:

1. parse intent
2. search memories
3. retrieve supporting events/media
4. answer using stored evidence

Potential future functions:

- summarize trips
- create yearly recaps
- generate memory stories
- generate captions
- find forgotten events
- answer historical questions
- create chronological narratives

The AI must distinguish uncertain results.

Example:

"It appears your earliest Copenhagen memory is September 2019 based on the currently imported data."

Do not state incomplete archive information as absolute historical fact.

---

# 17. Privacy Model

Privacy is a foundational product requirement.

Import workflow:

Import

→ Private staging area

→ Automated processing

→ User review

→ Publish/share with group

Imported content must NOT automatically become visible to other group members.

Potential visibility levels:

- private
- selected members
- entire group

Users should be able to control:

- media sharing
- AI processing
- face recognition
- location visibility
- source context visibility
- message visibility

Sensitive source conversations may be private even when the media itself is shared.

Design permissions at the database level, not only in frontend code.

---

# 18. Storage

Original media should be stored in private object storage.

Do not use permanently public object URLs.

Recommended representations:

Original

→ private archive

Medium

→ optimized viewing

Thumbnail

→ timeline/grid

Delivery should use authorized or short-lived signed URLs.

Potential stack:

- PostgreSQL
- Supabase Auth
- Supabase Storage
- Row Level Security
- pgvector
- Next.js
- background worker service
- Swift/SwiftUI Apple companion

Do not couple the architecture exclusively to Supabase if portability is inexpensive.

---

# 19. Group Collaboration

Every group member may contribute different pieces of history.

Example:

Altan:

Apple ✓  
Discord ✓  
WhatsApp ✓  
Messenger ✓

Can:

Apple ✓  
Discord ✓  
WhatsApp pending

Mehmet:

Apple ✓  
WhatsApp ✓

The platform should merge overlapping content.

The same event may gain additional context as more members import archives.

Example:

Memory initially contains:

80 photos

Can imports data:

+ 32 unique photos  
+ 16 duplicates  
+ 42 WhatsApp message contexts

Memory becomes richer without duplicating media.

---

# 20. Memory Structure

A large event should support hierarchical structure.

Example:

Cyprus Summer 2026

→ Arrival

→ Kyrenia

→ Beach Day

→ Nicosia

→ Birthday Dinner

→ Final Night

This prevents a 700-photo event from becoming unusable.

Sub-events can be:

- manually created
- AI suggested
- location based
- time based

---

# 21. On This Day

Daily feature:

On This Day

3 years ago

Copenhagen Weekend

82 photos

This feature should use approved/shared memories only.

Potential notifications can be added later.

---

# 22. Year Recap

Generate annual recap:

2026

- 127 memories
- 4,281 photos
- 12 cities
- 3 countries
- 87 group meetups

Possible generated output:

- interactive recap
- slideshow
- story
- short video
- shareable cards

Do not make competitive social rankings central to the product.

---

# 23. Time Capsules

Allow users to create locked memories.

Example:

Created:

31 December 2026

Unlock:

31 December 2031

Contents:

- photos
- videos
- predictions
- text messages
- voice recordings

The system should enforce unlock time server-side.

---

# 24. Provenance

Never destroy provenance during normalization.

The system must always be able to answer:

- Where did this media originate?
- Who imported it?
- When was it captured?
- When was it shared?
- In which conversation/channel?
- What context surrounded it?
- Which file is the highest-quality master?
- Was metadata inferred or directly provided?

Recommended confidence fields:

- timestamp_confidence
- location_confidence
- identity_confidence
- duplicate_confidence
- memory_cluster_confidence

---

# 25. Non-Goals for Initial Version

Do not initially attempt:

- full social-network functionality
- public profiles
- follower systems
- public photo feeds
- aggressive gamification
- automatic publishing of everything
- scraping unsupported platforms
- rebuilding every feature of Google Photos
- perfect AI recognition from day one

The main focus is:

historical reconstruction + private group memories + intelligent discovery.

---

# 26. Recommended Development Workstreams

Use parallel workstreams with explicit dependencies.

Suggested DAG:

Identity & Groups
        ↓
Permissions
        ↓

Media Storage
        ↓
Import Framework
        ↓
Normalization
        ↓
Deduplication
        ↓
Metadata Resolution
        ↓
AI Processing
        ↓
Memory Clustering
        ↓
Search / Retrieval
        ↓
Memory AI

Parallel streams:

Frontend Experience

Timeline Engine

Map / Location

People / Faces

Native Apple Companion

Archive Parsers

Each workstream should maintain documentation such as:

SPEC.md

ARCHITECTURE.md

CONTRACTS.md

TEST_PLAN.md

DECISIONS.md

---

# 27. Suggested Milestones

## Phase 1 — Foundation

Implement:

- authentication
- friend groups
- invitations
- permissions
- object storage
- manual image upload
- basic timeline
- memories
- private staging

Goal:

A working private shared-memory application.

## Phase 2 — Import Engine

Implement:

- generic adapter interface
- WhatsApp importer
- Discord archive importer
- Messenger archive importer
- provenance model

Goal:

Historical archive ingestion.

## Phase 3 — Intelligent Media

Implement:

- EXIF
- deduplication
- perceptual similarity
- embeddings
- location extraction
- automated event suggestions

Goal:

Turn raw archives into structured memories.

## Phase 4 — Apple Photos

Implement native companion.

Capabilities:

- PhotoKit access
- metadata sync
- selective upload
- incremental synchronization

Goal:

High-quality continuous personal-library ingestion.

## Phase 5 — People + AI Search

Implement:

- optional face recognition
- identity management
- semantic search
- combined filters
- natural-language retrieval

Goal:

Search personal history naturally.

## Phase 6 — Memory AI

Implement RAG over:

- memories
- media
- people
- messages
- locations
- events

Goal:

Conversational access to group history.

## Phase 7 — Advanced Experience

Implement:

- maps
- On This Day
- year recaps
- collaborative stories
- time capsules
- generated slideshows/video
- richer event/sub-event detection

---

# 28. Quality Requirements

The system should be designed for potentially tens or hundreds of thousands of media items per group.

Requirements:

- resumable imports
- background processing
- idempotent jobs
- failure recovery
- deduplication
- indexing
- pagination
- virtualized photo grids
- optimized thumbnails
- signed media access
- audit logs for important operations
- import progress reporting

Example import states:

QUEUED  
SCANNING  
UPLOADING  
PROCESSING  
DEDUPLICATING  
CLUSTERING  
REVIEW_REQUIRED  
COMPLETED  
FAILED

Individual failures should not cancel an entire 20,000-file import.

---

# 29. Core Engineering Principle

Do not model the system as:

User → Album → Photos

Model it as:

People  
↕  
Media  
↕  
Sources  
↕  
Locations  
↕  
Messages  
↕  
Events  
↕  
Memories

Everything should retain relationships.

This creates a historical knowledge graph even if PostgreSQL remains the primary database.

---

# 30. Final Product Goal

The finished system should eventually support interactions such as:

"Show all summer trips we've taken together."

"Find the earliest photo containing all five members."

"Show our university memories."

"Find photos from Cyprus where someone is holding a drink near the beach."

"What were we doing five years ago today?"

"Create a timeline of our friendship from 2018 to 2026."

"Create a three-minute recap of our university years."

"Show every place Can and I have visited together."

The platform should be capable of reconstructing shared history from fragmented digital archives while preserving privacy, provenance and user control.

The fundamental vision is:

> Transform fragmented digital history into a private, structured and searchable memory of a group's shared life.