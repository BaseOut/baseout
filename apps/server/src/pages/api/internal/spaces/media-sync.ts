// POST /api/internal/spaces/:spaceId/media-sync
//
// The workflows backup task streams batched attachment metadata during the
// attachment fan-out (workflows-media-metadata); the engine merges it into the
// per-Space media index — bo_at_assets upserted by content checksum (dedup =
// one asset, N refs), bo_at_asset_refs upserted by Airtable attachment id.
// Ref removal only on a `complete` record capture; assets are never deleted
// here (zero live refs stamps zero_ref_since for the retention machinery).
// Idempotent by construction — delivery gaps self-heal on the next run.
//
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { diffMediaBatch, extractMediaBatch } from "../../../../lib/per-space/media-sync";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import {
  applyMediaBatch,
  ensureBaseRun,
  readMediaWorkingSet,
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

export async function spacesMediaSyncHandler(
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
  const body = raw as { backupRunId?: unknown; baseId?: unknown; records?: unknown };
  if (!UUID_RE.test(String(body.backupRunId))) return jsonResponse({ error: "invalid_request" }, 400);
  if (typeof body.baseId !== "string" || !Array.isArray(body.records)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  const backupRunId = String(body.backupRunId);
  const baseId = body.baseId;
  const batch = extractMediaBatch(body.records);

  const { db: masterDb } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }

  try {
    const result = await withSpaceSchema(masterDb, space.pgLocator, async (tx) => {
      const baseRunId = await ensureBaseRun(tx, backupRunId, baseId);
      const prior = await readMediaWorkingSet(
        tx,
        batch.records.map((r) => r.recordId),
      );
      const diff = diffMediaBatch({ baseId, batch, prior });
      await applyMediaBatch(tx, { baseRunId, diff });
      return diff;
    });

    return jsonResponse(
      {
        ok: true,
        records: batch.records.length,
        assets: result.assetUpserts.length,
        refs: result.refUpserts.length,
        addedRefs: result.addedRefs,
        removedRefs: result.refRemovals.length,
        dropped: batch.dropped,
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
