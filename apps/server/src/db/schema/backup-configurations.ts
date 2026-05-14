// MIRROR of apps/web/src/db/schema/core.ts:395 (canonical writer).
// Migrations: apps/web/drizzle/0004_user_role_and_backup_runs.sql
//             apps/web/drizzle/0007_backup_schedule_and_cancel.sql
//             (adds next_scheduled_at — written by SpaceDO on alarm set/fire)
//             apps/web/drizzle/0008_workspace_rediscovery.sql
//             (adds auto_add_future_bases — read by engine on rediscovery)
//
// apps/web INSERTs/UPDATEs frequency / mode / storage_type / auto_add_future_bases
// when the user picks bases / frequency / storage destination (and later
// from settings). apps/server reads frequency on alarm fire (Phase B of
// baseout-backup-schedule-and-cancel) and auto_add_future_bases during
// workspace rediscovery. The engine WRITES next_scheduled_at from inside
// the SpaceDO after every alarm-set / alarm-fire — the only column the
// engine is the canonical writer for on this table.
//
// Columns intentionally omitted: createdAt / modifiedAt. Add when the
// engine actually reads them.
//
// Per CLAUDE.md §5.3.

import { boolean, pgSchema, text, timestamp } from "drizzle-orm/pg-core";

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
  autoAddFutureBases: boolean("auto_add_future_bases").notNull(),
  // Engine reads during workspace rediscovery. When true AND under tier
  // basesPerSpace cap, newly discovered bases are inserted into
  // backup_configuration_bases with is_included=true.
  nextScheduledAt: timestamp("next_scheduled_at", { withTimezone: true }),
  // Engine-owned (SpaceDO is the canonical writer). NULL until the first
  // /set-frequency call lands. Surfaced by apps/web's IntegrationsView as
  // "Next backup: <date>".
});

export type BackupConfigurationRow = typeof backupConfigurations.$inferSelect;
