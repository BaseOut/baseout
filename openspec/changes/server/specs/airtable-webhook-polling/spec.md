## ADDED Requirements

### Requirement: Pull-based change detection from the webhook registry

The `server` repo SHALL detect Airtable changes by polling the central webhook registry, not by consuming forwarded events. `apps/hooks` dirty-marks `airtable_webhooks.last_ping_at` on each verified notification ping (pings carry no change data); each Space's Durable Object wakes on its own configurable interval, finds its subscriptions whose webhook has pinged since the Space's `last_polled_at` watermark, and triggers an incremental backup run per dirty base. Implementation: [`server-instant-webhook`](../../server-instant-webhook/proposal.md).

#### Scenario: Change flows end to end

- **WHEN** a record changes in a webhook-registered base
- **THEN** Airtable pings `apps/hooks`, the registry row is dirty-marked, the subscribing Space's next poll tick enqueues an incremental run, and the run pulls actual changes via the payloads API from the Space's own cursor

#### Scenario: Space-controlled cadence

- **WHEN** a Space's `webhook_poll_interval_seconds` is 3600
- **THEN** its changes are picked up on the hourly tick even if the base pings every minute — pings between ticks collapse into one dirty flag

### Requirement: Per-subscription cursor advancement

Each (webhook, Space) subscription SHALL maintain its own `payload_cursor`, advanced only after payload batches durably apply to the Space's DB, so any events missed during downtime are re-fetched on the next poll. Cursors are client-held transaction numbers; multiple Spaces read one webhook's payload stream independently.

#### Scenario: Catch-up after downtime

- **WHEN** processing resumes after an outage
- **THEN** the next poll fetches payloads from the stored cursor to the latest, processes them, and advances the cursor — nothing is lost while Airtable's 7-day payload retention holds

### Requirement: Gap detection and full re-read fallback

When a subscription's cursor falls outside Airtable's 7-day payload retention, or the payload stream signals that the webhook itself is broken (`INVALID_HOOK`/`INVALID_FILTERS`), the engine SHALL fall back to a full re-read of the affected base and reset the subscription's cursor to the latest. Softer payload-stream misses (drift against stored values, an `INTERNAL_ERROR` payload, an end-of-pass schema-verification mismatch) are corrected in-task by a `modifiedTime` reconciliation pass — no full re-read. As shipped: fallback = the [`server-instant-webhook`](../../server-instant-webhook/proposal.md) Phase D `/fallback` route; reconciliation = the incremental task's catch-all ([`workflows-instant-webhook`](../../workflows-instant-webhook/proposal.md) task 1.8).

#### Scenario: Cursor older than payload retention

- **WHEN** a subscription's cursor predates the oldest retained payload
- **THEN** the engine enqueues a full `backup-base` run and resets the cursor

### Requirement: Webhook lifecycle (org-level find-or-create, expiry, renewal)

Webhooks SHALL be registered once per (Organization, base) and shared across the org's Spaces via subscriptions (Airtable caps webhooks at 2 per base per OAuth integration). Registration persists `expires_at`, the encrypted MAC secret (returned only at creation), and `status`. Renewal (refresh before the 7-day expiry) and re-enabling notifications after Airtable disables them (ping-retry exhaustion) are owned by the webhook-renewal cron ([`server-cron-webhook-renewal`](../../server-cron-webhook-renewal/proposal.md)); note that listing payloads also extends expiry, so actively-polled webhooks largely self-renew.

#### Scenario: Enable on a base already webhook-registered by the org

- **WHEN** a second Space in the same Organization enables webhook backups on a base
- **THEN** the existing webhook is reused and only a subscription row is added

#### Scenario: Downgrade below the webhook tier

- **WHEN** a Space loses webhook-backup capability and it held the webhook's last subscription
- **THEN** `server` deregisters the webhook with Airtable and sets the row `status='inactive'`

### Requirement: Registry contract with apps/hooks

The only cross-app contract with `apps/hooks` SHALL be the `airtable_webhooks` table shape: hooks writes `last_ping_at`/`last_ping_source_ip` after HMAC verification; `server` reads them. No service binding, forward endpoint, or event payload crosses the app boundary, and `server` deploys MUST NOT affect ping reception.

#### Scenario: Server deploy during ping traffic

- **WHEN** `apps/server` is mid-deploy while pings arrive
- **THEN** hooks continues dirty-marking rows and the next poll tick after deploy picks up everything — no event loss, no retry dependency
