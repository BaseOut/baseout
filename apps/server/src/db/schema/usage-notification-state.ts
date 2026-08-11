// MIRROR of apps/web/src/db/schema/entitlements.ts (canonical writer).
// Migration: apps/web/drizzle/0034_entitlements_catalog.sql.
//
// apps/web owns the catalog + all entitlement migrations. The engine both READS
// and WRITES this row from the usage-enforcement evaluation (shared-entitlements
// 4.2, design D7): the deduplicated warn/enforce state machine per
// (organization, feature, period). The upsert targets the
// `usage_notification_state_org_feature_period_unique` constraint. `createdAt` is
// omitted (engine neither reads nor writes it — DB default fills it). Never
// migrate from this side. Per CLAUDE.md §5.3.

import { index, pgSchema, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const baseout = pgSchema("baseout");

export const usageNotificationState = baseout.table(
  "usage_notification_state",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    organizationId: text("organization_id").notNull(),
    featureSlug: text("feature_slug").notNull(),
    state: text("state").notNull().default("ok"), // 'ok' | 'warned_90' | 'warned_100' | 'enforced'
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    lastTransitionAt: timestamp("last_transition_at", { withTimezone: true }),
    modifiedAt: timestamp("modified_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("usage_notification_state_org_feature_period_idx").on(
      table.organizationId,
      table.featureSlug,
      table.periodStart,
    ),
  ],
);

export type UsageNotificationStateRow = typeof usageNotificationState.$inferSelect;
