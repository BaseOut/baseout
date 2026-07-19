## Context

`apps/server` owns all per-Space client-DB access (`bo_at_*` tables) behind `/api/internal/*` (`x-internal-token`). The public read API (`api-rest-read`) needs entity-scoped, paginated, searchable schema reads; existing internal endpoints return whole-Space flat lists sized for the web Browse tab. Per-Space backends vary: D1 SQLite, managed Postgres, future BYODB — one contract must behave identically on all.

## Goals / Non-Goals

**Goals**

- Internal contract sufficient for every schema requirement in `api-rest-read` (listings, drill-down, expand, ETag, changelog, versions, search) without over-fetching.
- Zero behavior change for `apps/web`'s existing parameterless calls.
- Identical semantics across D1 and PG.

**Non-Goals**

- FTS/relevance ranking, record-content search, public exposure, caching inside `server` (the public API's ETag/304 handles repeat polls).

## Decisions

### D1. Extend `schema-read` additively rather than adding parallel entity endpoints

`schema-read?entity=tables&baseId=appX&cursor=…` style parameters on the existing endpoint, defaulting to today's full flat response when absent.

- One dispatch path into the per-Space DB layer; `web` keeps working untouched.
- *Alternative rejected*: separate `bases`/`tables`/`fields` internal endpoints — five routes duplicating the same connection/dispatch boilerplate for no contract benefit at a service-to-service boundary.

### D2. Search executes in `server`, spec'd as a normalized contract

`schema-search` receives the already-Zod-validated config from `apps/api` (api owns public validation; server re-validates defensively). Matching is case-insensitive `LIKE` over name/description and JSON `options` text for select-choice matching, with explicit `ESCAPE` handling of `%`/`_` in user input. Ancestry (base for tables/views; base+table for fields) is joined in-query, not post-fetched.

- `LIKE` (not FTS) because it is the highest capability guaranteed identical on D1 SQLite and PG; per-Space schema volume is thousands of rows. FTS/relevance later is an internal upgrade — contract already reserves `match.mode` extension.
- Deterministic ordering: sort spec then `(entity_type, entity_id)` tie-break, so cursors are stable.

### D3. Cursor pagination shared with the public API's semantics

Opaque keyset cursors (same utility approach as `api-rest-read` D5): base64 of the last row's sort key + id. No offsets — `bo_at_records`-scale tables never hit this path, but schema tables on large Spaces still deserve gap/duplicate-safe paging.

### D4. `schemaHash` on every read response

Each response includes per-base `schemaHash` (current row from `bo_at_schema_versions`), fetched in the same round-trip. This is the sole source for the public API's ETag — `apps/api` never computes hashes itself.

### D5. Auth stays `x-internal-token` + service binding

Same gate as every other internal route; the inbound change's HMAC service-token pattern can supersede later, uniformly, as its own change. Nothing here widens the public surface of `server`.

## Risks / Trade-offs

- [Contract drift between this internal API and `api-rest-read`'s public shapes] → shared fixture tests: the `api-rest-read` integration suite runs against these endpoints' recorded shapes; both changes' specs cross-reference each other and must be edited together.
- [JSON `options` LIKE matching differs subtly between SQLite and PG text casting] → normalize by matching against a derived plain-text options string built in the query helper, covered by dual-backend tests.
- [Large `expand=fields` responses for wide bases] → internal responses are paginated too; `apps/api` assembles pages rather than requesting unbounded payloads.

## Migration Plan

Additive routes/params only; deploy `server` before `apps/api` starts calling (enforced by change sequencing). Rollback = remove routes; `web` unaffected throughout.

## Open Questions

- Whether `schema-read` should also serve views to the public API in v1 (`api-rest-read` searches views but does not list them publicly yet) — contract includes views; public exposure is an `api-rest-read` decision.
- Dual-backend test rig: is a Miniflare D1 + Docker PG matrix already available from existing server tests, or does this change stand it up?
