/**
 * Idempotent per-Space DDL for in-place upgrades (system-per-space-upgrade).
 *
 * The per-Space schema has evolved by ADDING tables (v3 Health metric tables,
 * v4 synced-view candidates, v5 chat threads/messages, …, v14 entity tags +
 * partial entity uniques) — never by altering or dropping existing ones (the
 * v7 interfaces reshape is the exception and is handled separately in
 * apps/server provisioning/upgrade.ts). So an existing Space can be brought
 * current by simply (re)creating any missing tables + indexes. This maps the
 * bundled provisioning DDL to `... IF NOT EXISTS` variants so the full
 * statement set can be re-run safely against a partially-populated schema
 * (existing objects are skipped).
 *
 * IMPORTANT: this is only correct while per-Space changes stay additive. If a
 * future version ALTERs a column or changes a type, that needs a real migration
 * step here — `IF NOT EXISTS` will silently skip it. Keep this invariant.
 *
 * v14 note: page→parent linkage already lives on bo_at_pages.interface_id
 * (server-interfaces-normalize); no hand-written ALTER for a parent_id column
 * on bo_at_interfaces is required. New tables/indexes are covered by the
 * CREATE … IF NOT EXISTS rewrite below.
 */

import { spacePgDdlStatements } from "./pg-ddl";

/** The provisioning DDL statements, rewritten to be safely re-runnable. */
export function spacePgDdlStatementsIdempotent(): string[] {
  return spacePgDdlStatements().map((stmt) =>
    stmt
      .replace(/^CREATE TABLE "/, 'CREATE TABLE IF NOT EXISTS "')
      .replace(/^CREATE INDEX "/, 'CREATE INDEX IF NOT EXISTS "')
      .replace(/^CREATE UNIQUE INDEX "/, 'CREATE UNIQUE INDEX IF NOT EXISTS "'),
  );
}
