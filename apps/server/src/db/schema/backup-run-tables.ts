// MIRROR of apps/web/src/db/schema/core.ts:backupRunTables (canonical writer).
// Migration: apps/web/drizzle/0020_complex_the_hood.sql
//
// apps/server INSERTs one row per table within a per-base completion when the
// Trigger.dev backup-base task provides per-table detail (optional tables[]
// payload on POST /api/internal/runs/:runId/complete).
//
// Columns the engine neither reads nor writes are intentionally omitted.
// Never migrate from this side — migrations are owned by apps/web.
// Per CLAUDE.md §5.3.

import { integer, pgSchema, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const baseout = pgSchema("baseout");

export const backupRunTables = baseout.table("backup_run_tables", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  runBaseId: text("run_base_id").notNull(),
  // FK → backup_run_bases(id) cascade — canonical migration owns the constraint.
  tableId: text("table_id").notNull(),
  tableName: text("table_name").notNull(),
  recordCount: integer("record_count").notNull().default(0),
  fieldCount: integer("field_count").notNull().default(0),
  attachmentCount: integer("attachment_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type BackupRunTableRow = typeof backupRunTables.$inferSelect;
export type BackupRunTableInsert = typeof backupRunTables.$inferInsert;
