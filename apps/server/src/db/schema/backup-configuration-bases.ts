// MIRROR of apps/web/src/db/schema/core.ts:419 (canonical writer).
// Migration: apps/web/drizzle/0004_user_role_and_backup_runs.sql
//
// One row per (backup_configuration, at_base). apps/web writes selection
// state when the user picks bases. apps/server reads which bases are
// included on run-start (filter to is_included=true) and joins through
// at_bases to resolve the Airtable base ID.
//
// Columns intentionally omitted: isAutoDiscovered, createdAt, modifiedAt
// — engine doesn't read or write them.
//
// Per CLAUDE.md §5.3.

import { boolean, pgSchema, text } from "drizzle-orm/pg-core";

const baseout = pgSchema("baseout");

export const backupConfigurationBases = baseout.table(
  "backup_configuration_bases",
  {
    id: text("id").primaryKey(),
    backupConfigurationId: text("backup_configuration_id").notNull(),
    atBaseId: text("at_base_id").notNull(),
    isIncluded: boolean("is_included").notNull(),
  },
);

export type BackupConfigurationBaseRow =
  typeof backupConfigurationBases.$inferSelect;
