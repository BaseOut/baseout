# shared-service-runs — Design

## Context

Background execution is split across three mechanisms today:

1. **Worker cron dispatch** (`apps/server/src/index.ts` `scheduled()` → `lib/cron/dispatch.ts`, shipped by `server-oauth-refresh-cron-health`): `*/15 * * * *` fires `oauth-refresh-sweep` + `run-reconciliation`; `0 13 * * *` fires `oauth-keepalive` + `connection-auto-invalidate`. Each job logs a structured summary line and vanishes — logs are the only record.
2. **Trigger.dev schedule**: hourly `cleanup-expired-snapshots` task (`apps/workflows`) calls the engine's `/api/internal/cleanup-plan`, deletes storage, then posts `/api/internal/cleanup-complete`. Its only DB footprint is `backup_runs.deleted_at`.
3. **Durable Object alarms**: SpaceDO backup scheduling (per-space, writes `backup_runs` rows with `triggered_by='scheduled'`). Not in scope as a writer (see Non-Goals).

Admin's `/services` page (`apps/admin/src/lib/service-health.ts`) derives health from side-effects of (2) and (3) and from stale `connection_sessions` — it predates the cron dispatch and its header comment still claims `scheduled()` is a stub. Staff cannot see whether the four live cron jobs ran, succeeded, or how long they took.

Constraints: web owns all master-DB migrations; workflows has no DB access (engine-mediated only); admin mirrors are read-only, selected columns, no FKs; workerd requires per-request postgres-js clients; instrumentation must never change job behavior.

## Goals / Non-Goals

**Goals:**
- One queryable row per background-service execution, written at start and finalized at end.
- All four live cron jobs + the Trigger.dev cleanup pass instrumented; contract binding on future jobs.
- Admin `/services` shows real run history; remaining derived signals stay and stay labeled.
- The log is self-pruning (90 days).

**Non-Goals:**
- Instrumenting SpaceDO backup-scheduler alarms (per-space, high-cardinality; scheduler health remains derived from `next_scheduled_at` drift + `backup_runs`, which is already a real signal for it).
- Alerting/paging on failures (admin page visibility only; `admin-operations-overview` adds dashboard tiles reading the same table).
- Retry semantics, run-attempt hierarchies, or per-item detail rows — `counts` jsonb covers per-pass counters.
- A generic metrics/observability pipeline (Logpush etc. stays deferred in the `admin` umbrella).

## Decisions

### D1: Single row updated on finalize (not intent/result row pairs)
`admin_audit_log` uses two rows for tamper-evidence; that is an audit concern. `service_runs` is operational telemetry — the natural query is "latest run per service", which a single-row lifecycle answers with one `DISTINCT ON (service)` query. A dangling `started` row is itself the crash signal. Alternative (append two rows) rejected: doubles row count and pushes pairing logic into every reader.

### D2: DDL

```sql
CREATE TABLE baseout.service_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service       text NOT NULL,
  status        text NOT NULL DEFAULT 'started',  -- started | succeeded | failed (app-enforced, like backup_runs)
  started_at    timestamptz NOT NULL,
  completed_at  timestamptz,
  duration_ms   integer,
  counts        jsonb,
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  modified_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX service_runs_service_started_idx ON baseout.service_runs (service, started_at DESC);
CREATE INDEX service_runs_status_idx ON baseout.service_runs (status);
```

Canonical Drizzle definition in `apps/web/src/db/schema/core.ts`; migration `apps/web/drizzle/00XX_service_runs.sql` (next free number at implementation time). Status is plain text app-enforced, matching `backup_runs` house style. `counts` is jsonb rather than fixed int columns because counter shapes differ per service (sweep: scanned/refreshed/failed/pendingReauth; cleanup: planned/deleted; prune: deleted) — alternative fixed `items_processed`/`items_failed` columns rejected as lossy.

### D3: Writer helper API (`apps/server/src/lib/service-runs.ts`)

```ts
export const SERVICE_IDS = {
  live: ['oauth_refresh_sweep', 'run_reconciliation', 'oauth_keepalive',
         'connection_auto_invalidate', 'retention_cleanup', 'service_runs_prune'],
  reserved: ['webhook_renewal', 'connection_lock_sweep', 'dead_connection_check',
             'rediscovery', 'trial_expiry_monitor', 'quota_usage_monitor'],
} as const;

export async function withServiceRun<T extends { counts?: Record<string, number> }>(
  db: MasterDb, service: ServiceId, body: () => Promise<T>): Promise<T>

// Engine-mediated lifecycle for workflows-driven jobs:
export async function openServiceRun(db, service): Promise<string | null>   // null if insert failed (logged)
export async function finalizeServiceRun(db, id, outcome): Promise<void>    // swallow+log on failure
```

