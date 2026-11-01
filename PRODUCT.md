# Mazi product

<!-- impeccable:product-schema 1 -->

Confirmed by the product owner in the 3 October 2026 discussion of [issue #3](https://github.com/dodoscoding/Mazi/issues/3). This records product intent; a synthetic Atlas prototype now implements the initial browsing experiment. [Decisions D13-D15](docs/DECISIONS.md) reconcile this direction with the earlier plans.

## Platform

web

A responsive website for phones and computers. Native applications are outside the current scope; later native roadmap entries remain proposals requiring a new decision.

## Stack

The local prototype uses React 19.2, TypeScript, Vite, React Three Fiber 9/Three.js, plain CSS and local synthetic fixtures under [D16](docs/PROTOTYPE_STACK.md). The delegated M0 engineering decision selects Next.js production integration in M1, PostgreSQL, Supabase Auth/private Storage, and one worker using database leases. EU hosting is accepted; paid provisioning remains outside M0. The experiment does not prove those production flows.

## Users

One existing, invite-only friend group of 8-10 people. Members sign in to contribute and explore the group's archive. Group administrators manage invitations and membership.

On 14 October 2026 the owner approved shared-code entry for the local app. Friends enter the shared code and a unique visible name. An existing name resumes immediately, including on another browser. A remembered browser goes straight to the Atlas. New profiles see a short introduction once, and About retains it. The owner accepts that code holders can use another member's name. No email or personal password is required. [D17](docs/DECISIONS.md#shared-code-entry-decision-14-october-2026) owns this entry decision; the existing application pages remain in place.

## Product Purpose

The owner selected a private social space for the existing friend group on 1 November 2026: shared memories, comments, reactions and events. Shared history should support ongoing interaction and give friends a reason to return. [D25](docs/DECISIONS.md#private-social-space-direction-1-november-2026) revises the earlier rediscovery-first emphasis; [the investigation](docs/PRODUCT_EVOLUTION_INVESTIGATION.md) separates existing capabilities from proposed implementation.

The current application helps friends rediscover shared history and find memories across fragmented photos and source conversations. A memory connects its media with available context and source evidence; event notes support member recollections. A general social feed, native reactions and future-event attendance are proposed additions.

Success means friends enjoy exploring and can understand and use the archive on their phones and computers. The initial experiment is a polished Home-to-memory journey through photos and context, using synthetic content, tried by 2-3 friends. Observe discoverability, clarity of controls, enjoyment, and willingness to return. The owner reported positive feedback on 5 October 2026. Unaided completion observations and exact device evidence have not been supplied.

## Operating Context

Members can complete small-memory import, review, and browsing workflows entirely on a phone. Desktop supports comfortable bulk imports and review of many files. Review happens after sharing and helps correct dates, duplicates, and organization.

## Capabilities and Constraints

- Current primary navigation includes Home, Timeline and Search. D25 requests a simpler Home and clearer destinations; the proposed navigation is documented in the investigation and is not implemented yet.
- My Imports is an easy-to-reach supporting workspace; group settings are a supporting route.
- Map, People, and Memory AI enter navigation only when their features ship. Their detailed scope remains in the roadmap.
- Parallel You, a proposed alternative-life simulator ([D26](docs/DECISIONS.md#parallel-you-experiment-1-november-2026)), is fiction kept apart from the archive. It never reads memories and never appears among them. It is not implemented.
- Imported content is shared automatically with every active group member as each item becomes available through ingestion. There is no human review or Publish action before group visibility.
- The group is the single content audience. Private staging, selected-recipient sharing, and independent component audience controls are deferred.
- Members must sign in and belong to the group. Group sharing does not mean anonymous internet access or public object storage.
- Technical upload, validation, processing, and failure states remain necessary. They must not turn into a manual publication gate or wait for the whole import batch to finish.
- Preserve contributed media, available conversation context, provenance, and visibly uncertain dates. Imported records do not establish a person's identity automatically.

## Brand Commitments

Mazi should feel warm, personal, and nostalgic, with photography as the focus. The ambition is bespoke studio quality: strong composition, careful detail, tasteful animation, and meaningful interactive 3D that makes memory exploration enjoyable. The owner's "$10,000 website" reference describes a quality aspiration, not an approved spending budget.

The owner supplied [EnvolDev's HELIOS post](https://x.com/EnvolDev/status/2102793526287487066/video/1) as a reference for meaningful, tasteful 3D. Its [live demo](https://helios-solar-8fn.pages.dev/) was inspected: spatial exploration and object focus coexist with search and a details panel. The X video could not be played. On 14 October 2026 the owner approved a space theme and selected direction A, Luminous night, from the Claude Design canvas. [D19](docs/DECISIONS.md#luminous-night-visual-world-14-october-2026) owns that decision and its night-by-default theme, day toggle, evidence-only people lines and off-by-default ambient sound.

## Evidence on Hand

The [specification](docs/SPEC.md), [roadmap](docs/ROADMAP.md), [contracts](docs/CONTRACTS.md), and [access policy](docs/PRIVACY.md) contain implementation proposals. The [original brief](docs/source/PRODUCT_BRIEF.md) and [initial project plan](PROJECT_PLAN.md) are preserved historical sources; confirmed decisions take precedence where they differ.

The team selected The Atlas of Us. A runnable local prototype and generated synthetic assets support Home, memory detail, photo exploration and context. [Prototype evidence](work/design/atlas/VERIFICATION.md) separates automated and visual checks from physical-device acceptance. Owner-reported friend feedback is recorded in M0 acceptance. No production backend or personal archive is connected to Atlas. M0 is complete; [M0 acceptance](docs/M0_ACCEPTANCE.md) records decisions and passing local provider/browser evidence.

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
- Optional AI and face recognition remain off. People subject controls and later native applications require separate scope and acceptance. MapLibre is deferred to M3, with no map in the pilot.

Other unconfirmed details in the planning documents remain proposals; this record does not promote them to approved product facts.
