## ADDED Requirements

### Requirement: Endpoint, auth, and request shape

The SQL REST API SHALL be served at `https://sql.baseout.com/v1/spaces/{space_id}/query` accepting `POST` with JSON body `{ query: "SELECT ...", params: [...] }` and SHALL authenticate via Bearer tokens from `api_tokens` (per-Space scope). Available on Pro+.

#### Scenario: Valid token + parameterized SELECT

- **WHEN** a Pro+ token holder POSTs a SELECT with parameters
- **THEN** the API returns `{ rows: [...], row_count: N }` (200)

#### Scenario: Tier-ineligible token

- **WHEN** a Starter token (or below) is used
- **THEN** the API returns 402 with an upgrade hint

### Requirement: Read-only enforcement

The API SHALL execute queries under a read-only DB role on the Space's client DB AND SHALL parse the query to reject any non-read statements (INSERT/UPDATE/DELETE/DDL).

#### Scenario: INSERT rejected

- **WHEN** the body's `query` begins with INSERT
- **THEN** the API returns 400 before any DB call is made

### Requirement: Parameterization required

The API SHALL reject queries that contain raw user-supplied literals where parameterization is required, requiring all user-supplied values to use `params`.

#### Scenario: Concatenated literal rejected

- **WHEN** the query body uses a string-concatenated user value rather than a parameter placeholder
- **THEN** the API returns 400 with a structured error explaining the parameter requirement

### Requirement: Rate limits

The API SHALL enforce monthly query caps of 10K (Pro), 50K (Business), and Unlimited (Enterprise), counted per Space.

#### Scenario: Pro limit reached

- **WHEN** a Pro Space exceeds 10K queries in the period
- **THEN** subsequent requests return 429 until the period rolls over or the customer upgrades

### Requirement: Credit consumption

The API SHALL debit 1 credit per 50 queries against the Org's credit buckets.

#### Scenario: 50th query in batch

- **WHEN** a Space's 50th query in a counting bucket completes
- **THEN** a `credit_transactions` row debits 1 credit and the bucket is rolled forward

### Requirement: Response size cap

Responses SHALL be capped (default 10 MB) and SHALL surface guidance to paginate when the cap is hit.

#### Scenario: Result exceeds cap

- **WHEN** a SELECT result would exceed 10 MB serialized
- **THEN** the API returns the first chunk plus a structured cursor and a `truncated: true` flag

### Requirement: OpenAPI documentation

An OpenAPI 3 specification SHALL be hosted at `docs.baseout.com` describing all endpoints, parameters, error shapes, and rate-limit headers.

#### Scenario: Spec available at docs URL

- **WHEN** a developer fetches `docs.baseout.com/openapi.json`
- **THEN** a valid OpenAPI 3 document is returned describing the SQL REST API endpoints
