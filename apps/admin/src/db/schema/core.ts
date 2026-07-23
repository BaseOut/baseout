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
  overageMode: text('overage_mode').notNull().default('cap'), // 'auto' | 'cap'
  monthlyOverageCap: integer('monthly_overage_cap'), // cents; NULL = no cap
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Canonical: apps/web core.ts organizationMembers (migration 0000_deep_freak.sql).
export const organizationMembers = baseout.table('organization_members', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text('organization_id').notNull(),
  userId: text('user_id').notNull(),
  role: text('role').notNull(), // 'owner' | 'admin' | 'member'
  isDefault: boolean('is_default').notNull().default(false),
  invitedAt: timestamp('invited_at', { withTimezone: true }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const spaces = baseout.table('spaces', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text('organization_id').notNull(),
  name: text('name').notNull(),
  spaceType: text('space_type'), // 'single_platform' | 'multi_platform' (space detail — admin-entity-linking)
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
  createdByUserId: text('created_by_user_id'), // user detail: connections created by a user (admin-entity-linking)
  spaceId: text('space_id'),                   // space-scoped connections (scope='space')
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
  pendingReauthAt: timestamp('pending_reauth_at', { withTimezone: true }), // error-triage occurrence time (migration 0026)
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
  triggerRunIds: jsonb('trigger_run_ids').$type<string[]>(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const backupConfigurationBases = baseout.table('backup_configuration_bases', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  isAutoDiscovered: boolean('is_auto_discovered').notNull().default(false), // space detail (admin-entity-linking)
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
  mode: text('mode').notNull().default('static'), // static | dynamic — config summary (admin-entity-directories)
  autoAddFutureBases: boolean('auto_add_future_bases').notNull().default(false), // space detail (admin-entity-linking)
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
  modifiedAt: timestamp('modified_at', { withTimezone: true }), // DB-error occurrence time (admin-error-triage)
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

// Postgres-trigger-written connection status-flip history (canonical:
// apps/web core.ts connectionStatusAudit, migration
// 0015_connection_status_audit.sql). Partial mirror — the old/new
// invalidated/token/modified timestamp pairs are omitted (the /audit surface
// shows the status flip + who did it, not the timestamp deltas). Read-only.
export const connectionStatusAudit = baseout.table('connection_status_audit', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  connectionId: text('connection_id').notNull(),
  organizationId: text('organization_id'),
  platformId: text('platform_id'),
  oldStatus: text('old_status'),
  newStatus: text('new_status').notNull(),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  dbUser: text('db_user').notNull().default(sql`current_user`),
  applicationName: text('application_name'),
})

// Per-metric overage usage per billing period (canonical: apps/web core.ts
// overageRecords, migration 0000_deep_freak.sql). Read-only.
export const overageRecords = baseout.table('overage_records', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text('organization_id').notNull(),
  subscriptionItemId: text('subscription_item_id').notNull(),
  metric: text('metric').notNull(),
  // 'records' | 'attachments' | 'storage_gb' | 'database_gb'
  // | 'bases' | 'spaces' | 'team_members' | 'manual_runs' | 'api_calls'
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  includedQuota: integer('included_quota').notNull(),
  usageAmount: integer('usage_amount').notNull(),
  overageAmount: integer('overage_amount').notNull(),
  unitCostCents: integer('unit_cost_cents').notNull(),
  totalCostCents: integer('total_cost_cents').notNull(),
  stripeInvoiceItemId: text('stripe_invoice_item_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Restore runs (canonical: apps/web core.ts restoreRuns, migration
// 0019_shallow_mattie_franklin.sql). `trigger_run_ids` (text[]) omitted —
// engine plumbing, not displayed. Read-only.
export const restoreRuns = baseout.table('restore_runs', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  spaceId: text('space_id').notNull(),
  connectionId: text('connection_id').notNull(),
  sourceRunId: text('source_run_id').notNull(),
  status: text('status').notNull(),
  // 'queued' | 'running' | 'cancelling' | 'cancelled' | 'succeeded' | 'failed'
  scope: text('scope').notNull(), // 'base' | 'table' | 'point_in_time'
  scopeTarget: jsonb('scope_target').notNull(), // { baseId, tableId?, runId? }
  tablesRestored: integer('tables_restored').notNull().default(0),
  recordsRestored: integer('records_restored').notNull().default(0),
  attachmentsRestored: integer('attachments_restored').notNull().default(0),
  triggeredBy: text('triggered_by').notNull(), // 'user_manual' | 'admin_override'
  isTrial: boolean('is_trial').notNull().default(false),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Per-base run snapshot (canonical: apps/web core.ts backupRunBases,
// migration 0020_backup_run_bases_and_tables.sql). Absent for legacy
// completions predating workflows-run-detail. Read-only.
export const backupRunBases = baseout.table('backup_run_bases', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  runId: text('run_id').notNull(),
  atBaseId: text('at_base_id').notNull(),
  baseName: text('base_name').notNull(),
  status: text('status').notNull(),
  // 'succeeded' | 'failed' | 'trial_complete' | 'trial_truncated'
  tablesCount: integer('tables_count').notNull().default(0),
  recordsCount: integer('records_count').notNull().default(0),
  attachmentsCount: integer('attachments_count').notNull().default(0),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  errorMessage: text('error_message'),
})

// Per-table run snapshot (canonical: apps/web core.ts backupRunTables, same
// 0020 migration). Read-only.
export const backupRunTables = baseout.table('backup_run_tables', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  runBaseId: text('run_base_id').notNull(),
  tableId: text('table_id').notNull(),
  tableName: text('table_name').notNull(),
  recordCount: integer('record_count').notNull().default(0),
  fieldCount: integer('field_count').notNull().default(0),
  attachmentCount: integer('attachment_count').notNull().default(0),
})

// Background-service run log (canonical: apps/web core.ts serviceRuns, migration
// 0028_service_runs.sql; written by apps/server via withServiceRun). READ-ONLY
// here — the /services surface reads it; no admin code path writes it
// (guard-tested in service-runs-guard.test.ts). All columns are safe (no *_enc).
export const serviceRuns = baseout.table('service_runs', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  service: text('service').notNull(),
  status: text('status').notNull().default('started'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  durationMs: integer('duration_ms'),
  counts: jsonb('counts'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  modifiedAt: timestamp('modified_at', { withTimezone: true }).notNull().defaultNow(),
})

// Staff error-triage acks (canonical: apps/web core.ts adminErrorAcks, migration
// 0029_admin_error_acks.sql). APPEND-ONLY: read + INSERT only, no UPDATE/DELETE
// (guard-tested in error-acks-guard.test.ts). Effective state = latest `phase`
// row per (target_type, target_id[, target_state]). No FKs; no *_enc.
export const adminErrorAcks = baseout.table('admin_error_acks', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  phase: text('phase').notNull().default('ack'),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  targetState: text('target_state'),
  organizationId: text('organization_id'),
  ackedByUserId: text('acked_by_user_id').notNull(),
  ackedByEmail: text('acked_by_email').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Airtable base registry (canonical: apps/web core.ts atBases). Read-only.
// Space detail lists a Space's bases + inclusion flags (joined to
// backup_configuration_bases). Per CLAUDE.md §5.3.
export const atBases = baseout.table('at_bases', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  spaceId: text('space_id').notNull(),
  atBaseId: text('at_base_id').notNull(),
  name: text('name').notNull(),
  discoveredVia: text('discovered_via').notNull().default('oauth_callback'),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
})

// Backup retention policy (canonical: apps/web core.ts backupRetentionPolicies).
// Read-only; space detail shows the effective policy. Per CLAUDE.md §5.3.
export const backupRetentionPolicies = baseout.table('backup_retention_policies', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  spaceId: text('space_id').notNull(),
  policyTier: text('policy_tier').notNull(),
  keepLastN: integer('keep_last_n'),
  dailyWindowDays: integer('daily_window_days'),
  weeklyWindowDays: integer('weekly_window_days'),
  monthlyIndefinite: boolean('monthly_indefinite').notNull().default(false),
})
