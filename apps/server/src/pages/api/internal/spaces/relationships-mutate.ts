// POST /api/internal/spaces/:spaceId/relationships/mutate
//
// apps/web's Relationships tab confirms/dismisses an inferred synced-view
// candidate, or creates a user-authored one. Single mutate route with an
// `action` discriminator. Mirrors the schema-docs mutation guards.
//
//   { action: 'confirm' | 'dismiss', id }
//   { action: 'create', baseId, sourceTableId, destTableId }
//
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import {
  createUserSyncedView,
  setSyncedViewStatus,
} from "../../../../lib/per-space/relationships-io";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesRelationshipsMutateHandler(
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
  const body = raw as {
    action?: unknown;
    id?: unknown;
    baseId?: unknown;
    sourceTableId?: unknown;
    destTableId?: unknown;
  };
  const action = body.action;
  if (action !== "confirm" && action !== "dismiss" && action !== "create") {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const { db: masterDb } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }

  try {
    if (action === "create") {
      if (
        typeof body.baseId !== "string" ||
        typeof body.sourceTableId !== "string" ||
        typeof body.destTableId !== "string" ||
        body.sourceTableId === body.destTableId
      ) {
        return jsonResponse({ error: "invalid_request" }, 400);
      }
      // Canonicalize source<dest so it dedupes with inferred rows.
      const [s, d] =
        body.sourceTableId < body.destTableId
          ? [body.sourceTableId, body.destTableId]
          : [body.destTableId, body.sourceTableId];
      const result = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
        createUserSyncedView(tx, { baseId: body.baseId as string, sourceTableId: s, destTableId: d }),
      );
      return jsonResponse({ ok: true, id: result.id }, 200);
    }

    if (typeof body.id !== "string" || body.id.length === 0) {
      return jsonResponse({ error: "invalid_request" }, 400);
    }
    const ok = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
      setSyncedViewStatus(tx, {
        id: body.id as string,
        status: action === "confirm" ? "confirmed" : "dismissed",
      }),
    );
    if (!ok) return jsonResponse({ error: "not_found" }, 404);
    return jsonResponse({ ok: true }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "mutate_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
