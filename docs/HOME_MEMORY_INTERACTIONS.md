# Home to memory interaction specification

Implementation update, 2026-10-03: Atlas is selected. The local experiment implements selection, memory detail, photographs/context, history, keyboard controls, live reduced motion and recovery. [Stack](PROTOTYPE_STACK.md) and [verification](../work/design/atlas/VERIFICATION.md) record the current scope. The following original handoff remains a proposal where broader product behavior is not implemented. Phones use a compact top navigation and selected-photo-first composition; the atlas has three actual memory markers and no drag/orbit controls.

Historical handoff, 2026-10-03: this specification preceded the selected Atlas implementation recorded above. The earlier alternatives remain in [DESIGN_PROPOSAL.md](DESIGN_PROPOSAL.md). The original album/screening descriptions below are conditional studies, not the selected scene. Runtime behavior, motion feel, browser support, and performance are unverified. No application code or dependency is introduced by this document.

## Bolder-round interaction alternatives

The navigation, source evidence, accessibility, recovery, and immediate group-sharing requirements below survive every direction. The chosen scene adds exactly one spatial behavior:

| Candidate | Selection and opening | Narrow / reduced-motion alternative |
| --- | --- | --- |
| Memory Signal | Previous/Next or a dated list selects a fin; the selected photo face opens to a readable plane, then enters detail | Render only the selected face and nearby indexed choices; instant replacement with no fin sweep |
| Our Panorama | A photo tile selects or opens its real memory; the active tile's hinge explains entry into detail | Single-column tile composition; no forced horizontal panorama and no hinge under reduced motion |
| Return Tickets | A dated archive row selects the folded ticket; Open memory unfolds its photo into detail | Stacked index and ticket, with a flat ticket at reduced motion; no simulated barcode action |
| An Index of Us | A readable title in the shoulder index selects the plate; Open memory reveals photo and source | Index becomes a normal list/disclosure; flat plate and instant detail change |
| The Memory Garden | An island or equivalent list entry selects the actual memory; the selected photo rises to a level detail frame | One focal island and conventional list; static inlay instead of rise/camera travel |
| The Atlas of Us | A dated marker or list entry selects the memory; the right-side photo opens to detail | Selected photo above a compact dated index; no required pan or orbit |

These are hypotheses for the first prototype, not implemented gestures. A second click on an already selected object may open it only when the visible Open memory control and its HTML equivalent establish the same action. Hover never changes persistent selection. Scene movement must not create unrequested date, location, person, or relationship information.

## Journey and hierarchy

1. Home offers one featured memory, neighboring choices, and a compact Recently added section. Selecting a neighbor changes the feature; Open memory enters the memory detail route. Clicking or keyboard-activating the central photo also opens it. A neighbor's first activation selects it, rather than unexpectedly entering it.
2. The memory detail presents its title, date certainty, photographs, contribution credit, and available source context. One dominant photo leads. A thumbnail strip and Previous photo / Next photo buttons provide deliberate exploration; no autoplay.
3. Source context appears beside the photograph on wide screens and below it on narrow screens. If lengthy, Show conversation expands it locally. Text, names, timestamps, and uncertainty remain actual readable text.
4. Back to Home returns to the same featured memory, focus origin, and scroll position. Direct links have a usable Home link even without prior history. Browser Back and Forward remain authoritative.

Home, Timeline, and Search are the primary destinations. My Imports is reachable from the header or a plainly labeled supporting menu on narrow screens. Group settings remain secondary. Map, People, and AI do not appear before they ship. The prototype may limit the working path but must label out-of-scope controls honestly rather than simulate completion.

## Meaningful 3D

The scene represents existing memory groupings, not inferred geography or a relationship network. A memory is a photo stack in the Living Album or a focused photographic plane with neighbors in the Screening Room. Stack depth is illustrative and capped; show the actual photo count in text rather than imply one visible layer per contribution.

The initial camera faces the selected image. Neighboring objects are shallow and partially receding, with enough separation to identify them. Free orbit, immersive fly-through, ambient rotation, pointer-following camera, scroll-jacking, and hidden drag-only controls are excluded from this first journey. Explicit previous/next controls own selection. A Reset view control is only needed if later experimentation adds user camera manipulation.

