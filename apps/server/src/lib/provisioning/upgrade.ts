// In-place per-Space schema upgrade (system-per-space-upgrade).
//
// The per-Space schema has only ever grown by ADDING tables (v3 Health, v4
// synced-view candidates, v5 chat). An existing Space recorded at an older
// version is brought current by re-running the bundled DDL in its idempotent
// (IF NOT EXISTS) form — missing tables/indexes are created, existing ones
// skipped — then bumping space_databases.schema_version. This is "lazy
// on-access": callers run it right before reading/writing a per-Space schema, so
// existing Spaces self-heal without a manual re-provision.
//
// INVARIANT: correct only while changes stay additive. A future ALTER/type
// change needs a real migration step (IF NOT EXISTS would silently skip it).

import { eq } from "drizzle-orm";
import { spacePgDdlStatementsIdempotent } from "@baseout/db-schema/space/pg-ddl-upgrade";
import { SPACE_SCHEMA_VERSION } from "@baseout/db-schema/space";
import type { Sql } from "postgres";
import type { AppDb } from "../../db/worker";
import { spaceDatabases } from "../../db/schema";
import { schemaNameForSpace } from "./posture";

/** Pure decision: is a Space at `recorded` behind the current schema version? */
export function needsUpgrade(
  recorded: number | null | undefined,
  current: number = SPACE_SCHEMA_VERSION,
): boolean {
  return (recorded ?? 0) < current;
}

/**
 * Re-run the idempotent per-Space DDL into the Space's schema (creates any
 * missing tables/indexes). Transaction-scoped search_path, like provisioning.
 */
export async function upgradeManagedPgSchema(sql: Sql, schemaName: string): Promise<void> {
  await sql.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL search_path TO "${schemaName}"`);
    for (const statement of spacePgDdlStatementsIdempotent()) {
      await tx.unsafe(statement);
    }
  });
}

export interface EnsureCurrentResult {
  upgraded: boolean;
  from: number;
  to: number;
}

/**
 * Ensure a managed_pg Space's schema is at the current version. No-op when it
 * already is (the common case — one cheap version comparison). When behind, runs
 * the idempotent DDL + records the new version. Safe to call on every per-Space
 * access; only the first stale access pays the DDL cost.
 *
 * Caller passes the already-resolved row (pgLocator + recorded schemaVersion) to
 * avoid a re-resolve. Returns whether an upgrade ran.
 */
export async function ensureSpaceSchemaCurrent(
  db: AppDb,
  sql: Sql,
  args: { spaceId: string; pgLocator: string | null; schemaVersion: number | null },
): Promise<EnsureCurrentResult> {
  const from = args.schemaVersion ?? 0;
  if (!needsUpgrade(from)) {
    return { upgraded: false, from, to: from };
  }
  // pgLocator is the schema name; fall back to deriving it from the id.
  const schemaName = args.pgLocator ?? schemaNameForSpace(args.spaceId);
  await upgradeManagedPgSchema(sql, schemaName);
  await db
    .update(spaceDatabases)
    .set({ schemaVersion: SPACE_SCHEMA_VERSION, modifiedAt: new Date() })
    .where(eq(spaceDatabases.spaceId, args.spaceId));
  return { upgraded: true, from, to: SPACE_SCHEMA_VERSION };
}
