// MIRROR of apps/web/src/db/schema/core.ts:264 (canonical writer).
// Migrations: apps/web/drizzle/0000_deep_freak.sql (initial)
//
// One Stripe subscription per Organization. apps/web is the canonical
// writer (Stripe webhook + onboarding). apps/server reads
// `organization_id` during workspace rediscovery to resolve the tier on
// the connected subscription_items row (`basesPerSpace` cap).
//
// Columns intentionally omitted: stripeSubscriptionId, status,
// createdAt, modifiedAt — engine doesn't read them.
//
// Per CLAUDE.md §5.3.

import { pgSchema, text } from "drizzle-orm/pg-core";

const baseout = pgSchema("baseout");

export const subscriptions = baseout.table("subscriptions", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
});

export type SubscriptionRow = typeof subscriptions.$inferSelect;
