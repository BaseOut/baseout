// POST /api/internal/runs/:runId/delete-complete
//
// Callback the apps/workflows delete-run-files task POSTs after attempting
// to delete every per-base prefix. On ok:true we hard-DELETE the
// backup_runs row (gated on status='deleting' so we don't accidentally
// wipe a row that's since been reset by an operator). On ok:false the
// row stays 'deleting' and we log the failure list — the future
// server-retention-orphan-sweep change handles reconciliation; for MVP
// an operator handles it via SQL.
//
// Token gate is applied by middleware (path begins /api/internal/). This
// handler validates URL shape (UUID) + JSON body shape, then writes.
//
// Result-code → HTTP-status mapping:
//   ok                          → 200  { ok: true, deleted: <bool> }
//   invalid_request             → 400
//
// Filed by openspec/changes/shared-backup-run-delete (Phase C.4).

import { and, eq, sql } from "drizzle-orm";
import type { AppLocals, Env } from "../../../../env";
import { backupRuns } from "../../../../db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

interface DeleteCompleteBody {
  runId: string;
  ok: boolean;
  results: Array<{
    prefix: string;
    deletedCount?: number;
    error?: string;
  }>;
}

function isDeleteCompleteBody(x: unknown): x is DeleteCompleteBody {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  if (typeof o.runId !== "string") return false;
  if (typeof o.ok !== "boolean") return false;
  if (!Array.isArray(o.results)) return false;
  return true;
}

export async function runsDeleteCompleteHandler(
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  if (!isDeleteCompleteBody(body)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const { db } = locals.getMasterDb();

  if (body.ok) {
    // Hard-DELETE the row, gated on status='deleting' so we don't blow
    // away anything an operator may have reset out of the deleting state.
    const rows = await db
      .delete(backupRuns)
      .where(
        and(
          eq(backupRuns.id, runId),
          sql`${backupRuns.status} = 'deleting'`,
        ),
      )
      .returning({ id: backupRuns.id });
    // event: 'backup_run_row_deleted' (intentional log — no console; the
    // structured logger lands in Phase E if it doesn't exist yet).
    return jsonResponse({ ok: true, deleted: rows.length > 0 }, 200);
  }

  // ok:false — row stays 'deleting'. Future retention-orphan-sweep
  // reconciles. For MVP, the failure list is captured by the workflows
  // task's caller-side log + the row's stuck status.
  // event: 'backup_run_delete_partial_failure', runId, results
  return jsonResponse(
    { ok: false, reason: "row_left_for_reconciliation" },
    200,
  );
}
