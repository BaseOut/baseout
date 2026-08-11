// MIRROR of apps/web/src/db/schema/core.ts:264 (canonical writer).
// Migrations: apps/web/drizzle/0000_deep_freak.sql (initial)
//
// One Stripe subscription per Organization. apps/web is the canonical
// writer (Stripe webhook + onboarding). apps/server reads
// `organization_id` + `status` during workspace rediscovery to resolve
// the tier on the connected subscription_items row (`basesPerSpace` cap),
// and `created_at` as the monthly-anniversary anchor for usage metering
// (shared-entitlements 3.1 / D6).
// Only 'active' and 'trialing' subscriptions resolve; others fall back to
// the starter cap.
//
// Columns intentionally omitted: stripeSubscriptionId, modifiedAt — engine
// doesn't read them.
//
// Per CLAUDE.md §5.3.

import { pgSchema, text, timestamp } from "drizzle-orm/pg-core";

const baseout = pgSchema("baseout");

export const subscriptions = baseout.table("subscriptions", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  status: text("status").notNull(),
  // 'trialing' | 'active' | 'past_due' | 'cancelled' | 'incomplete' |
  // 'incomplete_expired'. Engine filters to active/trialing for tier resolution.
  createdAt: timestamp("created_at", { withTimezone: true }),
  // Subscription start — the monthly-anniversary anchor for flow-meter resets
  // and stock-meter period bucketing (D6). Canonical: apps/web core.ts.
});

export type SubscriptionRow = typeof subscriptions.$inferSelect;
