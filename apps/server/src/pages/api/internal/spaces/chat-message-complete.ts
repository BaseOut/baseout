// POST /api/internal/spaces/:spaceId/chat/message-complete
//        { threadId, messageId, content, status }
//
// The workflows chat-respond task POSTs the generated reply here; the engine
// flips the pending assistant message to complete (or error). Mirrors the other
// workflows-target sync routes' guards.
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import { completeAssistantMessage } from "../../../../lib/per-space/chat-io";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesChatMessageCompleteHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: "invalid_request" }, 400);

  let body: { messageId?: unknown; content?: unknown; status?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  if (!UUID_RE.test(String(body.messageId))) return jsonResponse({ error: "invalid_request" }, 400);
  if (typeof body.content !== "string") return jsonResponse({ error: "invalid_request" }, 400);
  const status = body.status === "error" ? "error" : "complete";

  const { db: masterDb } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }

  try {
    const ok = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
      completeAssistantMessage(tx, {
        messageId: String(body.messageId),
        content: body.content as string,
        status,
      }),
    );
    if (!ok) return jsonResponse({ error: "not_found" }, 404);
    return jsonResponse({ ok: true }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "chat_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
