// Per-table query-view regeneration — Postgres I/O layer.
//
// Applies the pure SQL builders in query-views.ts inside a withSpaceSchema
// transaction (search_path already scoped, so unqualified matviews, helper
// functions, and pg_matviews reads all land in / see the Space's schema).
// Drop + create repopulates the matview in one step — no separate REFRESH.
// Callers gate on records_enabled: views pivot record cells, so a schema-only
// Space has nothing to project.

import { and, eq, sql } from "drizzle-orm";
import { spacePg } from "@baseout/db-schema/space";
import type { SpaceTx } from "./space-db-pg";
import {
  buildQueryViewStatements,
  dropStaleViewStatements,
  planViewNames,
  queryViewHelperStatements,
} from "./query-views";

/**
 * Regenerate the per-table query views. `tableIds` narrows the rebuild (an
 * incremental pass's affected tables; one table after a records-sync); omit it
 * to rebuild every active table (schema-sync after a schema change). Stale
 * matviews — removed or renamed tables — are dropped on every call, and name
 * planning always spans ALL active tables (the matview namespace is
 * Space-wide, so a partial rebuild must not re-roll another table's name).
 */
export async function regenerateQueryViews(
  tx: SpaceTx,
  args: { tableIds?: string[] },
): Promise<{ regenerated: number; dropped: number }> {
  const active = await tx
    .select({ tableId: spacePg.tables.tableId, name: spacePg.tables.name })
    .from(spacePg.tables)
    .where(eq(spacePg.tables.status, "active"));

  const names = planViewNames(active);

  const existingRows = (await tx.execute(
    sql`SELECT matviewname FROM pg_matviews WHERE schemaname = current_schema()`,
  )) as unknown as Iterable<{ matviewname: string }>;
  const existing = Array.from(existingRows, (r) => String(r.matviewname));

  const dropStmts = dropStaleViewStatements(existing, new Set(names.values()));
  for (const stmt of dropStmts) await tx.execute(sql.raw(stmt));

  const wanted = args.tableIds ? new Set(args.tableIds) : null;
  const targets = wanted ? active.filter((t) => wanted.has(t.tableId)) : active;

  if (targets.length > 0) {
    for (const stmt of queryViewHelperStatements()) await tx.execute(sql.raw(stmt));
  }

  for (const t of targets) {
    // Active fields only — a removed field's cells persist in the EAV rows,
    // but its column drops out of the projection with it.
    const fields = await tx
      .select({ fieldId: spacePg.fields.fieldId, name: spacePg.fields.name, type: spacePg.fields.type })
      .from(spacePg.fields)
      .where(and(eq(spacePg.fields.tableId, t.tableId), eq(spacePg.fields.status, "active")));
    for (const stmt of buildQueryViewStatements(names.get(t.tableId)!, t.tableId, fields)) {
      await tx.execute(sql.raw(stmt));
    }
  }

  return { regenerated: targets.length, dropped: dropStmts.length };
}
