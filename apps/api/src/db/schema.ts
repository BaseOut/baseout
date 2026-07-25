// Read-only MIRROR of master-DB tables (canonical: apps/web/src/db/schema/core.ts).
// apps/api never writes the master DB and never touches per-Space client DBs
// (schema reads go through apps/server — design D3). Selected columns only; add
// columns when an endpoint needs them. Per the apps/server mirror convention
// (CLAUDE.md §5.3) — never migrate from this side; web owns all master migrations.

import { pgSchema, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

const baseout = pgSchema("baseout");

// Public API tokens (canonical: core.ts apiTokens; migration 0027_api_tokens.sql).
export const apiTokens = baseout.table("api_tokens", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  spaceId: text("space_id"),
  tokenHash: text("token_hash").notNull(),
  scopes: text("scopes").array().notNull(),
  isActive: boolean("is_active").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export const organizations = baseout.table("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const spaces = baseout.table("spaces", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id"),
  name: text("name").notNull(),
  spaceType: text("space_type").notNull(),
  status: text("status").notNull(),
  onboardingStep: integer("onboarding_step").notNull(),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const spacePlatforms = baseout.table("space_platforms", {
  id: text("id").primaryKey(),
  spaceId: text("space_id"),
  platformId: text("platform_id"),
});

export const platforms = baseout.table("platforms", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull(),
});

export const atBases = baseout.table("at_bases", {
  id: text("id").primaryKey(),
  spaceId: text("space_id"),
  atBaseId: text("at_base_id").notNull(),
  name: text("name").notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
});

export const connections = baseout.table("connections", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id"),
  platformId: text("platform_id"),
  spaceId: text("space_id"),
  scope: text("scope").notNull(),
  status: text("status").notNull(),
  displayName: text("display_name"),
});

export const backupRuns = baseout.table("backup_runs", {
  id: text("id").primaryKey(),
  spaceId: text("space_id"),
  status: text("status").notNull(),
  triggeredBy: text("triggered_by").notNull(),
  kind: text("kind").notNull(),
  recordCount: integer("record_count"),
  tableCount: integer("table_count"),
  attachmentCount: integer("attachment_count"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const backupConfigurationBases = baseout.table("backup_configuration_bases", {
  id: text("id").primaryKey(),
  backupConfigurationId: text("backup_configuration_id"),
  atBaseId: text("at_base_id"),
  isIncluded: boolean("is_included").notNull(),
  isAutoDiscovered: boolean("is_auto_discovered").notNull(),
});

export const backupConfigurations = baseout.table("backup_configurations", {
  id: text("id").primaryKey(),
  spaceId: text("space_id"),
  frequency: text("frequency").notNull(),
  scope: text("scope").notNull(),
  schemaFrequency: text("schema_frequency"),
  schemaNextScheduledAt: timestamp("schema_next_scheduled_at", { withTimezone: true }),
  mode: text("mode").notNull(),
  storageType: text("storage_type").notNull(),
  autoAddFutureBases: boolean("auto_add_future_bases").notNull(),
  nextScheduledAt: timestamp("next_scheduled_at", { withTimezone: true }),
});

export const backupRetentionPolicies = baseout.table("backup_retention_policies", {
  id: text("id").primaryKey(),
  spaceId: text("space_id"),
  policyTier: text("policy_tier").notNull(),
  keepLastN: integer("keep_last_n"),
  dailyWindowDays: integer("daily_window_days"),
  weeklyWindowDays: integer("weekly_window_days"),
  monthlyIndefinite: boolean("monthly_indefinite").notNull(),
  customRules: jsonb("custom_rules"),
});

export const backupRunBases = baseout.table("backup_run_bases", {
  id: text("id").primaryKey(),
  runId: text("run_id"),
  atBaseId: text("at_base_id").notNull(),
  baseName: text("base_name").notNull(),
  status: text("status").notNull(),
  tablesCount: integer("tables_count").notNull(),
  recordsCount: integer("records_count").notNull(),
  attachmentsCount: integer("attachments_count").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  errorMessage: text("error_message"),
});

export const backupRunTables = baseout.table("backup_run_tables", {
  id: text("id").primaryKey(),
  runBaseId: text("run_base_id"),
  tableId: text("table_id").notNull(),
  tableName: text("table_name").notNull(),
  recordCount: integer("record_count").notNull(),
  fieldCount: integer("field_count").notNull(),
  attachmentCount: integer("attachment_count").notNull(),
});
