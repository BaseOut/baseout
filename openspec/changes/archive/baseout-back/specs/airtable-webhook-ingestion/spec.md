## ADDED Requirements

### Requirement: Public webhook receiver

The engine SHALL expose a public Worker endpoint at `POST /webhooks/airtable/{webhook_id}` that authenticates each callback via Airtable's HMAC signature and looks up `airtable_webhooks.airtable_webhook_id` to identify the owning Space.

#### Scenario: Valid signature accepted

- **WHEN** an Airtable webhook callback arrives with a valid HMAC signature
- **THEN** the receiver returns 200 and forwards the event to the per-Space DO

#### Scenario: Invalid signature rejected

- **WHEN** the HMAC signature does not match
- **THEN** the receiver returns 401 and does not forward the event

### Requirement: Per-Space DO event coalescing

The per-Space DO SHALL append received events to an in-memory queue, coalesce contiguous events into batches, persist batches to the client DB `change_log` table, and trigger an incremental backup run when a configurable threshold (event count or elapsed time) is crossed.

#### Scenario: Threshold-triggered run

- **WHEN** the configured event-count threshold is crossed
- **THEN** the DO writes any pending batch to `change_log` and creates a `backup_runs` row with `trigger_type='webhook'`

### Requirement: Cursor advancement

The DO SHALL maintain `airtable_webhooks.cursor` and advance it as events are processed, so any events missed during downtime can be fetched on the next callback.

#### Scenario: Catch-up on downtime

- **WHEN** the DO comes back online after a brief outage
- **THEN** it fetches events from `cursor` to the latest, processes them, and advances `cursor`

### Requirement: Gap detection and full re-read fallback

When `last_known_cursor` is older than 24 hours OR three consecutive webhook fetches return zero events while records were modified, the engine SHALL fall back to a full-table re-read of affected bases.

#### Scenario: 24-hour gap

- **WHEN** `last_known_cursor` is older than 24 hours
- **THEN** the engine performs a full re-read of all bases in the Space and resets `last_known_cursor`

### Requirement: Webhook lifecycle (registration on enable, expiry, renewal)

When a Space enables Instant Backup (Pro+), the engine SHALL register webhooks against each included base via the Airtable webhook API. Registration metadata is persisted in `airtable_webhooks` with `expires_at`, `is_active=true`, and `last_successful_renewal_at`. Renewal is owned by the webhook-renewal background service.

#### Scenario: Enable Instant Backup on a base

- **WHEN** a Space enables Instant Backup on a base
- **THEN** a webhook is registered with Airtable and an `airtable_webhooks` row is inserted with `expires_at` set to ~7 days from registration
