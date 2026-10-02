# Mazi — Project Plan

Build a private, invite-only website where a friend group can collect, organize, and explore their shared memories.

The platform should bring together photos, videos, conversations, and reactions from different sources. Every member controls what they import and what they share.

## 1. Core experience

Each member joins through an invitation and gets a private import area. They can add photos, videos, or exported chat archives, review what was found, and approve selected content for the group.

The main navigation should include:

- **Timeline:** Browse memories chronologically.
- **Map:** Explore memories by location.
- **People:** Find memories featuring specific friends.
- **Events:** Explore trips, birthdays, university years, gaming nights, and other collections.
- **Search:** Search by date, place, person, message, or description.
- **Ask AI:** Ask questions and create recaps from accessible memories.
- **My Imports:** Manage uploads, processing progress, and sharing permissions.

## 2. Import system

Build a separate importer for each supported source, translating its data into a common format.

Start with direct photo and video uploads, then add support for Apple Photos exports, WhatsApp chat exports with media, Discord data packages, and Messenger archives.

Treat direct account connections as a later feature where supported. Do not display working connection buttons until the integration is implemented.

Extract available photos, videos, original filenames, dates, locations, authors, messages, and reactions. Preserve the source of every item.

Keep the photo’s capture date separate from the date it was sent in a conversation. Missing information should remain unknown, and inferred information should be clearly marked.

Imports should run in the background, show progress, support retries, and avoid creating extra copies when the same archive is imported again.

## 3. Privacy and sharing

Every import starts private.

Before sharing, members can review individual items, approve a selection, or exclude sensitive content. Sharing a photo should not automatically publish its surrounding conversation; members should review that context separately.

Members must be able to withdraw their own shared contributions and delete their imports. If another member independently contributed the same photo, their contribution should remain under their control.

Apply these permissions to originals, thumbnails, messages, search results, AI answers, and generated recaps.

## 4. Duplicate detection

Use file hashes to detect exact duplicates and visual similarity to suggest compressed, resized, or edited versions of the same photo.

Represent a photo as one main asset connected to multiple source records. Each source record retains its contributor, conversation, messages, reactions, and sharing permissions.

Choose the best available version as the main display image. Keep uncertain matches available for review, and make merges reversible. Never automatically delete originals based only on visual similarity.

## 5. Automatic organization

Suggest events using dates, locations, and related content. Examples include Cyprus Summer 2024, Copenhagen Trip, Birthdays, University Years, and Gaming Nights.

Members can rename events, adjust dates, merge collections, or move photos between them. A photo may belong to multiple collections.

Start with manual people tagging. Add optional face grouping later, with member consent and confirmation of suggested identities.

## 6. Search and AI

Combine filters and keyword search with visual and semantic search.

Support questions such as:

- “Show me our Cyprus memories from 2022.”
- “When was the first photo of all of us together?”
- “Find the beach photo where Can was wearing sunglasses.”
- “Create a recap of our university years.”

Answers should link to the photos or messages that support them. AI should acknowledge missing evidence and uncertainty. For example, it should say “the earliest photo in this archive” when it cannot establish the first photo ever taken.

Select the AI provider after deciding whether members allow external processing of their private content.

## 7. Technical foundation

Use Next.js, TypeScript, and Tailwind CSS for the website. Use Supabase Auth, PostgreSQL, and private storage for accounts, metadata, permissions, and media.

Use a separate background worker for archive parsing, metadata extraction, thumbnail generation, and video processing. Use Inngest to coordinate jobs and retries.

Use PostgreSQL full-text search and pgvector for search, and MapLibre for the map.

Store media assets separately from their source records, messages, event memberships, and visibility rules.

## 8. Development sequence

Build the product in four stages:

1. **Private archive:** Invitations, authentication, photo uploads, private review, sharing, timeline, manual events, and exact duplicate detection.
2. **Historical imports:** Add chat importers one at a time, using real sample exports to verify what each source preserves.
3. **Discovery:** Add the map, people tagging, search, event suggestions, and visual duplicate review.
4. **AI:** Add visual search, questions with supporting evidence, and editable recaps.

Complete one working journey early: a member imports memories, reviews them privately, shares a selection, and another member finds them in the timeline.

## 9. Launch criteria

Before inviting the whole group, verify that private content cannot appear in another member’s feed, search, media links, or AI results.

Also verify that interrupted imports can resume, repeated imports do not multiply content, duplicate merges preserve source context, and withdrawing a contribution removes access appropriately.

Include backups for both the database and media files, and test restoring them.

The visual design should feel warm, personal, and nostalgic, with photography as the focus, clear navigation, and a comfortable mobile experience.
