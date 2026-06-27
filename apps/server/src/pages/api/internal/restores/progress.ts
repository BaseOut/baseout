// POST /api/internal/restores/:restoreId/progress (server-restore Phase C.2)
//
// Internal fire-and-forget callback the Trigger.dev restore-base task fires
// after each table-page restore succeeds (and once more at end-of-table).
// Bumps restore_runs.records_restored / tables_restored so the frontend's 2s
// poll can render a live "Restoring… N records" label.
//
// Mirrors apps/server/src/pages/api/internal/runs/progress.ts for the restore
// lifecycle. Token gate is applied by middleware (path begins /api/internal/).
//
// Wire shape:
//   Body: { triggerRunId?, atBaseId?, recordsAppended: int>=0, tableCompleted: bool }
//   200  { ok: true, kind: 'applied' | 'noop' }
//   400  { error: 'invalid_request' }
//   404  { error: 'restore_not_found' }
//
// "noop" fires when the row exists but its status flipped to terminal
// before this event arrived — accepted silently so the runner's
// fire-and-forget POST doesn't retry.
//
// Note: restore_runs.trigger_run_ids is a Postgres text[] (not jsonb), so
// the SQL uses array operators (ANY, array_remove, cardinality) rather than
// the jsonb minus / ? operators used for backup_runs.

import { sql } from "drizzle-orm";
import type { AppLocals, Env } from "../../../../env";
import {
  processRestoreProgress,
  type ProcessRestoreProgressInput,
  type ProcessRestoreProgressResult,
} from "../../../../lib/restores/progress";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function statusFor(result: ProcessRestoreProgressResult): number {
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

function parseBody(
  raw: unknown,
): Omit<ProcessRestoreProgressInput, "restoreId"> | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!isNonNegativeInt(r.recordsAppended)) return null;
  if (typeof r.tableCompleted !== "boolean") return null;
  // triggerRunId + atBaseId are optional — accepted for tracing only.
  const triggerRunId =
    typeof r.triggerRunId === "string" ? r.triggerRunId : "";
  const atBaseId = typeof r.atBaseId === "string" ? r.atBaseId : "";
  return {
    triggerRunId,
    atBaseId,
    recordsAppended: r.recordsAppended,
    tableCompleted: r.tableCompleted,
  };
}

export async function restoresProgressHandler(
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
  const input: ProcessRestoreProgressInput = { ...parsed, restoreId };

  const { db } = locals.getMasterDb();

  const result = await processRestoreProgress(input, {
    applyProgress: async (perEvent) => {
      // Single CTE returning two booleans:
      //   - exists  → is there ANY row with this id?
      //   - updated → did the WHERE id=$1 AND status='running' UPDATE match?
      //
      // tableCompleted=true bumps tables_restored by 1.
      // restore_runs uses integer columns with NOT NULL DEFAULT 0 (unlike
      // backup_runs which uses nullable integers) — COALESCE is included
      // defensively in case of any legacy null values.
      const rows = await db.execute(sql`
        WITH existing AS (
          SELECT id FROM baseout.restore_runs WHERE id = ${perEvent.restoreId}
        ),
        updated AS (
          UPDATE baseout.restore_runs
          SET
            records_restored = COALESCE(records_restored, 0) + ${perEvent.recordsAppended},
            tables_restored = COALESCE(tables_restored, 0) + ${
              perEvent.tableCompleted ? sql`1` : sql`0`
            },
            modified_at = NOW()
          WHERE id = ${perEvent.restoreId} AND status = 'running'
          RETURNING id
        )
        SELECT
          (SELECT id FROM existing) AS exists_id,
          (SELECT id FROM updated) AS updated_id
      `);

      const row = (rows as unknown as Array<{
        exists_id: string | null;
        updated_id: string | null;
      }>)[0];
      return {
        exists: Boolean(row?.exists_id),
        updated: Boolean(row?.updated_id),
      };
    },
  });

  if (result.ok) {
    return jsonResponse({ ok: true, kind: result.kind }, statusFor(result));
  }
  return jsonResponse({ error: result.error }, statusFor(result));
}
