# shared-service-runs — Tasks

## 1. Schema (apps/web — canonical)

- [ ] 1.1 Add `serviceRuns` table to `apps/web/src/db/schema/core.ts` per design D2 (columns, defaults, `(service, started_at DESC)` + `status` indexes)
- [ ] 1.2 Generate migration `apps/web/drizzle/00XX_service_runs.sql`; run `db:check`; apply to dev DB with `db:migrate`

## 2. Writer helper (apps/server)

- [ ] 2.1 TDD `src/lib/service-runs.ts`: `SERVICE_IDS` registry (live + reserved, JSDoc'ing each service's `counts` keys), `withServiceRun()`, `openServiceRun()`, `finalizeServiceRun()` — tests cover success, body-throw (rethrown, row `failed`), insert-throw (job still runs, logged), finalize-throw (original outcome preserved)
- [ ] 2.2 Add `service_runs` to `apps/server/src/db/schema/` mirror (header comment naming canonical web migration; INSERT/UPDATE via helper only)

## 3. Cron wiring (apps/server)

- [ ] 3.1 Reshape the four `runScheduled*` entry points to return their pass counters (keep existing structured log lines)
- [ ] 3.2 Wrap the four dispatch calls in `scheduled()` with `withServiceRun` using the per-invocation master DB client; test each job id produces exactly one row
- [ ] 3.3 Add `service-runs-prune` to the `KEEPALIVE_CRON` list in `lib/cron/dispatch.ts` + implement the 90-day DELETE under `withServiceRun`; boundary test (89d kept / 91d deleted; `counts.deleted` recorded)

## 4. Cleanup-pass instrumentation (apps/server + apps/workflows)

- [ ] 4.1 `cleanupPlanHandler`: open `retention_cleanup` run row; include `serviceRunId` in plan response (null-tolerant when insert failed)
- [ ] 4.2 `cleanupCompleteHandler`: finalize the echoed `serviceRunId` with pass counters; ignore missing/unknown id (test deploy-skew tolerance both directions)
- [ ] 4.3 `apps/workflows` cleanup task: carry `serviceRunId` from plan to completion payload (optional field on the shared payload type); pass-through test

## 5. Admin surface (apps/admin)

- [ ] 5.1 Add read-only `service_runs` mirror to `apps/admin/src/db/schema/core.ts`; extend the write-surface guard test to cover it
- [ ] 5.2 TDD `src/lib/service-runs-view.ts`: `summarizeServiceRuns()` (latest run, last success, failure streak, recent durations, staleness per design D7 windows), reserved-service labeling, forward-tolerant unknown ids; duplicate registry display map with lockstep-copy header comment
- [ ] 5.3 Trim `src/lib/service-health.ts` to scheduler + session-sweep derived signals only and correct the stale "scheduled() is a stub" header comment; update its tests
- [ ] 5.4 Rework `/services.astro`: per-service summary table (live first, reserved labeled), recent-failures list (last 20), derived-signals section labeled as derived
- [ ] 5.5 Ranked query for newest 50 rows per service + recent failures (single round trip each); verify against dev DB

## 6. Verification & docs

- [ ] 6.1 `pnpm typecheck` + `pnpm build` + full Vitest suites green in web/server/workflows/admin
- [ ] 6.2 Deploy order per design migration plan (web migration → server → workflows → admin) to dev; confirm rows appear after the next */15 cron firing
- [ ] 6.3 Human smoke: open deployed admin `/services`; verify four live services show real runs, cleanup pass records hourly, reserved services labeled, and a forced job failure surfaces in recent failures
- [ ] 6.4 Commit with §3.8 Verification section (Demo: admin /services after a cron firing; Test: the four suites; Caveats: cron timing on dev)