`withServiceRun` inserts `started`, invokes `body`, finalizes from the body's returned `counts` (succeeded) or the thrown error (failed, then rethrow). All record-keeping errors are logged (structured, `event: 'service_run_write_failed'`) and swallowed — the guard the spec demands. Each cron job already receives a per-invocation master DB client from the dispatch path; the helper reuses it (no second client, protecting the ~19-connection dev budget).

### D4: Cron wiring
`scheduled()`'s per-job calls wrap in `withServiceRun`: e.g. `withServiceRun(db, 'oauth_refresh_sweep', () => runScheduledOauthRefresh(env))`, with each `runScheduled*` function's existing structured summary reshaped to also return its counters (additive change; log lines stay). `lib/cron/dispatch.ts` gains `"service-runs-prune"` in the `KEEPALIVE_CRON` job list — piggybacking the existing daily cron rather than adding a third cron expression (alternative rejected: more wrangler config surface for a trivial DELETE).

### D5: Cleanup instrumentation crosses the engine boundary by id echo
`cleanupPlanHandler` calls `openServiceRun(db, 'retention_cleanup')` and adds `serviceRunId` to the plan response. The workflows task carries it opaquely into the `cleanup-complete` payload (one optional field in the shared payload type — the only `apps/workflows` diff). `cleanupCompleteHandler` calls `finalizeServiceRun` with the pass counters. Missing/unknown `serviceRunId` in a completion is ignored (backward/forward compatible during deploy skew). A crash between plan and complete leaves the dangling `started` row that admin renders as stuck.

### D6: Prune is a plain DELETE, 90 days, self-instrumented
`DELETE FROM service_runs WHERE started_at < now() - interval '90 days'` under `withServiceRun(db, 'service_runs_prune', ...)` recording `{ deleted }`. 90 days ≈ 8.6k rows/quarter at current cadence (4 × 96/day + 24/day + 1/day) — trivially small; no partitioning or batching needed. Alternative (fold into the customer-data retention engine) rejected: that engine is per-Space policy machinery; this is one line of housekeeping.

### D7: Admin reader
Read-only mirror of `service_runs` in `apps/admin/src/db/schema/core.ts` (all columns are safe — no `*_enc` exists on the table). New pure lib `service-runs-view.ts`:
- `summarizeServiceRuns(rows, now)` → per-service `{ latest, lastSuccessAt, failureStreak, recentDurations, stale }` — computed from the newest N (50) rows per service, fetched with one `DISTINCT ON`-style ranked query.
- Staleness window per service: constant map, default `4 × expected cadence` (15-min jobs → 1h; hourly → 4h; daily → 4d); a `started` row older than its window ⇒ `stale: true`.
- Registry duplicated as a display map in admin (mirror rules forbid importing server code) with a lockstep-copy header comment, same pattern as `isInternalEmail`.
`/services.astro` renders: per-service summary table (live first, reserved labeled "not yet implemented"), recent-failures list (last 20 failed rows across services), then the retained derived signals section (`deriveServiceHealth` kept for scheduler + session sweep only; cleanup signal removed in favor of real rows; header comment corrected).

### D8: Testing
- **web**: migration snapshot/db:check only (no runtime change).
- **server**: Vitest unit tests on `withServiceRun` (success, body-throw, insert-throw, finalize-throw — assert job outcome preserved), dispatch wiring (each job id produces a row via a stubbed db), prune boundary (89d kept / 91d deleted), cleanup handlers open/finalize + missing-id tolerance.
- **workflows**: payload pass-through test (serviceRunId echoes; absent stays absent).
- **admin**: pure-lib tests for `summarizeServiceRuns` (streaks, staleness, no-rows/reserved states) + existing service-health tests updated for the reduced derived set; read-only guard test extended to `service_runs`.

## Risks / Trade-offs

- [Instrumentation adds 2 writes per job execution] → negligible volume (≈400 writes/day); reuses the job's existing DB client; failures swallowed by design.
- [Deploy skew: cron code deployed before migration runs] → helper treats insert failure as non-fatal (logged), so jobs keep running; migration ordering note in tasks (migrate first).
- [Dangling `started` rows from genuine Worker evictions look like crashes] → acceptable: an evicted job IS an incomplete run; staleness window (not instant) keeps normal latency from flagging.
- [Registry duplicated in admin (lockstep copy)] → drift risk mitigated by header comments both sides + admin showing unknown service ids it finds in rows anyway (forward-tolerant rendering).
- [jsonb counters are schemaless] → per-service counter keys documented in the registry's JSDoc; admin renders keys generically so drift degrades to cosmetic.

## Migration Plan

1. Land web schema + migration; run `db:migrate` against dev.
2. Deploy `apps/server` with helper + wiring (safe either order thanks to non-fatal inserts, but migrate-first avoids noise).
3. Deploy workflows task update (optional field — safe with older engine).
4. Deploy admin. Rollback = revert deploys; table is additive and inert if unwritten.

## Open Questions

- None blocking. Whether `admin-operations-overview` consumes summaries via a shared admin lib or its own query is decided in that change; the table contract here is stable either way.
