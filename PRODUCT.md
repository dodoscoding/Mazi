# Mazi product

<!-- impeccable:product-schema 1 -->

Confirmed by the product owner in the 3 October 2026 discussion of [issue #3](https://github.com/dodoscoding/Mazi/issues/3). This records product intent; a synthetic Atlas prototype now implements the initial browsing experiment. [Decisions D13-D15](docs/DECISIONS.md) reconcile this direction with the earlier plans.

## Platform

web

A responsive website for phones and computers. Native applications are outside the current scope; later native roadmap entries remain proposals requiring a new decision.

## Stack

The local prototype uses React 19.2, TypeScript, Vite, React Three Fiber 9/Three.js, plain CSS and local synthetic fixtures under [D16](docs/PROTOTYPE_STACK.md). Production stack, queue, storage, authentication and hosting remain M0 decisions; D01/D10 are not resolved by the experiment.

## Users

One existing, invite-only friend group of 8-10 people. Members sign in to contribute and explore the group's archive. Group administrators manage invitations and membership.

## Product Purpose

Help friends rediscover their shared history and find specific memories across fragmented photos, videos, and source conversations. Rediscovery is the main reason to return; search stays easy to reach. A memory connects its media with available context and source evidence.

Success means friends enjoy exploring and can understand and use the archive on their phones and computers. The initial experiment is a polished Home-to-memory journey through photos and context, using synthetic content, tried by 2-3 friends. Observe discoverability, clarity of controls, enjoyment, and willingness to return. These outcomes have not been tested.

## Operating Context

Members can complete small-memory import, review, and browsing workflows entirely on a phone. Desktop supports comfortable bulk imports and review of many files. Review happens after sharing and helps correct dates, duplicates, and organization.

## Capabilities and Constraints

- Initial primary navigation: Home, Timeline, Search. Home supports rediscovery across any date.
- My Imports is an easy-to-reach supporting workspace; group settings are a supporting route.
- Map, People, and Memory AI enter navigation only when their features ship. Their detailed scope remains in the roadmap.
- Imported content is shared automatically with every active group member as each item becomes available through ingestion. There is no human review or Publish action before group visibility.
- The group is the single content audience. Private staging, selected-recipient sharing, and independent component audience controls are deferred.
- Members must sign in and belong to the group. Group sharing does not mean anonymous internet access or public object storage.
- Technical upload, validation, processing, and failure states remain necessary. They must not turn into a manual publication gate or wait for the whole import batch to finish.
- Preserve contributed media, available conversation context, provenance, and visibly uncertain dates. Imported records do not establish a person's identity automatically.

## Brand Commitments

Mazi should feel warm, personal, and nostalgic, with photography as the focus. The ambition is bespoke studio quality: strong composition, careful detail, tasteful animation, and meaningful interactive 3D that makes memory exploration enjoyable. The owner's "$10,000 website" reference describes a quality aspiration, not an approved spending budget.

The owner supplied [EnvolDev's HELIOS post](https://x.com/EnvolDev/status/2102793526287487066/video/1) as a reference for meaningful, tasteful 3D. Its [live demo](https://helios-solar-8fn.pages.dev/) was inspected: spatial exploration and object focus coexist with search and a details panel. The X video could not be played. No space theme, palette, typography, model, or camera choreography is approved for Mazi by this reference alone.

## Evidence on Hand

The [specification](docs/SPEC.md), [roadmap](docs/ROADMAP.md), [contracts](docs/CONTRACTS.md), and [access policy](docs/PRIVACY.md) contain implementation proposals. The [original brief](docs/source/PRODUCT_BRIEF.md) and [initial project plan](PROJECT_PLAN.md) are preserved historical sources; confirmed decisions take precedence where they differ.

The team selected The Atlas of Us. A runnable local prototype and generated synthetic assets support Home, memory detail, photo exploration and context. [Prototype evidence](work/design/atlas/VERIFICATION.md) separates automated and visual checks from untested real devices and friend feedback. No production backend or personal archive is connected.

## Product Principles

1. Make rediscovery enjoyable while keeping deliberate retrieval easy.
2. Make contribution simple: accepted imports enter the shared group archive automatically.
3. Use visual craft, motion, and 3D to support meaningful exploration.
4. Keep source evidence, uncertainty, and correction understandable.
5. Make the complete small-memory journey usable across phones, computers, and input methods.

## Accessibility & Inclusion

Adapt 3D scene complexity to the device while preserving the experience and access to content. Provide reduced-motion behavior and equivalent conventional controls so essential navigation does not depend on camera manipulation. Keyboard and screen-reader journeys, usable focus, named controls, progress announcements, and contrast remain proposed T08 acceptance. The exact standard, supported browser/device matrix, and measurable motion/rendering budgets remain open for implementation planning.

## Open Decisions

- Atlas is selected for the prototype. Its procedural chart, local synthetic photographs, palette, typography and motion are recorded in the implemented design; validate them with 2-3 friends.
- Production stack, deployment, server-readable versus end-to-end encrypted architecture, regions, and operating budget: retain the M0 decision gates. The prototype-only stack is recorded in D16.
- File limits, quotas, supported export formats, and date/context extraction details: validate through source fixtures.
- Contribution deletion, membership departure, group closure, and retention details: retain their explicit decision gates.
- Optional AI, recognition, People subject controls, and later native applications: separately scoped future decisions.

Other unconfirmed details in the planning documents remain proposals; this record does not promote them to approved product facts.
