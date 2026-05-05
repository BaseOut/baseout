## Context

`baseout-sql-rest-api` is the public read-only SQL endpoint. A thin Cloudflare Workers project that authenticates per-Space tokens, parses each query for read-only safety, executes against the Space's client DB under a read-only role, debits credits, and returns rows. It does not own DB provisioning (`baseout-backup`), token CRUD (`baseout-web`), or any UI.

Stakeholders: external developers (BI/dashboard tools, scripts), `baseout-backup` team (provisions read-only roles, owns client DB lifecycle), product (versioning + rate-limit policy), revenue.

Constraints carried in from product:
- **Pro+ only.** Tier-gated.
- **Read-only at two layers** — enforced by both the DB role and query parsing.
- **URL-versioned, v1 never breaks.**
- **Structurally symmetric to `baseout-inbound-api`** — same `api_tokens` table, same OpenAPI publishing pattern, similar credit-consumption semantics. Sharing this design language across the two public APIs reduces customer learning curve.

## Goals / Non-Goals

**Goals:**
- A SELECT query from an authenticated Pro+ token returns rows in <1 second p95 for queries that complete within DB-side timeouts.
- Read-only enforcement is bulletproof — no INSERT/UPDATE/DELETE/DDL ever reaches the DB even if the parser is bypassed (the DB role enforces it).
- Parameterization is the only allowed shape for user-supplied values; raw concatenated literals are rejected before DB execution.
- Rate limit + credit accounting matches `baseout-inbound-api`'s patterns for consistency.

**Non-Goals:**
- Write operations of any kind.
- Direct PG connection-string surfacing (that's `baseout-backup`'s `direct-sql-access` capability for Business+).
- Token CRUD (`baseout-web`).
- Read-only role provisioning (`baseout-backup`).
- Per-query result caching (V2 if needed).

## Decisions

### Custom Worker (vs. PostgREST)
Custom Worker on `sql.baseout.com`, not PostgREST. Reason: better control over query parsing for read-only enforcement, rate limiting, credit consumption, and connection pooling. PostgREST adds operational complexity and a less-friendly auth/rate-limit story. Resolved.

### Standalone repo (vs. living in `baseout-backup`)
Public versioned API; `/v1/` MUST never break. Structural twin of `baseout-inbound-api`. Splitting it out lets it ship on its own deploy schedule. Trade: shares connection-pool sizing concerns with `baseout-backup` (both connect to the same Pro shared PG instance) — coordinate via shared infrastructure docs and pool config.

### Two-layer read-only enforcement
Layer 1: `baseout-backup` provisions a `space_{id}_ro` role with SELECT-only privileges on the Space's client DB. The SQL REST API connects under this role.
Layer 2: this repo parses incoming queries and rejects any non-SELECT statement (case-insensitive match on `INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|GRANT|REVOKE|TRUNCATE|...`) BEFORE issuing to the DB.
Reason: defense in depth. A parser bug doesn't expose write paths because the role can't write. A role-config bug doesn't expose write paths because the parser refuses.

### Parameterized-only
All user-supplied values must use the `params` array, like `{ query: "SELECT * FROM foo WHERE id = $1", params: [42] }`. The parser rejects queries that appear to embed unparameterized literals where parameterization is the safe path. Reason: prevents SQL injection at the API layer; aligns with PG protocol's parameter binding.

### 10 MB response cap with cursor pagination
Default 10 MB per response, configurable by tier. On overflow, return the first chunk plus a structured cursor and `truncated: true`. Reason: protect Workers memory + bandwidth; provide a clean way for clients to paginate large reads.

### Credit consumption: 1 per 50 queries
Bucketed counter — 50 queries debits 1 credit. Reason: cheap-by-design to encourage iteration; aligns with `baseout-inbound-api`'s 1-per-100-calls pattern.

### Connection pool shared with `baseout-backup` for shared PG
For Pro tier (shared PG), both `baseout-sql-rest-api` and `baseout-backup` connect to the same DigitalOcean PG cluster. Pool sizing must be coordinated. For Dedicated PG (Business+), each Space has its own DB; this repo connects directly per request via the per-Space connection string from `space_databases` (decrypted on-demand).

## Risks / Trade-offs

- **[Risk] Connection pool exhaustion on shared PG** → Coordinate sizing with `baseout-backup`; cap concurrent SQL REST connections per Org; load test before launch.
- **[Risk] Slow query DoS** → DB-side `statement_timeout` enforced (default 30s) for the read-only role; queries exceeding return 504 with a clear error.
- **[Risk] Read-only enforcement bypass via stored procedure / `pg_proc` trickery** → Read-only role doesn't have EXECUTE on functions that write; mitigation reviewed during security audit.
- **[Risk] Token leak** → Same logging policy as `baseout-inbound-api`: never log plaintext bearer.
- **[Trade-off] Shared `api_tokens` table with `baseout-inbound-api`** → A token created for Inbound API is also valid for SQL REST. Could be confusing. V1 accepts this — both consume the same shared scope. V2 may add per-API token scope flags if confusion shows up.

## Migration Plan

### Build sequence

1. **Phase 0 — Foundation**: `apps/sql-rest-api/` repo, CI/CD, Cloudflare Workers project per env, secrets, `@baseout/db-schema` consumption.
2. **Phase 1 — Receiver + Auth**: route binding for `sql.baseout.com`, bearer-token auth via `api_tokens`.
3. **Phase 2 — Read-Only Enforcement**: query parser (rejects non-SELECT), read-only role connection (depends on `baseout-backup` Phase 5 read-only role provisioning), parameterization requirement.
4. **Phase 3 — Rate Limit + Credit + Response Cap**: per-Space monthly query caps (10K Pro, 50K Business, Unlimited Enterprise), 1-credit-per-50 debit, 10 MB response size cap with cursor pagination.
5. **Phase 4 — Documentation**: OpenAPI 3 spec; deploy at `docs.baseout.com`.
6. **Phase 5 — Hardening**: load test (connection-pool exhaustion, slow query DoS), security review (read-only enforcement bypass attempts), OpenAPI docs review.

### Rollback strategy
- Public DNS rollback: `sql.baseout.com` cutover via Cloudflare DNS in seconds.
- v1 contract: any change must be additive; OpenAPI-diff CI check.

## Open Questions

| # | Question | Default Answer |
|---|---|---|
| Q1 | Workers PG driver | `postgres` (npm) with Hyperdrive on Cloudflare; validate connection-pool behavior in load test. |
| Q2 | Per-tier `statement_timeout` | Pro 30s, Business 60s, Enterprise 300s; revisit based on customer reports. |
| Q3 | Per-API token scopes | V1: shared `api_tokens` for both Inbound + SQL REST. V2: add per-API scope if customer confusion materializes. |
