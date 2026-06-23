// Per-Space DB provisioning — Postgres-backed I/O implementations.
//
// Wires the narrow interfaces in ./provision.ts to the real master-DB
// connection: the drizzle-backed row state machine and the managed_pg factory
// (schema-per-Space on the shared cluster). The engine route builds these from
// the per-request `{ db, sql }` and hands them to provisionSpaceDatabase.

import { eq } from "drizzle-orm";
import { spacePgDdlStatements } from "@baseout/db-schema/space/pg-ddl";
import type { Sql } from "postgres";
import type { AppDb } from "../../db/worker";
import { spaceDatabases } from "../../db/schema";
import { schemaNameForSpace, type SpaceDbBackend } from "./posture";
import type { SpaceDbProvisionWriter } from "./provision";

/** Drizzle-backed space_databases row state machine (master DB). */
export function drizzleSpaceDbWriter(db: AppDb): SpaceDbProvisionWriter {
  return {
    async getStatus(spaceId) {
      const [row] = await db
        .select({ status: spaceDatabases.status })
        .from(spaceDatabases)
        .where(eq(spaceDatabases.spaceId, spaceId))
        .limit(1);
      return row?.status ?? null;
    },

    async beginProvisioning(input) {
      await db
        .insert(spaceDatabases)
        .values({
          spaceId: input.spaceId,
          backend: input.backend,
          recordsEnabled: input.recordsEnabled,
          status: "provisioning",
          provisionedByUserId: input.provisionedByUserId ?? null,
        })
        .onConflictDoUpdate({
          target: spaceDatabases.spaceId,
          set: {
            backend: input.backend,
            recordsEnabled: input.recordsEnabled,
            status: "provisioning",
            errorMessage: null,
            modifiedAt: new Date(),
          },
        });
    },

    async markActive(input) {
      // locator → pg_locator (managed_pg is the only backend that reaches
      // markActive today; d1/byodb will set their own locator columns).
      await db
        .update(spaceDatabases)
        .set({
          status: "active",
          pgLocator: input.locator,
          schemaVersion: input.schemaVersion,
          lastSchemaSyncAt: new Date(),
          provisionedAt: new Date(),
          errorMessage: null,
          modifiedAt: new Date(),
        })
        .where(eq(spaceDatabases.spaceId, input.spaceId));
    },

    async markError(input) {
      await db
        .update(spaceDatabases)
        .set({
          status: "error",
          errorMessage: input.message,
          modifiedAt: new Date(),
        })
        .where(eq(spaceDatabases.spaceId, input.spaceId));
    },
  };
}

/**
 * managed_pg factory: create the Space's schema-per-Space on the shared cluster
 * and apply the per-Space DDL into it. Idempotent — if the schema's tables
 * already exist, the DDL is skipped (probe on bo_at_bases). Returns the schema
 * name (the pg_locator).
 *
 * The schema name is derived from the validated Space UUID (schemaNameForSpace
 * → [a-z0-9_]+), so the identifier interpolated into DDL can never be attacker-
 * controlled. The DDL itself comes from the bundled, parity-tested
 * @baseout/db-schema/space/pg-ddl.
 */
export async function applyManagedPgSchema(
  sql: Sql,
  spaceId: string,
): Promise<string> {
  const schemaName = schemaNameForSpace(spaceId);

  await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

  const probe = await sql<{ exists: boolean }[]>`
    select to_regclass(${`${schemaName}.bo_at_bases`}) is not null as exists
  `;
  const alreadyApplied = probe[0]?.exists === true;

  if (!alreadyApplied) {
    await sql.begin(async (tx) => {
      // Transaction-scoped search_path so the unqualified CREATE TABLEs in the
      // bundled DDL land in this Space's schema, not 'baseout'/'public'.
      await tx.unsafe(`SET LOCAL search_path TO "${schemaName}"`);
      for (const statement of spacePgDdlStatements()) {
        await tx.unsafe(statement);
      }
    });
  }

  return schemaName;
}

/** Drop a Space's managed_pg schema (cleanup fan-out on Space deletion). */
export async function dropManagedPgSchema(
  sql: Sql,
  spaceId: string,
): Promise<void> {
  const schemaName = schemaNameForSpace(spaceId);
  await sql.unsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
}

export type { SpaceDbBackend };
