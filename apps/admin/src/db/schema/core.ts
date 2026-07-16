// ─────────────────────────────────────────────────────────────────────────
// MIRROR of apps/web/src/db/schema/core.ts — that file is the CANONICAL
// migration source (apps/web owns master-DB schema + the drizzle/ directory).
// Keep this in sync; admin owns no migrations.
//
// This is a partial mirror: only the columns the staff surfaces touch.
// Foreign-key `.references()` are intentionally omitted — they aren't
// needed and would force importing the referenced tables. snake_case
// column names match the live DB exactly.
//
// WRITE SCOPE (shared-admin-actions): this mirror is no longer read-only.
// Admin may INSERT `admin_audit_log` + `backup_runs`, DELETE the
// `backup_runs` row it just inserted (engine-4xx orphan cleanup), and
// UPDATE `connections.status/invalidated_at/modified_at` +
// `organizations.has_migrated` — nothing else. `admin_audit_log` is
// append-only: no UPDATE/DELETE call site may exist (guard-tested).
//
// NEVER mirror `*_enc` columns (encrypted OAuth tokens, BYODB DSNs) — leaving
// them out of the mirror guarantees no admin query can ever select them.
// ─────────────────────────────────────────────────────────────────────────
import { pgSchema, text, boolean, timestamp, integer, jsonb } from 'drizzle-orm/pg-core'
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
  stripeCustomerId: text('stripe_customer_id'),
  hasMigrated: boolean('has_migrated').notNull().default(true),
  dynamicLocked: boolean('dynamic_locked').notNull().default(false),
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
  stripeSubscriptionId: text('stripe_subscription_id').notNull(),
  status: text('status').notNull(),
  // 'trialing' | 'active' | 'past_due' | 'cancelled' | 'incomplete' | 'incomplete_expired'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const subscriptionItems = baseout.table('subscription_items', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: text('subscription_id').notNull(),
  platformId: text('platform_id').notNull(),
  tier: text('tier').notNull(),
  billingPeriod: text('billing_period').notNull(), // 'monthly' | 'annual'
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  trialBackupRunUsed: boolean('trial_backup_run_used').notNull().default(false),
  trialEverUsed: boolean('trial_ever_used').notNull().default(false),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
})

export const connections = baseout.table('connections', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text('organization_id').notNull(),
  platformId: text('platform_id').notNull(),
  scope: text('scope').notNull().default('organization'),
  displayName: text('display_name'),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  status: text('status').notNull(),
  // 'active' | 'invalid' | 'refreshing' | 'pending_reauth'
  invalidatedAt: timestamp('invalidated_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  oauthRefreshClaimId: text('oauth_refresh_claim_id'),
  oauthRefreshClaimedAt: timestamp('oauth_refresh_claimed_at', { withTimezone: true }),
  oauthRefreshLastError: text('oauth_refresh_last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp('modified_at', { withTimezone: true }).notNull().defaultNow(),
})

export const connectionSessions = baseout.table('connection_sessions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  connectionId: text('connection_id').notNull(),
  lockedBy: text('locked_by').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})

export const backupRuns = baseout.table('backup_runs', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  spaceId: text('space_id').notNull(),
  connectionId: text('connection_id').notNull(),
  status: text('status').notNull().default('queued'),
  // 'queued' | 'running' | 'succeeded' | 'failed' | 'trial_complete' | 'trial_truncated' | 'cancelling' | 'cancelled' | 'deleting'
  triggeredBy: text('triggered_by').notNull(),
  kind: text('kind').notNull().default('full'), // 'full' | 'schema'
  isTrial: boolean('is_trial').notNull().default(false),
  recordCount: integer('record_count'),
  tableCount: integer('table_count'),
  attachmentCount: integer('attachment_count'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const backupConfigurationBases = baseout.table('backup_configuration_bases', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  backupConfigurationId: text('backup_configuration_id').notNull(),
  atBaseId: text('at_base_id').notNull(),
  isIncluded: boolean('is_included').notNull().default(true),
})

// Append-only staff-action audit trail (canonical: apps/web core.ts +
// drizzle/0025_admin_audit_log.sql). Admin INSERTs intent/result rows via
// src/lib/audit.ts — never UPDATE or DELETE.
export const adminAuditLog = baseout.table('admin_audit_log', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  phase: text('phase').notNull().default('intent'),
  // 'intent' | 'result'
  intentId: text('intent_id'),
  actorUserId: text('actor_user_id').notNull(),
  actorEmail: text('actor_email').notNull(),
  action: text('action').notNull(),
  // 'force_backup' | 'invalidate_connection' | 'force_migration'
  targetType: text('target_type').notNull(),
  // 'space' | 'connection' | 'organization'
  targetId: text('target_id').notNull(),
  organizationId: text('organization_id'),
  params: jsonb('params'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const backupConfigurations = baseout.table('backup_configurations', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  spaceId: text('space_id').notNull(),
  frequency: text('frequency').notNull().default('monthly'),
  scope: text('scope').notNull().default('schema_and_data'),
  schemaFrequency: text('schema_frequency'),
  schemaNextScheduledAt: timestamp('schema_next_scheduled_at', { withTimezone: true }),
  storageType: text('storage_type').notNull().default('r2_managed'),
  nextScheduledAt: timestamp('next_scheduled_at', { withTimezone: true }),
})

// `byodb_connection_string_enc` deliberately NOT mirrored (see header).
export const spaceDatabases = baseout.table('space_databases', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  spaceId: text('space_id').notNull(),
  backend: text('backend').notNull(), // 'd1' | 'managed_pg' | 'byodb'
  recordsEnabled: boolean('records_enabled').notNull().default(false),
  status: text('status').notNull().default('pending'),
  // 'pending' | 'provisioning' | 'active' | 'migrating' | 'error'
  d1DatabaseId: text('d1_database_id'),
  pgLocator: text('pg_locator'),
  schemaVersion: integer('schema_version'),
  lastSchemaSyncAt: timestamp('last_schema_sync_at', { withTimezone: true }),
  lastRecordsSyncAt: timestamp('last_records_sync_at', { withTimezone: true }),
  provisionedAt: timestamp('provisioned_at', { withTimezone: true }),
  errorMessage: text('error_message'),
})

// OAuth token `*_enc` columns deliberately NOT mirrored (see header).
export const storageDestinations = baseout.table('storage_destinations', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  spaceId: text('space_id').notNull(),
  type: text('type').notNull(),
  // 'local_fs' | 'google_drive' | 'box' | 'dropbox' | 'onedrive'
  oauthExpiresAt: timestamp('oauth_expires_at', { withTimezone: true }),
  oauthAccountEmail: text('oauth_account_email'),
  connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
  lastValidatedAt: timestamp('last_validated_at', { withTimezone: true }),
})
