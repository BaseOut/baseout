// POST /api/internal/spaces/:spaceId/rescan-bases
//
// Workspace rediscovery — the engine path that picks up Airtable bases
// added to a workspace after OAuth. apps/web's POST
// /api/spaces/:spaceId/rescan-bases proxies here via the BACKUP_ENGINE
// service binding; SpaceDO.alarm() also routes through the same pure
// orchestrator (Phase 4) so the policy is shared.
//
// Token gate is applied by middleware (path begins /api/internal/). This
// handler validates URL shape (UUID), then delegates to the pure
// `runWorkspaceRediscovery` function with production deps that read the
// per-config + organizationId + active Airtable connection from the
// master DB.
//
// Result-code → HTTP-status mapping:
//   ok                    → 200 { ok, discovered, autoAdded, blockedByTier }
//   space_not_found       → 404
//   config_not_found      → 404
//   connection_not_found  → 409  (Space has no active Airtable connection)
//   airtable_error        → 502  { error, upstream_status? }

import type { AppLocals, Env } from "../../../../env";
import { runWorkspaceRediscovery } from "../../../../lib/rediscovery/run";
import { buildRediscoveryDeps } from "../../../../lib/rediscovery/run-deps";
import { AirtableError } from "../../../../lib/airtable/client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesRescanBasesHandler(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  if (!UUID_RE.test(spaceId)) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const { db } = locals.getMasterDb();
  const deps = await buildRediscoveryDeps({
    db,
    spaceId,
    triggeredBy: "manual",
    encryptionKey: env.BASEOUT_ENCRYPTION_KEY,
  });

  if (!deps.ok) {
    switch (deps.error) {
      case "space_not_found":
      case "config_not_found":
        return jsonResponse({ error: deps.error }, 404);
      case "connection_not_found":
        return jsonResponse({ error: deps.error }, 409);
    }
  }

  try {
    const result = await runWorkspaceRediscovery(
      {
        spaceId,
        configId: deps.context.configId,
        organizationId: deps.context.organizationId,
        triggeredBy: "manual",
      },
      deps.deps,
    );
    return jsonResponse({ ok: true, ...result }, 200);
  } catch (err) {
    if (err instanceof AirtableError) {
      return jsonResponse(
        { error: "airtable_error", upstream_status: err.status },
        502,
      );
    }
    throw err;
  }
}
