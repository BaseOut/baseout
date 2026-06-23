// POST /api/internal/spaces/:spaceId/provision-database
//
// apps/web calls this after creating a Space. The engine owns the per-Space DB
// lifecycle (web never connects to per-Space DBs), so provisioning runs here:
// validate posture → upsert space_databases → create the backend + apply the
// per-Space schema → mark active. managed_pg runs inline (schema-per-Space DDL
// on the shared cluster, fast); d1/byodb are not yet wired (501).
//
// Token gate is applied by middleware (path begins /api/internal/).
//
// Result-code → HTTP-status:
//   ok                                       → 200 { ok, status, backend, locator }
//   invalid_backend / sovereign_requires_…   → 400
//   backend_not_implemented                  → 501
//   provision_failed                         → 500

import type { AppLocals, Env } from "../../../../env";
import { provisionSpaceDatabase } from "../../../../lib/provisioning/provision";
import {
  applyManagedPgSchema,
  drizzleSpaceDbWriter,
} from "../../../../lib/provisioning/provision-pg";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesProvisionDatabaseHandler(
  request: Request,
  _env: Env,
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

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  if (typeof raw !== "object" || raw === null) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  const body = raw as Record<string, unknown>;
  // Default backend = managed_pg (the shared-cluster schema-per-Space backend).
  const backend = typeof body.backend === "string" ? body.backend : "managed_pg";
  const recordsEnabled = body.recordsEnabled === true;
  const provisionedByUserId =
    typeof body.provisionedByUserId === "string"
      ? body.provisionedByUserId
      : null;

  const { db, sql } = locals.getMasterDb();

  const result = await provisionSpaceDatabase(
    {
      writer: drizzleSpaceDbWriter(db),
      backends: { managedPg: (id) => applyManagedPgSchema(sql, id) },
    },
    { spaceId, backend, recordsEnabled, provisionedByUserId },
  );

  if (result.ok) {
    return jsonResponse(
      {
        ok: true,
        status: result.status,
        backend: result.backend,
        locator: result.locator,
      },
      200,
    );
  }

  const status =
    result.code === "invalid_backend" ||
    result.code === "sovereign_requires_records"
      ? 400
      : result.code === "backend_not_implemented"
        ? 501
        : 500;
  return jsonResponse({ ok: false, error: result.code, message: result.message }, status);
}
