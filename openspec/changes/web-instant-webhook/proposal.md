## Why

UI counterpart to [`server-instant-webhook`](../server-instant-webhook/proposal.md), split out per the CLAUDE.md §3.6 change-naming convention (the server change previously carried a "Phase F — UI" that belongs in a `web-*` change). With the pull-based architecture, "Instant" is a **poll interval**, not a separate machinery — the UI's job is to unlock the option for eligible Spaces, expose the interval within tier limits, distinguish webhook-driven runs in history, and surface webhook-attention states.

## What Changes

- **FrequencyPicker** (`apps/web/src/components/backups/FrequencyPicker.astro`): remove the "not supported" error for Instant; enable when tier ≥ Pro AND the Space's dynamic DB is ready (`space_databases.status='ready'`). Selecting Instant reveals a poll-interval control (`webhook_poll_interval_seconds`) constrained to the tier's platform minimum (values per Features §6.1; server-side validation is authoritative, returning `webhook_poll_interval_below_minimum`).
- **Backup-config PATCH flow**: on transition to/from `instant`, the existing route calls the engine register/unregister webhook routes (wired in `server-instant-webhook` Phase E); this change owns the UX around the responses — including the `airtable_webhook_cap_reached` error state ("this base is already webhook-connected by the maximum number of organizations").
- **History widget**: runs with `triggered_by='webhook'` get a ⚡ glyph; the detail accordion shows "Source: Webhook · N created · N updated · N deleted" plus `reconciled_records` when a reconciliation pass contributed.
- **Attention states**: when a Space's subscribed webhook has `status='pending_reauth'` (webhook deleted upstream or Connection reauth needed), show a "webhook backups paused — reconnect required" banner on the Space's backups view, linking to the Reconnect flow. `notifications_disabled` is NOT customer-facing (self-heals via the renewal cron; data continues via the daily safety sweep).
- **Loading states** per CLAUDE.md §4.5 (`setButtonLoading`) on the frequency/interval saves — registration round-trips to Airtable.

## Out of Scope

- Registry schema + migrations, engine routes, lifecycle — `server-instant-webhook` (canonical `apps/web/drizzle/` migration is specced there even though the files land in this app, per the master-DB-ownership rule).
- Receiver, renewal cron, task — `hooks`, `server-cron-webhook-renewal`, `workflows-instant-webhook`.
- Per-tier interval minimum values — Features §6.1 doc update in `server-instant-webhook` Phase G.

## Capabilities

### New Capabilities

- `web-instant-backup-config`: frequency + poll-interval configuration UI with tier gating, webhook-run history affordances, and webhook-attention states.

### Modified Capabilities

None.

## Impact

- `apps/web/src/components/backups/FrequencyPicker.astro`, the backups history widget, the Space backups page (banner), the backup-config PATCH route's response handling.
- Storybook: extend the FrequencyPicker and history-widget stories for the new states in the same change (coverage test enforces).
- No new master-DB surface; reads `airtable_webhooks.status` via existing space-scoped queries.
