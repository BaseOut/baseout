// MIRROR of apps/web/src/db/schema/core.ts:395 (canonical writer).
// Migration: apps/web/drizzle/0004_user_role_and_backup_runs.sql
//
// apps/web INSERTs/UPDATEs this row when the user picks bases / frequency /
// storage destination during onboarding (and later from settings).
// apps/server reads it on run-start to decide where + how to write the
// backup output. The engine doesn't write to this table.
//
// Columns intentionally omitted: frequency (engine only sees manually-
// triggered runs in MVP — scheduled execution is a later phase),
// createdAt / modifiedAt. Add when the engine actually reads or writes
// them.
//
// Per CLAUDE.md §5.3.

import { pgSchema, text } from "drizzle-orm/pg-core";

const baseout = pgSchema("baseout");

export const backupConfigurations = baseout.table("backup_configurations", {
  id: text("id").primaryKey(),
  spaceId: text("space_id").notNull(),
  mode: text("mode").notNull(),
  // 'static' | 'dynamic'
  storageType: text("storage_type").notNull(),
  // 'r2_managed' | 'google_drive' | 'dropbox' | 'box' | 'onedrive' | 's3'
  // | 'frame_io' | 'byos'
});

export type BackupConfigurationRow = typeof backupConfigurations.$inferSelect;
