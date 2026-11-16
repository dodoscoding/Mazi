# Independent memory deep-link routing review

Verdict: PASS for the source delta. New staged HTTP/browser verification remains required before promotion.

- Base: `409d20c5b2f31078a4bb9f35fdc835bdccd7783c`.
- Head: `94efa03ff9d56e87907d2aa81b2fa7e7eb647b7b`.
- Stable patch ID: `d46ef753b6d9f23bcfdd793c39e518e7587c6584`.
- Reviewer: GPT-6.1 Sol, high reasoning; independent within one model family.

## Standards

The complete diff adds one four-line rewrite object to vercel.json. No application, API, build, dependency, function, header, cron or authorization code changes. Independent JSON parsing and structural comparison confirm that removing this single new object yields the exact prior rewrite list and that every other configuration value is identical. Full committed-delta whitespace passes. No actionable finding.

## Spec

`/memory/:path*` now resolves to the existing `/index.html` shell. This supplies the pathname entry promised by CONTRACTS.md:124/316; `readRoute` already reads `location.pathname + location.search` when no hash route is present. The browser's original route remains available for selected-memory authorization and unavailable-target handling. [Vercel's official rewrite documentation](https://vercel.com/docs/routing/rewrites#wildcard-path-forwarding) documents this wildcard syntax and URL-preserving same-application rewrites.

The rule is confined to the memory path namespace. Existing `/api/(.*)`, health and land rewrites retain their prior destinations and ordering. Static asset namespaces, `/memories`, security headers, region, function inclusion/exclusion and output directory are unchanged. It creates no private-data bypass: the static shell is followed by existing authenticated selected-target reads.

The preserved [staged failure](STAGED_ROUTE_FAILURE.json) records a genuine edge 404 on `/memory/release-probe` at the base deployment, which was not promoted. This review does not claim a green staged request or deployment. The coordinator must verify the newly built staged deep link, app rendering/query handling and representative API/assets before promotion.

No build, deployment, application edit or production action occurred during review.
