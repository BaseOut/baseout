// MIRROR of apps/web/src/db/schema/core.ts:322 (canonical writer).
// Migrations: apps/web/drizzle/0004_user_role_and_backup_runs.sql
//             apps/web/drizzle/0006_windy_sauron.sql (trigger_run_ids column)
//
// apps/web INSERTs each row on user-triggered or scheduled run-create.
// apps/server flips status (queued → running → succeeded | failed |
// trial_complete), writes per-run counts on completion, and stores the
// fan-out array of Trigger.dev run IDs in trigger_run_ids.
//
// Columns the engine neither reads nor writes (createdAt, errorMessage we
// only write, etc.) are intentionally omitted following the same pattern as
// connections.ts. Add columns when the engine actually needs them — never
// migrate from this side.
//
// Per CLAUDE.md §5.3.

import {
  boolean,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const baseout = pgSchema("baseout");

export const backupRuns = baseout.table("backup_runs", {
  // .default mirrors the canonical DB default (gen_random_uuid()) so
  // Drizzle's INSERT-type surface lets us omit `id` on a SpaceDO scheduled
  // insert. This file is never migrated from — see header.
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: text("space_id").notNull(),
  connectionId: text("connection_id").notNull(),
  status: text("status").notNull(),
  // 'queued' | 'running' | 'succeeded' | 'failed' | 'trial_complete' | 'trial_truncated' | 'cancelling' | 'cancelled'
  // Canonical writer is apps/web per CLAUDE.md §2; apps/server flips the
  // status through the engine lifecycle. 'cancelling' is the intermediate
  // state the cancel route writes before Trigger.dev acks; 'cancelled' is
  // terminal.
  triggeredBy: text("triggered_by").notNull(),
  // 'manual' | 'scheduled' | 'webhook' | 'trial' (engine-defined free text).
  // The SpaceDO scheduler (Phase B of baseout-backup-schedule-and-cancel)
  // INSERTs rows with triggered_by='scheduled' on every alarm fire.
  isTrial: boolean("is_trial").notNull(),
  recordCount: integer("record_count"),
  tableCount: integer("table_count"),
  attachmentCount: integer("attachment_count"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  triggerRunIds: jsonb("trigger_run_ids").$type<string[]>(),
  // JSON array of Trigger.dev v3 run IDs — one per included base. Set by
  // the run-start handler when fanning out; consumed by run-complete to
  // determine when all per-base work has reported in.
  modifiedAt: timestamp("modified_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // .defaultNow() mirrors the canonical DB default so INSERTs from the
  // SpaceDO scheduler can omit modified_at. This file is never migrated
  // from — see header.
});

export type BackupRunRow = typeof backupRuns.$inferSelect;
