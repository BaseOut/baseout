## ADDED Requirements

### Requirement: Cron architecture

Background services SHALL run as cron-triggered handlers within the `server` Cloudflare Workers project. The single `wrangler.jsonc` SHALL declare one cron trigger per service, each routed to its handler under `src/cron/`. Each cron SHALL run idempotently, write stateful flow results to `notification_log`, and be safe to re-run on overlap.

#### Scenario: Overlapping invocations

- **WHEN** a cron tick fires while the previous tick is still running
- **THEN** the second invocation either skips or operates on a non-overlapping work set; no duplicate notifications are sent

#### Scenario: All cron triggers in one wrangler.jsonc

- **WHEN** an operator inspects the deployed Worker's cron schedule
- **THEN** all background-service crons are listed in the single `server` `wrangler.jsonc`, not split across multiple Worker projects

### Requirement: Webhook renewal service

A daily cron SHALL scan `airtable_webhooks WHERE expires_at < now() + interval '24 hours'` and call the Airtable webhook renewal API. On success it SHALL update `last_successful_renewal_at` and `expires_at`. On 3 consecutive failures it SHALL set `is_active=false`, fire an alert, and send the Webhook Renewal Failure email.

#### Scenario: Renewal succeeds at 6-day threshold

- **WHEN** an `airtable_webhooks` row's `expires_at` is within 24 hours
- **THEN** the renewal API is called and the row's `expires_at` is updated to the new expiry

#### Scenario: 3-strike disable

- **WHEN** webhook renewal fails three runs in a row for the same row
- **THEN** `is_active=false` and the alert + email fire

### Requirement: OAuth token refresh service

A 15-minute cron SHALL scan `connections WHERE token_expires_at < now() + interval '1 hour' AND status='active'` and call each platform's refresh endpoint (Airtable, Google, Dropbox, Box, OneDrive, Frame.io). On success it SHALL update encrypted token columns. On failure it SHALL set `connections.status='pending_reauth'` and start the dead-connection cadence.

#### Scenario: Token refreshed before expiry

- **WHEN** a connection's `token_expires_at` is within 1 hour
- **THEN** the refresh exchange runs and the encrypted token columns are updated

#### Scenario: Refresh fails

- **WHEN** a refresh exchange returns an error
- **THEN** `connections.status='pending_reauth'`, an entry in `notification_log` is created, and Send 1 of the dead-connection cadence is dispatched immediately

### Requirement: Dead-connection notification cadence

When a connection enters `pending_reauth`, a four-touch cadence SHALL fire: Send 1 immediate, Send 2 at +2 days, Send 3 at +3 days more (+5 total), Send 4 (final) at +5 days more (+10 total). After Send 4 the connection SHALL be marked `status='invalid'` with `invalidated_at` set. Cadence SHALL stop early on user re-auth (`is_resolved=true`, `resolved_at` set).

#### Scenario: User re-auths between Send 2 and Send 3

- **WHEN** the user re-auths the Connection on day 3 of the cadence
- **THEN** Send 3 and Send 4 are NOT dispatched, `is_resolved=true`, `resolved_at` is set

#### Scenario: Cadence completes without re-auth

- **WHEN** the user does not re-auth by day 10
- **THEN** Send 4 fires, `connections.status='invalid'`, and `invalidated_at` is set

### Requirement: Trial expiry monitor

An hourly cron SHALL scan `subscription_items WHERE trial_ends_at IS NOT NULL`. On day 5 it SHALL send Trial Expiry Warning. On day 7 it SHALL set `trial_ends_at < now()`, trigger Stripe to convert to paid (or mark expired if no card on file), and send Trial Expired.

#### Scenario: Day-5 warning

- **WHEN** a subscription_item is exactly 5 days into its trial
- **THEN** the Trial Expiry Warning email is sent and the send is recorded in `notification_log`

#### Scenario: Day-7 conversion

- **WHEN** a subscription_item reaches day 7 with a card on file
- **THEN** Stripe is called to convert and the Trial Expired (converted variant) email is sent

### Requirement: Quota usage monitor

An hourly cron SHALL compute credits-consumed-this-period and storage-used per Org and SHALL fire one-shot-per-period notifications at 75/90/100 thresholds, plus an Overage Started notification when `is_overage=true` transactions first appear.

#### Scenario: 90% threshold one-shot

- **WHEN** an Org's consumption first crosses 90% in a period
- **THEN** the `quota_90` notification fires once for the period and is recorded in `notification_log`

### Requirement: Smart-cleanup scheduler

A cron SHALL run at the configured per-tier cadence (Monthly / Weekly / Daily / Continuous) and, per Space, evaluate the cleanup policy (Basic / Time-based / Two-tier / Three-tier / Custom) and delete snapshots beyond the retention window, recording each run in `cleanup_runs` with `trigger_type='scheduled'`, `credits_used=0`.

#### Scenario: Time-based policy on Daily cadence

- **WHEN** a Space with a Time-based 30-day policy runs on its Daily cadence
- **THEN** snapshots older than 30 days are deleted and a `cleanup_runs` row is written

### Requirement: Connection lock manager

A Durable Object-based service SHALL ensure no two backup or restore runs hit the same Airtable Connection simultaneously. Locks SHALL be held in the per-Connection DO with a 5-second retry budget for contending callers.

#### Scenario: Simultaneous backup + restore on shared Connection

- **WHEN** a backup and a restore both target Spaces sharing one Connection
- **THEN** the second caller blocks until the first releases the lock, retrying every 5 seconds
