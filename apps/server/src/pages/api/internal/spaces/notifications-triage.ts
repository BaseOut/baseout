// POST /api/internal/spaces/:spaceId/notifications/triage
//
// Idempotent triage upsert for the web Inbox (server-notifications-inbox):
// { itemId, action: 'read'|'unread'|'done'|'undone'|'snooze'|'unsnooze',
//   snoozedUntil? } → bo_at_inbox_state. `done` on a state-backed id (conn:*)
// is rejected 422 — those rows self-heal (web spec: no Mark done). The triage
// decision is validated BEFORE any DB access (triagePatch is pure), so
// malformed commands never touch the Space.
//
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import { ensureSpaceSchemaCurrent } from "../../../../lib/provisioning/upgrade";
import {
  applyTriage,
  triagePatch,
  InvalidTriageError,
  StateBackedDoneError,
} from "../../../../lib/notifications/io";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesNotificationsTriageHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: "invalid_request" }, 400);

  let body: { itemId?: unknown; action?: unknown; snoozedUntil?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "invalid_request", message: "body must be JSON" }, 400);
  }
  const itemId = typeof body.itemId === "string" ? body.itemId : "";
  const action = typeof body.action === "string" ? body.action : "";
  const snoozedUntil = typeof body.snoozedUntil === "string" ? body.snoozedUntil : undefined;

  // Decide (and reject) before touching the DB — pure validation.
  try {
    triagePatch(itemId, action, snoozedUntil);
  } catch (err) {
    if (err instanceof StateBackedDoneError) {
      return jsonResponse({ error: "state_backed_item", message: err.message }, 422);
    }
    if (err instanceof InvalidTriageError) {
      return jsonResponse({ error: "invalid_request", message: err.message }, 400);
    }
    throw err;
  }

  const { db: masterDb, sql } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }
  const pgLocator = space.pgLocator;

  try {
    await ensureSpaceSchemaCurrent(masterDb, sql, {
      spaceId,
      pgLocator,
      schemaVersion: space.schemaVersion,
    });
    await withSpaceSchema(masterDb, pgLocator, (tx) =>
      applyTriage(tx, { itemId, action, snoozedUntil }),
    );
    return jsonResponse({ ok: true }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "write_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
