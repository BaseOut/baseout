// GET /api/internal/spaces/:spaceId/notifications
//
// Engine-brokered alert feed for the web Inbox (server-notifications-inbox).
// Recomputes the feed from live sources (master backup_runs + connections for
// the Space, per-Space bo_at_schema_updates) and merges the persisted triage
// state — derivation, not a mailbox. Returns { ok, items } where each item
// matches the web `InboxItem` shape minus `space` (web fans out across the
// account's Spaces and labels rows itself). Mirrors the schema-changelog
// guards.
//
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import { ensureSpaceSchemaCurrent } from "../../../../lib/provisioning/upgrade";
import {
  loadInboxFeed,
  readMasterInboxSources,
  readSpaceInboxSources,
} from "../../../../lib/notifications/io";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesNotificationsHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: "invalid_request" }, 400);

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
    const items = await loadInboxFeed({
      now: new Date(),
      loadMasterSources: (since) => readMasterInboxSources(masterDb, spaceId, since),
      loadSpaceSources: (since) =>
        withSpaceSchema(masterDb, pgLocator, (tx) => readSpaceInboxSources(tx, since)),
    });
    return jsonResponse({ ok: true, items }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "read_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
