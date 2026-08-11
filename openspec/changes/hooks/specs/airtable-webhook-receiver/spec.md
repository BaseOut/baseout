## ADDED Requirements

### Requirement: Public receiver endpoint

The `apps/hooks` app SHALL expose a public Cloudflare Worker endpoint at `POST /webhooks/airtable/{webhook_row_id}` on `hooks.baseout.com` that accepts Airtable webhook notification pings. The path parameter is the Baseout-owned `airtable_webhooks.id` uuid, embedded in the `notificationUrl` at webhook-creation time. This Worker is the only externally-reachable surface in the app; it performs no payload polling, no change processing, and no run-triggering — those live in `server` (`airtable-webhook-polling`) and `workflows` (`incremental-backup-task`).

#### Scenario: Endpoint reachable from Airtable

- **WHEN** Airtable POSTs a notification ping to `https://hooks.baseout.com/webhooks/airtable/{webhook_row_id}`
- **THEN** the request is handled entirely within the hooks Worker with no runtime dependency on any other Baseout app

### Requirement: HMAC signature verification

Every ping SHALL be authenticated by validating the `X-Airtable-Content-MAC` header as HMAC-SHA256 of the raw request body using the base64-decoded per-webhook MAC secret (stored AES-256-GCM-encrypted in `airtable_webhooks.mac_secret_base64_enc`). Verification SHALL use the raw body bytes before any JSON parsing. Requests with missing, malformed, or non-matching signatures SHALL be rejected and SHALL NOT update any row.

#### Scenario: Valid signature accepted

- **WHEN** a ping arrives whose `X-Airtable-Content-MAC` matches the computed HMAC for the row identified by the path
- **THEN** the receiver proceeds to the dirty-mark upsert

#### Scenario: Invalid signature rejected

- **WHEN** the MAC does not match the stored secret
- **THEN** the receiver returns 401 and does NOT update `last_ping_at`

#### Scenario: Missing signature rejected

- **WHEN** a ping arrives with no `X-Airtable-Content-MAC` header
- **THEN** the receiver returns 401 and does NOT update `last_ping_at`

### Requirement: Row lookup and cross-check

The receiver SHALL look up `airtable_webhooks` by the path `webhook_row_id` (primary key) before verification. Unknown ids and rows with `status='inactive'` SHALL be rejected with 410. After successful MAC verification, the parsed body's `webhook.id` and `base.id` SHALL be cross-checked against the row's `airtable_webhook_id` and `base_id`; a mismatch SHALL be rejected with 401 and logged as a probable spoofing attempt.

#### Scenario: Unknown webhook_row_id

- **WHEN** the path id matches no `airtable_webhooks` row
- **THEN** the receiver returns 410 (Gone)

#### Scenario: Inactive webhook row

- **WHEN** the matching row has `status='inactive'`
- **THEN** the receiver returns 410

#### Scenario: Body/row mismatch after valid MAC

- **WHEN** the MAC verifies but the body's `base.id` does not equal the row's `base_id`
- **THEN** the receiver returns 401 and emits a structured warning log

### Requirement: Dirty-mark upsert (the only write)

On a verified ping, the receiver SHALL update the matched `airtable_webhooks` row: `last_ping_at = now()`, `last_ping_source_ip = <connecting IP>`. The receiver SHALL NOT insert event rows, enqueue messages, call other services, or write anywhere else. Repeated pings are naturally idempotent (later timestamp wins).

#### Scenario: Successful ping

- **WHEN** signature verification and cross-check succeed and the upsert commits
- **THEN** the receiver returns 200 with an empty body (per Airtable's success contract)

#### Scenario: Burst of pings for one webhook

- **WHEN** multiple pings for the same webhook arrive in quick succession
- **THEN** each performs the same single-row timestamp update and returns 200; no additional state accumulates

#### Scenario: Master DB write failure

- **WHEN** the upsert fails (DB unreachable, timeout)
- **THEN** the receiver returns 503 so Airtable retries per its policy (up to 13 attempts with exponential backoff over ~1 day)

### Requirement: Independent versioning and deploy

The hooks Worker SHALL be deployable independently of every other Baseout app, and SHALL have no runtime dependency on `server` — a `server` deploy or outage MUST NOT affect ping acceptance.

#### Scenario: Server deploy in progress

- **WHEN** `apps/server` is mid-deploy or down
- **THEN** the hooks Worker continues verifying and dirty-marking pings normally

### Requirement: Observability

The Worker SHALL emit a structured log per callback (`webhook_row_id`, `base_id`, body timestamp, source IP, outcome: verified/mac_mismatch/unknown_id/inactive/db_error) and metrics for callback rate, rejection rate by reason, and upsert latency. Alerts SHALL fire on rejection-rate spikes and on sustained 503 responses (threshold: 15 minutes), well inside Airtable's ~1-day retry window — retry exhaustion causes Airtable to disable notifications for the webhook.

#### Scenario: Sustained DB failure

- **WHEN** the receiver has returned 503s continuously for 15 minutes
- **THEN** an on-call alert fires before Airtable's ping-retry exhaustion disables notifications
