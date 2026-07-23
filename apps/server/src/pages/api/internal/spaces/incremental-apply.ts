// POST /api/internal/spaces/:spaceId/incremental-apply
//
// Engine-brokered per-space write seam for the incremental (webhook-driven)
// backup task (openspec/changes/server-dynamic-mode, re-scoped; Option B of
// system-per-space-db §3). One URL, `op`-dispatched — the workflows wrapper
// (apps/workflows/trigger/tasks/incremental-backup.task.ts) wires each of its
// IncrementalDb methods to one op here:
//
//   openBaseRun            → op: open-base-run            { backupRunId, baseId }
//   completeBaseRun        → op: complete-base-run        { baseRunId, status, counts, errorMessage? }
//   applySchemaEvents      → op: apply-schema-events      { baseRunId, baseId, writes: SchemaWrite[] }
//   applyRecordEvents      → op: apply-record-events      { baseRunId, baseId, writes: RecordWrite[] }
//   getStoredRecords       → op: get-stored-records       { tableId, recordIds }
//   insertSchemaVersion    → op: insert-schema-version    { baseRunId, baseId, schemaHash, schemaJson }
//   getAppliedSchemaState  → op: get-applied-schema-state { baseId }
//   regenerateViews        → op: regenerate-views         { tableIds }   (honest no-op today)
//   listStoredRecordIds    → op: list-stored-record-ids   { tableId }
//   listTableIds           → op: list-table-ids           { baseId }
//
// regenerate-views acknowledges without work: per-table query views are not
// generated yet (system-per-space-db §4.1–4.3 deferred); the response carries
// `regenerated:false, reason:'views_not_generated'` so the caller sees the gap.
//
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import {
  parseIncrementalApplyBody,
  planRecordWrites,
  planSchemaWrites,
} from "../../../../lib/per-space/incremental-apply";
import {
  applyIncrementalRecordPlan,
  applyIncrementalSchemaPlan,
  completeIncrementalBaseRun,
  getAppliedSchemaState,
  getStoredRecords,
  insertSchemaVersionDeduped,
  listStoredRecordIds,
  listTableIds,
  openIncrementalBaseRun,
} from "../../../../lib/per-space/incremental-io";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import { ensureSpaceSchemaCurrent } from "../../../../lib/provisioning/upgrade";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesIncrementalApplyHandler(
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
  const parsed = parseIncrementalApplyBody(raw);
  if (!parsed.ok) return jsonResponse({ error: "invalid_request", reason: parsed.reason }, 400);
  const req = parsed.req;

  const { db: masterDb, sql } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }
  const pgLocator = space.pgLocator;

  // regenerate-views is DB-free today — acknowledge before opening a tx.
  if (req.op === "regenerate-views") {
    return jsonResponse({ ok: true, regenerated: false, reason: "views_not_generated" }, 200);
  }

  // Best-effort lazy upgrade once per pass, at the pass's opening op — the
  // remaining ops of the same pass ride the already-current schema.
  if (req.op === "open-base-run") {
    try {
      await ensureSpaceSchemaCurrent(masterDb, sql, {
        spaceId,
        pgLocator,
        schemaVersion: space.schemaVersion,
      });
    } catch {
      // ignored — re-attempted on the next pass.
    }
  }

  try {
    const result = await withSpaceSchema(masterDb, pgLocator, async (tx) => {
      switch (req.op) {
        case "open-base-run": {
          const { baseRunId } = await openIncrementalBaseRun(tx, {
            backupRunId: req.backupRunId,
            baseId: req.baseId,
          });
          return { ok: true, baseRunId };
        }
        case "complete-base-run":
          await completeIncrementalBaseRun(tx, {
            baseRunId: req.baseRunId,
            status: req.status,
            counts: req.counts,
            ...(req.errorMessage !== undefined ? { errorMessage: req.errorMessage } : {}),
          });
          return { ok: true };
        case "apply-schema-events": {
          const plan = planSchemaWrites(req.writes);
          const { applied, logged } = await applyIncrementalSchemaPlan(tx, {
            baseId: req.baseId,
            baseRunId: req.baseRunId,
            plan,
          });
          return { ok: true, applied, logged, skippedViews: plan.skippedViews };
        }
        case "apply-record-events": {
          const plan = planRecordWrites(req.writes);
          const { applied, logged } = await applyIncrementalRecordPlan(tx, {
            baseId: req.baseId,
            baseRunId: req.baseRunId,
            plan,
          });
          return { ok: true, applied, logged };
        }
        case "get-stored-records":
          return { ok: true, records: await getStoredRecords(tx, req.tableId, req.recordIds) };
        case "insert-schema-version": {
          const { inserted } = await insertSchemaVersionDeduped(tx, {
            baseId: req.baseId,
            baseRunId: req.baseRunId,
            schemaHash: req.schemaHash,
            schemaJson: req.schemaJson,
          });
          return { ok: true, inserted };
        }
        case "get-applied-schema-state":
          return { ok: true, state: await getAppliedSchemaState(tx, req.baseId) };
        case "list-stored-record-ids":
          return { ok: true, recordIds: await listStoredRecordIds(tx, req.tableId) };
        case "list-table-ids":
          return { ok: true, tableIds: await listTableIds(tx, req.baseId) };
      }
    });
    return jsonResponse(result, 200);
  } catch (err) {
    return jsonResponse(
      { error: "apply_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
