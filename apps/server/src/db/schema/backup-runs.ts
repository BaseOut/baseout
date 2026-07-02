// MIRROR of apps/web/src/db/schema/core.ts:322 (canonical writer).
// Migrations: apps/web/drizzle/0004_user_role_and_backup_runs.sql
//             apps/web/drizzle/0006_windy_sauron.sql (trigger_run_ids column)
//             apps/web/drizzle/0022_backup_scope.sql (kind column — full|schema)
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
  // 'queued' | 'running' | 'succeeded' | 'failed' | 'trial_complete' | 'trial_truncated' | 'cancelling' | 'cancelled' | 'deleting'
  // Canonical writer is apps/web per CLAUDE.md §2; apps/server flips the
  // status through the engine lifecycle. 'cancelling' is the intermediate
  // state the cancel route writes before Trigger.dev acks; 'cancelled' is
  // terminal. 'deleting' is the intermediate state for user-initiated
  // per-run delete (openspec/changes/shared-backup-run-delete) — the
  // terminal action is a row hard-DELETE via /api/internal/runs/:runId/
  // delete-complete, not a status flip.
  triggeredBy: text("triggered_by").notNull(),
  // 'manual' | 'scheduled' | 'webhook' | 'trial' (engine-defined free text).
  // The SpaceDO scheduler (Phase B of baseout-backup-schedule-and-cancel)
  // INSERTs rows with triggered_by='scheduled' on every alarm fire.
  kind: text("kind").notNull().default("full"),
  // 'full' | 'schema' — what this run captured (server-backup-scope). Stamped
  // by the run-start path; passed into the per-base task payload so a schema
  // run skips records/attachments. Migration: 0022_backup_scope.sql.
  // .default("full") mirrors the canonical DB default so a SpaceDO INSERT may
  // omit `kind` for full runs (same pattern as id / modifiedAt above).
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
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  // Soft-delete marker — the cleanup pass sets this AFTER the run's storage
  // objects are removed (openspec/changes/server-retention-and-cleanup). The
  // row is retained for audit; cleanup queries filter `deleted_at IS NULL`.
  // Migration: apps/web/drizzle/0021_backup_retention_and_cleanup.sql.
  modifiedAt: timestamp("modified_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // .defaultNow() mirrors the canonical DB default so INSERTs from the
  // SpaceDO scheduler can omit modified_at. This file is never migrated
  // from — see header.
});

export type BackupRunRow = typeof backupRuns.$inferSelect;
