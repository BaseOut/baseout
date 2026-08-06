// MIRROR of apps/web/src/db/schema/entitlements.ts (canonical writer).
// Migration: apps/web/drizzle/0035_usage_rollups_unique_idx.sql adds the
// unique index this engine's ON CONFLICT upsert targets; the table itself
// lands in apps/web/drizzle/0034_entitlements_catalog.sql.
//
// apps/web owns the catalog + all entitlement migrations. apps/server writes
// Space-attributed usage samples here from the run-completion ingestion
// (shared-entitlements 3.1): a per-base backup completion increments the
// owning Space's `records_under_management` and `file_storage_gb` stock
// meters for the current monthly-anniversary period. The reconciliation sweep
// (3.5) is the authority that re-derives exact levels from durable rows, so
// these callback-driven writes are best-effort.
//
// Columns intentionally omitted: createdAt — engine neither reads nor writes
// it. Never migrate from this side. Per CLAUDE.md §5.3.

import { index, numeric, pgSchema, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const baseout = pgSchema("baseout");

export const usageRollups = baseout.table(
  "usage_rollups",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    organizationId: text("organization_id").notNull(),
    featureSlug: text("feature_slug").notNull(),
    spaceId: text("space_id"),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    used: numeric("used").notNull().default("0"),
    meterKind: text("meter_kind"),
    modifiedAt: timestamp("modified_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("usage_rollups_org_feature_period_idx").on(
      table.organizationId,
      table.featureSlug,
      table.periodStart,
    ),
  ],
);

export type UsageRollupRow = typeof usageRollups.$inferSelect;
