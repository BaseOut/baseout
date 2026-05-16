## Why

Airtable webhook subscriptions expire 7 days after creation (per Airtable's `webhooks/{id}` API spec). When Instant Backup is enabled on a Space, `apps/server` registers an Airtable webhook against each included Base; if the registration is left to rot, the webhook silently dies and Instant Backup falls back to scheduled cron — without flagging anything to the customer.

The `airtable_webhooks` table already carries the renewal cadence: each row has `expires_at`. What's missing is a cron that proactively renews any subscription whose `expires_at` is within a 24-hour rolling window.

Apps/server's [`wrangler.jsonc.example`](../../../apps/server/wrangler.jsonc.example) already reserves a commented-out cron entry for this purpose. This change activates it.

## What Changes

- **Activate the webhook-renewal cron** in `apps/server` on an hourly cadence (`0 * * * *`). The Worker's `scheduled` handler dispatches the renewal pass; no Trigger.dev task — the work fits inside the Worker's wall-clock budget (one Airtable refresh-RPC per due row, typically < 10 rows per pass at MVP scale).
- **New module** `apps/server/src/lib/webhook-renewal.ts`: pure-orchestration. `runWebhookRenewalPass(deps)` selects rows where `expires_at < NOW() + INTERVAL '24 hours'` AND `status = 'active'`, calls Airtable's `POST /v0/bases/:baseId/webhooks/:webhookId/refresh`, persists the new `expires_at`, transitions status to `'renewed'` (or `'failed_renewal'` on Airtable error).
- **New module** `apps/server/src/lib/airtable-webhook-renewal.ts`: Airtable-specific refresh RPC. Mirrors the shape of `airtable-refresh.ts` from `baseout-server-cron-oauth-refresh`.
- **Extend engine-side schema mirror** `apps/server/src/db/schema/airtable-webhooks.ts` to include `expires_at`, `status`, `last_renewed_at`. No new columns in the canonical master DB; the mirror declares what the engine reads/writes (the canonical migration lands as part of `baseout-server-instant-webhook` Phase A).
- **Activate the cron trigger** by uncommenting the entry in `apps/server/wrangler.jsonc.example` (and the equivalent in the rendered `wrangler.jsonc`).
- **Tests** under `apps/server/tests/integration/webhook-renewal.test.ts` — drives the cron handler against a real local Postgres + stubbed Airtable webhook API; asserts state transitions for happy path, `Airtable 404` (webhook deleted on Airtable side → `pending_reauth`), and `Airtable 5xx` (retry next cron tick).

## Capabilities

### New Capabilities

- `airtable-webhook-renewal`: hourly cron that selects expiring webhook subscriptions, refreshes them against Airtable, and surfaces failures via the `airtable_webhooks.status` field.

### Modified Capabilities

None directly; the `airtable-webhook-coalescing` capability (owned by `baseout-server` parent) already references "webhook lifecycle (registration on Instant Backup enable, renewal owned by the in-repo background service)" — this change implements the renewal side.

## Impact

- **`apps/server/src/lib/webhook-renewal.ts`** — new pure module.
- **`apps/server/src/lib/airtable-webhook-renewal.ts`** — new Airtable RPC wrapper.
- **`apps/server/src/db/schema/airtable-webhooks.ts`** — extended (or new) mirror.
- **`apps/server/wrangler.jsonc.example`** — uncomment the cron line.
- **`apps/server/src/index.ts`** — wire the `scheduled` handler to dispatch on the webhook-renewal cron pattern (the existing dispatcher likely already routes by cron expression; confirm or extend).
- **`apps/server/tests/integration/webhook-renewal.test.ts`** — new integration test.

## Out of Scope

- **Webhook registration on Instant Backup enable** — owned by `baseout-server-instant-webhook` Phase E.
- **Webhook event coalescing + cursor advancement** — owned by `baseout-server-instant-webhook` Phase B-D.
- **Customer-facing "webhook needs attention" UI** — separate apps/web change once the `pending_reauth` flow on `airtable_webhooks` lands.

## Cross-app contract

When renewal flips a row to `status='pending_reauth'`, the per-Space DO should treat that Space's Instant Backup as effectively disabled until the customer reconnects the source. The DO's existing `coalesce` path is the right place for that branch; the integration is a follow-up bullet, not part of this change.
