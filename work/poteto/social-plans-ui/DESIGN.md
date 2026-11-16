# Plans interface design

The existing friend group can arrange a meeting before it has any photographs. Plan rows emphasize the agreed local day and title. The detail keeps the place, attendance and participants together, with organizer controls below. Creation is a focused form rather than another dashboard.

Reuse the Luminous night tokens. Void `#05070c`, deep `#0a0f18`, surface `#161f2d`, primary text `#eef2f7`, atmosphere `#8fd3ff` and action `#ffb46a` retain their existing roles. Instrument Serif carries headings; Geist carries forms and attendance. Content stays left aligned with a narrow form and wrapping action rows at 320 pixels.

The route lazily imports one Plans component. Existing Menu and Sheet primitives provide contribution choices and destructive-action confirmation. The read model is the backend Plan or a bounded PlanPage. A draft and a pending idempotent command remain in component memory. A failed uncertain write retries the exact command and key before another save. Group/session loss aborts requests and clears both.

A new meeting asks for local date/time and an IANA zone. Candidate offsets are checked against Intl calendar formatting. Ambiguous times require one explicit UTC offset; nonexistent times require another local time. The backend remains authoritative. A linked memory is optional and accepts an existing detail link or identifier without loading Atlas.

The default list shows upcoming active plans. The all-plans view includes past and cancelled plans. Shared deep links carry both group and plan identifiers. The current group must match the link before the page reads private data. Demo entry is read-only.
