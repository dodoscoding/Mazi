# Mazi product

<!-- impeccable:product-schema 1 -->

The current product contract is [D28](docs/DECISIONS.md#app-simplification-14-november-2026), confirmed on 14 November 2026: **Relive shared history in a simple but fun way.** The [approved specification](docs/APP_SIMPLIFICATION_SPEC.md) governs the simplification tracked in [PR #161](https://github.com/dodoscoding/Mazi/pull/161). Earlier D13-D27 decisions remain historical where superseded; local implementation evidence does not establish deployment or production acceptance.

## Platform

web

A responsive website for phones and computers. Native applications are outside the current scope; later native roadmap entries remain proposals requiring a new decision.

## Stack

The local prototype uses React 19.2, TypeScript, Vite, React Three Fiber 9/Three.js, plain CSS and local synthetic fixtures under [D16](docs/PROTOTYPE_STACK.md). The delegated M0 engineering decision selects Next.js production integration in M1, PostgreSQL, Supabase Auth/private Storage, and one worker using database leases. EU hosting is accepted; paid provisioning remains outside M0. The experiment does not prove those production flows.

## Users

One existing, invite-only friend group of 8-10 people. Members sign in to contribute and explore the group's archive. Group administrators manage circle membership; production invitation proposals remain separately documented.

On 14 October 2026 the owner approved shared-code entry for the local app. Friends enter the shared code and a unique visible name. An existing name resumes immediately, including on another browser. A remembered browser opens Globe. New profiles see a short introduction once, and Settings retains introduction replay. The owner accepts that code holders can use another member's name. No email or personal password is required. [D17](docs/DECISIONS.md#shared-code-entry-decision-14-october-2026) owns this entry decision; D28 relocates the retained account and archive tasks into the simplified interface.

## Product Purpose

Help the existing circle relive its shared history through Globe and Photos. Imports, correction and administration support that experience. Globe is the returning-session landing; Photos offers conventional month browsing, year navigation, search and an explicit Undated collection. Both use the same photograph viewer.

Conversation context remains optional beside photographs and available as secondary search results, including source conversations without a photograph. Source evidence and uncertainty must remain understandable. Independent live comments are distinct from imported conversations and historical story recollections.

The earlier private-social-space and three-destination increments remain documented under D25-D26. D28 supersedes their top-level emphasis and navigation. Success still requires observed enjoyment, discoverability and usable phone/desktop flows; synthetic checks and owner-reported friend feedback do not replace physical-device or production acceptance.

## Operating Context

Members can complete small-memory import, review, and browsing workflows entirely on a phone. Desktop supports comfortable bulk imports and review of many files. Review happens after sharing and helps correct dates, duplicates, and organization.

## Capabilities and Constraints

- Globe and Photos are the two primary views. Add contains imports, connected sources, progress/recovery and focused correction queues. Settings contains membership, account/sign-out, export, departure, About/replay and applicable discovery/identity/processing controls. One current-circle context serves these views.
- Photos shows individual photographs by month, newest first, with compact filters and explicit unknown/uncertain chronology. Search stays in Photos; a text-only conversation opens its exact recorded source context without inventing a photograph association.
- Annual recap is a capture-year collection of available photographs, oldest first by month. Sharing-only, unknown, ambiguous or conflicting capture evidence do not become recap evidence. It has no generated narration, story editor or video workflow.
- Past creations appears in Settings only when eligible existing stories or capsules are available. Reading, exports and authorized deletion remain, including withdrawal of one's own existing recollection. Sealed capsules retain server opening times even for their authors.
- AI answers, story/capsule creation and editing, and generated-story media operations are retired through the application API as well as the interface. Their stored history and unrelated original-media/source reads remain intact. Recognition and external providers are not enabled.
- Imported content is shared automatically with every active group member as ingestion makes it available. Inventory/transfer validation, processing and failure recovery remain explicit; no human Publish action gates successfully ingested items.
- The group is the single content audience. Sign-in, active membership, ownership, personal visibility, withdrawal and existing source limits continue to govern every applicable read, export and mutation. Private staging and selected-recipient audiences remain deferred.
- Preserve contributed originals, source conversation context, provenance and date uncertainty. Imported names do not establish a person's identity automatically. Existing storage formats and archive paths remain compatible.
- Parallel You, a proposed alternative-life simulator ([PY-D1](docs/DECISIONS.md#parallel-you-experiment-1-november-2026)), is fiction kept apart from the archive. It never reads memories and never appears among them. It is not implemented.

## Brand Commitments

Mazi should feel warm, personal, and nostalgic, with photography as the focus. The ambition is bespoke studio quality: strong composition, careful detail, tasteful animation, and meaningful interactive 3D that makes memory exploration enjoyable. The owner's "$10,000 website" reference describes a quality aspiration, not an approved spending budget.

The owner supplied [EnvolDev's HELIOS post](https://x.com/EnvolDev/status/2102793526287487066/video/1) as a reference for meaningful, tasteful 3D. Its [live demo](https://helios-solar-8fn.pages.dev/) was inspected: spatial exploration and object focus coexist with search and a details panel. The X video could not be played. On 14 October 2026 the owner approved a space theme and selected direction A, Luminous night, from the Claude Design canvas. [D19](docs/DECISIONS.md#luminous-night-visual-world-14-october-2026) owns that decision and its night-by-default theme, day toggle, evidence-only people lines and off-by-default ambient sound.

## Evidence on Hand

The [specification](docs/SPEC.md), [roadmap](docs/ROADMAP.md), [contracts](docs/CONTRACTS.md), and [access policy](docs/PRIVACY.md) contain implementation proposals. The [original brief](docs/source/PRODUCT_BRIEF.md) and [initial project plan](PROJECT_PLAN.md) are preserved historical sources; confirmed decisions take precedence where they differ.

The team selected The Atlas of Us. The initial prototype and generated synthetic assets demonstrated Home, memory detail, photograph exploration and context before the D28 consolidation. [Prototype evidence](work/design/atlas/VERIFICATION.md) separates automated and visual checks from physical-device acceptance. Owner-reported friend feedback is recorded in M0 acceptance. Synthetic prototype receipts do not establish the readiness of a production backend or personal archive. M0 is complete; [M0 acceptance](docs/M0_ACCEPTANCE.md) records decisions and passing local provider/browser evidence.

## Product Principles

1. Make rediscovery enjoyable while keeping deliberate retrieval easy.
2. Make contribution simple: accepted imports enter the shared group archive automatically.
3. Use visual craft, motion, and 3D to support meaningful exploration.
4. Keep source evidence, uncertainty, and correction understandable.
5. Make the complete small-memory journey usable across phones, computers, and input methods.

## Accessibility & Inclusion

Adapt 3D scene complexity to the device while preserving the experience and access to content. Provide reduced-motion behavior and equivalent conventional controls so essential navigation does not depend on camera manipulation. Keyboard and screen-reader journeys, usable focus, named controls, progress announcements, and contrast remain proposed T08 acceptance. The owner selected stable Chrome and Firefox on desktop; the delegated phone decision selects Chrome and Firefox on Android. iOS is deferred. The exact accessibility standard, physical-device evidence, and measurable motion/rendering budgets remain open.

## Open Decisions

- Atlas is selected. On 5 October 2026 the owner reported positive feedback from 2-3 friends. No raw study record or exact device inventory was supplied; physical-device and numerical fidelity evidence remain open.
- Accepted production choices are Next.js in M1 with React Atlas, plain CSS, PostgreSQL, Supabase Auth/private Storage, and one worker using database leases. EU hosting and server readability without E2EE are accepted. The ceiling is €75/month with no paid M0 provisioning. Provider review and cost feasibility remain gates.
- M1 accepts manual JPEG/PNG only, up to 10 members, 10,000 items, and 20 GiB originals/previews. Exact file/member limits are in M0 acceptance. Chat exports, HEIC, and video remain conditional M2 support. D09 raw timestamp evidence and resolved display dates are accepted.
- Departure withdraws the departing member's contributions while independent eligible copies remain. Application retention targets are engineering decisions in Privacy; provider feasibility and group-closure implementation remain open.
- App answer generation is retired. Existing manual People/subject controls and applicable local discovery preferences remain; face recognition and external providers stay disabled. Later native applications require separate scope and acceptance. MapLibre is deferred to M3, with no map in the pilot.

Other unconfirmed details in the planning documents remain proposals; this record does not promote them to approved product facts.
