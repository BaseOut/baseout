## ADDED Requirements

### Requirement: Org-level webhook registry with per-Space subscriptions

Airtable webhooks SHALL be registered once per (Organization, base) — enforced by a UNIQUE constraint on `airtable_webhooks (organization_id, base_id)` — and consumed by Spaces via `airtable_webhook_subscriptions` rows. Each subscription SHALL carry its own `payload_cursor` and `last_polled_at` watermark. There SHALL be no shared "processed" state on the webhook row: processed-ness is per-Space.

#### Scenario: Second Space enables the same base

- **WHEN** a Space enables webhook-driven backups for a base whose (organization, base) already has an active `airtable_webhooks` row
- **THEN** no Airtable API call is made and only a new subscription row is inserted

#### Scenario: Independent cadences on one webhook

- **WHEN** two Spaces subscribe to the same webhook with poll intervals of 60s and 3600s
- **THEN** each polls Airtable's payload stream from its own `payload_cursor` without affecting the other's position

### Requirement: SpaceDO cadence polling of the dirty-flag registry

The per-Space Durable Object SHALL wake on a configurable interval (`backup_configurations.webhook_poll_interval_seconds`, default 900, plus jitter) and query the master DB for the Space's subscriptions where `airtable_webhooks.last_ping_at > last_polled_at` OR `last_polled_at` is older than 24 hours (safety sweep). For each dirty subscription it SHALL insert a `backup_runs` row (`triggered_by='webhook'`), enqueue the `incremental-backup` task with the subscription's cursor, and set `last_polled_at = now()`. The webhook-poll alarm SHALL coexist with the cron-snapshot alarm via the single-alarm min-dispatch pattern. The DO reads the master DB directly; no HTTP endpoint mediates registry access.

#### Scenario: Dirty base triggers an incremental run

- **WHEN** the poll alarm fires and a subscription's webhook has `last_ping_at` newer than the subscription's `last_polled_at`
- **THEN** a `backup_runs` row with `triggered_by='webhook'` is created and the incremental task is enqueued with that subscription's `payload_cursor`

#### Scenario: Clean base is skipped

- **WHEN** the poll alarm fires and no subscribed webhook has pinged since `last_polled_at` (and the safety sweep is not due)
- **THEN** no run is created and no Airtable API call is made

#### Scenario: Safety sweep with no pings

- **WHEN** a subscription's `last_polled_at` is older than 24 hours even though no ping arrived
- **THEN** the poll fires anyway, so missed pings can never silence a subscription for more than a day

#### Scenario: Ping races an in-flight poll

- **WHEN** a new ping updates `last_ping_at` after the DO set `last_polled_at` for the current pass
- **THEN** the next poll tick sees `last_ping_at > last_polled_at` and re-polls; the intervening changes are picked up via the cursor

#### Scenario: In-flight run guard

- **WHEN** a webhook-triggered run for the same (space, base) is still in a non-terminal state at poll time
- **THEN** no second run is enqueued for that base this tick

### Requirement: Tier-gated poll interval

`webhook_poll_interval_seconds` SHALL be persisted in `backup_configurations`, readable by the SpaceDO on each poll cycle, and PATCHable by the customer subject to platform-enforced per-tier minimums (values defined in Features §6.1).

#### Scenario: Below-minimum interval rejected

- **WHEN** a Space PATCHes `webhook_poll_interval_seconds` below its tier's platform minimum
- **THEN** the route returns 400 `{ error: 'webhook_poll_interval_below_minimum', minimum: <tier minimum> }`

### Requirement: Webhook lifecycle (find-or-create, unsubscribe, cap, reauth)

On enabling webhook-driven backups, `server` SHALL find-or-create the (organization, base) webhook: reuse an active row, else register with Airtable using a `notificationUrl` embedding the pre-generated row uuid (`https://hooks.baseout.com/webhooks/airtable/{id}`) and a specification watching `tableData`, `tableFields`, and `tableMetadata` with `includeCellValuesInFieldIds: "all"`, `includePreviousCellValues: true`, and `includePreviousFieldDefinitions: true`. The MAC secret SHALL be encrypted and persisted from the create response before any subsequent step (it is unrecoverable later); if row persistence fails after a successful Airtable create, the Airtable webhook SHALL be deleted as a compensating action. On a Space unsubscribing, the subscription row SHALL be deleted; when the last subscription for a webhook is removed, the Airtable webhook SHALL be deleted and the row set `status='inactive'`.

#### Scenario: First enable registers with full specification

- **WHEN** a Space enables webhook backups for a base with no active org-level webhook
- **THEN** `server` POSTs the webhook creation with the specification above, persists the encrypted secret + `airtable_webhook_id` + `expires_at`, and inserts the subscription

#### Scenario: Last unsubscribe deletes

- **WHEN** the only remaining subscription for a webhook is removed
- **THEN** `server` calls Airtable's webhook DELETE and sets `status='inactive'`

#### Scenario: Airtable per-base webhook cap reached

- **WHEN** Airtable rejects the create because the integration already has 2 webhooks on that base
- **THEN** the route surfaces `{ error: 'airtable_webhook_cap_reached' }` and leaves no partial registry state

#### Scenario: Connection revoked

- **WHEN** the Connection that created a webhook becomes invalid or is disconnected
- **THEN** the webhook row transitions to `status='pending_reauth'` and its Spaces' webhook-driven backups pause until reconnect re-creates or re-points the webhook

### Requirement: Incremental run callbacks

`server` SHALL expose `INTERNAL_TOKEN`-gated routes for the incremental task: `POST /api/internal/webhook-subscriptions/:id/cursor` (advance `payload_cursor`; monotonic — decreases rejected) and `POST /api/internal/webhook-subscriptions/:id/fallback` (enqueue a full `backup-base` run for the affected base, stamp `last_reconciled_at`, reset the cursor to Airtable's latest).

#### Scenario: Cursor advances after a durable batch

- **WHEN** the task POSTs a cursor greater than the stored `payload_cursor`
- **THEN** the subscription row is updated to the new cursor

#### Scenario: Stale cursor rejected

- **WHEN** the task POSTs a cursor lower than the stored value (e.g., a retried stale attempt)
- **THEN** the route returns 409 and the stored cursor is unchanged

#### Scenario: Gap fallback

- **WHEN** the task signals a gap (cursor older than Airtable's 7-day payload retention, or a payload-stream error)
- **THEN** `server` enqueues a full `backup-base` run for the base and resets the subscription's cursor to the latest

### Requirement: Shared Airtable rate budget

All Airtable webhook API calls (create, delete, refresh, payload polling) SHALL route through the per-Connection ConnectionDO rate-limit gateway. Payload polling shares Airtable's 5 requests/second per-base budget with snapshot backups and schema reads; concurrent polls against one base SHALL be serialized by the gateway rather than tripping 429s.

#### Scenario: Two Spaces poll one busy base

- **WHEN** two Spaces' incremental tasks poll payloads for the same base concurrently while a scheduled snapshot also runs
- **THEN** all calls pass through the same ConnectionDO gateway and respect the shared 5 rps per-base limit
