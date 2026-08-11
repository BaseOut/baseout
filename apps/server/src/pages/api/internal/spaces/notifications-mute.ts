// POST /api/internal/spaces/:spaceId/notifications/mute
//
// Idempotent per-base mute flip for the web Inbox (server-notifications-inbox):
// { baseId, muted: boolean } → bo_at_inbox_mutes (row present = muted). Muted
// bases drop activity-lane rows only from the derived feed — attention rows
// ignore mutes per the web spec.
//
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import { ensureSpaceSchemaCurrent } from "../../../../lib/provisioning/upgrade";
import { applyMute } from "../../../../lib/notifications/io";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesNotificationsMuteHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: "invalid_request" }, 400);

  let body: { baseId?: unknown; muted?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "invalid_request", message: "body must be JSON" }, 400);
  }
  const baseId = typeof body.baseId === "string" ? body.baseId : "";
  if (!baseId || typeof body.muted !== "boolean") {
    return jsonResponse(
      { error: "invalid_request", message: "baseId (string) and muted (boolean) are required" },
      400,
    );
  }
  const muted = body.muted;

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
    await withSpaceSchema(masterDb, pgLocator, (tx) => applyMute(tx, { baseId, muted }));
    return jsonResponse({ ok: true }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "write_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
