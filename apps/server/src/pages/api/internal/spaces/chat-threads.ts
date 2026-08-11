// GET  /api/internal/spaces/:spaceId/chat/threads[?includeArchived=1]  — list
// POST /api/internal/spaces/:spaceId/chat/threads                       — create
//
// apps/web's Chat tab lists + creates threads. Mirrors the per-Space read guards.
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import { ensureSpaceSchemaCurrent } from "../../../../lib/provisioning/upgrade";
import { createThread, listThreads } from "../../../../lib/per-space/chat-io";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesChatThreadsHandler(
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
    if (request.method === "POST") {
      let createdByUserId: string | null = null;
      try {
        const body = (await request.json()) as { createdByUserId?: unknown };
        if (typeof body.createdByUserId === "string") createdByUserId = body.createdByUserId;
      } catch {
        // empty body is fine
      }
      const created = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
        createThread(tx, { createdByUserId }),
      );
      return jsonResponse({ ok: true, id: created.id }, 201);
    }

    const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "1";
    const threads = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
      listThreads(tx, { includeArchived }),
    );
    return jsonResponse({ ok: true, threads }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "chat_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
