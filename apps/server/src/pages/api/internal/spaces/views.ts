// /api/internal/spaces/:spaceId/views
//   GET  → list saved views (Data Browse presets)
//   POST → create a saved view
//
// Saved-views broker (server-saved-views D2), cloned from the documents broker
// shape. apps/web and apps/api proxy here; the browser/agent never touches the
// per-Space DB. Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { ensureSpaceSchemaCurrent } from "../../../../lib/provisioning/upgrade";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import { createSavedView, listSavedViews } from "../../../../lib/per-space/saved-views";
import { parseCreateSavedView, type SavedViewCreateInput } from "../../../../lib/per-space/saved-views-logic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesViewsHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: "invalid_request" }, 400);

  let input: SavedViewCreateInput | undefined;
  if (request.method === "POST") {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return jsonResponse({ error: "invalid_request" }, 400);
    }
    const parsed = parseCreateSavedView(raw);
    if (!parsed) return jsonResponse({ error: "invalid_request" }, 400);
    input = parsed;
  }

  const { db: masterDb, sql } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }

  try {
    // bo_at_saved_views arrived at per-Space schema v15 — bring an older Space
    // forward before touching the table (lazy upgrade, system-per-space-upgrade).
    await ensureSpaceSchemaCurrent(masterDb, sql, {
      spaceId,
      pgLocator: space.pgLocator,
      schemaVersion: space.schemaVersion,
    });

    if (request.method === "GET") {
      const views = await withSpaceSchema(masterDb, space.pgLocator, (tx) => listSavedViews(tx));
      return jsonResponse({ ok: true, views }, 200);
    }
    const view = await withSpaceSchema(masterDb, space.pgLocator, (tx) => createSavedView(tx, input!));
    return jsonResponse({ ok: true, view }, 201);
  } catch (err) {
    return jsonResponse(
      { error: "views_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
