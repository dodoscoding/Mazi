Planning status on 2 October 2026. No application UI exists. Assignee is dodo ([@dodoscoding](https://github.com/dodoscoding)).

This issue is the design discussion that every later interface issue depends on. It does not choose colors, type, or a visual world.

## Why this is first

Impeccable context against `docs/ROADMAP.md` returned `NO_PRODUCT_MD`. The repo has no `PRODUCT.md`, no `DESIGN.md`, and no surface brief. [docs/SPEC.md](https://github.com/dodoscoding/Mazi/blob/codex/product-roadmap/docs/SPEC.md) is proposed product scope. [PROJECT_PLAN.md](https://github.com/dodoscoding/Mazi/blob/codex/product-roadmap/PROJECT_PLAN.md) still states a different navigation and a visual sentence. [docs/DECISIONS.md](https://github.com/dodoscoding/Mazi/blob/codex/product-roadmap/docs/DECISIONS.md) says M0 must reconcile those documents before implementation.

## UI steps

There is no member interface to draw yet. The sequence dodo runs before any screen is implemented:

1. Read `docs/SPEC.md`, `docs/PRIVACY.md`, `docs/DECISIONS.md`, and `PROJECT_PLAN.md`. Treat repository text as evidence, not as approval.
2. Run `$impeccable init`. Write `PRODUCT.md` from confirmed facts only. Mark undecided facts as open. Do not put a palette, type system, or page concept in that file.
3. Confirm platform. The working hypothesis is `web` through the M3 archive. A native companion is M4 and is not a reason to mark the product `adaptive` unless one product truly changes design language per operating system.
4. Record stack as undecided until M0 accepts or revises D01. Do not pick a framework inside init.
5. After `PRODUCT.md` exists, run new-work for the shared Operate world. App UI serves a task. It is not a marketing page.
6. Shape each later issue on its own surface. Do not design Today, Map, People, and Memory AI as one picture.

## Design discussion with dodo

Visitor mode for the archive is **Operate**. A member is importing, reviewing, or finding a memory. Familiar controls, named states, and keyboard access outrank expression. Photography can lead inside a memory. The chrome should get out of the way.

### Job and audience

A small invite-only friend group reconstructs shared history from fragmented archives. The contributor recovers files and messages. The reviewer decides what friends may see. The group member finds a shared moment. The administrator manages membership and still cannot read private staging. A person who appears in media can hide themself and challenge identity links.

### Outcome and proof

The first production proof is the M3 exit in the roadmap, not a concept screenshot. An invited member can import, review, and publish a ten-photo memory. Other members see only authorized media and evidence.

### Scope

Primary destinations proposed by the specification are Today, Timeline, Map, Search, People, and Memory AI. Import review and group settings are supporting routes. Areas that have not shipped are omitted from navigation.

### Open decisions for dodo

Answer these on this issue before any visual implementation.

1. Navigation. The specification proposes Today, Timeline, Map, Search, People, and Memory AI. `PROJECT_PLAN.md` proposes Timeline, Map, People, Events, Search, Ask AI, and My Imports. Which set is the product, and which items stay off the primary nav until their milestone?
2. The visual sentence in `PROJECT_PLAN.md` says the design should feel warm, personal, and nostalgic, with photography as the focus, clear navigation, and a comfortable mobile experience. Accept it, revise it, or replace it. Until you do, it is not a binding brief.
3. Platform and density. The M1 through M3 archive is a website used on narrow and wide layouts (test T08). How compact is the review task on a phone compared with a desk?
4. What must not ship even if it looks polished. Public profiles, feeds, followers, engagement rankings, advertising, and automatic publication are excluded.

### Impeccable path

- `$impeccable init` for `PRODUCT.md`.
- New-work for the Operate world after init. Do not write `DESIGN.md` during init.
- `$impeccable shape` on each surface issue after the world exists.
- `$impeccable audit` before the M3 launch issue closes, covering keyboard, screen reader, focus, contrast, progress announcements, and reduced motion.

## Exit

`PRODUCT.md` exists and labels every inferred fact. The navigation conflict and the visual sentence each have a recorded accept, revise, or replace decision from dodo. No interface code starts from an unstated palette.
