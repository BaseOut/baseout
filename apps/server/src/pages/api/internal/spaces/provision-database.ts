// POST /api/internal/spaces/:spaceId/provision-database
//
// apps/web calls this after creating a Space. The engine owns the per-Space DB
// lifecycle (web never connects to per-Space DBs), so provisioning runs here:
// validate posture → upsert space_databases → create the backend + apply the
// per-Space schema → mark active. managed_pg runs inline (schema-per-Space DDL
// on the shared cluster, fast); d1 creates a real Cloudflare D1 database via
// the REST API when CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_D1_API_TOKEN are set
// (server-d1-backend) — without them the d1 arm answers 501, as byodb does.
//
// Token gate is applied by middleware (path begins /api/internal/).
//
// Result-code → HTTP-status:
//   ok                                       → 200 { ok, status, backend, locator }
//   invalid_backend / sovereign_requires_…   → 400
//   isolation_above_ceiling                  → 403 (DB_ISOLATION_ENFORCEMENT only)
//   backend_not_implemented                  → 501
//   provision_failed                         → 500

import { eq } from "drizzle-orm";
import { refuseAboveCeiling } from "@baseout/db-schema";
import type { AppLocals, Env } from "../../../../env";
import {
  deprovisionSpaceDatabase,
  provisionSpaceDatabase,
  type ProvisionDeps,
} from "../../../../lib/provisioning/provision";
import {
  applyManagedPgSchema,
  dropManagedPgSchema,
  drizzleSpaceDbWriter,
} from "../../../../lib/provisioning/provision-pg";
import { applyD1Schema } from "../../../../lib/provisioning/provision-d1";
import { deleteD1Database, type D1ApiConfig } from "../../../../lib/provisioning/d1-api";
import { resolveEntitlements } from "../../../../lib/entitlements/resolve";
import { spaceDatabases, spaces } from "../../../../db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** D1 REST config when the token is provisioned; null keeps the d1 arm at 501. */
function d1ConfigFromEnv(env: Env): D1ApiConfig | null {
  return env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_D1_API_TOKEN
    ? { accountId: env.CLOUDFLARE_ACCOUNT_ID, apiToken: env.CLOUDFLARE_D1_API_TOKEN }
    : null;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function spacesProvisionDatabaseHandler(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  locals: AppLocals,
  spaceId: string,
): Promise<Response> {
  // DELETE = deprovision (cleanup fan-out on Space deletion, system-per-space-db
  // §6.2): drop the managed_pg schema + delete the control-plane row. Called by
  // the web Space-delete flow (that cross-app wire is the follow-up).
  if (request.method === "DELETE") {
    if (!UUID_RE.test(spaceId)) {
      return jsonResponse({ error: "invalid_request" }, 400);
    }
    const { db, sql } = locals.getMasterDb();
    const d1Config = d1ConfigFromEnv(env);
    const result = await deprovisionSpaceDatabase(
      {
        async getRow(id) {
          const [row] = await db
            .select({
              backend: spaceDatabases.backend,
              pgLocator: spaceDatabases.pgLocator,
              d1DatabaseId: spaceDatabases.d1DatabaseId,
            })
            .from(spaceDatabases)
            .where(eq(spaceDatabases.spaceId, id))
            .limit(1);
          if (!row) return null;
          // d1's teardown locator is the database UUID (what the CF DELETE addresses).
          const locator = row.backend === "d1" ? row.d1DatabaseId : row.pgLocator;
          return { backend: row.backend, locator };
        },
        async dropManagedPg(id) {
          await dropManagedPgSchema(sql, id);
        },
        ...(d1Config
          ? { deleteD1: (locator: string) => deleteD1Database(d1Config, locator) }
          : {}),
        async deleteRow(id) {
          await db.delete(spaceDatabases).where(eq(spaceDatabases.spaceId, id));
        },
      },
      { spaceId },
    );
    if (result.ok) {
      return jsonResponse({ ok: true, status: result.status }, 200);
    }
    const status = result.code === "backend_not_implemented" ? 501 : 500;
    return jsonResponse({ ok: false, error: result.code, message: result.message }, status);
  }

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

  // DB-isolation-class tier ceiling (shared-db-isolation-ladder L2.2). Only
  // enforced under the DB_ISOLATION_ENFORCEMENT flag — off by default because
  // the d1 backend isn't wired yet, so enforcing would wrongly refuse Lite
  // (ceiling d1) orgs that currently provision managed_pg. Flag off ⇒ the gate
  // is undefined and provisioning behaviour is byte-for-byte unchanged.
  const isolationGate: ProvisionDeps["isolationGate"] =
    env.DB_ISOLATION_ENFORCEMENT === "1"
      ? async ({ requestedClass }) => {
          const [space] = await db
            .select({ organizationId: spaces.organizationId })
            .from(spaces)
            .where(eq(spaces.id, spaceId))
            .limit(1);
          // No Space row (or no entitlement resolution) → fail open (allow).
          if (!space) return { allowed: true, ceiling: "byodb" };
          const resolution = await resolveEntitlements(db, space.organizationId);
          if (!resolution) return { allowed: true, ceiling: "byodb" };
          try {
            return refuseAboveCeiling(requestedClass, resolution.entitlements);
          } catch {
            // Org's catalog lacks the database_isolation_class feature → fail
            // open (allow) rather than 500 the provisioning call.
            return { allowed: true, ceiling: "byodb" };
          }
        }
      : undefined;

  const d1Config = d1ConfigFromEnv(env);
  const result = await provisionSpaceDatabase(
    {
      writer: drizzleSpaceDbWriter(db),
      backends: {
        managedPg: (id) => applyManagedPgSchema(sql, id),
        ...(d1Config
          ? {
              d1: (id) =>
                applyD1Schema({
                  spaceId: id,
                  envName: env.BASEOUT_ENV ?? "dev",
                  config: d1Config,
                }),
            }
          : {}),
      },
      isolationGate,
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
      : result.code === "isolation_above_ceiling"
        ? 403
        : result.code === "backend_not_implemented"
          ? 501
          : 500;
  return jsonResponse({ ok: false, error: result.code, message: result.message }, status);
}
