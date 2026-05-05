## Why

The SQL REST API (`https://sql.baseout.com/v1/spaces/{space_id}/query`) is a public, token-authorized, read-only programmatic API that lets Pro+ customers run SELECT queries against their dynamic client DB. It needs its own URL-versioned contract that NEVER breaks v1, its own deploy and version cadence (independent of UI iteration in `baseout-web` or data-plane changes in `baseout-backup`), and structural symmetry with `baseout-inbound-api` (also a public versioned API gated by `api_tokens` and credits). None of it exists yet. This change splits the SQL REST API out of `baseout-backup` into its own runtime repo `baseout-sql-rest-api`.

## What Changes

- Establish `baseout-sql-rest-api` as a standalone Cloudflare Workers project at `apps/sql-rest-api/`, deployed independently of every other Baseout repo.
- Public hostname `sql.baseout.com` with URL-versioned paths under `/v1/spaces/{space_id}/query`.
- Bearer-token authentication using `api_tokens` (per-Space scope), same shared table that `baseout-inbound-api` uses.
- Read-only enforcement at two layers: (a) execute under a read-only PG role provisioned by `baseout-backup` on the Space's client DB, and (b) parse the query and reject any non-SELECT (INSERT/UPDATE/DELETE/DDL).
- Reject queries that contain raw user-supplied literals where parameterization is required; require all user-supplied values to use the `params` array.
- Tier-based monthly query caps (10K Pro, 50K Business, Unlimited Enterprise) per Space.
- Credit consumption: 1 credit per 50 queries debited via `credit_transactions`.
- Response size cap (default 10 MB); structured cursor pagination on truncation.
- OpenAPI 3 specification hosted at `docs.baseout.com`.

## Capabilities

### New Capabilities

- `sql-rest-api`: Public versioned read-only SQL API at `sql.baseout.com/v1/spaces/{space_id}/query` with Bearer-token auth, parameterized-query requirement, two-layer read-only enforcement (read-only DB role + query parsing), tier-based monthly query caps, 1-credit-per-50-queries consumption, 10 MB response cap with cursor pagination, and OpenAPI 3 documentation at `docs.baseout.com`.

### Modified Capabilities

None — this is the initial `baseout-sql-rest-api` implementation.

## Impact

- **New repo**: `apps/sql-rest-api/` — Cloudflare Workers project for the public SQL REST API.
- **Consumed packages**: `@baseout/db-schema` (for `api_tokens`, `space_databases`, `credit_buckets`, `credit_transactions`).
- **External dependencies**: Cloudflare Workers, DigitalOcean PostgreSQL (master DB + Pro shared PG client DB connection), Neon/Supabase (Dedicated PG client DBs), pg / postgres-js (or compatible Workers-friendly driver).
- **Cross-repo contracts**:
  - With `baseout-web`: shares `api_tokens`; never invokes `baseout-web`.
  - With `baseout-backup`: depends on read-only DB roles that `baseout-backup` provisions on each Space's client DB during DB provisioning. Shares the connection-pool concerns on Pro shared PG (coordinate pool sizing).
- **Master DB access**: reads `api_tokens`, `space_databases` (to look up the Space's client DB connection details), `subscription_items` + `plan_limits` (tier-gating), `organization_billing_settings`. Writes `credit_transactions`.
- **Client DB access**: SELECT-only via the read-only PG role provisioned by `baseout-backup`. NEVER opens an admin connection.
- **Secrets**: master DB connection string, master encryption key (decrypt `space_databases` connection string), connection-pool credentials (read-only role), service-to-`baseout-backup` HMAC (for any internal coordination if needed).
- **Operational**: `wrangler.jsonc` per environment with one route binding (`sql.baseout.com`), Logpush + tail Workers, on-call alert routing for elevated 4xx/5xx rates, OpenAPI docs deploy pipeline.
- **Public contract stability**: URL-versioned (`/v1/`); v1 SHALL NEVER break. Breaking changes ship as `/v2/`.
