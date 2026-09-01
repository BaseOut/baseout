// MIRROR of apps/web/src/db/schema/core.ts:285 (canonical writer).
// Migrations: db/migrations/0000_deep_freak.sql (initial)
//
// One row per active Platform within a subscription. apps/web is the
// canonical writer (Stripe webhook + onboarding). apps/server reads
// `subscription_id`, `platform_id`, and `tier` during workspace
// rediscovery to resolve the tier-capability `basesPerSpace` cap, and
// `plan_id` when resolving DB-native effective entitlements
// (shared-entitlements 2.3/4.2 — the migration off `tier`).
//
// Columns intentionally omitted: stripeSubscriptionItemId, stripeProductId,
// stripePriceId, billingPeriod, trialEndsAt, trialBackupRunUsed,
// trialEverUsed, currentPeriodStart, currentPeriodEnd, cancelledAt,
// createdAt, modifiedAt — engine doesn't read them today.
//
// Per CLAUDE.md §5.3.

import { pgSchema, text } from "drizzle-orm/pg-core";

const baseout = pgSchema("baseout");

export const subscriptionItems = baseout.table("subscription_items", {
  id: text("id").primaryKey(),
  subscriptionId: text("subscription_id").notNull(),
  platformId: text("platform_id").notNull(),
  tier: text("tier").notNull(),
  // 'starter' | 'launch' | 'growth' | 'pro' | 'business' | 'enterprise'
  // Nullable: set by the entitlement backfill (task 2.3); NULL for an
  // un-backfilled org → the resolver's innerJoin yields no plan → returns null.
  planId: text("plan_id"),
});

export type SubscriptionItemRow = typeof subscriptionItems.$inferSelect;
