## 1. Phase 0 — Foundation

- [ ] 1.1 Create `apps/sql-rest-api/` repo with README, Vitest, Drizzle, msw, Wrangler config, PG driver
- [ ] 1.2 Wire GitHub Actions CI (Vitest + OpenAPI-diff check on `/v1/` schemas)
- [ ] 1.3 Provision Cloudflare Workers project (production + staging) with route binding for `sql.baseout.com`
- [ ] 1.4 Consume `@baseout/db-schema` (pinned version)
- [ ] 1.5 Populate Cloudflare Secrets (master DB string, master encryption key, service-to-`server` HMAC, connection-pool credentials for Pro shared PG)

## 2. Phase 1 — Receiver + Auth

- [ ] 2.1 Implement bearer-token auth via `api_tokens` SHA-256 hash lookup (per-Space scope check)
- [ ] 2.2 Implement Pro+ tier-gating via `subscription_items` + `plan_limits`
- [ ] 2.3 Return structured 401 / 402 / 200 responses; never log plaintext bearer

## 3. Phase 2 — Read-Only Enforcement

- [ ] 3.1 Implement query parser that rejects non-SELECT statements (INSERT/UPDATE/DELETE/DDL/GRANT/REVOKE/TRUNCATE etc.)
- [ ] 3.2 Implement parameterization requirement (reject queries with raw concatenated user literals)
- [ ] 3.3 Connect to client DB under the `space_{id}_ro` read-only role provisioned by `server`
- [ ] 3.4 Wire connection pooling for Pro shared PG; per-request connection for Dedicated PG (decrypt per-Space connection string from `space_databases`)
- [ ] 3.5 Lock the read-only-role contract with `server` (their `direct-sql-access` capability also depends on it)

## 4. Phase 3 — Rate Limit + Credit + Response Cap

- [ ] 4.1 Implement per-Space monthly query caps (10K Pro, 50K Business, Unlimited Enterprise)
- [ ] 4.2 Implement period reset on Stripe `invoice.paid` for the Org
- [ ] 4.3 Implement credit consumption (1 credit per 50 queries → `credit_transactions`)
- [ ] 4.4 Implement 10 MB response size cap with cursor-based pagination (`truncated: true` + cursor)
- [ ] 4.5 Implement DB-side `statement_timeout` per tier (Pro 30s, Business 60s, Enterprise 300s)

## 5. Phase 4 — Documentation

- [ ] 5.1 Author OpenAPI 3 spec for `POST /v1/spaces/{space_id}/query`
- [ ] 5.2 Set up `docs.baseout.com` hosting (shared with `inbound-api` docs site)
- [ ] 5.3 Wire CI step: regenerate OpenAPI on every PR; fail if `/v1/` breaks

## 6. Phase 5 — Pre-Launch Hardening

- [ ] 6.1 Run load test for connection-pool exhaustion on shared PG; coordinate sizing with `server`
- [ ] 6.2 Run slow-query DoS test; verify `statement_timeout` cleanly returns 504
- [ ] 6.3 Security review: attempt read-only bypass via stored procedures, function calls, multi-statement queries
- [ ] 6.4 OpenAPI docs review with a sample external integrator
- [ ] 6.5 Configure error-rate alerts (4xx anomaly, 5xx anomaly, 504 anomaly)
- [ ] 6.6 Wire Logpush + tail Workers

## 7. Definition of Done — `sql-rest-api` V1 Launch

- [ ] 7.1 SELECT queries from authenticated Pro+ tokens return rows correctly
- [ ] 7.2 Non-SELECT statements rejected at the parser layer
- [ ] 7.3 Read-only role enforced at the DB layer (defense in depth verified)
- [ ] 7.4 Parameterized-only enforced; raw concatenated literals rejected
- [ ] 7.5 Per-tier rate limits + credit consumption functional
- [ ] 7.6 Response size cap with cursor pagination functional
- [ ] 7.7 v1 OpenAPI spec published at `docs.baseout.com`
- [ ] 7.8 OpenAPI-diff CI check blocks breaking changes on `/v1/`
- [ ] 7.9 Load test passes; no connection-pool starvation
- [ ] 7.10 Security review passed; no read-only bypass found
