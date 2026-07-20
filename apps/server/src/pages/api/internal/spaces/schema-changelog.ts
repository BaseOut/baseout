// GET /api/internal/spaces/:spaceId/schema-changelog?baseId=appXXX[&limit=200]
//
// apps/web's Changelog tab reads a base's schema history: modifications
// (bo_at_schema_updates) + lifecycle removals (tables/fields/views), assembled at
// read time with run dates. No new capture. Mirrors the schema-read /
// relationships-overview guards.
//
// Token gate is applied by middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import { ensureSpaceSchemaCurrent } from "../../../../lib/provisioning/upgrade";
import { readSchemaChangelog } from "../../../../lib/per-space/schema-changelog-io";
import { clampLimit, paginateChangelog } from "../../../../lib/per-space/schema-query";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesSchemaChangelogHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: "invalid_request" }, 400);
  const sp = new URL(request.url).searchParams;
  const baseId = sp.get("baseId");
  if (!baseId) return jsonResponse({ error: "invalid_request", param: "baseId" }, 400);

  // Additive public filters (server-rest-read-support). When any is present we
  // switch to filter+keyset-paginate mode; otherwise the pre-change web contract
  // (whole list, `limit` slice, no cursor) is preserved exactly.
  const entityType = sp.get("entityType");
  const changeType = sp.get("changeType");
  const breaksDataParam = sp.get("breaksData");
  const from = sp.get("from");
  const to = sp.get("to");
  const cursor = sp.get("cursor");
  const filtered =
    entityType !== null || changeType !== null || breaksDataParam !== null ||
    from !== null || to !== null || cursor !== null;

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

    if (filtered) {
      const full = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
        readSchemaChangelog(tx, baseId), // no slice — assemble the whole base feed
      );
      const page = paginateChangelog(full.entries, {
        entityType: entityType ?? undefined,
        changeType: changeType ?? undefined,
        breaksData: breaksDataParam === null ? undefined : breaksDataParam === "true",
        from: from ?? undefined,
        to: to ?? undefined,
        limit: clampLimit(sp.get("limit")),
        cursor: cursor ?? undefined,
      });
      return jsonResponse({ ok: true, entries: page.entries, nextCursor: page.nextCursor }, 200);
    }

    const limit = Math.min(Math.max(parseInt(sp.get("limit") ?? "200", 10) || 200, 1), 1000);
    const changelog = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
      readSchemaChangelog(tx, baseId, { limit }),
    );
    return jsonResponse({ ok: true, ...changelog }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "read_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
