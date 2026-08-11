// MIRROR of apps/web/src/db/schema/core.ts:backupRunBases (canonical writer).
// Migration: apps/web/drizzle/0020_complex_the_hood.sql
//
// apps/server INSERTs one row per per-base completion callback when the
// Trigger.dev backup-base task provides per-table detail (optional tables[]
// payload on POST /api/internal/runs/:runId/complete). Absent for legacy
// completions that predate the workflows-run-detail change.
//
// Columns the engine neither reads nor writes are intentionally omitted.
// Never migrate from this side — migrations are owned by apps/web.
// Per CLAUDE.md §5.3.

import { integer, pgSchema, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const baseout = pgSchema("baseout");

export const backupRunBases = baseout.table("backup_run_bases", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: text("run_id").notNull(),
  // FK → backup_runs(id) cascade — canonical migration owns the constraint.
  atBaseId: text("at_base_id").notNull(),
  baseName: text("base_name").notNull(),
  status: text("status").notNull(),
  // 'succeeded' | 'failed' | 'trial_complete' | 'trial_truncated'
  tablesCount: integer("tables_count").notNull().default(0),
  recordsCount: integer("records_count").notNull().default(0),
  attachmentsCount: integer("attachments_count").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type BackupRunBaseRow = typeof backupRunBases.$inferSelect;
export type BackupRunBaseInsert = typeof backupRunBases.$inferInsert;
