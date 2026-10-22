# Vercel import release verification

The release branch starts at the deployed `69bf23c13fa543292af99ad105347c8d49208b61`, preserving its Vercel WSGI bridge, request-driven worker, image decoding fix and branding. Merge `89ec735` adds main `034921da3e5849f7b45c982ac0704a8d8bcdf380`. The image preparation conflict preserves both invalid-media classification and validated archive reuse.

A deployment-specific hidden-page guard in `useWorkDrain` also stopped work. Regression commit `f294c85` exposes three failures before fix `2cc937b` removes that guard. Six focused drain tests pass, including initial hidden state, hiding during a request, hidden work kicks, no overlap, logout, and local-thread/404 stop behavior. Documentation commit `bb07baa` scopes hidden polling to the retained Imports/Circle routes.

## Acceptance on 22 October 2026

- Build/typecheck, lint, documentation checks and patch whitespace pass.
- 85 backend tests pass, covering imports, sources, storage and the Vercel bridge; an independent reviewer repeated them successfully.
- 114 DOM tests pass, including all six worker-drain tests.
- 19 import browser cases pass, one conditional case skipped.
- Independent review against the deployed base finds no blocking application issue. Its documentation note was corrected.
- [Native request-driven result](vercel-native.json) passes at `2cc937b`: 4,700,761 bytes uploaded and inventoried while genuinely hidden, selected file retained on return, and 80 photographs available after the confirming page closes. This run used the actual `api.index.app` WSGI bridge on a local threaded WSGI server, with temporary synthetic fixture storage and no always-on worker. Native browser tab switching used computer-use controls. The retained `native-probe.mjs` is unchanged.

Native observations prove background behavior for this local request-driven runtime. They do not measure production hosted latency or guarantee progress during browser suspension. Once all tabs close, Vercel can finish its current request, but subsequent queued work waits for another request or the daily cron.

## Deployment scope

Project `mazi` (`prj_rm73tXXOISr9jfe1FtU9YpAncs2B`) in `altanesmers-projects` (`team_pmgjuOOjaC2wTXtIFmbgFAcB`), production domain `mazi-three.vercel.app`. Deploy using the existing configuration and environment, first with `--prod --skip-domain`, smoke-test the staged build, then promote. No schema, secret, provider, cron, domain configuration, or billing changes. Connector access failed for the team; the authenticated Vercel CLI resolved the exact same project and is used as fallback. Release commands and final deployment ID are recorded in the task handoff.
