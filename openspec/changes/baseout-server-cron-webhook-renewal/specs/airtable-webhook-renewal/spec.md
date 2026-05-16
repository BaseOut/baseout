## ADDED Requirements

### Requirement: Hourly cron renews expiring Airtable webhook subscriptions
`apps/server` SHALL run an hourly cron (`0 * * * *`) that selects `airtable_webhooks` rows with `expires_at` within the next 24 hours and `status = 'active'`, then calls Airtable's webhook-refresh API to extend each subscription.

#### Scenario: happy renewal
- **WHEN** an `airtable_webhooks` row has `expires_at < NOW() + INTERVAL '24 hours'` AND `status = 'active'`
- **THEN** the cron SHALL POST `/v0/bases/:baseId/webhooks/:webhookId/refresh` to Airtable
- **AND** SHALL update the row's `expires_at` to the response value
- **AND** SHALL set `last_renewed_at = NOW()` and `status = 'renewed'` (or keep `'active'` per chosen state encoding — confirm during implementation)

#### Scenario: webhook deleted on Airtable side
- **WHEN** Airtable returns 404 from the refresh endpoint
- **THEN** the cron SHALL set the row's `status = 'pending_reauth'`
- **AND** SHALL NOT retry the refresh on subsequent cron passes (the customer must reconnect to recreate the webhook)

#### Scenario: transient upstream failure
- **WHEN** Airtable returns 5xx or a network error
- **THEN** the cron SHALL leave the row's `status = 'active'` and `expires_at` unchanged
- **AND** SHALL emit a structured log line `event: 'webhook_renewal_failed_transient'`
- **AND** the next hourly cron pass SHALL retry the same row

#### Scenario: no eligible rows
- **WHEN** no rows match the renewal predicate
- **THEN** the cron SHALL no-op without contacting Airtable
- **AND** SHALL emit `event: 'webhook_renewal_no_eligible_rows'`

### Requirement: Pure-orchestration module is unit-testable
The renewal pass SHALL be implemented as a pure async function `runWebhookRenewalPass(deps)` taking injected `db`, `fetchImpl`, `now`, and `decryptToken` deps. The cron entry point SHALL be a thin wrapper that supplies real deps.

#### Scenario: tests inject deps
- **WHEN** integration tests exercise the renewal pass
- **THEN** they SHALL pass a stubbed `fetchImpl` and a frozen `now`
- **AND** SHALL NOT hit the real Airtable API
- **AND** SHALL exercise real Postgres (per CLAUDE.md §3.4 integration-test rule)
