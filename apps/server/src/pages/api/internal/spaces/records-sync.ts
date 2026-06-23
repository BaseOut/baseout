// POST /api/internal/spaces/:spaceId/records-sync
//
// The workflows backup writer POSTs the captured records for ONE table (only
// when the Space's per-Space DB has records enabled); the engine diffs them
// against bo_at_records + bo_at_record_field_data and writes the EAV cells +
// the bo_at_record_updates superseded-value log. A no-op (200) when records are
// disabled — schema-only Spaces still have a per-Space DB but no record tables.
//
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveDbUrl } from "../../../../db/worker";
import { diffRecords, type CapturedRecord } from "../../../../lib/per-space/record-diff";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import {
  applyRecordDiff,
  createSpacePgDb,
  ensureBaseRun,
  readRecordWorkingSet,
} from "../../../../lib/per-space/space-db-pg";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesRecordsSyncHandler(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: "invalid_request" }, 400);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  const body = raw as {
    backupRunId?: unknown;
    baseId?: unknown;
    tableId?: unknown;
    records?: unknown;
    confident?: unknown;
  };
  if (!UUID_RE.test(String(body.backupRunId))) return jsonResponse({ error: "invalid_request" }, 400);
  if (typeof body.baseId !== "string" || typeof body.tableId !== "string" || !Array.isArray(body.records)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  const backupRunId = String(body.backupRunId);
  const baseId = body.baseId;
  const tableId = body.tableId;
  const captured = body.records as CapturedRecord[];
  const confident = body.confident !== false;

  const { db: masterDb } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }
  if (!space.recordsEnabled) {
    return jsonResponse({ ok: true, skipped: "records_disabled" }, 200);
  }

  const { db: spaceDb, sql } = createSpacePgDb(resolveDbUrl(env), space.pgLocator);
  try {
    const baseRunId = await ensureBaseRun(spaceDb, backupRunId, baseId);
    const { priorRecords, priorCells } = await readRecordWorkingSet(spaceDb, tableId);
    const result = diffRecords({ tableId, captured, priorRecords, priorCells, runId: baseRunId, confident });
    await applyRecordDiff(spaceDb, { tableId, baseId, baseRunId, result });
    return jsonResponse(
      {
        ok: true,
        records: result.records.length,
        cells: result.cells.length,
        updates: result.recordUpdates.length,
      },
      200,
    );
  } finally {
    ctx.waitUntil(sql.end({ timeout: 5 }));
  }
}
