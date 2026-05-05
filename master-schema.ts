/**
 * Baseout — Master Database Schema
 * Database: PostgreSQL (DigitalOcean)
 * ORM: Drizzle
 *
 * This file defines the master DB schema — organizational metadata, billing,
 * connections, spaces, and subscriptions. It does NOT include customer Airtable
 * record data, which lives in per-Space client DBs (D1 / Shared PG / Dedicated PG).
 *
 * better-auth tables (users, sessions, accounts, verifications) are managed by
 * better-auth's own migration system and are NOT defined here. better-auth is
 * configured to use crypto.randomUUID() so all user IDs are UUIDs, consistent
 * with this schema.
 *
 * Status: Core tables only (Sections 1–5 approved).
 *         Backup, restore, storage, webhooks, notifications, and health score
 *         tables will be added in a subsequent migration.
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORMS
// Seeded reference table — not user-editable.
// Each platform has a short code used as a prefix for platform-specific tables
// (e.g. 'at' → at_bases, 'nt' → nt_pages).
// ─────────────────────────────────────────────────────────────────────────────

export const platforms = pgTable('platforms', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),       // 'airtable' | 'notion' | 'hubspot'
  code: text('code').notNull().unique(),       // 'at' | 'nt' | 'hs' — table/field prefix
  name: text('name').notNull(),                // 'Airtable' | 'Notion' | 'HubSpot'
  iconUrl: text('icon_url'),
  websiteUrl: text('website_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp('modified_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─────────────────────────────────────────────────────────────────────────────
// ORGANIZATIONS
// Top-level billing entity — one per customer company.
// Maps to a single Stripe customer and billing relationship.
// ─────────────────────────────────────────────────────────────────────────────

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),        // URL-safe identifier e.g. "acme-corp"
  stripeCustomerId: text('stripe_customer_id').unique(),
  hasMigrated: boolean('has_migrated').notNull().default(true),
  // false = On2Air migrated user; shows "Complete Your Migration" screen on first login
  dynamicLocked: boolean('dynamic_locked').notNull().default(false),
  // true = On2Air user; dynamic features shown as upgrade CTAs, not hidden
  overageMode: text('overage_mode').notNull().default('cap'), // 'auto' | 'cap'
  monthlyOverageCap: integer('monthly_overage_cap'),
  // cents; NULL = no cap (only applies when overage_mode = 'auto')
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp('modified_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─────────────────────────────────────────────────────────────────────────────
// ORGANIZATION MEMBERS
// Links better-auth users to Organizations with a role.
// A user may belong to multiple Organizations (e.g. a consultant managing clients).
// ─────────────────────────────────────────────────────────────────────────────

export const organizationMembers = pgTable('organization_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),           // references better-auth users.id (uuid configured)
  role: text('role').notNull(),                // 'owner' | 'admin' | 'member'
  isDefault: boolean('is_default').notNull().default(false),
  // true = this org is loaded on login if no active org is set
  invitedByUserId: uuid('invited_by_user_id'), // better-auth user ID of inviter
  invitedAt: timestamp('invited_at', { withTimezone: true }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp('modified_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('organization_members_org_user_unique').on(table.organizationId, table.userId),
  index('organization_members_user_id_idx').on(table.userId),
])

// ─────────────────────────────────────────────────────────────────────────────
// SPACES
// A container within an Organization bound to one Platform (V1).
// Has its own backup config, storage destination, and database.
// Defined before user_preferences and connections to avoid forward references.
// ─────────────────────────────────────────────────────────────────────────────

export const spaces = pgTable('spaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  spaceType: text('space_type').notNull().default('single_platform'),
  // 'single_platform' | 'multi_platform' (V2)
  status: text('status').notNull().default('setup_incomplete'),
  // 'setup_incomplete' | 'active' | 'paused' | 'error'
  onboardingStep: integer('onboarding_step').notNull().default(1),
  // 1–5; tracks wizard progress; ignored once onboarding_completed_at is set
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp('modified_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('spaces_organization_id_idx').on(table.organizationId),
])

// ─────────────────────────────────────────────────────────────────────────────
// SPACE PLATFORMS
// Join table: links Spaces to Platforms.
// V1: always one row per Space. V2 multi-platform Spaces will have multiple rows.
// ─────────────────────────────────────────────────────────────────────────────

export const spacePlatforms = pgTable('space_platforms', {
  id: uuid('id').primaryKey().defaultRandom(),
  spaceId: uuid('space_id')
    .notNull()
    .references(() => spaces.id, { onDelete: 'cascade' }),
  platformId: uuid('platform_id')
    .notNull()
    .references(() => platforms.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('space_platforms_space_platform_unique').on(table.spaceId, table.platformId),
  index('space_platforms_space_id_idx').on(table.spaceId),
])

// ─────────────────────────────────────────────────────────────────────────────
// AT_BASES  (Airtable-specific)
// Pure registry of Airtable bases known within a Space.
// Backup-specific flags (is_included, is_auto_discovered) live in
// backup_configuration_bases, not here.
// ─────────────────────────────────────────────────────────────────────────────

export const atBases = pgTable('at_bases', {
  id: uuid('id').primaryKey().defaultRandom(),
  spaceId: uuid('space_id')
    .notNull()
    .references(() => spaces.id, { onDelete: 'cascade' }),
  atBaseId: text('at_base_id').notNull(),      // Airtable base ID e.g. "appXXXXXXXXX"
  name: text('name').notNull(),                // cached from last API scan
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp('modified_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('at_bases_space_base_unique').on(table.spaceId, table.atBaseId),
  index('at_bases_space_id_idx').on(table.spaceId),
])

// ─────────────────────────────────────────────────────────────────────────────
// USER PREFERENCES
// Per-user session state: active org and last viewed space.
// Survives browser closes — persisted in master DB, not a cookie.
// ─────────────────────────────────────────────────────────────────────────────

export const userPreferences = pgTable('user_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique(),  // references better-auth users.id
  activeOrganizationId: uuid('active_organization_id')
    .references(() => organizations.id, { onDelete: 'set null' }),
  // changes when user switches orgs; defaults to their is_default org on first load
  activeSpaceId: uuid('active_space_id')
    .references(() => spaces.id, { onDelete: 'set null' }),
  // last viewed Space — remembered across sessions per PRD §6.4
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp('modified_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTIONS
// Authenticated links between an Organization and an external Platform.
// One Connection can serve multiple Spaces within the same Organization.
// Tokens stored AES-256-GCM encrypted (_enc suffix).
// ─────────────────────────────────────────────────────────────────────────────

export const connections = pgTable('connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  platformId: uuid('platform_id')
    .notNull()
    .references(() => platforms.id),
  createdByUserId: uuid('created_by_user_id').notNull(), // references better-auth users.id
  scope: text('scope').notNull().default('organization'),
  // 'user'         → only visible to created_by_user_id
  // 'organization' → all users in the org can use it
  // 'space'        → restricted to a specific space (spaceId required)
  spaceId: uuid('space_id')
    .references(() => spaces.id, { onDelete: 'set null' }),
  // populated when scope = 'space'
  displayName: text('display_name'),           // user-given label e.g. "Main Airtable Account"
  accessTokenEnc: text('access_token_enc').notNull(),
  refreshTokenEnc: text('refresh_token_enc'),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  scopes: text('scopes'),                      // space-delimited OAuth scopes granted
  platformConfig: jsonb('platform_config'),
  // airtable: { at_user_id, at_workspace_id, is_enterprise_scope }
  // notion:   { workspace_id, workspace_name }
  // hubspot:  { portal_id }
  status: text('status').notNull(),
  // 'active' | 'invalid' | 'refreshing' | 'pending_reauth'
  maxConcurrentSessions: integer('max_concurrent_sessions').notNull().default(3),
  invalidatedAt: timestamp('invalidated_at', { withTimezone: true }),
  // set when dead-connection cadence completes and status moves to 'invalid'
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp('modified_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('connections_org_platform_idx').on(table.organizationId, table.platformId),
  index('connections_created_by_idx').on(table.createdByUserId),
])

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTION SESSIONS
// Ephemeral lock records — inserted on acquire, deleted on release.
// Acquire: verify active count < max_concurrent_sessions, then insert.
// Release: delete row.
// Crash recovery: background service sweeps expires_at < now() and purges stale rows.
// ─────────────────────────────────────────────────────────────────────────────

export const connectionSessions = pgTable('connection_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  connectionId: uuid('connection_id')
    .notNull()
    .references(() => connections.id, { onDelete: 'cascade' }),
  lockedBy: text('locked_by').notNull(),
  // structured reference e.g. "backup-run:uuid", "durable-object:space-abc"
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  // safety TTL — process must release or renew before this; swept by background service
}, (table) => [
  index('connection_sessions_connection_id_idx').on(table.connectionId),
  index('connection_sessions_expires_at_idx').on(table.expiresAt),
])

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTIONS
// One Stripe subscription per Organization.
// Created at sign-up as a $0 trial — modified (never replaced) as tiers change.
// ─────────────────────────────────────────────────────────────────────────────

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),
  status: text('status').notNull(),
  // 'trialing' | 'active' | 'past_due' | 'cancelled' | 'incomplete' | 'incomplete_expired'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp('modified_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('subscriptions_organization_unique').on(table.organizationId),
])

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION ITEMS
// One row per active Platform within a subscription.
// Capabilities and limits are always resolved from Stripe product metadata
// (platform + tier) — these fields are cached locally for fast lookups only.
// ─────────────────────────────────────────────────────────────────────────────

export const subscriptionItems = pgTable('subscription_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  subscriptionId: uuid('subscription_id')
    .notNull()
    .references(() => subscriptions.id, { onDelete: 'cascade' }),
  platformId: uuid('platform_id')
    .notNull()
    .references(() => platforms.id),
  stripeSubscriptionItemId: text('stripe_subscription_item_id').notNull().unique(),
  stripeProductId: text('stripe_product_id').notNull(),
  stripePriceId: text('stripe_price_id').notNull(),
  tier: text('tier').notNull(),
  // 'starter' | 'launch' | 'growth' | 'pro' | 'business' | 'enterprise'
  billingPeriod: text('billing_period').notNull(), // 'monthly' | 'annual'
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  trialBackupRunUsed: boolean('trial_backup_run_used').notNull().default(false),
  // true after the trial's single backup run is consumed
  trialEverUsed: boolean('trial_ever_used').notNull().default(false),
  // one trial per platform per org, ever — survives cancellation and re-subscription
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp('modified_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('subscription_items_sub_platform_unique').on(table.subscriptionId, table.platformId),
  index('subscription_items_sub_platform_idx').on(table.subscriptionId, table.platformId),
])

// ─────────────────────────────────────────────────────────────────────────────
// OVERAGE RECORDS
// Per-metric overage usage per billing period.
// Written by the background quota monitor; stripe_invoice_item_id set after billing.
// ─────────────────────────────────────────────────────────────────────────────

export const overageRecords = pgTable('overage_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  subscriptionItemId: uuid('subscription_item_id')
    .notNull()
    .references(() => subscriptionItems.id, { onDelete: 'cascade' }),
  metric: text('metric').notNull(),
  // 'records' | 'attachments' | 'storage_gb' | 'database_gb'
  // 'bases' | 'spaces' | 'team_members' | 'manual_runs' | 'api_calls'
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  includedQuota: integer('included_quota').notNull(),  // tier's included amount
  usageAmount: integer('usage_amount').notNull(),       // actual usage recorded
  overageAmount: integer('overage_amount').notNull(),   // usage_amount - included_quota (0 if none)
  unitCostCents: integer('unit_cost_cents').notNull(),
  totalCostCents: integer('total_cost_cents').notNull(), // overage_amount * unit_cost_cents
  stripeInvoiceItemId: text('stripe_invoice_item_id'),  // set once billed via Stripe
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp('modified_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('overage_records_org_period_idx').on(table.organizationId, table.periodStart),
  index('overage_records_sub_item_metric_idx').on(table.subscriptionItemId, table.metric),
])
