// Service-run writer (shared-service-runs). Records one row per background-service
// execution: INSERT `started`, run the job, finalize `succeeded`/`failed`. All
// record-keeping failures are logged and SWALLOWED — instrumentation must never
// change job behavior (the guard the spec demands). The pure orchestration
// (`withServiceRunVia`) is unit-tested; the drizzle adapter (`drizzleWriter`) is
// the thin I/O layer.

import { eq, lt, sql } from "drizzle-orm";
import type { AppDb } from "../db/worker";
import { serviceRuns } from "../db/schema";

// Registry of background-service identifiers. `live` are instrumented now;
// `reserved` are named so admin can render them "not yet running" and future
// changes adopt withServiceRun() without a registry edit. Per-service `counts`
// keys (documented for the admin renderer):
//   oauth_refresh_sweep        { scanned, refreshed, failed, pendingReauth }
//   run_reconciliation         { swept, requeued, failed }
//   oauth_keepalive            { scanned, refreshed, failed }
//   connection_auto_invalidate { invalidated }
//   retention_cleanup          { deleted, attempted }
//   service_runs_prune         { deleted }
//   webhook_renewal            { scanned, refreshed, reenabled, pendingReauth, transientFailures }
export const SERVICE_IDS = {
  live: [
    "oauth_refresh_sweep",
    "run_reconciliation",
    "oauth_keepalive",
    "connection_auto_invalidate",
    "retention_cleanup",
    "service_runs_prune",
    "webhook_renewal",
    // server-reports task 4.1: weekly/monthly report schedule sweep.
    "report_schedule_sweep",
  ],
  reserved: [
    "connection_lock_sweep",
    "dead_connection_check",
    "rediscovery",
    "trial_expiry_monitor",
    "quota_usage_monitor",
  ],
} as const;

export type ServiceId = (typeof SERVICE_IDS.live)[number] | (typeof SERVICE_IDS.reserved)[number];

export interface ServiceRunOutcome {
  status: "succeeded" | "failed";
  counts?: Record<string, number>;
  errorMessage?: string;
  /** Omit for engine-mediated finalize (cross-request) — computed in SQL from started_at. */
  durationMs?: number;
}

/** Seam so the orchestration is testable without a DB. Both methods NEVER throw. */
export interface ServiceRunWriter {
  /** INSERT a `started` row; returns its id, or null if the write failed (logged). */
  open(service: ServiceId): Promise<string | null>;
  /** UPDATE the row to its final state; no-op on a null id; swallow+log on failure. */
  finalize(id: string | null, outcome: ServiceRunOutcome): Promise<void>;
}

function logFailure(op: string, service: string, err: unknown): void {
  const line = JSON.stringify({
    level: "error",
    event: "service_run_write_failed",
    op,
    service,
    err: err instanceof Error ? err.message : String(err),
  });
  // eslint-disable-next-line no-console -- swallowed record-keeping failure; Worker log → observability.
  console.error(line);
}

/** Real drizzle-backed writer. Both methods self-guard so the job is never affected. */
export function drizzleWriter(db: AppDb): ServiceRunWriter {
  return {
    async open(service) {
      try {
        const [row] = await db
          .insert(serviceRuns)
          .values({ service, status: "started", startedAt: new Date() })
          .returning({ id: serviceRuns.id });
        return row?.id ?? null;
      } catch (err) {
        logFailure("open", service, err);
        return null;
      }
    },
    async finalize(id, outcome) {
      if (!id) return;
      try {
        // In-process paths pass durationMs; engine-mediated finalize (cleanup,
        // a different request than open) omits it → compute from started_at.
        const durationMs =
          outcome.durationMs ??
          sql<number>`(extract(epoch from (now() - ${serviceRuns.startedAt})) * 1000)::int`;
        await db
          .update(serviceRuns)
          .set({
            status: outcome.status,
            completedAt: new Date(),
            durationMs,
            counts: outcome.counts ?? null,
            errorMessage: outcome.errorMessage ?? null,
            modifiedAt: new Date(),
          })
          .where(eq(serviceRuns.id, id));
      } catch (err) {
        logFailure("finalize", "?", err);
      }
    },
  };
}

/**
 * Pure orchestration: open → body → finalize. The finalize calls are themselves
 * guarded so even a throwing writer can't change the body's outcome; a body throw
 * is finalized `failed` and rethrown. Injectable writer for tests.
 */
export async function withServiceRunVia<T extends { counts?: Record<string, number> }>(
  writer: ServiceRunWriter,
  service: ServiceId,
  body: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  const id = await writer.open(service);
  const safeFinalize = async (outcome: ServiceRunOutcome) => {
    try {
      await writer.finalize(id, outcome);
    } catch (err) {
      logFailure("finalize", service, err);
    }
  };
  try {
    const result = await body();
    await safeFinalize({ status: "succeeded", counts: result.counts, durationMs: Date.now() - startedAt });
    return result;
  } catch (err) {
    await safeFinalize({
      status: "failed",
      errorMessage: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startedAt,
    });
    throw err;
  }
}

/** Instrument a job body with a service-run row (the common cron path). */
export function withServiceRun<T extends { counts?: Record<string, number> }>(
  db: AppDb,
  service: ServiceId,
  body: () => Promise<T>,
): Promise<T> {
  return withServiceRunVia(drizzleWriter(db), service, body);
}

/** Engine-mediated lifecycle for workflows-driven jobs (open here, finalize on the callback). */
export function openServiceRun(db: AppDb, service: ServiceId): Promise<string | null> {
  return drizzleWriter(db).open(service);
}

export function finalizeServiceRun(db: AppDb, id: string | null, outcome: ServiceRunOutcome): Promise<void> {
  return drizzleWriter(db).finalize(id, outcome);
}

// ── prune (service_runs_prune job) ──
export const SERVICE_RUN_RETENTION_DAYS = 90;

/** Pure: the cutoff before which rows are pruned (design D6). */
export function pruneCutoff(now: Date): Date {
  return new Date(now.getTime() - SERVICE_RUN_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

/** Delete rows older than the retention window; returns the counts shape for withServiceRun. */
export async function pruneServiceRuns(db: AppDb, now = new Date()): Promise<{ counts: { deleted: number } }> {
  const deleted = await db
    .delete(serviceRuns)
    .where(lt(serviceRuns.startedAt, pruneCutoff(now)))
    .returning({ id: serviceRuns.id });
  return { counts: { deleted: deleted.length } };
}

/**
 * Extract a flat `{ key: number }` counts object from a job's result (own
 * enumerable numeric fields). Tolerates null/undefined (skipped job → {}), so
 * the cron wiring can wrap any `runScheduled*` return without knowing its shape.
 */
export function numericCounts(result: unknown): Record<string, number> {
  if (!result || typeof result !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(result as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}
