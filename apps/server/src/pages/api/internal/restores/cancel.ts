// POST /api/internal/restores/:restoreId/cancel (server-restore Phase D.2)
//
// Internal route apps/web's cancel button forwards to via the BACKUP_ENGINE
// service binding. Atomically transitions the row from {queued | running}
// → 'cancelling' → 'cancelled' and asks Trigger.dev to cancel each fanned-
// out task. See src/lib/restores/cancel.ts for the state machine + idempotency
// rules.
//
// Mirrors apps/server/src/pages/api/internal/runs/cancel.ts for the restore
// lifecycle. Key difference: the terminal timestamp column is cancelled_at
// (not completed_at), matching the restore_runs schema (Phase A).
//
// Token gate is applied by middleware (path begins /api/internal/). This
// handler validates URL shape (UUID) then delegates to processRestoreCancel.
//
// Result-code → HTTP-status mapping:
//   ok                             → 200  { ok: true, cancelledTriggerRunIds }
//   restore_not_found              → 404
//   restore_already_terminal       → 409

import { and, eq, inArray, sql } from "drizzle-orm";
import { runs as triggerRuns } from "@trigger.dev/sdk";
import type { AppLocals, Env } from "../../../../env";
import { restoreRuns } from "../../../../db/schema";
import {
  processRestoreCancel,
  type ProcessRestoreCancelResult,
} from "../../../../lib/restores/cancel";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function statusFor(result: ProcessRestoreCancelResult): number {
  if (result.ok) return 200;
  switch (result.error) {
    case "restore_not_found":
      return 404;
    case "restore_already_terminal":
      return 409;
  }
}

export async function restoresCancelHandler(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  restoreId: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  if (!UUID_RE.test(restoreId)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const { db } = locals.getMasterDb();

  const result = await processRestoreCancel(
    { restoreId },
    {
      fetchRestoreForCancel: async (id) => {
        const rows = await db
          .select({
            id: restoreRuns.id,
            status: restoreRuns.status,
            triggerRunIds: restoreRuns.triggerRunIds,
          })
          .from(restoreRuns)
          .where(eq(restoreRuns.id, id))
          .limit(1);
        return rows[0] ?? null;
      },
      markRestoreCancelling: async (id) => {
        // CAS via WHERE status IN ('queued','running'). RETURNING surfaces
        // exactly one row if we won; empty otherwise.
        const rows = await db
          .update(restoreRuns)
          .set({ status: "cancelling", modifiedAt: new Date() })
          .where(
            and(
              eq(restoreRuns.id, id),
              inArray(restoreRuns.status, ["queued", "running"]),
            ),
          )
          .returning({ id: restoreRuns.id });
        return rows.length > 0;
      },
      cancelTriggerRun: async (triggerRunId) => {
        // Trigger.dev v3 management SDK. Mirrors the backup cancel pattern.
        const { configure } = await import("@trigger.dev/sdk");
        configure({ accessToken: env.TRIGGER_SECRET_KEY });
        await triggerRuns.cancel(triggerRunId);
      },
      markRestoreCancelled: async ({ restoreId: id, cancelledAt }) => {
        // Uses cancelled_at (restore_runs column) rather than completed_at
        // (backup_runs column). Guards on status='cancelling' — the CAS we
        // already won.
        await db
          .update(restoreRuns)
          .set({
            status: "cancelled",
            cancelledAt,
            modifiedAt: cancelledAt,
          })
          .where(
            and(
              eq(restoreRuns.id, id),
              sql`${restoreRuns.status} = 'cancelling'`,
            ),
          );
      },
    },
  );

  if (result.ok) {
    return jsonResponse(
      { ok: true, cancelledTriggerRunIds: result.cancelledTriggerRunIds },
      statusFor(result),
    );
  }
  return jsonResponse({ error: result.error }, statusFor(result));
}
