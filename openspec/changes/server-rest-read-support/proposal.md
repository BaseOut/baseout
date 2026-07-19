## Why

The public read REST API (`openspec/changes/api-rest-read/`) serves schema resources — listings, drill-down, changelog, versions, and search — but `apps/api` never touches per-Space client DBs; only `apps/server` holds the `bo_at_*` dispatch logic across backends (D1 / managed PG / BYODB). Today's internal endpoints (`schema-read`, `schema-changelog`) were built for the web Browse tab: whole-Space flat dumps, no entity scoping, no pagination, no search. This change extends `apps/server`'s internal surface to be an adequate upstream for the public API. It is the paired single-app follow-up to `api-rest-read` per the CLAUDE.md §3.6 pairing convention.

## What Changes

- **New internal endpoint** `POST /api/internal/spaces/:spaceId/schema-search`: executes the structured search contract (query, types, match mode/fields, filters, sort, cursor) against `bo_at_bases/tables/fields/views` with normalized `LIKE`-based matching identical across D1 and PG; returns heterogeneous hits with full ancestry.
- **Parameterized schema reads** (additive query params on `GET /api/internal/spaces/:spaceId/schema-read`): entity scoping (`baseId`, `tableId`, `ids`), entity-type selection, cursor pagination, and per-base `schemaHash` in every response (feeds the public API's ETag).
- **New internal endpoint** `GET /api/internal/spaces/:spaceId/schema-versions?baseId=`: captured versions from `bo_at_schema_versions` (id, `schema_hash`, captured-at), paginated.
- **Changelog filters** (additive on `schema-changelog`): `baseId`, `entityType`, `changeType`, `breaksData`, `from`/`to`, cursor pagination.
- All endpoints stay under the existing `/api/internal/*` gate (`x-internal-token`), reached via service binding; no public surface is added to `apps/server`.
- Not in scope: FTS/relevance ranking, record-data search, any `apps/api` code (lives in `api-rest-read`), UI changes.

## Capabilities

### New Capabilities

- `internal-schema-read`: The internal schema read/search contract `apps/server` provides to `apps/api` — search execution, scoped + paginated reads, versions listing, changelog filtering, and schema-hash exposure.

### Modified Capabilities

None in `openspec/specs/`. The existing `schema-read`/`schema-changelog` behavior consumed by `apps/web` is unchanged — all parameters are additive; parameterless calls return today's shapes.

## Impact

- **`apps/server`**: new route handlers under `src/pages/api/internal/spaces/`, shared query helpers over the per-Space DB dispatch layer (must behave identically on D1 SQLite and managed PG), cursor utilities.
- **Consumers**: `apps/api` (primary, via service binding + `x-internal-token`); `apps/web`'s existing Browse calls unaffected.
- **Cross-repo contract**: request/response shapes here are the upstream of `api-rest-read`'s schema requirements — if one side changes, both changes' specs must be updated together.
- **No DB schema changes**: reads only, against existing `bo_at_*` tables.
