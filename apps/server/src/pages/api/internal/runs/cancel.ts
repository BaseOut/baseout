// POST /api/internal/runs/:runId/cancel
//
// Internal route the apps/web cancel button forwards to via the
// BACKUP_ENGINE service binding. Atomically transitions the row from
// {queued | running} → 'cancelling' → 'cancelled' and asks Trigger.dev
// to cancel each fanned-out task. See src/lib/runs/cancel.ts for the
// state machine + idempotency rules.
//
// Token gate is applied by middleware (path begins /api/internal/). This
// handler validates URL shape (UUID) then delegates to processRunCancel.
//
// Result-code → HTTP-status mapping:
//   ok                          → 200  { ok: true, cancelledTriggerRunIds }
//   run_not_found               → 404
//   run_already_terminal        → 409

import { and, eq, inArray, sql } from "drizzle-orm";
import { runs as triggerRuns } from "@trigger.dev/sdk";
import type { AppLocals, Env } from "../../../../env";
import { backupRuns } from "../../../../db/schema";
import {
  processRunCancel,
  type ProcessRunCancelResult,
} from "../../../../lib/runs/cancel";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function statusFor(result: ProcessRunCancelResult): number {
  if (result.ok) return 200;
  switch (result.error) {
    case "run_not_found":
      return 404;
    case "run_already_terminal":
      return 409;
  }
}

export async function runsCancelHandler(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  runId: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  if (!UUID_RE.test(runId)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const { db } = locals.getMasterDb();

  const result = await processRunCancel(
    { runId },
    {
      fetchRunForCancel: async (id) => {
        const rows = await db
          .select({
            id: backupRuns.id,
            status: backupRuns.status,
            triggerRunIds: backupRuns.triggerRunIds,
          })
          .from(backupRuns)
          .where(eq(backupRuns.id, id))
          .limit(1);
        return rows[0] ?? null;
      },
      markRunCancelling: async (id) => {
        // CAS via WHERE status IN ('queued','running'). RETURNING surfaces
        // exactly one row if we won; empty otherwise.
        const rows = await db
          .update(backupRuns)
          .set({ status: "cancelling", modifiedAt: new Date() })
          .where(
            and(
              eq(backupRuns.id, id),
              inArray(backupRuns.status, ["queued", "running"]),
            ),
          )
          .returning({ id: backupRuns.id });
        return rows.length > 0;
      },
      cancelTriggerRun: async (triggerRunId) => {
        // Trigger.dev v3 management SDK. Reads TRIGGER_SECRET_KEY via
        // configure() set inside trigger-client.ts at module load — but
        // since cancel routes don't currently enqueue tasks, configure
        // explicitly here. Calling configure twice with the same token is
        // safe per @trigger.dev/sdk docs.
        const { configure } = await import("@trigger.dev/sdk");
        configure({ accessToken: env.TRIGGER_SECRET_KEY });
        await triggerRuns.cancel(triggerRunId);
      },
      markRunCancelled: async ({ runId: id, completedAt }) => {
        // Use sql`` so we can guard on status='cancelling' — the CAS we
        // already won — without confusing drizzle's typed status field.
        await db
          .update(backupRuns)
          .set({
            status: "cancelled",
            completedAt,
            modifiedAt: completedAt,
          })
          .where(
            and(
              eq(backupRuns.id, id),
              sql`${backupRuns.status} = 'cancelling'`,
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
