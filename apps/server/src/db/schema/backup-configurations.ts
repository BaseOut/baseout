// MIRROR of apps/web/src/db/schema/core.ts:395 (canonical writer).
// Migrations: apps/web/drizzle/0004_user_role_and_backup_runs.sql
//             apps/web/drizzle/0007_backup_schedule_and_cancel.sql
//             (adds next_scheduled_at — written by SpaceDO on alarm set/fire)
//
// apps/web INSERTs/UPDATEs frequency / mode / storage_type when the user
// picks bases / frequency / storage destination during onboarding (and
// later from settings). apps/server reads frequency on alarm fire (Phase
// B of baseout-backup-schedule-and-cancel) and WRITES next_scheduled_at
// from inside the SpaceDO after every alarm-set / alarm-fire — the only
// column the engine is the canonical writer for on this table.
//
// Columns intentionally omitted: createdAt / modifiedAt. Add when the
// engine actually reads them.
//
// Per CLAUDE.md §5.3.

import { pgSchema, text, timestamp } from "drizzle-orm/pg-core";

const baseout = pgSchema("baseout");

export const backupConfigurations = baseout.table("backup_configurations", {
  id: text("id").primaryKey(),
  spaceId: text("space_id").notNull(),
  frequency: text("frequency").notNull(),
  // 'monthly' | 'weekly' | 'daily' | 'instant' — gated by tier per
  // Features §6.1. Engine reads on alarm fire (SpaceDO.alarm()).
  mode: text("mode").notNull(),
  // 'static' | 'dynamic'
  storageType: text("storage_type").notNull(),
  // 'r2_managed' | 'google_drive' | 'dropbox' | 'box' | 'onedrive' | 's3'
  // | 'frame_io' | 'byos'
  nextScheduledAt: timestamp("next_scheduled_at", { withTimezone: true }),
  // Engine-owned (SpaceDO is the canonical writer). NULL until the first
  // /set-frequency call lands. Surfaced by apps/web's IntegrationsView as
  // "Next backup: <date>".
});

export type BackupConfigurationRow = typeof backupConfigurations.$inferSelect;
