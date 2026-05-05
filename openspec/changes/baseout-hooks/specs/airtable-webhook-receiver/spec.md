## ADDED Requirements

### Requirement: Public receiver endpoint

The webhook-ingestion repo SHALL expose a public Cloudflare Worker endpoint at `POST /webhooks/airtable/{webhook_id}` that accepts Airtable webhook callbacks. This Worker is the only externally-reachable surface in the repo; it is not the place where event coalescing or run-triggering happens — those concerns live in the `baseout-backup` repo (see `airtable-webhook-coalescing`).

#### Scenario: Endpoint reachable from Airtable

- **WHEN** Airtable POSTs a webhook callback to `https://webhooks.baseout.com/webhooks/airtable/{webhook_id}`
- **THEN** the request lands on the webhook-ingestion Worker and is processed before any other repo's code runs

### Requirement: HMAC signature verification

Every call`baseout-backup` SHALL be authenticated by validating Airtable's HMAC signature against the per-webhook secret stored alongside the registration in `airtable_webhooks`. Requests with missing, malformed, or non-matching signatures SHALL be rejected before any forwarding occurs.

#### Scenario: Valid signature accepted

- **WHEN** a callback arrives with a valid HMAC signature for the given `webhook_id`
- **THEN** the receiver returns 200 and proceeds to lookup + forward

#### Scenario: Invalid signature rejected

- **WHEN** the HMAC signature does not match the stored secret
- **THEN** the receiver returns 401 and does NOT forward the event

#### Scenario: Missing signature rejected

- **WHEN** a callback arrives with no signature header
- **THEN** the receiver returns 401 and does NOT forward the event

### Requirement: Space lookup

After signature verification, the receiver SHALL look up the `airtable_webhooks` row by `airtable_webhook_id` to identify the owning Space (`space_id`) and the Connection. If no active row matches, the request SHALL be rejected.

#### Scenario: Unknown webhook_id

- **WHEN** a callback's `webhook_id` does not match any active `airtable_webhooks` row
- **THEN** the receiver returns 410 (Gone) and does NOT forward the event

#### Scenario: Inactive webhook row

- **WHEN** the matching `airtable_webhooks` row has `is_active=false`
- **THEN** the receiver returns 410 and does NOT forward the event

### Requirement: Forward to backup's per-Space DO

The receiver SHALL forward verified events to the `baseout-backup` repo's per-Space Durable Object via service binding (or internal HTTP with HMAC service token). Forwarding payload SHALL include the Space ID, the raw event, and the verified `webhook_id`. The receiver SHALL NOT itself coalesce events, persist anything to client DBs, or trigger backup runs.

#### Scenario: Successful forward

- **WHEN** signature verification + Space lookup succeed
- **THEN** the receiver forwards to `baseout-backup`'s per-Space DO and returns 200 to Airtable

#### Scenario: Forward failure

- **WHEN** the forward to backup fails (DO unreachable, service binding error)
- **THEN** the receiver returns 503 so Airtable retries per its webhook-delivery policy

### Requirement: Independent versioning and deploy

The webhook-ingestion Worker SHALL be deployable independently of `baseout-backup` so that auth or routing changes (e.g., signature scheme rotation) do not require redeploying the backup engine, and conversely backup-engine deploys do not interrupt webhook reception.

#### Scenario: Backup deploy in progress

- **WHEN** `baseout-backup` is being redeployed
- **THEN** the webhook-ingestion Worker continues accepting callbacks; forwards may briefly fail and trigger Airtable retries, but no callback is lost at the receiver layer

### Requirement: Observability

The Worker SHALL emit structured logs for each callback (signature outcome, lookup outcome, forward outcome) and metrics for callback rate, rejection rate by reason, and forward latency to the backup DO.

#### Scenario: Spike in rejections

- **WHEN** signature-rejection rate crosses an alerting threshold
- **THEN** an on-call alert fires with the breakdown by reason
