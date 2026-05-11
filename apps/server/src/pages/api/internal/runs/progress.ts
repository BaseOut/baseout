// POST /api/internal/runs/:runId/progress
//
// Internal fire-and-forget callback the Trigger.dev backup-base task fires
// after each table-page upload succeeds (and once more at end-of-table).
// Bumps backup_runs.record_count / table_count so the frontend's 2s poll
// can render a live "Backing up… N records" label.
//
// Token gate is applied by middleware (path begins /api/internal/). This
// handler validates URL shape (UUID) + JSON body, then delegates to
// processRunProgress (src/lib/runs/progress.ts).
//
// Wire shape:
//   Body: { triggerRunId?, atBaseId?, recordsAppended: int>=0, tableCompleted: bool }
//   200  { ok: true, kind: 'applied' | 'noop' }
//   400  { error: 'invalid_request' }
//   404  { error: 'run_not_found' }
//
// "noop" fires when the row exists but its status flipped to terminal
// before this event arrived — accepted silently so the runner's
// fire-and-forget POST doesn't retry. See progress.ts header for the
// late-event design rationale.

import { sql } from "drizzle-orm";
import type { AppLocals, Env } from "../../../../env";
import {
  processRunProgress,
  type ProcessRunProgressInput,
  type ProcessRunProgressResult,
} from "../../../../lib/runs/progress";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function statusFor(result: ProcessRunProgressResult): number {
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

function parseBody(raw: unknown): Omit<ProcessRunProgressInput, "runId"> | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!isNonNegativeInt(r.recordsAppended)) return null;
  if (typeof r.tableCompleted !== "boolean") return null;
  // triggerRunId + atBaseId are optional — accepted for tracing only.
  // Fall back to empty strings when absent; the pure function doesn't
  // forward these fields to the dep.
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

export async function runsProgressHandler(
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
  const input: ProcessRunProgressInput = { ...parsed, runId };

  const { db } = locals.getMasterDb();

  const result = await processRunProgress(input, {
    applyProgress: async (perEvent) => {
      // Single CTE returning two booleans:
      //   - exists  → is there ANY row with this id?
      //   - updated → did the WHERE id=$1 AND status='running' UPDATE
      //               actually match?
      //
      // tableCompleted=true bumps table_count by 1 in addition to the
      // record-count bump. COALESCE handles the schema's nullable columns
      // (Phase 8a writes nulls on row creation; treat null as 0 for the
      // increment).
      const rows = await db.execute(sql`
        WITH existing AS (
          SELECT id FROM baseout.backup_runs WHERE id = ${perEvent.runId}
        ),
        updated AS (
          UPDATE baseout.backup_runs
          SET
            record_count = COALESCE(record_count, 0) + ${perEvent.recordsAppended},
            table_count = COALESCE(table_count, 0) + ${
              perEvent.tableCompleted ? sql`1` : sql`0`
            },
            modified_at = NOW()
          WHERE id = ${perEvent.runId} AND status = 'running'
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
    return jsonResponse(
      { ok: true, kind: result.kind },
      statusFor(result),
    );
  }
  return jsonResponse({ error: result.error }, statusFor(result));
}
