## ADDED Requirements

### Requirement: Per-Space DO event coalescing

The `server` repo's per-Space Durable Object SHALL receive verified webhook events forwarded by `webhook-ingestion`, append them to an in-memory queue, coalesce contiguous events into batches, persist batches to the client DB `change_log` table, and trigger an incremental backup run when a configurable threshold (event count or elapsed time) is crossed.

#### Scenario: Threshold-triggered run

- **WHEN** the configured event-count threshold is crossed inside the per-Space DO
- **THEN** the DO writes any pending batch to `change_log` and creates a `backup_runs` row with `trigger_type='webhook'`

#### Scenario: Time-window threshold

- **WHEN** events have been buffered for the configured maximum coalescing window without crossing the count threshold
- **THEN** the DO flushes the batch and triggers a run

### Requirement: Cursor advancement

The DO SHALL maintain `airtable_webhooks.cursor` and advance it as events are processed, so any events missed during downtime can be fetched on the next callback.

#### Scenario: Catch-up on downtime

- **WHEN** the DO comes back online after a brief outage
- **THEN** it fetches events from `cursor` to the latest via Airtable's webhook payload API, processes them, and advances `cursor`

### Requirement: Gap detection and full re-read fallback

When `last_known_cursor` is older than 24 hours OR three consecutive webhook fetches return zero events while records were modified, the backup engine SHALL fall back to a full-table re-read of affected bases.

#### Scenario: 24-hour gap

- **WHEN** `last_known_cursor` is older than 24 hours
- **THEN** the engine performs a full re-read of all bases in the Space and resets `last_known_cursor`

#### Scenario: Three zero-event fetches with modifications

- **WHEN** three consecutive webhook fetches return zero events but records have been modified in the time window
- **THEN** a full re-read is triggered

### Requirement: Webhook lifecycle (registration on enable, expiry, renewal)

When a Space enables Instant Backup (Pro+), `server` SHALL register webhooks against each included base via the Airtable webhook API. Registration metadata is persisted in `airtable_webhooks` with `expires_at`, `is_active=true`, and `last_successful_renewal_at`. Renewal is owned by the webhook-renewal background service in this repo (see `background-services` spec).

#### Scenario: Enable Instant Backup on a base

- **WHEN** a Space enables Instant Backup on a base
- **THEN** `server` registers a webhook with Airtable and inserts an `airtable_webhooks` row with `expires_at` set to ~7 days from registration and a per-webhook HMAC secret persisted

#### Scenario: Disable on Space tier downgrade

- **WHEN** a Space downgrades below Pro and Instant Backup is no longer available
- **THEN** `server` deregisters the webhook with Airtable and sets `airtable_webhooks.is_active=false`

### Requirement: Receiver-side contract

This repo SHALL accept event forwards only from `webhook-ingestion` (via service binding or HMAC-authenticated internal HTTP). Inbound forwards MUST carry the verified `webhook_id`, the Space ID, and the raw event payload.

#### Scenario: Direct external POST refused

- **WHEN** a request that bypasses the webhook-ingestion repo arrives at the per-Space DO's forward endpoint
- **THEN** the request is refused (no service-token / no service binding)

### Requirement: Idempotent event handling

The DO SHALL deduplicate events by Airtable event ID so that a duplicate forward (e.g., from Airtable retry plus a webhook-ingestion retry) does not result in double-counting in `change_log`.

#### Scenario: Duplicate forward

- **WHEN** the same event ID is forwarded twice within a short window
- **THEN** the second forward is recognized and ignored (no duplicate `change_log` row)
