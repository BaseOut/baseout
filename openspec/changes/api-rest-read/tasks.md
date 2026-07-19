## 1. Foundations

- [ ] 1.1 Add `api_tokens` table to `packages/db-schema` (org-owned, nullable `space_id`, scopes, `token_prefix`, `token_hash`, `is_active`, `expires_at`, `last_used_at`) + migration; document plaintext-once + SHA-256 hashing helper in `@baseout/shared`
- [ ] 1.2 Stand up `apps/api` Worker skeleton: router, env typing, `wrangler.jsonc` with master-DB access (Hyperdrive), `server` service binding, Analytics Engine dataset binding, Rate Limiting binding, per-request DB client teardown
- [ ] 1.3 Build the operation registry (method, path template, scope, Zod request/response schemas, handler) and generate the router from it
- [ ] 1.4 Auth middleware: Bearer parse → hash lookup → active/expiry checks → grant context (org, optional space, scopes); async `last_used_at` update; 401/403/404 semantics per spec (tests first)

## 2. Conventions Layer

- [ ] 2.1 Response helpers: list envelope `{ data, pagination }`, error objects with `type/code/message/param/requestId`, `X-Request-Id` on every response
- [ ] 2.2 Cursor pagination utility (opaque keyset cursors, limit 1–100 default 50) with gap/duplicate-safety tests
- [ ] 2.3 Usage metering middleware: AE `writeDataPoint` per request via `ctx.waitUntil` (token/org/space/platform/route-template/method/status/surface/duration); failure-isolated
- [ ] 2.4 Shadow rate limiting: evaluate binding keyed by token id, `RATE_LIMIT_ENFORCE` flag, `X-RateLimit-*` headers, 429 path behind the flag (tests for both modes)

## 3. Org, Space, and Backup Endpoints (master DB)

- [ ] 3.1 `GET /v1/orgs/{orgId}`, `/spaces`, `/spaces/{spaceId}`, `/spaces/{spaceId}/platforms`
- [ ] 3.2 `GET .../backups/runs` with `status`/`kind`/`from`/`to`/`baseId` filters, excluding soft-deleted runs
- [ ] 3.3 `GET .../backups/runs/{runId}` with per-base (`backup_run_bases`) and per-table (`backup_run_tables`) breakdown
- [ ] 3.4 `GET .../backups/configuration`, `.../backups/retention`, `.../backups/status` (rollup: last run, next scheduled, 30-day success rate, consecutive failures)

## 4. Schema Endpoints (via server boundary)

- [ ] 4.1 Server client in `apps/api`: HMAC service-token calls over the service binding, timeout → 502 `upstream_unavailable`
- [ ] 4.2 File paired change `server-rest-read-support`: internal `schema-search` endpoint + any shaping needed on `schema-read`/`schema-changelog` responses (cross-reference this change in its proposal)
- [ ] 4.3 Schema listing + drill-down + flat fetch-by-ID routes under `/{platform}/schema/` (code validation → 404 `platform_not_found`), `?expand=` and `?fields=` support
- [ ] 4.4 `GET .../schema/changes` (filters: baseId, entityType, changeType, breaksData, from/to) and `GET .../schema/versions?baseId=`
- [ ] 4.5 `POST .../schema/search` (Zod body per spec, heterogeneous hits with ancestry) + `GET .../schema/search?q=` convenience mapping
- [ ] 4.6 ETag/304 on schema responses derived from `schema_hash`

## 5. Docs, Verification, Ops

- [ ] 5.1 OpenAPI 3 generation from the operation registry (`scripts/generate-openapi.ts`) and publish pipeline to `docs.baseout.com`
- [ ] 5.2 Integration tests: real local PG + Miniflare bindings, msw at the server-boundary HTTP edge; cover auth matrix (org mismatch, space mismatch, missing scope, expired token) and pagination walks
- [ ] 5.3 Wrangler envs (staging/production), Logpush + 4xx/5xx alerting, deploy runbook note
- [ ] 5.4 Resolve open questions with product owner: shadow-limit numbers / abuse ceiling stance, docs hosting, usage summary on org endpoint; reconcile the inbound change's one-token-per-Space wording
