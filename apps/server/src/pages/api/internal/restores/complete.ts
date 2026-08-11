// POST /api/internal/restores/:restoreId/complete (server-restore Phase C.4)
//
// Internal callback the Trigger.dev restore-base task wrapper hits after
// restoreBase returns. Wires the per-base completion into the masterDb
// restore_runs row.
//
// Mirrors apps/server/src/pages/api/internal/runs/complete.ts for the restore
// lifecycle. Token gate is applied by middleware (path begins /api/internal/).
//
// Key SQL difference vs backup_runs: restore_runs.trigger_run_ids is a Postgres
// text[] (not jsonb), so we use array operators:
//   - Array contains check: trigger_run_ids @> ARRAY[triggerRunId]
//   - Remove element:       array_remove(trigger_run_ids, triggerRunId)
//   - Remaining count:      cardinality(trigger_run_ids) after removal
// (vs jsonb's `? operator` and `- operator` used in runs/complete.ts)
//
// Status set is 'succeeded' | 'failed' only — no trial states for restores.
//
// Result-code → HTTP-status mapping:
//   ok / kind=noop|partial|finalized → 200  { ok: true, kind, ... }
//   restore_not_found                → 404
//   invalid request body             → 400  { error: 'invalid_request' }

import { eq, sql } from "drizzle-orm";
import type { AppLocals, Env } from "../../../../env";
import { restoreRuns } from "../../../../db/schema";
import {
  processRestoreComplete,
  type ProcessRestoreCompleteInput,
  type ProcessRestoreCompleteResult,
} from "../../../../lib/restores/complete";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_STATUSES = new Set(["succeeded", "failed"]);

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function statusFor(result: ProcessRestoreCompleteResult): number {
  if (result.ok) return 200;
  switch (result.error) {
    case "restore_not_found":
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

function parseBody(raw: unknown): ProcessRestoreCompleteInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!isNonEmptyString(r.triggerRunId)) return null;
  if (!isNonEmptyString(r.atBaseId)) return null;
  if (typeof r.status !== "string" || !ALLOWED_STATUSES.has(r.status)) {
    return null;
  }
  if (!isNonNegativeInt(r.tablesRestored)) return null;
  if (!isNonNegativeInt(r.recordsRestored)) return null;
  if (!isNonNegativeInt(r.attachmentsRestored)) return null;
  if (r.errorMessage !== undefined && typeof r.errorMessage !== "string") {
    return null;
  }
  return {
    restoreId: "", // overwritten by caller from URL
    triggerRunId: r.triggerRunId,
    atBaseId: r.atBaseId,
    status: r.status as ProcessRestoreCompleteInput["status"],
    tablesRestored: r.tablesRestored,
    recordsRestored: r.recordsRestored,
    attachmentsRestored: r.attachmentsRestored,
    ...(typeof r.errorMessage === "string"
      ? { errorMessage: r.errorMessage }
      : {}),
  };
}

export async function restoresCompleteHandler(
  request: Request,
  _env: Env,
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
  const input: ProcessRestoreCompleteInput = { ...parsed, restoreId };

  const { db } = locals.getMasterDb();

  const result = await processRestoreComplete(input, {
    fetchRestoreById: async (id) => {
      const rows = await db
        .select({ id: restoreRuns.id })
        .from(restoreRuns)
        .where(eq(restoreRuns.id, id))
        .limit(1);
      return rows[0] ?? null;
    },
    applyPerBaseCompletion: async (perBase) => {
      // Atomic per-base completion for a text[] trigger_run_ids column.
      //
      // WHERE trigger_run_ids @> ARRAY[triggerRunId] checks that the ID is
      // still present (idempotency gate). On match:
      //   - array_remove removes the ID from the array.
      //   - Counters are incremented (COALESCE defensively handles any nulls).
      //   - error_message is stickily set via COALESCE(existing, new).
      //   - RETURNING cardinality gives the post-update remaining count.
      //
      // If WHERE matches no rows (ID already removed), returns null → noop.
      const failureMessage = perBase.failureMessage;
      const rows = await db.execute(sql`
        UPDATE baseout.restore_runs
        SET
          trigger_run_ids = array_remove(trigger_run_ids, ${perBase.triggerRunId}::text),
          records_restored = COALESCE(records_restored, 0) + ${perBase.recordsRestored},
          tables_restored = COALESCE(tables_restored, 0) + ${perBase.tablesRestored},
          attachments_restored = COALESCE(attachments_restored, 0) + ${perBase.attachmentsRestored},
          error_message = COALESCE(error_message, ${failureMessage}::text),
          modified_at = NOW()
        WHERE id = ${perBase.restoreId}
          AND trigger_run_ids @> ARRAY[${perBase.triggerRunId}::text]
        RETURNING
          cardinality(trigger_run_ids) AS remaining_count,
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
    finalizeRestore: async (final) => {
      await db
        .update(restoreRuns)
        .set({
          status: final.finalStatus,
          completedAt: final.completedAt,
          modifiedAt: final.completedAt,
        })
        .where(eq(restoreRuns.id, final.restoreId));
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
