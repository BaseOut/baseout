// MIRROR of apps/web/src/db/schema/entitlements.ts (canonical writer).
// Migration: db/migrations/0034_entitlements_catalog.sql.
//
// apps/web owns the catalog + all entitlement migrations. The engine READS active
// add-on purchases when resolving effective entitlements (shared-entitlements
// 4.2): stacking quantity raises a limit feature's effective cap. Purchases are
// written by the web Stripe-webhook sync (task 2.2); the engine never writes
// them. Only the columns the resolver reads are mirrored. Never migrate from this
// side. Per CLAUDE.md §5.3.

import { integer, pgSchema, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const baseout = pgSchema("baseout");

export const addonPurchases = baseout.table("addon_purchases", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text("organization_id").notNull(),
  addonId: text("addon_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  status: text("status").notNull().default("active"), // 'active' | 'cancelled' | 'expired'
  expiresAt: timestamp("expires_at", { withTimezone: true }), // one-time packs only
});

export type AddonPurchaseRow = typeof addonPurchases.$inferSelect;
