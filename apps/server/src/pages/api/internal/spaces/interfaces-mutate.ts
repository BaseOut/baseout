// POST /api/internal/spaces/:spaceId/interfaces/mutate
//
// Manual create / update / soft-remove for interface apps + pages.
//   { action: 'create', baseId, type: 'interface'|'page', parentId?, … }
//   { action: 'update', id, … }
//   { action: 'remove', id }
//
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import { ensureSpaceSchemaCurrent } from "../../../../lib/provisioning/upgrade";
import { mutateInterface } from "../../../../lib/per-space/automations-interfaces-io";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function statusFor(code: string): number {
  if (code === "duplicate_entity") return 409;
  if (code === "not_found") return 404;
  if (code === "invalid_parent" || code === "invalid_request") return 400;
  return 400;
}

export async function spacesInterfacesMutateHandler(
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
  const body = raw as { action?: unknown };
  if (body.action !== "create" && body.action !== "update" && body.action !== "remove") {
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
    const result = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
      mutateInterface(tx, body as Parameters<typeof mutateInterface>[1]),
    );
    if (!result.ok) {
      return jsonResponse({ error: result.code }, statusFor(result.code));
    }
    if ("entity" in result) {
      return jsonResponse({ ok: true, interface: result.entity }, 200);
    }
    return jsonResponse({ ok: true }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "mutate_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
