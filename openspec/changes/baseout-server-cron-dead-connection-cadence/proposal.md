## Why

When a `Connection` row flips to `status='pending_reauth'` (the source's OAuth token died — see `baseout-server-cron-oauth-refresh`'s `'pending_reauth'` transition), the customer needs to know. Today, the only visible signal is the dashboard's reconnect prompt — but a customer who hasn't logged in for a week won't see that prompt, and their scheduled backups will silently fail until they do.

PRD §15.4 specifies a notification cadence for dead Connections: email at T+24h, T+72h, T+7d, T+14d, escalating language each step ("your backups are paused" → "your backups are paused, here's what to do" → "your backups have been paused for a week" → "we will stop trying to back up this Connection in 7 days"). After T+21d the Connection is auto-marked `'invalid'` and the row is excluded from future scheduling.

The `notification_log` table is already in the schema for exactly this kind of idempotent cadence tracking (one row per `{org, kind, sub_kind}` per send). This change wires the cron that drives the cadence.

## What Changes

- **Activate the dead-connection-cadence cron** in `apps/server` on a daily cadence (`0 13 * * *` — 13:00 UTC). The Worker's `scheduled` handler dispatches the cadence pass; no Trigger.dev task (the work fits inside the Worker's wall clock — at most one email-trigger per dead-Connection org per day).
- **New module** `apps/server/src/lib/connection-cadence.ts`: pure-orchestration. `runConnectionCadencePass(deps)` selects `connections` rows with `status='pending_reauth'`, joins to `notification_log` to find which cadence step is next (T+24h, T+72h, T+7d, T+14d, T+21d), POSTs an engine-callback to `/api/internal/orgs/:id/connection-cadence-email` (the Cloudflare Workers `send_email` binding call lives on the server side). After T+21d, transitions the Connection row to `status='invalid'`.
- **Extend** the engine-side schema mirror at `apps/server/src/db/schema/notification_log.ts` (or `connections.ts`, depending on where the cadence-tracking columns live).
- **Activate the cron trigger** in `apps/server/wrangler.jsonc.example`.
- **Tests** under `apps/server/tests/integration/connection-cadence.test.ts` — drives the cron with seeded Postgres state through each cadence step.

## Capabilities

### New Capabilities

- `dead-connection-cadence`: daily cron that escalates email notifications for Connections in `pending_reauth` and auto-invalidates them after 21 days.

### Modified Capabilities

The `background-services` capability in `baseout-server` parent already names "dead-connection cadence" as a sub-service. This change is its concrete implementation.

## Impact

- `apps/server/src/lib/connection-cadence.ts` — new pure module.
- `apps/server/src/db/schema/notification_log.ts` — new (or extended) mirror.
- `apps/server/wrangler.jsonc.example` — uncomment the cron line.
- `apps/server/src/pages/api/internal/orgs/:id/connection-cadence-email.ts` — new route handler that renders + the Cloudflare Workers `send_email` binding-dispatches the email per cadence step. Server-side template (`apps/server/src/emails/ConnectionCadence.tsx`) — React Email per project convention.
- `apps/server/tests/integration/connection-cadence.test.ts` — integration test.

## Out of Scope

- **Storage-destination Connection cadence** (Google Drive / Dropbox / Box / OneDrive token death) — same shape but separate kind in `notification_log`. File alongside the storage-destination Connect flow when that lands.
- **In-app banner on the dashboard** — apps/web change. The cadence cron only emails today; the dashboard already shows a reconnect prompt for `pending_reauth` Connections.
- **Customer-configurable cadence intervals** — out of MVP. PRD-pinned intervals only.

## Cross-app contract

The cron writes to `notification_log` only via the engine-callback endpoint. the Cloudflare Workers `send_email` binding call + template render stay server-side per the `backup-email-notifications` capability in `baseout-server` parent. No workflows-side task — the cadence is bounded enough to fit in a Worker.
