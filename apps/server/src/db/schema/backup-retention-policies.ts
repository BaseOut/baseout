// MIRROR of apps/web/src/db/schema/core.ts:backupRetentionPolicies (canonical writer).
// Migration: apps/web/drizzle/0021_backup_retention_and_cleanup.sql
//
// One row per Space — the resolved retention policy the cleanup engine prunes
// against. apps/web writes these (backfill script + the deferred retention
// settings PATCH); apps/server READS them in the cleanup pass to decide which
// runs to prune. The engine mirrors the full table because the cleanup
// decision needs every knob.
//
// Never migrate from this side — migrations are owned by apps/web.
// Per CLAUDE.md §5.3.

import { boolean, integer, jsonb, pgSchema, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const baseout = pgSchema("baseout");

/** Retention policy shape per Features §6.9 — Basic → Custom ladder. */
export type RetentionPolicyTier =
  | "basic"
  | "time_based"
  | "two_tier"
  | "three_tier"
  | "custom";

export const backupRetentionPolicies = baseout.table("backup_retention_policies", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  spaceId: text("space_id").notNull(),
  // UNIQUE space_id — canonical migration owns the constraint.
  policyTier: text("policy_tier").notNull().$type<RetentionPolicyTier>(),
  keepLastN: integer("keep_last_n"),
  dailyWindowDays: integer("daily_window_days"),
  weeklyWindowDays: integer("weekly_window_days"),
  monthlyIndefinite: boolean("monthly_indefinite").notNull().default(false),
  customRules: jsonb("custom_rules"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp("modified_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BackupRetentionPolicyRow = typeof backupRetentionPolicies.$inferSelect;
export type BackupRetentionPolicyInsert = typeof backupRetentionPolicies.$inferInsert;
