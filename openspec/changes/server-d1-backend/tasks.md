# server-d1-backend — tasks

TDD per CLAUDE.md §3.4: pure modules get Vitest first; Cloudflare API interactions mocked at the HTTP boundary (msw). Engine integration bits run under the targeted-suite discipline (full-suite DO teardown hang is a known local artifact).

## 1. Pure foundations

- [x] 1.1 `resolveSpaceD1Name(env, spaceId)` → `baseout-{env}-space-{spaceId}`; input + composed-name validation against D1 naming rules; Vitest (mirror `r2-bucket.ts`'s shape).
- [x] 1.2 DDL batch builder: sqlite dialect DDL from `packages/db-schema` space/sqlite rendered into ordered statements + `SPACE_SCHEMA_VERSION` stamp row; parity-guard test that the statement set tracks the schema module (fails on drift).
- [x] 1.3 Locator (de)serialization for the `space_databases` row (`d1_database_id`, `d1_database_name`); tests.

## 2. Master-DB delta

- [x] 2.1 `space_databases` locator columns for d1 (canonical migration in apps/web per repo rules; apps/server mirror updated with header comment naming it). `pnpm --filter @baseout/web db:migrate` applied before any UI/engine smoke. — _column `d1_database_id` already existed; `d1_database_name` added in `0039_d1_database_name.sql`. 2026-08-24 fixes: 0039 was missing from `meta/_journal.json` (would never apply) and `d1DatabaseName` was missing from the canonical `core.ts` + server mirror — all three corrected; `drizzle-kit check` clean. Apply on each env that will provision D1._

## 3. Provision + deprovision arms

- [x] 3.1 `provision-d1.ts`: Cloudflare `POST /d1/database` (treat exists-as-success) → DDL batch via query API → mark `active` + locator; wired into the existing `provisionSpaceDatabase` factory seam; mocked fetch tests incl. already-exists lookup and Cloudflare-error → `error` row. — _2026-08-24: actually wired: `ProvisionBackends.d1` + route supplies the factory when `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_D1_API_TOKEN` are set (else 501); `markActive` splits the d1 locator into `d1_database_id`/`d1_database_name`. Earlier check-off predated the wiring._
- [x] 3.2 Deprovision arm: `DELETE /d1/database/{uuid}` idempotent (404 = success) → row delete; tests. — _2026-08-24: wired: `DeprovisionDeps.deleteD1` injected by the route under the same env gate; d1 rows tear down by database UUID._

## 4. Query path

- [x] 4.1 D1 HTTP query executor behind the `per-space/resolve.ts` seam (same interface as the pg executor); mocked fetch tests for query + error mapping. _Brokered page routes still 501 on non-`managed_pg` until they dispatch on `createSpaceD1Executor` — follow-up, not a provision blocker._
- [x] 4.2 Sqlite view builders (live pivot, plain `CREATE VIEW`) applied at provision + schema-sync; tests over the same fixtures `query-views.ts` uses. — _2026-08-24 correction: previously checked off but NO sqlite view builders existed. 2026-08-25: pure builders landed (`per-space/query-views-sqlite.ts`), then APPLICATION shipped via `server-d1-data-plane` (commit 9b1b9bcd): schema-sync's d1 arm calls `regenerateQueryViewsD1` best-effort when records are enabled (space-db-d1.ts `regenerateQueryViews` — name planning, stale-view drops, per-table rebuild, same contract as the pg arm), and the 4.1 brokered-read dispatch shipped in the same change (schema-read d1 arm → `readAllEntities`/`schemaHashesFor`). Provision-side application is n/a by design — a fresh provision has no tables to pivot; the first schema-sync builds the views. Tests: `space-db-d1.test.ts` + `query-views-sqlite.test.ts` on real D1 (miniflare), 23/23 green 2026-08-25._

## 5. Secret + runbook (same change)

- [ ] 5.1 Generate `CLOUDFLARE_D1_API_TOKEN` (account-scoped, D1:Edit only). Add to engine `.dev.vars(.example)` + Cloudflare Secrets per env; NEVER web/workflows. _2026-08-24: `.dev.vars.example` block + Env typing (incl. `BASEOUT_ENV`) landed; minting the DURABLE token is dashboard work (Autumn blocked on role — Dan). 2026-08-25: NOT a smoke blocker anymore — wrangler's OAuth bearer (from `~/Library/Preferences/.wrangler/config/default.toml`, ~1h TTL, refresh with `wrangler whoami`) is accepted by the D1 REST API and was passed to a LOCAL engine via `wrangler dev --var CLOUDFLARE_D1_API_TOKEN:<bearer>` for the 6.1 smoke. Deployed envs still need the durable token._
- [x] 5.2 ops-setup.md: token generation/rotation/holder section; cross-ref from this change. — _2026-08-24: §D1 section actually written (earlier check-off predated it)._

## 6. Smoke (dev env)

- [x] 6.1 Provision a real Space with `backend: 'd1'` → database visible in dashboard → schema-only backup lands → brokered read returns it → deprovision removes it. Log outcome here with date + Space id. — _**GREEN 2026-08-25**, Space `03c01553-ba6f-4719-826d-d2f8aa4349f5` (openside), local engine (`wrangler dev --env dev`) + OAuth-bearer creds via `--var` (see 5.1 note), driven by `scripts/smoke-d1.mjs`: provision created real D1 `baseout-dev-space-03c01553…` (uuid `101bffdd-9a0e-4f66-8923-2ac66f497224`) → schema-sync 200 (schemaChanged, lifecycle 4) → schema-read round-tripped 1 base/1 table/2 fields → deprovision removed it (verified: `wrangler d1 list` clean + `space_databases` row gone). **Dev-DB 0039 trap fixed en route:** dev's `__drizzle_migrations` held a stray row with `created_at=1787146773380` > 0039's hand-backdated journal `when=1787000000000`, so `db:migrate` skipped 0039 silently forever ("migrations applied successfully" with nothing applied). Fixed by applying 0039's SQL manually (`ADD COLUMN IF NOT EXISTS`) + inserting its tracking row — do NOT bump the journal `when` (live DB already applied 0039; a bump would re-run it there)._
