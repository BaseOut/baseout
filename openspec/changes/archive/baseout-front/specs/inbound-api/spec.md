## ADDED Requirements

### Requirement: Endpoints, auth, and base path

The Inbound API SHALL be served at `/api/v1/inbound/*` with Bearer-token auth from `api_tokens` (token hash stored, plaintext shown once at creation). V1 scope is one token per Space.

#### Scenario: Valid token submission

- **WHEN** an external script POSTs to `/api/v1/inbound/automations` with a valid token
- **THEN** the request is authenticated and proceeds to validation

#### Scenario: Invalid token

- **WHEN** the token is missing or invalid
- **THEN** the API returns 401

### Requirement: Per-endpoint Zod validation

Each endpoint (`/automations`, `/interfaces`, `/synced-tables`, `/custom-metadata`) SHALL validate its body with a Zod schema; rejected payloads SHALL return structured errors.

#### Scenario: Invalid payload

- **WHEN** a payload fails Zod validation
- **THEN** the API returns 400 with a structured `{ field, error }` list

### Requirement: Tier-based monthly rate limits

Monthly call caps SHALL be: 10K (Growth), 50K (Pro), 200K (Business), Unlimited (Enterprise). Counts SHALL be per token and reset at the period boundary.

#### Scenario: Pro limit reached

- **WHEN** a Pro Space exceeds 50K calls in a month
- **THEN** subsequent calls return 429 until the period rolls over

### Requirement: Credit consumption

The API SHALL debit 1 credit per 100 inbound calls against the Org's credit buckets.

#### Scenario: 100th call in batch

- **WHEN** an Org accumulates its 100th inbound call in a counting bucket
- **THEN** a `credit_transactions` row debits 1 credit

### Requirement: Forward to back ingestion

The Inbound API SHALL NOT write to client DBs directly. It SHALL forward validated payloads to back's `POST /inbound/{type}` ingestion endpoint with the service token; back owns the client DB write.

#### Scenario: Successful forward

- **WHEN** a valid `automations` payload passes validation
- **THEN** front POSTs to back's `/inbound/automations` with the validated payload + space_id + service token, and returns the back response to the caller

### Requirement: URL-versioned

The API path SHALL be URL-versioned (`/v1/`). v1 SHALL never break (additive changes only).

#### Scenario: New optional field added

- **WHEN** a new optional field is added to v1 payloads
- **THEN** existing callers continue to work without modification

### Requirement: OpenAPI documentation

An OpenAPI 3 specification SHALL be hosted at `docs.baseout.com` describing all Inbound API endpoints, request/response shapes, and rate-limit headers.

#### Scenario: Spec available

- **WHEN** a developer fetches the docs URL
- **THEN** the OpenAPI document describing the Inbound API is returned
