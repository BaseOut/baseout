// GET /api/internal/runs/:runId/detail
//
// Returns the per-base/per-table snapshot for a run, assembled from
// backup_run_bases + backup_run_tables (openspec/changes/server-run-detail).
//
// Token gate is applied by middleware (path begins /api/internal/). This
// handler validates URL shape (UUID) + method, then queries the snapshot tables.
//
// An empty `bases` array is a valid 200 response — it means the run exists
// (or has just not completed yet) but no per-table detail was submitted.
// Legacy completions before workflows-run-detail never write snapshot rows.
//
// HTTP status mapping:
//   200 { bases: [...] }  — success (empty array is valid)
//   400 { error: 'invalid_request' }  — malformed runId
//   405 { error: 'method_not_allowed' }  — non-GET request

import { eq, inArray } from "drizzle-orm";
import type { AppLocals, Env } from "../../../../env";
import { backupRunBases, backupRunTables } from "../../../../db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function runsDetailHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  runId: string,
): Promise<Response> {
  if (request.method !== "GET") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  if (!UUID_RE.test(runId)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const { db } = locals.getMasterDb();

  // Fetch all base snapshots for the run.
  const bases = await db
    .select()
    .from(backupRunBases)
    .where(eq(backupRunBases.runId, runId));

  if (bases.length === 0) {
    return jsonResponse({ bases: [] }, 200);
  }

  // Fetch all table snapshots for the found bases in a single query.
  const baseIds = bases.map((b) => b.id);
  // inArray requires at least one element — guaranteed since bases.length > 0.
  const allTables = await db
    .select()
    .from(backupRunTables)
    .where(inArray(backupRunTables.runBaseId, baseIds));

  // Group tables by runBaseId.
  const tablesByBaseId = new Map<string, typeof allTables>();
  for (const t of allTables) {
    let group = tablesByBaseId.get(t.runBaseId);
    if (!group) {
      group = [];
      tablesByBaseId.set(t.runBaseId, group);
    }
    group.push(t);
  }

  const responseBody = {
    bases: bases.map((b) => ({
      atBaseId: b.atBaseId,
      baseName: b.baseName,
      status: b.status,
      tablesCount: b.tablesCount,
      recordsCount: b.recordsCount,
      attachmentsCount: b.attachmentsCount,
      startedAt: b.startedAt ? b.startedAt.toISOString() : null,
      completedAt: b.completedAt ? b.completedAt.toISOString() : null,
      errorMessage: b.errorMessage,
      tables: (tablesByBaseId.get(b.id) ?? []).map((t) => ({
        tableId: t.tableId,
        tableName: t.tableName,
        recordCount: t.recordCount,
        fieldCount: t.fieldCount,
        attachmentCount: t.attachmentCount,
      })),
    })),
  };

  return jsonResponse(responseBody, 200);
}
