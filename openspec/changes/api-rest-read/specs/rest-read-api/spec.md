## ADDED Requirements

### Requirement: Versioned URL structure with Org and Space in the path
The public read API SHALL be served at `api.baseout.com` under the URL-versioned prefix `/v1`. All resources SHALL nest as `/v1/orgs/{orgId}` and `/v1/orgs/{orgId}/spaces/{spaceId}`. Backup resources SHALL be platform-free (`/v1/orgs/{orgId}/spaces/{spaceId}/backups/...`). Schema resources SHALL nest under a bare Platform short-code segment (`/v1/orgs/{orgId}/spaces/{spaceId}/{platform}/schema/...`, where `{platform}` is the canonical code — `at` for Airtable — with no `platforms/` literal). v1 SHALL never break: changes are additive only; breaking changes ship as `/v2`.

#### Scenario: Platform segment accepts only connected platform codes
- **WHEN** a client requests `/v1/orgs/{orgId}/spaces/{spaceId}/nt/schema/bases` and the Space has no `nt` Platform
- **THEN** the API responds 404 with error code `platform_not_found`

#### Scenario: Unknown version prefix
- **WHEN** a client requests `/v2/orgs/{orgId}` before v2 exists
- **THEN** the API responds 404 with error code `version_not_found`

### Requirement: Bearer-token authentication via api_tokens
Every request SHALL present `Authorization: Bearer <token>` where the token is validated against the shared `api_tokens` table by comparing the SHA-256 hash. Tokens SHALL be prefixed `bo_live_` (`bo_test_` reserved). Requests with a missing, malformed, inactive, or expired token SHALL receive 401 with error code `unauthorized`. Successful authentication SHALL update `api_tokens.last_used_at` (write-behind; MUST NOT block the response).

#### Scenario: Valid token
- **WHEN** a request presents an active, unexpired token whose hash matches an `api_tokens` row
- **THEN** the request proceeds and `last_used_at` is updated asynchronously

#### Scenario: Expired token
- **WHEN** a request presents a token whose `expires_at` is in the past
- **THEN** the API responds 401 `unauthorized` without revealing whether the token ever existed

### Requirement: Org-owned, Space-optional token scoping with tenant-safe 404s
Every token SHALL belong to exactly one Organization (`organization_id` NOT NULL) and optionally one Space (`space_id` nullable; NULL grants all Spaces in the Organization). Tokens SHALL carry read scopes from `org:read`, `backups:read`, `schema:read`. A request whose path `{orgId}` does not match the token's Organization, or whose `{spaceId}` is outside the token's grant, SHALL receive 404 (`org_not_found` / `space_not_found`) — never 403 — so existence of other tenants' IDs is not confirmed. A request to a resource whose scope the token lacks SHALL receive 403 with error code `insufficient_scope`.

#### Scenario: Space-bound token used on another Space in the same Org
- **WHEN** a token bound to Space A requests `/v1/orgs/{orgId}/spaces/{spaceB}/backups/runs`
- **THEN** the API responds 404 `space_not_found`

#### Scenario: Org-wide token
- **WHEN** a token with `space_id = NULL` requests any Space in its Organization
- **THEN** the request is authorized

#### Scenario: Missing scope
- **WHEN** a token scoped only `backups:read` requests a schema endpoint
- **THEN** the API responds 403 `insufficient_scope`

### Requirement: Organization and Space read endpoints
The API SHALL provide: `GET /v1/orgs/{orgId}` (Organization profile: id, name, created date, plan/tier label), `GET /v1/orgs/{orgId}/spaces` (paginated Space list: id, name, status, platform codes, base count), `GET /v1/orgs/{orgId}/spaces/{spaceId}` (Space detail: status, settings snapshot, onboarding state, connected platforms), and `GET /v1/orgs/{orgId}/spaces/{spaceId}/platforms` (connected Platforms with connection status).

#### Scenario: List spaces
- **WHEN** an org-wide token calls `GET /v1/orgs/{orgId}/spaces`
- **THEN** the response is 200 with `data` as an array of Space objects and `pagination.nextCursor`

#### Scenario: Space detail includes status and settings
- **WHEN** a client calls `GET /v1/orgs/{orgId}/spaces/{spaceId}`
- **THEN** the response includes the Space `status` and a settings snapshot, without any encrypted or secret material

