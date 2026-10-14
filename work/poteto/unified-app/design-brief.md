# Unified app design brief

The user-facing app keeps Atlas's navy background, cream Caslon headings, copper actions and Source Sans forms. A shared header links Atlas, Timeline, Memories, People, Places, Ask and Imports. Feature screens use the same spacing, controls and responsive layout. The dominant home element remains the interactive Atlas.

Candidate A retains tested Python behavior and stored data behind a single API, moves modules to domain names, and integrates feature screens within the React app.
Candidate B ports all behavior to TypeScript. Compare complete feature preservation, unchanged data format, one launch command, domain ownership and verification cost. Existing tests cover many privacy and retry behaviors, so porting them is part of candidate B's cost.

Proposed integration contract, pending independent design review:

- Backend package `mazi/` with `identity`, `imports`, `archive`, `sources`, `discovery`, `answers`, `memories` subpackages. `python -m mazi` is the only app entry point. Preserve `.mazi-imports` and API URLs.
- Frontend feature code lives in `src/features/`. Existing DOM-driven workflows can become scoped mount functions with abort/cleanup rather than a risky logic rewrite. React owns navigation and lifecycle. No global scripts, eval, iframes or nested documents.
- A feature registry maps routes to imported templates and mount functions. A `FeaturePage` component mounts one module at a time and disposes its listeners, timers, requests and object URLs on navigation. User-visible links navigate within the shared shell.
- Atlas uses authorized archive events and photographs from existing API responses, through typed models. Sample memories are explicitly separate from an empty personal archive.
- Development uses one launcher supervising Python and Vite with a same-origin API proxy. Built mode serves `dist` and APIs from the Python entry point. The app exposes only one user-facing URL.
