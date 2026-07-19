## ADDED Requirements

### Requirement: Hourly cron renews expiring Airtable webhook subscriptions
`apps/server` SHALL run an hourly cron (`0 * * * *`) that selects `airtable_webhooks` rows with `status = 'active'` AND `expires_at` within the next 24 hours, then calls Airtable's webhook-refresh API to extend each subscription. (Listing payloads also extends expiry, so actively-polled webhooks rarely qualify; the cron protects quiet and paused ones.)

#### Scenario: happy renewal
- **WHEN** an `airtable_webhooks` row has `expires_at < NOW() + INTERVAL '24 hours'` AND `status = 'active'`
- **THEN** the cron SHALL POST `/v0/bases/:baseId/webhooks/:webhookId/refresh` to Airtable
- **AND** SHALL update the row's `expires_at` to the response value and set `last_renewed_at = NOW()`, keeping `status = 'active'`

#### Scenario: webhook deleted on Airtable side
- **WHEN** Airtable returns 404 from the refresh endpoint
- **THEN** the cron SHALL set the row's `status = 'pending_reauth'`
- **AND** SHALL NOT retry the refresh on subsequent passes (reconnect re-creates the webhook via `server-instant-webhook` lifecycle)

#### Scenario: token no longer authorized
- **WHEN** Airtable returns 401 or 403 from the refresh endpoint
- **THEN** the cron SHALL set the row's `status = 'pending_reauth'` (the owning Connection needs reauth)

#### Scenario: transient upstream failure
- **WHEN** Airtable returns 5xx or a network error
- **THEN** the cron SHALL leave the row's `status` and `expires_at` unchanged
- **AND** SHALL emit a structured log line `event: 'webhook_renewal_failed_transient'`
- **AND** the next hourly pass SHALL retry the same row

#### Scenario: no eligible rows
- **WHEN** no rows match the renewal predicate
- **THEN** the cron SHALL no-op without contacting Airtable
- **AND** SHALL emit `event: 'webhook_renewal_no_eligible_rows'`

### Requirement: Re-enable notifications Airtable disabled
The same pass SHALL select rows with `status = 'notifications_disabled'` (set when Airtable's ~13-retry ping backoff exhausted during a receiver/DB outage) and call Airtable's toggle-notifications endpoint with `enable: true`. On success the row returns to `status = 'active'`. No catch-up machinery is needed: payload generation continued while notifications were off, and the next Space poll resumes from each subscription's stored cursor.

#### Scenario: notifications restored after outage
- **WHEN** a row has `status = 'notifications_disabled'` and the toggle call succeeds
- **THEN** the row SHALL be set `status = 'active'`
- **AND** subscribed Spaces' subsequent polls SHALL pick up all changes accumulated during the outage via their cursors

#### Scenario: toggle fails transiently
- **WHEN** the toggle-notifications call returns 5xx
- **THEN** the row SHALL remain `notifications_disabled` and be retried next pass

### Requirement: Pure-orchestration module is unit-testable
The renewal pass SHALL be implemented as a pure async function `runWebhookRenewalPass(deps)` taking injected `db`, `fetchImpl`, `now`, and `decryptToken` deps. The cron entry point SHALL be a thin wrapper supplying real deps.

#### Scenario: tests inject deps
- **WHEN** integration tests exercise the renewal pass
- **THEN** they SHALL pass a stubbed `fetchImpl` and a frozen `now`
- **AND** SHALL NOT hit the real Airtable API
- **AND** SHALL exercise real Postgres (per CLAUDE.md §3.4 integration-test rule)