All title, date, count, navigation, and source-context content lives in semantic HTML. Canvas hit targets dispatch the same selection action as the conventional controls. There is one selected-memory ID shared by scene, labels, buttons, URL, and detail view. Assistive technology receives one useful list of memories, not duplicate canvas and HTML content.

No production mesh exists yet. The later prototype needs simple procedural photo surfaces and, for the album, a shallow modeled stack with independently addressable layers. Their materials and texture handling require inspection and device testing. A concept image must never be reported as a completed model.

## Responsive composition

| Context | Home | Memory detail |
| --- | --- | --- |
| Wide, roughly 1100 CSS px and above | Stable header; editorial split for Album or centered stage for Screening Room; recent memories below | Photo takes roughly two thirds; context occupies the remaining reading column |
| Medium, roughly 700-1099 CSS px | Title and stage stack when necessary; neighbors remain secondary | Photo above context, optional compact thumbnail row |
| Narrow, roughly 320-699 CSS px | One dominant photo, smaller depth cue, title and Open memory immediately adjacent; persistent Home / Timeline / Search below | Full-width photo, photo controls, then context; visible Back action above |

Breakpoints are composition hypotheses, not device detection. Reflow based on content fit, including long titles and 200% zoom. At 320 CSS px, the page must not require horizontal document scrolling. The photo strip may scroll horizontally with equivalent buttons. Preserve vertical page scrolling over the scene; native pinch zoom is not blocked. Essential touch targets aim for at least 44 by 44 CSS px, with focus never hidden beneath persistent navigation.

## Motion contract

When a member selects a memory, communicate which moment is now in focus without delaying access, moving the navigation, or losing the member's place. When they open it, preserve the selected photograph's identity while revealing its contents. These are spatial explanations, not entry ceremonies.

| Trigger and frequency | Owner and proposed phases | Interruption and reduced motion | Evidence required |
| --- | --- | --- | --- |
| Press any control; very frequent | Control: immediate active feedback, semantic action on click or keyboard activation, release | Pointer cancellation restores state; no mandatory scale or spring | Pointer-down then drag away; Enter and Space where appropriate; rapid repeated input |
| Select neighboring memory; occasional | Scene: acknowledge selection immediately, bring chosen surface to the focal plane, settle; text changes atomically with selected ID | Retarget from current pose and velocity where supported; latest selection wins; reduced motion swaps content without camera travel | Alternate rapidly between neighbors, select while loading, press keyboard controls repeatedly |
| Open memory; occasional | Navigation owns state and focus; one visual transition owner carries the selected photo into its detail position | Back during transition cancels or reverses from current presentation; details become usable without waiting; reduced motion uses instant route change | Open then immediately Back; slow detail data; repeat 10 times; history restoration |
| Change photo inside memory; frequent | Media: immediate selected thumbnail, replace the photo in a stable frame; optional restrained opacity transition | Latest photo selection wins, stale loads never replace it; reduced motion instant | Repeated Next, first/last boundaries, slow image, failed image, mixed orientations |
| Expand source conversation; occasional | Disclosure: reveal reading area, preserve focus on its toggle | Reverse from current visible state; reduced motion instant; no delayed focusable descendants | Long conversation, rapid expand/collapse, keyboard reachability |
| New import item becomes available; asynchronous | Data/list: update availability and announce politely; no rearranging the memory being read | Never seize focus or camera; preserve current browsing; quiet count update or New memories available affordance | Partial batch success, failures, duplicate retries, update while detail is open |

Initial timing experiments, not approved tokens: compare approximately 220-320 ms for selection and 320-450 ms for the identity-preserving opening transition against an immediate baseline. Controls acknowledge input immediately. No fixed spring constants, overshoot, delay chain, or animation package is selected. Choose measured values after the actual distance, primitive, and device are known. Keep large photographs stable and avoid blur or deformation during reading.

