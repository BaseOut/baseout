# shared-service-runs — Proposal

## Why

Admin's `/services` page cannot tell staff whether background services actually ran — it *derives* health from data side-effects (`backup_configurations.next_scheduled_at` drift, `backup_runs.deleted_at` as a cleanup heartbeat, stale `connection_sessions` counts) and labels itself as such, because no per-service run log exists anywhere. Meanwhile the fleet of real scheduled jobs has grown: the Worker cron dispatch shipped via [`server-oauth-refresh-cron-health`](../server-oauth-refresh-cron-health/) now fires **four** jobs (`oauth-refresh-sweep` + `run-reconciliation` every 15 min; `oauth-keepalive` + `connection-auto-invalidate` daily), and Trigger.dev runs the hourly `cleanup-expired-snapshots` task — yet none of them leave a queryable record of "I ran, here's what I did, here's what failed". The 2026-07-14 incident that motivated the cron-health change (a token expired for 4.7 days because no clock fired) showed exactly how a silent scheduler rots: this change makes every background run *visible* so the next dead clock or failing sweep surfaces in admin within one page load. It also gives the sibling `admin-operations-overview` change a real table to read for dashboard service-health tiles.

## What Changes

- **New master-DB table `service_runs`** — one row per background-service execution: `service` identifier, `status` (`started | succeeded | failed`), `started_at` / `completed_at` / `duration_ms`, per-service counters (`counts` jsonb), `error_message`. Canonical schema in `apps/web/src/db/schema/core.ts` + a new `apps/web/drizzle/` migration (web owns all master-DB migrations, per the `admin_audit_log` precedent in [`shared-admin-actions`](../shared-admin-actions/)). No web runtime code change.
- **Writer contract in `apps/server`** — a small `withServiceRun()` helper wraps a job body: INSERT a `started` row, execute, finalize the same row to `succeeded` (with counters) or `failed` (with error message). Instrumentation must never break the job: recording failures are logged and swallowed. All four live cron jobs in `scheduled()` dispatch adopt it, and the contract states that **every future scheduled/cron job MUST run under the helper** (webhook renewal, connection-lock sweep, dead-connection cadence, rediscovery, trial/quota monitors — all currently specced-only).
- **Trigger.dev cleanup instrumentation via the engine** — `apps/workflows` has no DB access, so the engine's existing `/api/internal/cleanup-plan` handler opens the `started` row and returns its id in the plan; the cleanup task echoes it back on the completion POST and the engine finalizes. A task crash between the two leaves a visible dangling `started` row instead of silence.
- **Stuck-run visibility** — a run left in `started` past a per-service staleness window renders as a warning in admin (crashed worker / never-finalized run), not as "running".
- **Retention for the log itself** — a `service-runs-prune` job (added to the existing daily cron dispatch) deletes `service_runs` rows older than 90 days, so the table never grows unbounded. The prune records itself through the same helper.
- **Admin `/services` rebuilt on real rows** — read-only partial mirror of `service_runs` in `apps/admin/src/db/schema/core.ts` (mirror rules: header comment naming the canonical source, selected columns, no FKs). Per-service: latest run status, last success time, consecutive-failure streak, recent durations, and a recent-failures list with error messages. Services that have no writer yet (SpaceDO backup scheduler, connection-session sweep) keep today's **derived** signals, explicitly labeled derived — the honest-labeling behavior is kept, not removed. The stale "scheduled() is a stub" header comment in `apps/admin/src/lib/service-health.ts` gets corrected in the same change.

## Relationship to sibling changes

- [`admin-operations-overview`](../admin-operations-overview/) (filed together): its dashboard reads the same `service_runs` contract for service-health tiles; this change owns the table shape and writer semantics.
- [`server-cron-webhook-renewal`](../server-cron-webhook-renewal/), [`server-cron-connection-lock-manager`](../server-cron-connection-lock-manager/), [`server-cron-dead-connection-cadence`](../server-cron-dead-connection-cadence/), [`server-rediscovery-alarm`](../server-rediscovery-alarm/) (all unimplemented): when built, their jobs MUST adopt `withServiceRun()` — each gets a reserved service identifier here so admin can show them as "not yet running" rather than unknown.
- [`server-retention-and-cleanup`](../server-retention-and-cleanup/) / [`workflows-retention-and-cleanup`](../workflows-retention-and-cleanup/): own the cleanup task this change instruments; the plan/complete endpoint contract gains an optional `serviceRunId` field, backward compatible.

## Capabilities

### New Capabilities

- `service-run-log`: the `service_runs` table, the `withServiceRun()` writer contract adopted by every scheduled job (Worker cron and engine-mediated Trigger.dev), the started/finalize row lifecycle, stuck-run semantics, and the 90-day self-prune.
- `admin-service-health`: the rebuilt admin `/services` surface — real per-service run history (latest status, last success, failure streaks, recent failures) from a read-only `service_runs` mirror, with remaining derived signals explicitly labeled.

### Modified Capabilities

None — no archived spec in `openspec/specs/` covers the services surface or cron jobs yet (the `/services` page shipped under the un-archived `admin-read-surfaces` change; behavior-level deltas are noted there for its archive reconciliation).

## Impact

- **apps/web**: `src/db/schema/core.ts` gains `serviceRuns`; new `drizzle/` migration. No runtime change.
- **apps/server**: new `src/lib/service-runs.ts` (helper + service-id registry + prune); `scheduled()` dispatch jobs wrapped; `lib/cron/dispatch.ts` gains `service-runs-prune` on the daily cron; `cleanup-plan` / `cleanup-complete` internal handlers open/finalize the cleanup run row; schema mirror gains `service_runs` (writable: INSERT + UPDATE of own rows only).
- **apps/workflows**: `cleanup-expired-snapshots` task passes through the optional `serviceRunId` from plan to completion payload (no DB access added).
- **apps/admin**: read-only `service_runs` mirror; `src/lib/service-health.ts` extended (real-row aggregation + retained derived signals); `/services` page rework. No new secrets, bindings, or auth surface.
- **Security review points**: no new secrets or auth paths; `service_runs` contains operational metadata only (never tokens, never customer content — `error_message` must not embed credentials, enforced by writer-side convention that it stores `Error.message` only); admin mirror stays read-only; all writes go through Drizzle parameterized queries.
