## Why

Airtable webhooks created with OAuth tokens expire 7 days after creation. Listing payloads extends the expiry another 7 days, so **actively-polled webhooks largely self-renew** — but quiet bases (no changes → no pings → no polls beyond the daily safety sweep... which does extend, but belt-and-braces) and paused Spaces can drift toward expiry. Separately, Airtable **disables notifications** for a webhook whose pings fail ~13 retries over a day (e.g., a sustained receiver/DB outage); payload generation continues, but no new pings arrive until we call the toggle-notifications endpoint. If either state is left to rot, webhook-driven backups silently degrade to the daily safety sweep without flagging anything.

This cron is the keeper of webhook health: renew what's expiring, re-enable what Airtable muted, and surface what needs the customer (`pending_reauth`).

## What Changes

- **Activate the webhook-renewal cron** in `apps/server` on an hourly cadence (`0 * * * *`). Worker `scheduled` handler; no Trigger.dev task — the work fits the Worker wall-clock budget (a handful of refresh RPCs per pass at MVP scale).
- **New module** `apps/server/src/lib/webhook-renewal.ts`: pure orchestration `runWebhookRenewalPass(deps)`:
  - Selects `airtable_webhooks` rows with `status='active'` AND `expires_at < NOW() + INTERVAL '24 hours'`; calls Airtable's `POST /v0/bases/:baseId/webhooks/:webhookId/refresh`; persists the returned `expires_at` + `last_renewed_at = NOW()`.
  - Selects rows with `status='notifications_disabled'`; calls Airtable's toggle-notifications endpoint (`enable: true`); on success restores `status='active'`. Missed changes need no special catch-up — the next Space poll rides the stored cursors.
  - Airtable 404 (webhook deleted upstream) → `status='pending_reauth'`; no further retries (customer reconnect re-creates via `server-instant-webhook` Phase E).
  - Airtable 401/403 (token invalid) → `status='pending_reauth'` (Connection needs reauth).
  - Airtable 5xx / network → leave row unchanged; structured log; retried next pass.
- **New module** `apps/server/src/lib/airtable-webhook-renewal.ts`: Airtable RPC wrappers (refresh + toggle notifications). Mirrors the shape of `airtable-refresh.ts` from `server-cron-oauth-refresh`.
- **Engine-side schema mirror** already carries `expires_at`, `status`, `last_renewed_at` per `server-instant-webhook` Phase A (canonical migration in `apps/web`); this change consumes it.
- **Activate the cron trigger** in `apps/server/wrangler.jsonc.example` (uncomment) + rendered `wrangler.jsonc`.
- **Tests** `apps/server/tests/integration/webhook-renewal.test.ts` — real local Postgres + stubbed Airtable API; state transitions for: happy renewal, notifications re-enable, 404 → `pending_reauth`, 401 → `pending_reauth`, 5xx → unchanged/retry, no eligible rows.

## Capabilities

### New Capabilities

- `airtable-webhook-renewal`: hourly cron that refreshes expiring webhook subscriptions, re-enables notifications Airtable disabled after ping-retry exhaustion, and surfaces dead registrations via `airtable_webhooks.status='pending_reauth'`.

### Modified Capabilities

None directly; implements the renewal/recovery side of the `airtable-webhook-polling` capability (owned by `server` parent, implemented by `server-instant-webhook`).

## Impact

- `apps/server/src/lib/webhook-renewal.ts` — new pure module.
- `apps/server/src/lib/airtable-webhook-renewal.ts` — new Airtable RPC wrappers (refresh, toggle notifications).
- `apps/server/wrangler.jsonc.example` — uncomment the cron line.
- `apps/server/src/index.ts` — route the hourly cron to the pass.
- `apps/server/tests/integration/webhook-renewal.test.ts` — new integration test.

## Out of Scope

- Webhook registration/deregistration and reauth re-creation — `server-instant-webhook` Phase E.
- The receiver's 503-alerting that should prevent most `notifications_disabled` states — `hooks`.
- Customer-facing "webhook needs attention" UI for `pending_reauth` — `web-instant-webhook`.

## Cross-app contract

`status='pending_reauth'` pauses webhook-driven backups for subscribed Spaces: the SpaceDO's dirty-check ignores non-`active` webhooks except via the daily safety sweep, which keeps data flowing (degraded) until reconnect. `web-instant-webhook` surfaces the attention state.
