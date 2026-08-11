// POST /api/internal/spaces/:spaceId/health-prompt
//   { ruleId, level: 'space' | 'entity', targetType?, targetId?, prompt: string|null }
//
// Edit (or reset, when prompt is null) a metric's prompt — space-level or a
// per-entity override (server-schema-health-scoring §4.2c). Pro+ gated web-side.
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import { ensureSpaceSchemaCurrent } from "../../../../lib/provisioning/upgrade";
import { setEntityOverride, setSpacePrompt } from "../../../../lib/per-space/health-config-io";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesHealthPromptHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: "invalid_request" }, 400);

  let body: {
    ruleId?: unknown;
    level?: unknown;
    targetType?: unknown;
    targetId?: unknown;
    prompt?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  if (typeof body.ruleId !== "string" || body.ruleId.length === 0) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  if (body.level !== "space" && body.level !== "entity") {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  // prompt: a non-empty string sets it; null resets it.
  const prompt =
    body.prompt === null ? null : typeof body.prompt === "string" && body.prompt.length > 0 ? body.prompt : undefined;
  if (prompt === undefined) return jsonResponse({ error: "invalid_request" }, 400);
  if (body.level === "entity" && (typeof body.targetType !== "string" || typeof body.targetId !== "string")) {
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
    await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
      body.level === "space"
        ? setSpacePrompt(tx, { ruleId: body.ruleId as string, prompt })
        : setEntityOverride(tx, {
            ruleId: body.ruleId as string,
            targetType: body.targetType as string,
            targetId: body.targetId as string,
            prompt,
          }),
    );
    return jsonResponse({ ok: true }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "prompt_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
