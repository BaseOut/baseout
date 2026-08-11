## 1. Foundations

- [x] 1.1 Add `api_tokens` table + migration; document plaintext-once + SHA-256 hashing helper in `@baseout/shared`. → canonical table in `apps/web/src/db/schema/core.ts` (frontend owns master migrations — reconciles the "packages/db-schema" wording) + `0027_api_tokens.sql`; `@baseout/shared/api-tokens` (hash/mint/parse) wired + tested (7). Committed 0ed647d.
- [x] 1.2 Stand up `apps/api` Worker skeleton: router, env typing, `wrangler.jsonc` (SERVER service binding, Analytics Engine dataset, Rate Limiting binding, vars), per-request DB client teardown. → `src/env.d.ts`, `src/db/{schema,client}.ts` (read-only master mirror + per-request postgres-js), `wrangler.jsonc` bindings. **Hyperdrive binding + `api.baseout.com` route are commented pending provisioning (task 5.3).**
- [x] 1.3 Build the operation registry (method, path template, scope, Zod schemas, handler) and generate the router from it. → `src/lib/registry.ts` (registry + `{param}`-template router, method/path match, pathExists for 404-vs-405); `src/operations/index.ts` assembles 19 ops.
- [x] 1.4 Auth middleware: Bearer parse → hash lookup → active/expiry → grant context; async `last_used_at`; 401/403/404 semantics (tests first). → `src/lib/auth.ts` (pure `isTokenUsable`/`authorizeGrant` + IO `authenticate`/`touchLastUsed`); tenant-safe 404s unit-tested.

## 2. Conventions Layer

- [x] 2.1 Response helpers: list envelope `{ data, pagination }`, error `{ type/code/message/param/requestId }`, `X-Request-Id` on every response. → `src/lib/{responses,errors}.ts`.
- [x] 2.2 Cursor pagination utility (opaque keyset, limit 1–100 default 50) with gap/duplicate-safety tests. → `src/lib/pagination.ts` + unit tests (`invalid_limit`/`invalid_cursor`, paginate slice/cursor).
- [x] 2.3 Usage metering: AE `writeDataPoint` per request (token/org/space/platform/route-template/method/status/surface/duration); failure-isolated. → `src/lib/metering.ts`, called from the pipeline incl. 401/404. **No-op until the AE dataset is provisioned (5.3); write is verified deployed.**
- [x] 2.4 Shadow rate limiting: evaluate binding keyed by token id, `RATE_LIMIT_ENFORCE` flag, `X-RateLimit-*` headers, 429 behind the flag (tests both modes). → `src/lib/ratelimit.ts` (pure `rateDecision` tested for shadow + enforce). **Live limiting needs the beta binding provisioned (5.3); numbers pending product owner (5.4).**

## 3. Org, Space, and Backup Endpoints (master DB)

- [x] 3.1 `GET /v1/orgs/{orgId}`, `/spaces`, `/spaces/{spaceId}`, `/spaces/{spaceId}/platforms`. → `src/operations/orgs.ts` (batched platform-codes + base counts; org profile `plan` exposed as an additive null pending capability-resolution wiring).
- [x] 3.2 `GET .../backups/runs` with `status`/`kind`/`from`/`to`/`baseId` filters, soft-deleted excluded. → `src/operations/backups.ts` (keyset on created_at,id).
- [x] 3.3 `GET .../backups/runs/{runId}` with per-base + per-table breakdown (`backup_run_bases` → `backup_run_tables` via run_base_id). → done.
- [x] 3.4 `GET .../backups/configuration` / `retention` / `status` rollup (last run, next scheduled, 30-day success rate, consecutive failures). → done.

## 4. Schema Endpoints (via server boundary)

- [x] 4.1 Server client: calls over the SERVER service binding + `x-internal-token`, timeout → 502 `upstream_unavailable`. → `src/lib/server-client.ts` (design's HMAC token → matched to the deployed `x-internal-token` gate; note in env.d.ts).
- [x] 4.2 Paired change `server-rest-read-support` — DONE (B.1, committed 52226de); this change consumes its exact response shapes.
- [x] 4.3 Schema listing + drill-down + flat fetch-by-ID under `/{platform}/schema/` (code → 404 `platform_not_found`), `?expand=fields`. → `src/operations/schema.ts`. (`?fields=` sparse-select deferred as an additive follow-up; `expand` shipped.)
- [x] 4.4 `GET .../schema/changes` (baseId/entityType/changeType/breaksData/from/to filters) + `GET .../schema/versions?baseId=`. → proxied to B.1 endpoints.
- [x] 4.5 `POST .../schema/search` (forwards to B.1 `schema-search`, maps its 400 `{param}` to the public envelope) + `GET .../schema/search?q=` convenience. → done.
- [x] 4.6 ETag/304 on schema responses derived from `schema_hash`. → weak ETag over involved bases' `schemaHashByBase`; `If-None-Match` → 304.

## 5. Docs, Verification, Ops

- [x] 5.1 OpenAPI 3 generation from the registry (`scripts/generate-openapi.ts`). → `src/lib/openapi.ts` + script; emits all 19 ops under bearer security + the Error schema (test-asserted). **Publish pipeline to `docs.baseout.com` DEFERRED — hosting mechanics are an open question (5.4).**
- [~] 5.2 Tests. → **Pure unit tests done** (23: auth matrix, pagination, router, OpenAPI, rate decision). **Real-PG + Miniflare + msw integration suite DEFERRED**; end-to-end is covered by the deployed/local smoke (`openspec/changes/api-rest-read/smoke.mjs`) pending the bindings.
- [ ] 5.3 **DEFERRED (deploy/provisioning-blocked):** Hyperdrive + AE dataset + Rate-Limit binding provisioning, `api.baseout.com` route, staging/production wrangler envs, Logpush + 4xx/5xx alerting, deploy runbook. Config placeholders + comments are in `wrangler.jsonc`.
- [ ] 5.4 **DEFERRED (product-owner decisions):** shadow-limit numbers / abuse-ceiling stance, `docs.baseout.com` hosting, usage-summary-on-org, reconcile the inbound change's one-token-per-Space wording.
