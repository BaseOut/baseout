// ─────────────────────────────────────────────────────────────────────────
// MIRROR of apps/web/src/db/schema/core.ts — that file is the CANONICAL
// migration source (apps/web owns master-DB schema + the drizzle/ directory).
// Keep this in sync; admin owns no migrations.
//
// This is a partial mirror: only the columns the Organizations → Spaces
// tracker reads. Foreign-key `.references()` are intentionally omitted —
// they aren't needed for read-only SELECTs and would force importing the
// referenced tables. snake_case column names match the live DB exactly.
// ─────────────────────────────────────────────────────────────────────────
import { pgSchema, text, boolean, timestamp } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const baseout = pgSchema('baseout')

export const platforms = baseout.table('platforms', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
})

export const organizations = baseout.table('organizations', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  hasMigrated: boolean('has_migrated').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const spaces = baseout.table('spaces', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text('organization_id').notNull(),
  name: text('name').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const spacePlatforms = baseout.table('space_platforms', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  spaceId: text('space_id').notNull(),
  platformId: text('platform_id').notNull(),
})

export const subscriptions = baseout.table('subscriptions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text('organization_id').notNull(),
  status: text('status').notNull(),
})

export const subscriptionItems = baseout.table('subscription_items', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: text('subscription_id').notNull(),
  platformId: text('platform_id').notNull(),
  tier: text('tier').notNull(),
})
