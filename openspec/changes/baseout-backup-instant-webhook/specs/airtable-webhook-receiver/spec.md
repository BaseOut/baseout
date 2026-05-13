## ADDED Requirements

### Requirement: HMAC verification on every webhook POST

The `apps/hooks` receiver SHALL verify the `X-Airtable-Content-MAC` header against the per-webhook secret stored in `airtable_webhooks.mac_secret_base64_enc` (decrypted with the master key). POSTs with missing or mismatched MAC SHALL be rejected with 401.

#### Scenario: Valid HMAC accepted

- **WHEN** an incoming POST to `/api/airtable` has a `X-Airtable-Content-MAC` that matches the SHA-256 HMAC of the body with the webhook's secret
- **THEN** the receiver SHALL proceed to dedup + forward

#### Scenario: Missing HMAC header

- **WHEN** an incoming POST has no `X-Airtable-Content-MAC` header
- **THEN** the receiver SHALL return 401 `{ error: 'mac_missing' }` and SHALL NOT INSERT a `webhook_events` row

### Requirement: Idempotent dedup via UNIQUE constraint

The receiver SHALL INSERT a row into `webhook_events` keyed on `(webhook_id, payload_cursor)`. Duplicate POSTs SHALL hit the UNIQUE constraint and SHALL be acknowledged with 200 without further processing.

#### Scenario: Airtable retries a ping

- **WHEN** Airtable re-sends the same notification (network glitch, retry) with the same `payload_cursor`
- **THEN** the second receiver POST SHALL hit the UNIQUE constraint and return 200 without forwarding to the engine

### Requirement: Forward to engine via service binding

After verifying HMAC + writing the dedup row, the receiver SHALL POST `{ webhookId, payloadCursor }` to the engine's `/api/internal/webhooks/notify` via the `BACKUP_ENGINE` service binding. The forward call SHALL include the `x-internal-token` header per CLAUDE.md §5.2.

#### Scenario: Engine forward succeeds

- **WHEN** the receiver finishes HMAC verification and dedup INSERT
- **THEN** it SHALL call `env.BACKUP_ENGINE.fetch('https://engine/api/internal/webhooks/notify', { method: 'POST', body: '{...}', headers: { 'x-internal-token': ... } })` and return 200 regardless of the engine's response code
