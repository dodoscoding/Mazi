Planning status on 2 October 2026. Assignee is dodo ([@dodoscoding](https://github.com/dodoscoding)).

Source is [docs/ROADMAP.md](https://github.com/dodoscoding/Mazi/blob/codex/product-roadmap/docs/ROADMAP.md) M4, except Map, which has its own issue. Depends on the M3 launch and on the M0 PhotoKit feasibility record. Accountable role is the native and integration lead. Estimate for M4 as a whole is 5 to 8 working weeks, not a commitment. Run M4 in parallel with M5 only with separate capacity.

Tests are T12 and the source-specific T07 fixtures.

## Outcome

A member can select Apple media and selected Discord channels, resume an interrupted sync without repeated appearances, and stop ingestion when permission changes. One native platform ships first.

## Scope

- One native platform first. The proposed default is macOS for bulk imports, then iOS after device validation. D07 is proposed, not accepted.
- Metadata-first selection, album, date, and type filters, foreground resumable uploads, change tracking, and permission-revocation handling.
- Live Photo components and original or edited versions, without silently dropping either.
- Discord bot intake only for selected channels and date ranges, with required permissions and an explicit continuous-import switch.

Apple People labels are not a promised capability. Map does not depend on the native companion.

## UI steps

Apple selection.

1. The member grants or denies library access. Denial has a useful dead end and does not start a transfer.
2. They filter by album, date, or type and select items. Unselected items stay on the device.
3. A foreground transfer shows progress and can resume after a network loss or an app restart.
4. Changing or revoking permission stops new reads. Media already kept in Mazi is not silently deleted because the source disappeared.
5. Live Photo parts and edited versions stay visible as related resources. The interface does not drop one without saying so.

Discord server.

1. The member connects a server they are allowed to read and picks channels and a date range.
2. Continuous import is off until they switch it on.
3. A channel outside the selection never appears in the inventory.

States to design with dodo.

- Permission not determined, limited, denied, and revoked mid-sync.
- iCloud delay, where the member can see that an item is selected but not yet retrieved.
- Interrupted sync that resumes as the same occurrence.
- Live Photo with a still and a motion component.
- Discord switch off, on, and a backfill that is still bounded by the selected range.

## Design discussion with dodo

Visitor mode is **Operate** on two platforms. The website remains the archive. The native companion is a selection and transfer tool unless dodo records a different job during init.

Impeccable path. Confirm platform in the design-kickoff issue before shaping this one. If the companion is native, use the native impeccable references for audit and adapt. Do not skin a website and call it the Mac or iPhone app. If M0 keeps the companion as a bounded web flow, say that here before visual work.

### Starting brief

The member is choosing a subset of a large library or a busy server. Success is a selection that matches what uploads, a resume that does not duplicate appearances, and a permission change that halts new reads.

### Open decisions for dodo

1. macOS first or iOS first, using the M0 device notes rather than the proposal alone.
2. How a limited photo permission is explained when the operating system, not Mazi, hid the rest of the library.
3. Where the continuous-import switch lives so it cannot be confused with a one-time export upload from M2.

## Exit

T12 and the source-specific T07 fixtures pass. Changed permissions stop ingestion. One real-device interrupted sync resumes without repeated appearances.
