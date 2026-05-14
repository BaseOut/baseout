// MIRROR of apps/web/src/db/schema/core.ts:285 (canonical writer).
// Migrations: apps/web/drizzle/0000_deep_freak.sql (initial)
//
// One row per active Platform within a subscription. apps/web is the
// canonical writer (Stripe webhook + onboarding). apps/server reads
// `subscription_id`, `platform_id`, and `tier` during workspace
// rediscovery to resolve the tier-capability `basesPerSpace` cap.
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
});

export type SubscriptionItemRow = typeof subscriptionItems.$inferSelect;
