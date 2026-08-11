// Production wiring for the reconciliation sweep (server-run-reconciliation).
//
// The pure decision + orchestration live in reconcile.ts / reconcile-sweep.ts;
// this supplies the real deps: drizzle SELECTs over the backup/restore run
// mirrors, an error-tolerant Trigger.dev status lookup (a failed lookup maps
// to null → the run is left alone this pass), and GUARDED terminal UPDATEs
// (status IN ('queued','running')) so a racing late /complete always results
// in exactly one terminal transition. scheduled() has no request locals, so
// the master DB client is created + torn down per firing (CLAUDE.md §5.1).

import { and, asc, inArray, lt, sql } from "drizzle-orm";
import { createMasterDb } from "../../db/worker";
import { backupRuns, restoreRuns } from "../../db/schema";
import {
  runReconcileSweep,
  type ReconcileKind,
  type ReconcileSweepResult,
} from "./reconcile-sweep";
import type { ReconcileRun } from "./reconcile";
import type { Env } from "../../env";

const TRIGGER_API = "https://api.trigger.dev/api/v3/runs";
/** SELECT prefilter only — the real windows live in decideReconciliation. */
const SELECT_MIN_AGE_MS = 10 * 60_000;
const NON_TERMINAL = ["queued", "running"] as const;

export async function runScheduledRunReconciliation(
  env: Env,
): Promise<ReconcileSweepResult> {
  const { db, sql: pg } = createMasterDb(env);
  try {
    return await runReconcileSweep({
      listStuckRuns: async (kind: ReconcileKind, limit) => {
        const cutoff = new Date(Date.now() - SELECT_MIN_AGE_MS);
        if (kind === "backup") {
          const rows = await db
            .select({
              id: backupRuns.id,
              status: backupRuns.status,
              startedAt: backupRuns.startedAt,
              createdAt: backupRuns.createdAt,
              errorMessage: backupRuns.errorMessage,
              triggerRunIds: backupRuns.triggerRunIds,
            })
            .from(backupRuns)
            .where(and(inArray(backupRuns.status, [...NON_TERMINAL]), lt(backupRuns.createdAt, cutoff)))
            .orderBy(asc(backupRuns.createdAt))
            .limit(limit);
          return rows.map((r) => ({ ...r, createdAt: r.createdAt ?? new Date(0) }));
        }
        const rows = await db
          .select({
            id: restoreRuns.id,
            status: restoreRuns.status,
            startedAt: restoreRuns.startedAt,
            createdAt: restoreRuns.createdAt,
            errorMessage: restoreRuns.errorMessage,
            triggerRunIds: restoreRuns.triggerRunIds,
          })
          .from(restoreRuns)
          .where(and(inArray(restoreRuns.status, [...NON_TERMINAL]), lt(restoreRuns.createdAt, cutoff)))
          .orderBy(asc(restoreRuns.createdAt))
          .limit(limit);
        return rows.map(
          (r): ReconcileRun => ({ ...r, createdAt: r.createdAt ?? new Date(0) }),
        );
      },
      lookupTaskStatuses: async (ids) => {
        const out: (string | null)[] = [];
        for (const id of ids) {
          try {
            const res = await fetch(`${TRIGGER_API}/${encodeURIComponent(id)}`, {
              headers: { authorization: `Bearer ${env.TRIGGER_SECRET_KEY}` },
            });
            if (!res.ok) {
              await res.body?.cancel?.();
              out.push(null);
              continue;
            }
            const body = (await res.json()) as { status?: unknown };
            out.push(typeof body.status === "string" ? body.status : null);
          } catch {
            out.push(null);
          }
        }
        return out;
      },
      applyDecision: async (kind, runId, decision) => {
        const table = kind === "backup" ? backupRuns : restoreRuns;
        const status = decision.action === "fail" ? "failed" : decision.finalStatus;
        const set: Record<string, unknown> = {
          status,
          completedAt: new Date(),
          modifiedAt: new Date(),
        };
        if (decision.action === "fail") {
          // Sticky: an existing per-base failure message is more specific
          // than the reconciliation reason — keep it if present.
          set.errorMessage = sql`COALESCE(${table.errorMessage}, ${decision.errorMessage})`;
        }
        const rows = await db
          .update(table)
          .set(set)
          .where(and(sql`${table.id} = ${runId}`, inArray(table.status, [...NON_TERMINAL])))
          .returning({ id: table.id });
        return rows.length > 0;
      },
      log: (event) => {
        // eslint-disable-next-line no-console -- per-sweep summary is the change spec's observability requirement
        console.log(JSON.stringify(event));
      },
    });
  } finally {
    await pg.end({ timeout: 5 }).catch(() => {});
  }
}
