# Atlas prototype stack and experiment

Status: selected for the local experiment on 3 October 2026 under the owner's request to choose the stack and build the Atlas journey. This is D16, not acceptance of the production architecture.

The owner approved the delivered prototype and authorized a pull request and merge on 3 October 2026. Acceptance is limited to the synthetic browsing experiment; the validation limits below remain open.

## Decisions

| Concern | Choice | Reason and boundary |
| --- | --- | --- |
| Application | React 19.2, TypeScript, Vite; exact versions in package-lock.json | Small client-only experiment, fast local feedback, reusable typed UI. No server rendering or server data needed. Node 22.12+; developed on Node 24.15.0. |
| 3D | React Three Fiber 9 / Three.js; procedural chart and photographic planes | One selection state drives HTML and real pickable geometry. Fiber 9 matches React 19 per [official documentation](https://r3f.docs.pmnd.rs/getting-started/introduction). No purchased model, physics engine or 3D helper library. |
| Styling | Plain CSS with shared custom properties | Reproduce Atlas's blue, ivory and copper world without a component framework. Self-host Libre Caslon Text and Source Sans 3 through Fontsource, retaining bundled OFL licenses. |
| Motion | Demand-rendered chart pose interpolation; browser View Transitions for photo continuity; CSS for control feedback | One owner per beat. Navigation is immediate when unsupported or reduced motion is requested. New input skips the previous transition; no blocking completion callback. [Platform API](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition). |
| Routes | Hash URLs with browser history | Portable static hosting and direct links without server rewrite rules. Memory and photo selection encoded in URL; Home selection encoded too. Native links retain normal open-in-new-tab behavior. |
| Data | Typed, checked-in synthetic fixtures | No backend, credentials, personal archives, cookies, remote analytics or persistence requirement. User content cannot be uploaded. Counts reflect actual fixture photos. |
| Assets | Local AI-generated fictional photographs, WebP delivery; procedural geometry retained as source | No runtime image service or personal photo exposure. Generation prompts and provenance under work/design/atlas and public/media. |
| Quality | TypeScript build, Playwright desktop and phone emulation, axe checks, visual/browser review | Proves this experiment only. Real iOS/Android hardware, representative low-end GPU profiling and friend feedback remain separate evidence. |
| Delivery | Local Vite development and preview servers | No hosting account or public deployment selected. Share only the synthetic build after choosing a delivery target. Never use this unauthenticated demo for real archives. |

React/Three, native Three without React, and a full server-rendered framework were considered. React/Fiber keeps selection and rendering coupled with a small component boundary. A full server framework would add setup without testing authentication or ingestion; vanilla Three would require more manual UI/scene synchronization. Production D01/D10 remain open.

## Experiment contract

Home to select dated memory → open → explore actual fixture photos → expand attached conversation → Back restores memory, focus and scroll. Keyboard and touch have HTML equivalents for every scene action. The camera has no orbit/drag interaction; selection alone retargets a bounded shallow chart rotation. On phones, the selected photograph leads; a compact chart and dated list follow.

Renderer initialization failure/context loss yields a flat dated view with retry. Photo failure preserves metadata/context and offers retry. Unknown routes show a recoverable state. Reduced motion applies live. Hidden scenes pause; settled scenes render on demand. Initial bounds: one canvas, DPR 1-1.5, three memory planes, no postprocessing or shadow maps. The atlas's grid is a date index, not inferred geography or relationships.

Timeline and Search, if presented as links, browse only the same demo fixtures. My Imports/group settings are explicitly unavailable. Product import behavior in D14 is unaffected.

## Delivery and acceptance

Run `npm ci`, `npm run dev`, `npm run build`, `npm test`, `npm run check:docs`, and `git diff --check`. Use `npm run dev -- --host 0.0.0.0` only on a trusted local network for physical-phone testing. The demo has no authentication.

Evidence and remaining limits are recorded in [the prototype verification](../work/design/atlas/VERIFICATION.md). User study: give 2-3 friends the three tasks (find/open a memory, change photos/read context, return/find another), observe unaided completion and ask whether they would revisit. Do not infer enjoyment from an automated pass.
