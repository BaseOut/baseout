// POST /api/internal/spaces/:spaceId/schema-sync
//
// The workflows backup writer POSTs the captured Airtable schema for ONE base;
// the engine diffs it against the per-Space DB's current working set and writes
// bo_at_schema_versions (hash-deduped) + bo_at_{bases,tables,fields,views}
// lifecycle + bo_at_schema_updates. Returns recordsEnabled so the writer knows
// whether to follow up with /records-sync. Runs regardless of records_enabled —
// the per-Space DB always holds schema.
//
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { diffSchema, type CapturedBase } from "../../../../lib/per-space/schema-diff";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import {
  applySchemaDiff,
  ensureBaseRun,
  readSchemaWorkingSet,
  withSpaceSchema,
} from "../../../../lib/per-space/space-db-pg";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesSchemaSyncHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
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
  const body = raw as { backupRunId?: unknown; captured?: unknown; confident?: unknown };
  if (!UUID_RE.test(String(body.backupRunId))) return jsonResponse({ error: "invalid_request" }, 400);
  const captured = body.captured as CapturedBase | undefined;
  if (!captured || typeof captured.baseId !== "string" || !Array.isArray(captured.tables)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  const backupRunId = String(body.backupRunId);
  const confident = body.confident !== false; // default true (full schema capture)

  const { db: masterDb } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }

  try {
    const { baseRunId, result } = await withSpaceSchema(masterDb, space.pgLocator, async (tx) => {
      const baseRunId = await ensureBaseRun(tx, backupRunId, captured.baseId);
      const prior = await readSchemaWorkingSet(tx, captured.baseId);
      const result = diffSchema({ captured, prior, runId: baseRunId, confident });
      await applySchemaDiff(tx, { baseId: captured.baseId, baseRunId, result, schemaJson: captured });
      return { baseRunId, result };
    });
    return jsonResponse(
      {
        ok: true,
        baseRunId,
        recordsEnabled: space.recordsEnabled,
        schemaChanged: result.schemaChanged,
        lifecycle: result.lifecycle.length,
        updates: result.schemaUpdates.length,
      },
      200,
    );
  } catch (err) {
    return jsonResponse(
      { error: "sync_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
