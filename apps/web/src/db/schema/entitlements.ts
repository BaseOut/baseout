/**
 * Entitlements — account-scoped master tables (shared-entitlements, design D2/D5–D7).
 *
 * These reference app-owned tables (organizations, spaces, users), so they live
 * here in apps/web rather than in @baseout/db-schema (the package must not depend
 * on the app). The PURE catalog tables (plans, features, plan_features, …) are
 * canonical in @baseout/db-schema and re-exported below so the schema barrel,
 * drizzle-kit, and the runtime client all see one unified set — the same
 * re-export pattern auth.ts uses. Canonical migrations are generated here.
 */

import {
  boolean,
  check,
  index,
  integer,
  numeric,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { baseout, users } from './auth'
import { organizations, spaces } from './core'
import { addonCatalog, features } from '@baseout/db-schema'

// Re-export the catalog (canonical in @baseout/db-schema) so drizzle-kit and the
// barrel resolve every entitlement table from one place.
export {
  featureGroups,
  features,
  plans,
  planPrices,
  planFeatures,
  addonCatalog,
} from '@baseout/db-schema'

// ———————————————————————————————————————————————————————————————————————————
// ACCOUNT FEATURE OVERRIDES
// Sparse, intentional exceptions only — one row per (organization, feature) with
// a typed value, a required reason, the granting staff user, and optional expiry
// (D2). Resolution: effective = override.value ?? plan value (+ add-ons on limits).
// Enterprise contracts are expressed entirely as override rows (D10).
// ———————————————————————————————————————————————————————————————————————————

export const accountFeatureOverrides = baseout.table('account_feature_overrides', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  featureId: text('feature_id')
    .notNull()
    .references(() => features.id, { onDelete: 'restrict' }),
  valueBool: boolean('value_bool'),
  valueNumeric: numeric('value_numeric'),
  valueEnum: text('value_enum'),
  reason: text('reason').notNull(),
  grantedByUserId: text('granted_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp('modified_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('account_feature_overrides_org_feature_unique').on(
    table.organizationId,
    table.featureId,
  ),
  index('account_feature_overrides_org_idx').on(table.organizationId),
])

// ———————————————————————————————————————————————————————————————————————————
// ADD-ON PURCHASES
// Entitlement extensions the customer BOUGHT (D8). Recurring = a Stripe
// subscription item on an add-on price; one-time packs carry expires_at = the
// current monthly anniversary boundary. Stacking quantity adds to limit
// features only. Distinct from overage_records (dormant).
// ———————————————————————————————————————————————————————————————————————————

export const addonPurchases = baseout.table('addon_purchases', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  addonId: text('addon_id')
    .notNull()
    .references(() => addonCatalog.id, { onDelete: 'restrict' }),
  quantity: integer('quantity').notNull().default(1),
  kind: text('kind').notNull(), // 'recurring' | 'one_time'
  stripeSubscriptionItemId: text('stripe_subscription_item_id').unique(),
  stripeInvoiceItemId: text('stripe_invoice_item_id').unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }), // one-time packs only
  status: text('status').notNull().default('active'), // 'active' | 'cancelled' | 'expired'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp('modified_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('addon_purchases_kind_check', sql`${table.kind} in ('recurring', 'one_time')`),
  check('addon_purchases_status_check', sql`${table.status} in ('active', 'cancelled', 'expired')`),
  index('addon_purchases_org_status_idx').on(table.organizationId, table.status),
])

// ———————————————————————————————————————————————————————————————————————————
// USAGE ROLLUPS
// Authoritative usage records in the master DB (D5/D6). Flow meters reset on the
// monthly anniversary; stock meters are the continuously-updated current-period
// level. space_id is set for per-Space stock samples, NULL for org-level flow
// rollups. Written by rollup ingestion + point-of-use metering; drift-corrected
// by the reconciliation sweep (metering phase).
// ———————————————————————————————————————————————————————————————————————————

export const usageRollups = baseout.table('usage_rollups', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  featureSlug: text('feature_slug').notNull(),
  spaceId: text('space_id').references(() => spaces.id, { onDelete: 'cascade' }),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  used: numeric('used').notNull().default('0'),
  meterKind: text('meter_kind'), // 'flow' | 'stock' | 'creation'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp('modified_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('usage_rollups_org_feature_period_idx').on(
    table.organizationId,
    table.featureSlug,
    table.periodStart,
  ),
  // Upsert key for the engine's per-run usage ingestion (shared-entitlements
  // 3.1). COALESCE collapses a NULL space_id so org-level flow rollups dedupe
  // alongside Space-scoped stock samples. Migration: 0035. (Hand-written — a
  // COALESCE expression index round-trips poorly through drizzle-kit generate.)
  uniqueIndex('usage_rollups_org_feature_space_period_uq').on(
    table.organizationId,
    table.featureSlug,
    sql`coalesce(${table.spaceId}, '')`,
    table.periodStart,
  ),
])

// ———————————————————————————————————————————————————————————————————————————
// USAGE NOTIFICATION STATE
// The deduplicated warn/enforce state machine (D7): ok → warned_90 → warned_100
// → enforced, per (organization, feature, period). Only transitions fire
// notifications; reset at period rollover or when usage drops back under.
// ———————————————————————————————————————————————————————————————————————————

export const usageNotificationState = baseout.table('usage_notification_state', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  featureSlug: text('feature_slug').notNull(),
  state: text('state').notNull().default('ok'), // 'ok' | 'warned_90' | 'warned_100' | 'enforced'
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  lastTransitionAt: timestamp('last_transition_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp('modified_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check(
    'usage_notification_state_check',
    sql`${table.state} in ('ok', 'warned_90', 'warned_100', 'enforced')`,
  ),
  unique('usage_notification_state_org_feature_period_unique').on(
    table.organizationId,
    table.featureSlug,
    table.periodStart,
  ),
])
