// POST /api/internal/runs/:runId/complete
//
// Internal callback the Trigger.dev backup-base task wrapper hits after
// runBackupBase returns. Wires the per-base completion into the masterDb
// row owned by Phase 8a's runs/start.
//
// Token gate is applied by middleware (path begins /api/internal/). This
// handler validates URL shape (UUID) + JSON body, then delegates to
// processRunComplete (src/lib/runs/complete.ts).
//
// Idempotency: the atomic UPDATE removes triggerRunId from
// trigger_run_ids if present. A second callback with the same triggerRunId
// matches no rows → null return → 200 noop. See complete.ts header for the
// design rationale (Option J — no schema change).
//
// Result-code → HTTP-status mapping:
//   ok / kind=noop|partial|finalized → 200  { ok: true, kind, ... }
//   run_not_found                    → 404
//   invalid request body             → 400  { error: 'invalid_request' }

import { eq, sql } from "drizzle-orm";
import type { AppLocals, Env } from "../../../../env";
import { backupRuns } from "../../../../db/schema";
import {
  processRunComplete,
  type ProcessRunCompleteInput,
  type ProcessRunCompleteResult,
} from "../../../../lib/runs/complete";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_STATUSES = new Set([
  "succeeded",
  "trial_truncated",
  "trial_complete",
  "failed",
]);

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function statusFor(result: ProcessRunCompleteResult): number {
  if (result.ok) return 200;
  switch (result.error) {
    case "run_not_found":
      return 404;
  }
}

function isNonNegativeInt(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    Number.isFinite(value)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function parseBody(raw: unknown): ProcessRunCompleteInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!isNonEmptyString(r.triggerRunId)) return null;
  if (!isNonEmptyString(r.atBaseId)) return null;
  if (typeof r.status !== "string" || !ALLOWED_STATUSES.has(r.status)) {
    return null;
  }
  if (!isNonNegativeInt(r.tablesProcessed)) return null;
  if (!isNonNegativeInt(r.recordsProcessed)) return null;
  if (!isNonNegativeInt(r.attachmentsProcessed)) return null;
  if (r.errorMessage !== undefined && typeof r.errorMessage !== "string") {
    return null;
  }
  return {
    runId: "", // overwritten by caller from URL
    triggerRunId: r.triggerRunId,
    atBaseId: r.atBaseId,
    status: r.status as ProcessRunCompleteInput["status"],
    tablesProcessed: r.tablesProcessed,
    recordsProcessed: r.recordsProcessed,
    attachmentsProcessed: r.attachmentsProcessed,
    ...(typeof r.errorMessage === "string"
      ? { errorMessage: r.errorMessage }
      : {}),
  };
}

export async function runsCompleteHandler(
  request: Request,
  _env: Env,
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

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const parsed = parseBody(raw);
  if (!parsed) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  const input: ProcessRunCompleteInput = { ...parsed, runId };

  // Production wiring uses the per-request masterDb; tests cover the routing
  // layer (this file) and the pure function (complete.ts) separately —
  // see runs-complete.test.ts and runs-complete-route.test.ts.
  const { db } = locals.getMasterDb();

  const result = await processRunComplete(input, {
    fetchRunById: async (id) => {
      const rows = await db
        .select({ id: backupRuns.id })
        .from(backupRuns)
        .where(eq(backupRuns.id, id))
        .limit(1);
      return rows[0] ?? null;
    },
    applyPerBaseCompletion: async (perBase) => {
      // Atomic per-base completion. Removes triggerRunId from trigger_run_ids
      // (jsonb minus operator), increments counters, stickily sets
      // error_message via COALESCE(existing, new). Returns the post-update
      // remaining count + hasFailure flag, or null if WHERE didn't match
      // (idempotent replay).
      //
      // Counters: COALESCE handles the schema's nullable integer columns —
      // Phase 8a writes nulls on row creation; we treat null as 0 for the
      // increment.
      const failureMessage = perBase.failureMessage;
      const rows = await db.execute(sql`
        UPDATE baseout.backup_runs
        SET
          trigger_run_ids = COALESCE(trigger_run_ids, '[]'::jsonb) - ${perBase.triggerRunId},
          record_count = COALESCE(record_count, 0) + ${perBase.recordsProcessed},
          table_count = COALESCE(table_count, 0) + ${perBase.tablesProcessed},
          attachment_count = COALESCE(attachment_count, 0) + ${perBase.attachmentsProcessed},
          error_message = COALESCE(error_message, ${failureMessage}::text),
          modified_at = NOW()
        WHERE id = ${perBase.runId}
          AND trigger_run_ids ? ${perBase.triggerRunId}
        RETURNING
          jsonb_array_length(trigger_run_ids) AS remaining_count,
          (error_message IS NOT NULL) AS has_failure
      `);

      const row = (rows as unknown as Array<{
        remaining_count: number;
        has_failure: boolean;
      }>)[0];
      if (!row) return null;
      return {
        remainingCount: Number(row.remaining_count),
        hasFailure: Boolean(row.has_failure),
      };
    },
    finalizeRun: async (final) => {
      await db
        .update(backupRuns)
        .set({
          status: final.finalStatus,
          completedAt: final.completedAt,
          modifiedAt: final.completedAt,
        })
        .where(eq(backupRuns.id, final.runId));
    },
  });

  if (result.ok) {
    if (result.kind === "noop") {
      return jsonResponse({ ok: true, kind: "noop" }, statusFor(result));
    }
    if (result.kind === "partial") {
      return jsonResponse(
        { ok: true, kind: "partial", remainingCount: result.remainingCount },
        statusFor(result),
      );
    }
    return jsonResponse(
      { ok: true, kind: "finalized", finalStatus: result.finalStatus },
      statusFor(result),
    );
  }
  return jsonResponse({ error: result.error }, statusFor(result));
}
