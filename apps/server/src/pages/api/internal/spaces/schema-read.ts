// GET /api/internal/spaces/:spaceId/schema
//
// Read broker for the captured schema entity tree. Two modes:
//   - Parameterless (apps/web Browse tab): whole-Space flat lists of
//     bases/tables/fields/views — the pre-existing contract, UNCHANGED.
//   - Scoped + paginated (server-rest-read-support, for the public api-rest-read
//     Worker): `?entity=tables&baseId=…&tableId=…&ids=…&limit=…&cursor=…` returns
//     one entity kind, keyset-paginated, with a `nextCursor`.
// Every response carries per-base `schemaHash` (feeds the public API's ETag).
// Distinct from schema-sync (the write path). Token gate is applied by
// middleware (path begins /api/internal/).

import type { AppLocals, Env } from "../../../../env";
import { resolveSpaceDb } from "../../../../lib/per-space/resolve";
import { readAllEntities, withSpaceSchema } from "../../../../lib/per-space/space-db-pg";
import {
  readEntitiesScoped,
  schemaHashesFor,
  type ScopedEntity,
} from "../../../../lib/per-space/schema-read-io";
import { clampLimit } from "../../../../lib/per-space/schema-query";
import { ensureSpaceSchemaCurrent } from "../../../../lib/provisioning/upgrade";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SCOPED_ENTITIES: ScopedEntity[] = ["bases", "tables", "fields", "views"];

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesSchemaReadHandler(
  request: Request,
  _env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  if (request.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!UUID_RE.test(spaceId)) return jsonResponse({ error: "invalid_request" }, 400);

  const sp = new URL(request.url).searchParams;
  const entity = sp.get("entity");
  const scoped = entity !== null;
  if (scoped && !SCOPED_ENTITIES.includes(entity as ScopedEntity)) {
    return jsonResponse({ error: "invalid_request", param: "entity" }, 400);
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
  } catch (err) {
    return jsonResponse(
      { error: "upgrade_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }

  try {
    if (scoped) {
      const idsParam = sp.get("ids");
      const result = await withSpaceSchema(masterDb, space.pgLocator, (tx) =>
        readEntitiesScoped(tx, {
          entity: entity as ScopedEntity,
          baseId: sp.get("baseId"),
          tableId: sp.get("tableId"),
          ids: idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : null,
          limit: clampLimit(sp.get("limit")),
          cursor: sp.get("cursor"),
        }),
      );
      return jsonResponse({ ok: true, ...result }, 200);
    }

    const { entities, schemaHashByBase } = await withSpaceSchema(masterDb, space.pgLocator, async (tx) => {
      const entities = await readAllEntities(tx);
      const schemaHashByBase = await schemaHashesFor(tx, entities.bases.map((b) => b.baseId));
      return { entities, schemaHashByBase };
    });
    return jsonResponse({ ok: true, ...entities, schemaHashByBase }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "schema_read_failed", message: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
}
