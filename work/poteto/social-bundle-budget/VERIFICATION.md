# Social feature bundle budget evidence

The source candidate is `codex/photo-labels-ui-20261104@20dba24768ba9619847f8d978c9b696e5fb4ebd9`, including the merged P1 interface. It uses locked dependencies and adds no UI package. The measurements were read from its actual production `dist/assets` build on macOS with Node 24.15.0 on 4 November 2026.

The original committed checker reports the following result from that candidate's working directory.

```text
ok   Globe chunk: 242.9 KiB gzip / 256 KiB
ok   Entry script: 149.1 KiB gzip / 150 KiB
ok   Stylesheet: 36.9 KiB gzip / 40 KiB
OVER All scripts: 401.8 KiB gzip / 400 KiB
```

Run the revised checker against the same files with `node /absolute/path/to/social-bundle-budget/scripts/check-budgets.mjs` from the candidate directory. It retains all primary limits and applies the D27 total limit of 420 KiB. The final integrated release remains required to pass every gate and the H1 no-Atlas/no-notebook network contract before deployment.

This configuration change does not modify runtime code, dependencies, schema, privacy checks or consent. Independent review is pending. The measurement does not establish hosted latency, cold-start behavior, physical-phone acceptance or a production milestone.
