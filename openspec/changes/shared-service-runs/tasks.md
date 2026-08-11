# shared-service-runs — Tasks

## 1. Schema (apps/web — canonical)

- [x] 1.1 Add `serviceRuns` table to `apps/web/src/db/schema/core.ts` per design D2 (columns, defaults, `(service, started_at DESC)` + `status` indexes).
- [x] 1.2 Generate migration `apps/web/drizzle/0028_service_runs.sql` (offline drizzle-kit); `db:check`/`db:migrate` on dev is a deploy step (Caveat).

## 2. Writer helper (apps/server)

- [x] 2.1 TDD `src/lib/service-runs.ts`: `SERVICE_IDS` (live + reserved, `counts`-key JSDoc), `withServiceRun`/`openServiceRun`/`finalizeServiceRun` (via an injectable `ServiceRunWriter` seam so orchestration is pure-tested) — 9 tests: success, body-throw (rethrown, failed), open-null (job still runs), finalize-throw (outcome preserved both directions), no-counts, pruneCutoff boundary, numericCounts.
- [x] 2.2 Add `service_runs` to `apps/server/src/db/schema/` mirror (header naming the canonical migration; written only via the helper).

## 3. Cron wiring (apps/server)

- [x] 3.1 The four `runScheduled*` already return result objects; `numericCounts()` extracts their counters (kept their structured log lines).
- [x] 3.2 Wrapped the four dispatch calls in `scheduled()` with `withServiceRun`. **Deviation:** a separate telemetry DB client is created in `scheduled()` (the OAuth jobs own their own client internally; refactoring their DB lifecycle is risky and the second short-lived client is negligible for a 15-min/daily cron) — noted in-code. Per-job-id row coverage is unit-tested via the writer seam.
- [x] 3.3 Added `service-runs-prune` to `KEEPALIVE_CRON` in `lib/cron/dispatch.ts` + `pruneServiceRuns` (90-day DELETE under `withServiceRun`, `counts.deleted`); `pruneCutoff` boundary unit-tested (89d kept / 91d deleted).

## 4. Cleanup-pass instrumentation (apps/server + apps/workflows)

- [x] 4.1 `cleanupPlanHandler` opens a `retention_cleanup` run row and echoes `serviceRunId` (null-tolerant when the insert failed).
- [x] 4.2 `cleanupCompleteHandler` finalizes the echoed `serviceRunId` with `{ deleted, attempted }`; missing/unknown id → no-op (duration computed in SQL from `started_at` since finalize is a different request than open).
- [x] 4.3 `apps/workflows` cleanup task carries `serviceRunId` plan→completion (optional field); also calls `postComplete` when zero runs were planned so an opened row never dangles. Pass-through + zero-plan + skip tests added (workflows cleanup suite 8).

## 5. Admin surface (apps/admin)

- [x] 5.1 Read-only `service_runs` mirror in `apps/admin/src/db/schema/core.ts` + a source-scanning no-write guard test (`service-runs-guard.test.ts`, same shape as the audit append-only guard).
- [x] 5.2 TDD `src/lib/service-runs-view.ts`: `summarizeServiceRuns` (latest / lastSuccess / failure streak / recent durations / staleness per D7 windows), reserved-service labelling, forward-tolerant unknown ids; `SERVICE_DISPLAY` lockstep-copy of the server registry. `recentFailures` too. 6 tests.
- [x] 5.3 Trimmed `service-health.ts` to scheduler + scheduled-runs + session-sweep (cleanup signal moved to real rows); corrected the stale "scheduled() is a stub" header; updated its test (now 3 derived signals).
- [x] 5.4 Reworked `/services.astro`: per-service summary table (live first, reserved labelled), recent-failures list (last 20), derived-signals section labelled derived.
- [x] 5.5 Ranked query: `row_number() OVER (PARTITION BY service ORDER BY started_at DESC) ≤ 50` (one round trip) + a recent-failures query. (Runs against the dev DB on deploy — see Caveat.)

## 6. Verification & docs

- [x] 6.1 typecheck + build + Vitest green: web tsc clean; server tsc 0 + build + service-runs 9; workflows tsc 0 + cleanup 8; admin astro-check 0 + full suite 199.
- [ ] 6.2 **DEFERRED (deploy):** deploy order web→server→workflows→admin to dev; confirm rows appear after the next */15 cron firing (migration `db:migrate` runs on the web deploy).
- [ ] 6.3 **DEFERRED (human smoke):** open deployed admin `/services`; verify live services show real runs, cleanup records hourly, reserved labelled, a forced failure surfaces in recent failures.
- [x] 6.4 Commit with a §3.8 Verification section.
