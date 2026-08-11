// POST /api/internal/spaces/:spaceId/collaborators-sync
//
// The workflows courier (workflows-base-collaborators) fetches
// GET /v0/meta/bases/{id}?include=collaborators&inviteLinks&interfaces&packages
// during the backup run and POSTs the body VERBATIM here as `metadata`. The
// engine owns ALL parsing (collaborators-sync.ts): principals + grants + invite
// links + base meta, with run-over-run per-base full-state diffing. A skipped
// capture (courier posts nothing) never reaches this route, so absence never
// triggers deletion diffing.
//
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { diffBaseAccess, ingestBaseMetadata } from "../../../../lib/per-space/collaborators-sync";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import {
  applyCollaboratorCapture,
  ensureBaseRun,
  readBaseGrants,
  readBaseInviteLinks,
  withSpaceSchema,
} from "../../../../lib/per-space/space-db-pg";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesCollaboratorsSyncHandler(
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
  const body = raw as { backupRunId?: unknown; baseId?: unknown; metadata?: unknown };
  if (!UUID_RE.test(String(body.backupRunId))) return jsonResponse({ error: "invalid_request" }, 400);
  if (typeof body.baseId !== "string" || typeof body.metadata !== "object" || body.metadata === null) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  const backupRunId = String(body.backupRunId);
  const baseId = body.baseId;

  const ingest = ingestBaseMetadata(baseId, body.metadata);

  const { db: masterDb } = locals.getMasterDb();
  const space = await resolveSpaceDb(masterDb, spaceId);
  if (!space || space.status !== "active") return jsonResponse({ error: "space_db_not_ready" }, 409);
  if (space.backend !== "managed_pg" || !space.pgLocator) {
    return jsonResponse({ error: "backend_not_implemented" }, 501);
  }

  try {
    const result = await withSpaceSchema(masterDb, space.pgLocator, async (tx) => {
      const baseRunId = await ensureBaseRun(tx, backupRunId, baseId);
      const priorGrants = await readBaseGrants(tx, baseId);
      const priorInviteLinks = await readBaseInviteLinks(tx, baseId);
      const diff = diffBaseAccess({
        baseId,
        observed: ingest.grants,
        priorGrants,
        observedInviteLinks: ingest.inviteLinks,
        priorInviteLinks,
      });
      await applyCollaboratorCapture(tx, { baseRunId, ingest, diff });
      return diff;
    });

    return jsonResponse(
      {
        ok: true,
        principals: ingest.principals.length,
        grants: result.grantUpserts.length,
        grantsDeleted: result.grantDeletions.length,
        inviteLinks: result.inviteUpserts.length,
        inviteLinksDeleted: result.inviteDeletions.length,
      },
      200,
    );
  } catch (err) {
    return jsonResponse(
      { error: "sync_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
