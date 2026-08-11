## ADDED Requirements

### Requirement: Internal schema search endpoint
`apps/server` SHALL expose `POST /api/internal/spaces/:spaceId/schema-search` under the `x-internal-token` gate. It SHALL accept the structured search configuration (`query`, `types` ⊆ base|table|field|view, `match.mode` ∈ contains|exact|prefix, `match.in` ⊆ name|description|options, `filters` incl. `baseIds`/`fieldTypes`/`isPrimary`/`changedAfter`, `sort`, `limit`, `cursor`), re-validated server-side, and SHALL return heterogeneous hits where each hit carries `type`, the entity, and its ancestry (base for tables/views; base and table for fields). Matching SHALL be case-insensitive `LIKE`-based with `%`/`_` escaped in user input, behave identically on D1 SQLite and managed Postgres, and use deterministic ordering (sort spec, then entity type + id) so cursors are stable.

#### Scenario: Field search with ancestry
- **WHEN** the endpoint receives `{ "query": "email", "types": ["field"] }` for a Space
- **THEN** each hit includes the field entity plus its parent table and base identifiers and names

#### Scenario: Options matching escapes wildcards
- **WHEN** the query string contains `%` or `_`
- **THEN** the characters are matched literally, not as wildcards

#### Scenario: Identical results across backends
- **WHEN** the same Space schema exists in a D1-backed and a PG-backed Space
- **THEN** the same search configuration returns the same hits in the same order

### Requirement: Parameterized schema reads (additive)
`GET /api/internal/spaces/:spaceId/schema-read` SHALL accept additive query parameters: `entity` (bases|tables|fields|views), `baseId`, `tableId`, `ids` (comma-separated native IDs), `limit`, and `cursor`. When called without parameters it SHALL return the existing whole-Space flat response unchanged (current `apps/web` consumer). Scoped responses SHALL be cursor-paginated with gap/duplicate-safe keyset cursors.

#### Scenario: Backward compatibility
- **WHEN** `schema-read` is called with no query parameters
- **THEN** the response shape matches the pre-change contract consumed by the web Browse tab

#### Scenario: Scoped table listing
- **WHEN** `schema-read?entity=tables&baseId=appX&limit=50` is called
- **THEN** only that base's tables are returned with a `nextCursor` when more exist

### Requirement: Schema hash exposure for caching
Every `schema-read` and `schema-search` response SHALL include the current `schemaHash` per involved base (from `bo_at_schema_versions`), fetched in the same request, so `apps/api` can derive ETags without computing hashes.

#### Scenario: Hash accompanies scoped reads
- **WHEN** `schema-read?entity=fields&tableId=tblX` is called
- **THEN** the response includes the owning base's current `schemaHash`

### Requirement: Schema versions listing
`apps/server` SHALL expose `GET /api/internal/spaces/:spaceId/schema-versions?baseId=` returning that base's captured schema versions from `bo_at_schema_versions` — version id, `schemaHash`, captured-at — newest-first and cursor-paginated. The full `schema_json` payload SHALL NOT be included in listings.

#### Scenario: Versions for a base
- **WHEN** the endpoint is called with a valid `baseId`
- **THEN** versions are returned newest-first without `schema_json` bodies

### Requirement: Changelog filtering (additive)
`GET /api/internal/spaces/:spaceId/schema-changelog` SHALL accept additive filters `baseId`, `entityType`, `changeType`, `breaksData`, `from`, `to`, plus `limit`/`cursor`, returning entries newest-first. Parameterless behavior SHALL remain unchanged for existing consumers.

#### Scenario: Breaking changes in a window
- **WHEN** `schema-changelog?breaksData=true&from=2026-06-01T00:00:00Z` is called
- **THEN** only data-breaking entries on/after that instant are returned, newest-first

### Requirement: Internal gate unchanged
All endpoints in this capability SHALL sit under `/api/internal/*` gated by the `x-internal-token` header and reached by consumers via Cloudflare service bindings. No public route SHALL be added to `apps/server`.

#### Scenario: Missing internal token
- **WHEN** any of these endpoints is called without a valid `x-internal-token`
- **THEN** the request is rejected with 401 before any client-DB access
