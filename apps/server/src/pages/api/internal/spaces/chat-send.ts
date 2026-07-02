// POST /api/internal/spaces/:spaceId/chat/send   { threadId, message }
//
// Appends the user message + a pending assistant message, assembles the
// metadata-only context for the thread's scope, and enqueues the workflows
// chat-respond task (which generates the reply + POSTs /chat/message-complete).
// The Chat tab polls the thread until the pending message resolves.
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import { ensureSpaceSchemaCurrent } from "../../../../lib/provisioning/upgrade";
import {
  appendTurn,
  assembleThreadContext,
  completeAssistantMessage,
  getThread,
} from "../../../../lib/per-space/chat-io";
import { enqueueChatRespond } from "../../../../lib/trigger-client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesChatSendHandler(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: "invalid_request" }, 400);

  let body: { threadId?: unknown; message?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  if (!UUID_RE.test(String(body.threadId))) return jsonResponse({ error: "invalid_request" }, 400);
  if (typeof body.message !== "string" || body.message.trim().length === 0) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  const threadId = String(body.threadId);
  const message = body.message;

  const { db: masterDb, sql } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }

  let prepared: {
    userMessageId: string;
    assistantMessageId: string;
    history: { role: string; content: string }[];
    context: string;
  } | null;
  try {
    await ensureSpaceSchemaCurrent(masterDb, sql, {
      spaceId,
      pgLocator: space.pgLocator,
      schemaVersion: space.schemaVersion,
    });
    prepared = await withSpaceSchema(masterDb, space.pgLocator!, async (tx) => {
      const thread = await getThread(tx, threadId);
      if (!thread) return null;
      const turn = await appendTurn(tx, { threadId, content: message });
      if (!turn) return null;
      const context = await assembleThreadContext(tx, {
        scope: thread.scope,
        attachedDocIds: thread.attachedDocIds,
      });
      return { ...turn, context };
    });
  } catch (err) {
    return jsonResponse(
      { error: "chat_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }

  if (!prepared) return jsonResponse({ error: "not_found" }, 404);

  // Enqueue the reply AFTER the tx commits so the task sees the pending row. On
  // enqueue failure, flip the pending message to error so the UI stops waiting.
  try {
    await enqueueChatRespond(env, {
      spaceId,
      threadId,
      assistantMessageId: prepared.assistantMessageId,
      context: prepared.context,
      history: prepared.history.map((h) => ({
        role: h.role === "assistant" ? "assistant" : "user",
        content: h.content,
      })),
      userMessage: message,
    });
  } catch {
    await withSpaceSchema(masterDb, space.pgLocator!, (tx) =>
      completeAssistantMessage(tx, {
        messageId: prepared!.assistantMessageId,
        content: "Sorry — I couldn't start a reply just now. Please try again.",
        status: "error",
      }),
    ).catch(() => {});
    return jsonResponse({ error: "enqueue_failed" }, 502);
  }

  return jsonResponse(
    { ok: true, userMessageId: prepared.userMessageId, assistantMessageId: prepared.assistantMessageId },
    200,
  );
}