### Requirement: Backup run history with filters
`GET .../spaces/{spaceId}/backups/runs` SHALL return the Space's backup runs newest-first, sourced from `backup_runs`, with query filters `status`, `kind`, `from`, `to` (ISO 8601, on `started_at`), and `baseId` (runs that included the base). Each run SHALL include id, status, kind, trigger, started/completed timestamps, record/table/attachment counts, and error message when failed. Soft-deleted runs (`deleted_at` set) SHALL be excluded.

#### Scenario: Filter by status and date window
- **WHEN** a client calls `.../backups/runs?status=failed&from=2026-06-01T00:00:00Z`
- **THEN** only failed runs started on/after that instant are returned

#### Scenario: Filter by base
- **WHEN** a client calls `.../backups/runs?baseId=appXXXXXXXXXXXXXX`
- **THEN** only runs whose `backup_run_bases` include that base are returned

### Requirement: Backup run detail
`GET .../backups/runs/{runId}` SHALL return the run with a per-base breakdown (from `backup_run_bases`: base id, name, status, counts) and, where captured, per-table detail (from `backup_run_tables`). An unknown or soft-deleted `runId` in an authorized Space SHALL return 404 `run_not_found`.

#### Scenario: Run detail with per-base breakdown
- **WHEN** a client fetches an existing run by id
- **THEN** the response includes a `bases` array with per-base status and counts

### Requirement: Backup configuration, retention, and status rollup
The API SHALL provide `GET .../backups/configuration` (frequency, mode, scope, storage type, auto-add-future-bases, included bases, next scheduled run, and the separate schema-snapshot schedule), `GET .../backups/retention` (policy tier, keep-last-N, daily/weekly windows, monthly-indefinite flag, custom rules), and `GET .../backups/status` (rollup: last run summary, next scheduled run, success rate over the last 30 days, counts of consecutive failures).

#### Scenario: Configuration reflects the engine's schedule
- **WHEN** a client calls `.../backups/configuration`
- **THEN** `nextScheduledAt` equals the engine-written `backup_configurations.next_scheduled_at` value

#### Scenario: Status rollup after a failure
- **WHEN** the most recent run failed
- **THEN** `.../backups/status` reports `lastRun.status = "failed"` with its error message and a non-zero `consecutiveFailures`

### Requirement: Schema listing and drill-down
The API SHALL provide, under `.../spaces/{spaceId}/{platform}/schema/`: `GET bases` (all bases in the Space), `GET bases/{baseId}` (base detail with table/record counts and last-synced timestamp), `GET bases/{baseId}/tables` (tables with field/record counts and primary field id), `GET tables/{tableId}` (table detail), `GET tables/{tableId}/fields` (fields with type, options JSON, isPrimary), and `GET fields/{fieldId}`. Listing endpoints nest under the parent; fetch-by-ID endpoints are flat, keyed by the globally unique native Platform ID (`appX`/`tblX`/`fldX`). Data SHALL be served from the Space's captured schema (via `apps/server` internal schema read), never live from the Platform. `?expand=` SHALL support embedding direct children (e.g. `tables/{tableId}?expand=fields`).

#### Scenario: Drill-down from base to fields
- **WHEN** a client lists bases, then that base's tables, then a table's fields
- **THEN** each response's ids are usable directly in the next request, and field objects include `type`, `options`, and `isPrimary`

#### Scenario: Flat fetch by native ID
- **WHEN** a client calls `GET .../schema/tables/{tableId}` with a valid table id in an authorized Space
- **THEN** the table is returned without requiring the base id in the path

#### Scenario: Expand fields inline
- **WHEN** a client calls `GET .../schema/tables/{tableId}?expand=fields`
- **THEN** the response embeds the table's fields array

### Requirement: Schema search with structured JSON configuration
`POST .../spaces/{spaceId}/{platform}/schema/search` SHALL accept a Zod-validated JSON body: `query` (string), `types` (subset of `base|table|field|view`, default all), `match` (`mode`: `contains|exact|prefix`, default `contains`; `in`: subset of `name|description|options`, default `name,description`), `filters` (`baseIds`, `fieldTypes`, `isPrimary`, `changedAfter`), `sort`, `limit`, `cursor`. Results SHALL be a heterogeneous hit list where each hit carries `type`, the matching entity, and its ancestry (base, and table for fields/views). `GET .../schema/search?q=<term>` SHALL behave as the POST with all defaults. Unknown body properties SHALL be rejected 400 `invalid_request` naming the offending `param`. The `match.mode` and `filters` vocabularies are additive-extension points (e.g. future `fuzzy`).

