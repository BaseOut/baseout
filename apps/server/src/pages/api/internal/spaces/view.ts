// /api/internal/spaces/:spaceId/views/:viewId
//   GET    → one saved view
//   PATCH  → update name/config/pinned/sortOrder (tableId immutable → 400 table_locked)
//   DELETE → delete the saved view
//
// Saved-views broker (server-saved-views D2/D3), cloned from the documents
// broker shape. Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { ensureSpaceSchemaCurrent } from "../../../../lib/provisioning/upgrade";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import { deleteSavedView, getSavedView, updateSavedView } from "../../../../lib/per-space/saved-views";
import { parsePatchSavedView, type SavedViewPatch } from "../../../../lib/per-space/saved-views-logic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesViewHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
  viewId: string,
): Promise<Response> {
  const method = request.method;
  if (method !== "GET" && method !== "PATCH" && method !== "DELETE") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  if (!UUID_RE.test(spaceId) || !UUID_RE.test(viewId)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  let patch: SavedViewPatch | undefined;
  if (method === "PATCH") {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return jsonResponse({ error: "invalid_request" }, 400);
    }
    const parsed = parsePatchSavedView(raw);
    if (!parsed.ok) return jsonResponse({ error: parsed.code }, 400);
    patch = parsed.patch;
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

    if (method === "GET") {
      const view = await withSpaceSchema(masterDb, space.pgLocator, (tx) => getSavedView(tx, viewId));
      if (!view) return jsonResponse({ error: "view_not_found" }, 404);
      return jsonResponse({ ok: true, view }, 200);
    }
    if (method === "PATCH") {
      const view = await withSpaceSchema(masterDb, space.pgLocator, (tx) => updateSavedView(tx, viewId, patch!));
      if (!view) return jsonResponse({ error: "view_not_found" }, 404);
      return jsonResponse({ ok: true, view }, 200);
    }
    const existed = await withSpaceSchema(masterDb, space.pgLocator, (tx) => deleteSavedView(tx, viewId));
    if (!existed) return jsonResponse({ error: "view_not_found" }, 404);
    return jsonResponse({ ok: true }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "view_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
