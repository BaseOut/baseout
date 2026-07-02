// GET   /api/internal/spaces/:spaceId/chat/threads/:threadId  — thread + messages
// PATCH /api/internal/spaces/:spaceId/chat/threads/:threadId  — rename/archive/context
//
// The Chat tab polls GET for the conversation (resolving pending replies) and
// PATCHes to rename, archive, or set the scope/attached-docs context.
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import { ensureSpaceSchemaCurrent } from "../../../../lib/provisioning/upgrade";
import {
  archiveThread,
  getThread,
  renameThread,
  setThreadContext,
} from "../../../../lib/per-space/chat-io";
import type { ChatScope } from "../../../../lib/per-space/chat-context";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesChatThreadHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
  threadId: string,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "PATCH") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  if (!UUID_RE.test(spaceId) || !UUID_RE.test(threadId)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

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
    if (request.method === "GET") {
      const thread = await withSpaceSchema(masterDb, space.pgLocator, (tx) => getThread(tx, threadId));
      if (!thread) return jsonResponse({ error: "not_found" }, 404);
      return jsonResponse({ ok: true, thread }, 200);
    }

    // PATCH — one of: { title } | { archived } | { scope, attachedDocIds }
    let body: { title?: unknown; archived?: unknown; scope?: unknown; attachedDocIds?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return jsonResponse({ error: "invalid_request" }, 400);
    }

    const ok = await withSpaceSchema(masterDb, space.pgLocator, async (tx) => {
      if (typeof body.title === "string") {
        return renameThread(tx, { id: threadId, title: body.title });
      }
      if (typeof body.archived === "boolean") {
        return archiveThread(tx, { id: threadId, archived: body.archived });
      }
      if ("scope" in body || "attachedDocIds" in body) {
        const scope = (body.scope as ChatScope | null) ?? null;
        const attachedDocIds = Array.isArray(body.attachedDocIds)
          ? (body.attachedDocIds as unknown[]).filter((x): x is string => typeof x === "string")
          : [];
        return setThreadContext(tx, { id: threadId, scope, attachedDocIds });
      }
      return null;
    });

    if (ok === null) return jsonResponse({ error: "invalid_request" }, 400);
    if (!ok) return jsonResponse({ error: "not_found" }, 404);
    return jsonResponse({ ok: true }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "chat_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
