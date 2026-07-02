// POST /api/internal/spaces/:spaceId/relationships/sync   { baseId, runId }
//
// The workflows relationship-inference task triggers this per run AFTER a schema
// capture. The heuristic runs engine-side (data locality — the engine already
// holds the per-Space schema), reading tables/fields + prior dismissals from the
// per-Space DB, then upserting synced-view candidates. Mirrors health-sync's
// guards. (Architecture note: inference is engine-side rather than computed in
// the Node runner to avoid shipping the schema over the wire and back.)
//
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import { inferAndWriteSyncedViews } from "../../../../lib/per-space/relationships-io";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesRelationshipsSyncHandler(
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
  const body = raw as { baseId?: unknown; runId?: unknown };
  if (typeof body.baseId !== "string" || body.baseId.length === 0) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  if (!UUID_RE.test(String(body.runId))) return jsonResponse({ error: "invalid_request" }, 400);

  const { db: masterDb } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }

  try {
    const result = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
      inferAndWriteSyncedViews(tx, {
        baseId: body.baseId as string,
        runId: String(body.runId),
      }),
    );
    return jsonResponse({ ok: true, ...result }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "sync_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
