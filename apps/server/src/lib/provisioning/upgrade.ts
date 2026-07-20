// In-place per-Space schema upgrade (system-per-space-upgrade).
//
// The per-Space schema grew additively through v6 (v3 Health, v4 synced-view
// candidates, v5 chat, v6 inbox). An existing Space recorded at an older version
// is brought current by re-running the bundled DDL in its idempotent
// (IF NOT EXISTS) form — missing tables/indexes are created, existing ones
// skipped — then bumping space_databases.schema_version. This is "lazy
// on-access": callers run it right before reading/writing a per-Space schema, so
// existing Spaces self-heal without a manual re-provision.
//
// v7 (server-interfaces-normalize) is the first NON-additive change: it reshaped
// bo_at_interfaces (apps-only; dropped columns), which CREATE TABLE IF NOT EXISTS
// cannot apply. Such reshapes get an explicit destructive step in
// preUpgradeStatements() that runs BEFORE the idempotent DDL. The additive
// invariant otherwise still holds — only reshapes need an entry there.

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

// Version at which server-interfaces-normalize reshaped bo_at_interfaces.
const INTERFACES_NORMALIZE_VERSION = 7;

/**
 * Destructive statements that MUST run before the idempotent DDL when bringing a
 * Space forward from `from`. The idempotent DDL only CREATEs (IF NOT EXISTS), so
 * a per-Space change that RESHAPES an existing table needs an explicit step here.
 *
 * v7 (server-interfaces-normalize): bo_at_interfaces was reshaped to apps-only
 * (dropped `type`/`first_seen_at`/`last_seen_at`, added the run-based lifecycle
 * set). Drop it so the idempotent CREATE recreates it in the new shape; the five
 * new tables are additive and created by that same DDL. Pre-launch, interface
 * rows repopulate on the next capture (design Decision 10). Gated on `from < 7`
 * so it never re-drops once a Space is already at v7+.
 */
export function preUpgradeStatements(from: number | null | undefined): string[] {
  const stmts: string[] = [];
  if ((from ?? 0) < INTERFACES_NORMALIZE_VERSION) {
    stmts.push('DROP TABLE IF EXISTS "bo_at_interfaces" CASCADE');
  }
  return stmts;
}

/**
 * Bring the Space's schema current: run any version-gated destructive steps for
 * reshaped tables, then re-run the idempotent per-Space DDL (creates any missing
 * tables/indexes). Transaction-scoped search_path, like provisioning. `from` is
 * the Space's recorded schema version (drives the destructive gate).
 */
export async function upgradeManagedPgSchema(
  sql: Sql,
  schemaName: string,
  from: number | null | undefined,
): Promise<void> {
  await sql.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL search_path TO "${schemaName}"`);
    for (const statement of preUpgradeStatements(from)) {
      await tx.unsafe(statement);
    }
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
  await upgradeManagedPgSchema(sql, schemaName, from);
  await db
    .update(spaceDatabases)
    .set({ schemaVersion: SPACE_SCHEMA_VERSION, modifiedAt: new Date() })
    .where(eq(spaceDatabases.spaceId, args.spaceId));
  return { upgraded: true, from, to: SPACE_SCHEMA_VERSION };
}