#### Scenario: Search fields by type across the Space
- **WHEN** a client POSTs `{ "query": "email", "types": ["field"], "filters": { "fieldTypes": ["singleLineText", "email"] } }`
- **THEN** each hit is a field whose name or description matches "email", includes its parent base and table, and satisfies the type filter

#### Scenario: Search inside select options
- **WHEN** a client POSTs `{ "query": "Archived", "types": ["field"], "match": { "in": ["options"] } }`
- **THEN** hits include select-type fields having a choice named "Archived"

#### Scenario: Convenience GET
- **WHEN** a client calls `GET .../schema/search?q=invoice`
- **THEN** the response equals the POST form with defaults and `query = "invoice"`

### Requirement: Schema changelog and captured versions
`GET .../schema/changes` SHALL return the Space's schema changelog (from `bo_at_schema_updates`) newest-first with `entityType`, `entityId`, `changeType`, `before`/`after` values, `breaksData` flag, and timestamp, filterable by `baseId`, `entityType`, `changeType`, `breaksData`, and `from`/`to`. `GET .../schema/versions?baseId=` SHALL return captured schema versions for a base (from `bo_at_schema_versions`): version id, `schemaHash`, captured-at timestamp.

#### Scenario: Breaking changes only
- **WHEN** a client calls `.../schema/changes?breaksData=true`
- **THEN** only changelog entries flagged as data-breaking are returned

### Requirement: Cursor pagination and list envelope
Every list endpoint SHALL use cursor pagination: `?limit=` (1–100, default 50) and `?cursor=` (opaque). List responses SHALL be `{ "data": [...], "pagination": { "nextCursor": <string|null> } }`. Single resources SHALL be bare JSON objects. Offset pagination SHALL NOT be offered.

#### Scenario: Walking pages
- **WHEN** a client passes the previous response's `pagination.nextCursor` as `?cursor=`
- **THEN** the next page continues without gaps or duplicates even if rows were inserted between requests

#### Scenario: Last page
- **WHEN** the final page is returned
- **THEN** `pagination.nextCursor` is null

### Requirement: Error contract and request IDs
Errors SHALL be `{ "error": { "type", "code", "message", "param", "requestId" } }` where `type` ∈ `invalid_request | unauthorized | forbidden | not_found | rate_limited | internal`; `param` present only for validation errors. Every response (success and error) SHALL carry an `X-Request-Id` header matching the `requestId` logged server-side. Internal failures SHALL return 500 with no stack traces or upstream detail.

#### Scenario: Validation error names the parameter
- **WHEN** a client sends `?limit=5000`
- **THEN** the API responds 400 with `error.code = "invalid_limit"` and `error.param = "limit"`

### Requirement: ETag caching on schema resources
Schema responses (bases, tables, fields, and their listings) SHALL carry an `ETag` derived from the relevant base's current `schema_hash`. A request with matching `If-None-Match` SHALL receive 304 with no body.

#### Scenario: Unchanged schema polls cheaply
- **WHEN** a client re-requests `GET .../schema/bases/{baseId}` with the previous `ETag` and no schema sync has occurred
- **THEN** the API responds 304

### Requirement: Single operation registry and OpenAPI publication
Every endpoint SHALL be declared exactly once in an operation registry (method, path template, required scope, Zod request/response schemas, handler). The Worker router and the OpenAPI 3 document SHALL both be generated from this registry, and the OpenAPI document SHALL be published at `docs.baseout.com`. The MCP tool catalog (`api-mcp` change) SHALL consume the same registry.

#### Scenario: New endpoint appears in OpenAPI automatically
- **WHEN** an operation is added to the registry
- **THEN** regenerating the OpenAPI document includes it with its schemas, with no separate documentation edit

### Requirement: Schema reads are served through the server boundary
`apps/api` SHALL NOT connect to per-Space client DBs. Schema listing, changelog, versions, and search SHALL be fulfilled by calling `apps/server` internal endpoints (existing `schema-read`/`schema-changelog`; new `schema-search` — paired change `server-rest-read-support`) authenticated with the HMAC service token over a service binding.

#### Scenario: Server unreachable
- **WHEN** the internal schema call fails or times out
- **THEN** the API responds 502 with `error.type = "internal"` and `error.code = "upstream_unavailable"`, and the failure is logged with the request id
