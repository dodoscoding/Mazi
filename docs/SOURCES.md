# Mazi source register

Sources were inspected on 2 October 2026. External documentation supports specific platform facts. It does not prove that a Mazi integration works. Import fixtures and device experiments remain milestone gates.

| Source | Evidence used | Limit |
| --- | --- | --- |
| [Original product brief](source/PRODUCT_BRIEF.md) | The user's 30-section vision, requirements, conceptual model, and suggested phases. | Examples and suggested stack are product input, not measured platform behavior. |
| [Existing project plan](../PROJECT_PLAN.md) | Upstream planning document added in eb81cc9 and discovered during PR preparation. | Preserved unchanged. Technology and sequencing differences require M0 reconciliation as recorded in DECISIONS. |
| [Supabase private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals) | Private storage supports authorized downloads and expiring signed links. | Mazi must still implement component permissions and account for bearer-link expiry. |
| [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security) | PostgreSQL row policies provide a database authorization mechanism. | No Mazi policies or schema have been implemented or tested. |
| [Supabase changelog](https://supabase.com/changelog.md) | Changelog index was read through HTTP after the web renderer rejected Markdown content type. | Versions and prices must be rechecked at implementation. |
| [Supabase PostgreSQL update notice](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) | Relevant database change notice inspected during stack research. | There is no existing Mazi database to upgrade. No production version is selected by this plan. |
| [Discord data package](https://support.discord.com/hc/en-us/articles/360004957991-Your-Discord-Data-Package) | Exported messages are the requester's sent messages; attachment records contain CDN references. | Does not establish full conversation history, reaction coverage, or successful media download. |
| [Discord privileged intents](https://support-dev.discord.com/hc/en-us/articles/6207308062871-What-are-Privileged-Intents) | Message-content access affects content and attachment fields. | Current approval/eligibility rules must be checked when configuring the bot. |
| [Discord permissions](https://github.com/discord/discord-api-docs/blob/main/developers/topics/permissions.mdx) | Channel permissions and history access are distinct from the app's feature settings. | A successful authorized bot backfill has not been demonstrated. |
| [Apple PhotoKit](https://developer.apple.com/documentation/photokit) | Official native Photos framework entry point. | The renderer required JavaScript. No detailed API contract was verified from this page. |
| [Apple limited-library guidance](https://developer.apple.com/documentation/photokit/delivering-an-enhanced-privacy-experience-in-your-photos-app) | Official search excerpt describes full versus limited library authorization. | Full page/Markdown could not be retrieved. Real-device and API verification remain open. |
| [WhatsApp export help](https://faq.whatsapp.com/1180414079177245/?cms_platform=android&locale=en_US) | Official export-help endpoint; search excerpt describes including or omitting media. | The opened page yielded no text. Exact limits, locale formats, and export completeness are unverified. |
| [Messenger secure-storage download help](https://www.facebook.com/help/messenger-app/677912386869109) | Official help endpoint identified for follow-up. | Redirected to login/blocking page. No export format or coverage claim is based on it. |

No vendor price, legal conclusion, API availability guarantee, or library-version recommendation is inferred from an inaccessible page. WhatsApp, Messenger, and Apple support remain explicitly conditional on source fixtures and experiments.
