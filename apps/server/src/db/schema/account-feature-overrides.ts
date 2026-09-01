// MIRROR of apps/web/src/db/schema/entitlements.ts (canonical writer).
// Migration: db/migrations/0034_entitlements_catalog.sql.
//
// apps/web owns the catalog + all entitlement migrations. The engine READS these
// sparse per-account overrides when resolving effective entitlements at usage-
// enforcement time (shared-entitlements 4.2) — it never writes them (override
// writes are the staff-only admin path). Only the columns the resolver reads are
// mirrored; `reason` / `granted_by_user_id` / timestamps are omitted. Never
// migrate from this side. Per CLAUDE.md §5.3.

import { boolean, numeric, pgSchema, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const baseout = pgSchema("baseout");

export const accountFeatureOverrides = baseout.table("account_feature_overrides", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text("organization_id").notNull(),
  featureId: text("feature_id").notNull(),
  valueBool: boolean("value_bool"),
  valueNumeric: numeric("value_numeric"),
  valueEnum: text("value_enum"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export type AccountFeatureOverrideRow = typeof accountFeatureOverrides.$inferSelect;