Only one layer may animate the photo's transition at a time. A route fade plus a canvas camera move plus a thumbnail spring is not three separate opportunities for expression. Avoid staged entrances for navigation and ordinary recent-memory lists. Sound and haptics are absent from the first web experiment.

## States and recovery

| State | Visible behavior and recovery |
| --- | --- |
| No group memories | Explain that this is the shared archive; Add memories opens the import path. No fabricated past moment or empty 3D stage |
| Only one memory or one photo | Show the real item; omit unnecessary previous/next controls and position theatrics |
| Initial load | Reserve the final photo dimensions, show static loading treatment, keep navigation available; avoid indefinite shimmer |
| Slow or failed image | Keep metadata and context visible, explain the unavailable photo, provide Retry; never show a broken-image icon as final UI |
| Scene unavailable or context lost | Replace the canvas with the same selected photo and conventional controls immediately; preserve selection and navigation |
| Missing or uncertain date | Display Unknown date or an explicit approximate date; do not fabricate a timeline position or anniversary |
| Missing conversation or attribution | Say No conversation attached or Contributor unavailable as appropriate; do not generate source evidence |
| Long title or many contributors | Wrap the title and allow layout growth; use an expandable contributor list with an honest count |
| Content withdrawn or access lost | Stop displaying inaccessible media, clear it from the scene and detail, explain availability, offer Home; enforcement belongs to application contracts |
| Import partially succeeds | Each accepted ready item is shared with the group immediately; failures keep Retry, and later corrections do not become a publication gate |

Before importing, show the plain-language audience statement: 'Imported memories are shared with everyone in this group as they become ready.' There is no Publish button, audience picker, individual privacy switch, or extra pre-publication review step.

## Accessibility and input

Aim for WCAG 2.2 AA as the proposed implementation target, subject to M0 agreement and actual testing. Verify text contrast at 4.5:1 for ordinary text and 3:1 for large text under [W3C's contrast criterion](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html); do not assume palette swatches or generated pixels prove compliance. Use clearly visible keyboard focus, descriptive image alternatives, named controls, and programmatic selected/expanded states. Avoid conveying selection or uncertainty through color alone.

Opening a detail route moves focus to its heading after navigation is committed, without waiting for motion or image loading. Returning restores the triggering control when it still exists, otherwise the Home heading. Scene objects are not an additional tab trap. Photo shortcuts only operate within the photo viewer, never while typing in an input or source-text control. Do not intercept browser navigation shortcuts.

Respect [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) on initial load and when it changes live. Stop camera travel and depth animation immediately, preserve the current selected state, and keep normal controls available. A conventional static mode must complete the same task. No essential behavior depends on hover, drag, a particular GPU, or a successful animation-completion callback.

## Performance hypotheses and proof

Choose the renderer and actual primitives only after the stack decision. Reserve photo layout before loading; load the selected image first and defer distant neighbors. Bound texture dimensions and release resources owned by the scene when leaving it. Pause offscreen or background work and render on demand when settled. Avoid continuous animation loops for a resting scene.

Starting prototype budgets for measurement: at most three visible memory objects, one active canvas, capped device pixel ratio no higher than 1.5 on the initial mobile configuration and 2 on desktop, and a 60 fps target while transitioning on representative test hardware. These are tuning hypotheses, not proven compatibility guarantees. If the measured scene cannot meet the target, reduce resolution/effects or use the static view while preserving the task. Establish measured transfer, texture-memory, draw-call, and input-response budgets with the renderer and chosen assets; no invented measurements are accepted.

Test the working prototype with 2-3 friends on phones and computers. Ask them to open a memory, find another photograph, read its context, return, and retrieve a specific moment. Observe hesitation, incorrect actions, desire to explore, and willingness to use it again. Compare the spatial treatment with its static alternative so visual appeal and task friction can be distinguished. No such user testing has occurred.

Required implementation evidence: wide and narrow screenshots; a real-device interaction recording; keyboard and screen-reader walkthrough; reduced-motion change while open; repeated selection and Back during opening; slow/failed images; renderer startup failure and context loss; and a representative performance trace. Screenshots alone prove none of the behavioral claims.
