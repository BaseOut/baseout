// GET /api/internal/spaces/:spaceId/interfaces?[baseId][&includeRemoved=1]
//
// apps/web's Interfaces tab lists apps (bo_at_interfaces) + pages (bo_at_pages)
// as a unified type=interface|page view with parentId. Guard chain mirrors
// relationships-overview.
//
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import { ensureSpaceSchemaCurrent } from "../../../../lib/provisioning/upgrade";
import { listInterfaces } from "../../../../lib/per-space/automations-interfaces-io";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesInterfacesHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: "invalid_request" }, 400);

  const sp = new URL(request.url).searchParams;
  const baseId = sp.get("baseId") ?? undefined;
  const includeRemoved = sp.get("includeRemoved") === "1";

  const { db: masterDb, sql } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }

  try {
    await ensureSpaceSchemaCurrent(masterDb, sql, {
      spaceId,
      pgLocator: space.pgLocator,
      schemaVersion: space.schemaVersion,
    });
    const interfaces = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
      listInterfaces(tx, { baseId, includeRemoved }),
    );
    return jsonResponse({ ok: true, interfaces }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "read_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
