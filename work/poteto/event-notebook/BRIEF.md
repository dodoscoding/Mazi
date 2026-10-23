# Event notebook

## Request and acceptance

Click an event title such as Party night to open related imported chat excerpts and notes members write, within the existing event page. Make it enjoyable, readable, responsive, and consistent with Mazi. Create a ready PR at the end. No merge or deployment.

- Approved event titles link to the canonical /memory/<event-id> route, including review and recap/story entry points.
- The detail page presents imported chat context and member notes with clear authorship and distinct origins.
- Members can add, edit, and remove their own saved note in place, with real server persistence, revision conflict recovery, retained drafts on recoverable failures, and no other-member edits.
- Preserve existing many-stories-per-event data. Never overwrite or hide earlier contributions by choosing a single story without exposing the others.
- Respect withdrawn source context, full-memory visibility, membership, hidden/background clearing, navigation, reduced motion, keyboard and phone use.
- Existing title creation through Archive review is retained. Link the empty notebook to that existing flow where appropriate. Do not promise complete chat transcripts or semantic topic matching.

## Grounding

mazi/atlas.py projects approved events as cards whose id is the actual event ID. It already projects active, visible imported context as messages {name,time,text}. Context is a bounded excerpt and deduplicated across visible origins.

mazi/memories/memories.py implements advanced_stories and story_contributions. Stories are many per event. /api/memories/stories, /story, /create and /write already authenticate and apply full event visibility. Each story supports one editable recollection per member, max 2,000 characters, with revision checks. Contribution author currently is an ID. Display names can be enriched through shared_profiles. No storage change is required.

src/MemoryView.tsx displays a quote and an expandable imported conversation. src/features/memories/mount.js implements revision-aware recollection writing. Gallery titles already link to /memory/<id>; accepted archive event, annual recap and shared-story headings are static. src/useArchive.ts handles private state clearing and abort generation guards.

## Direction

Extend the established Luminous night world. Instrument Serif titles and warm memory accents, Geist body text, blue source context, existing tokens in the shipped night theme. The event page opens a readable notebook with chat excerpts and saved recollections as content. A small authoring area supports one clear save action. Fun comes from readable conversational rhythm and a restrained reveal, with no decorative confetti or replacement of the app identity. User confirmed within-page presentation.

## Throughput checkpoint

- Blocking first steps. Ground existing storage, authorization, route IDs, design tokens, and test harness before implementation. Compare two architecture sketches.
- Independent workstreams. Read-only UI/backend investigation and architecture sketches run independently. Code-coupled feature implementation has one owner.
- Shared mutable state. Each sketch has a separate output. Only the implementation owner edits code in this isolated worktree; parent owns evidence and PR work.
- Smallest safe decomposition. One implementation owner handles the API/UI contract and tests together. Independent reviewers assess standards, spec, and visual evidence after implementation.

## Verification and evidence

Pin base c9b580406e0ead1072bd556f5c239dba357fc4a1. Use focused backend, DOM and browser contracts, build/typecheck, relevant formatting, document checker, and full repository suites at the end. Synthetic data only. Capture desktop and phone in the shipped night theme. Report real limitations.

## Workflow choices

Poteto Feature playbook and architect arena. Model the Domain chooses explicit notebook/story/note shapes. Separate Before Serializing Shared State gives sketches distinct files and code one owner. Prove It Works requires browser input-to-save-to-refresh evidence. Sequence Work into Verifiable Units keeps failing tests and passing implementation in ordered commits. Origin cannot resolve dodoscoding/Mazi, so PR operations use gh.

## Parent design comparison

The two complete sketches were read before selection. Criteria use a five-point scale.

| Criterion | A, direct existing APIs | B, event capability |
| --- | --- | --- |
| Preserve legacy notes and visibility | 5 | 5 |
| First-save and conflict semantics | 3 | 5 |
| Understandable public boundary | 4 | 5 |
| Title-to-text responsive experience | 4 | 5 |
| Existing harness verification | 5 | 5 |

B is the provisional base. Existing transaction() serializes SQLite writers with BEGIN IMMEDIATE and hosted writers with an exclusive archive advisory transaction lock in mazi/persistence.py. That supports atomic select/create/write without adding a lock design. Avoid nested public transaction methods by sharing private mutation helpers with existing story endpoints. Graft A's single active editor, exact story targeting for historical notes, and explicit draft-preserving refresh. Reject an Atlas-wide note projection and a separate note table. The independent reviewer also selected B. Grafts include a single tagged editor state, explicit conflict recovery, no private requests in sample or standalone-photo mode, and generation guards after every asynchronous boundary. The same model family supplied independent candidates and review.
