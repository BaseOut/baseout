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
- [ ] 4.2 Sqlite view builders (live pivot, plain `CREATE VIEW`) applied at provision + schema-sync; tests over the same fixtures `query-views.ts` uses. — _2026-08-24 correction: previously checked off but NO sqlite view builders exist anywhere in the tree (query-views.ts is PG-matview-only). Un-checked; still to build._

## 5. Secret + runbook (same change)

- [ ] 5.1 Generate `CLOUDFLARE_D1_API_TOKEN` (account-scoped, D1:Edit only). Add to engine `.dev.vars(.example)` + Cloudflare Secrets per env; NEVER web/workflows. _2026-08-24: `.dev.vars.example` block + Env typing (incl. `BASEOUT_ENV`) landed; minting the real token is dashboard work (Autumn/Dan)._
- [x] 5.2 ops-setup.md: token generation/rotation/holder section; cross-ref from this change. — _2026-08-24: §D1 section actually written (earlier check-off predated it)._

## 6. Smoke (dev env)

- [ ] 6.1 Provision a real Space with `backend: 'd1'` → database visible in dashboard → schema-only backup lands → brokered read returns it → deprovision removes it. Log outcome here with date + Space id. _Blocked on 5.1 + live/dev migrate of 0039._
