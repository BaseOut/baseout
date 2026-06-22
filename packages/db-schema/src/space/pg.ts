/**
 * Per-Space DB schema — Postgres dialect (managed_pg + byodb backends).
 *
 * Canonical home of the per-Space schema. The design-of-record is
 * openspec/changes/system-per-space-db (proposal.md / design.md / spec.md);
 * this file IS the applied schema. The SQLite/D1 mirror is ./sqlite.ts — keep
 * the two in lockstep (tests/space-schema-parity.test.ts enforces table/column
 * parity). A separate drizzle config (drizzle.space-pg.config.ts) generates this
 * dialect's migrations, distinct from the master-DB config (PRD §21.1).
 *
 * Conventions:
 * - bo_at_ prefix (Baseout-owned, Airtable platform namespace).
 * - Cross-DB refs (space_id, backup_run_id, rule_id, user ids) are plain uuid
 *   columns, NOT foreign keys — they point at the master DB.
 * - Time lives on bo_at_base_runs; lifecycle *_run columns reference
 *   bo_at_base_runs.id and derive their timestamp by joining that row.
 */
import {
  pgTable, text, integer, bigint, boolean, jsonb, timestamp, uuid,
  primaryKey, index, uniqueIndex,
} from 'drizzle-orm/pg-core'

// status: 'active' | 'removed' | 'unknown'. 'removed' ONLY on a confident full
// parent enumeration; a failed/partial run uses 'unknown' (never false-delete).
const lifecycle = {
  status: text('status').notNull().default('active'),
  firstSeenRun: uuid('first_seen_run'),
  firstUnseenRun: uuid('first_unseen_run'),
  lastSeenRun: uuid('last_seen_run'),
}

// Per-base execution record — the run↔base entry point. One row per (run, base).
export const baseRuns = pgTable('bo_at_base_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  backupRunId: uuid('backup_run_id').notNull(),     // → master backup_runs.id (cross-DB)
  baseId: text('base_id').notNull(),
  status: text('status').notNull().default('queued'), // queued|running|succeeded|failed|unknown
  currStep: text('curr_step'),
  schemaVersionId: uuid('schema_version_id'),         // → bo_at_schema_versions.id
  schemaHash: text('schema_hash'),
  tablesCount: integer('tables_count'),
  recordsCount: integer('records_count'),
  attachmentsCount: integer('attachments_count'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  errorMessage: text('error_message'),
}, (t) => ({
  byBackupRun: index('bo_at_base_runs_backup_run_idx').on(t.backupRunId),
  byBase: index('bo_at_base_runs_base_idx').on(t.baseId),
}))

// ---- Schema: relational current working set (latest version) ----

export const bases = pgTable('bo_at_bases', {
  baseId: text('base_id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  ...lifecycle,
})

export const tables = pgTable('bo_at_tables', {
  tableId: text('table_id').primaryKey(),
  baseId: text('base_id').notNull(),
  name: text('name').notNull(),
  primaryFieldId: text('primary_field_id'),
  fieldCount: integer('field_count'),
  recordCount: integer('record_count'),
  description: text('description'),
  ...lifecycle,
}, (t) => ({ byBase: index('bo_at_tables_base_idx').on(t.baseId) }))

export const fields = pgTable('bo_at_fields', {
  fieldId: text('field_id').primaryKey(),
  tableId: text('table_id').notNull(),
  baseId: text('base_id').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  options: jsonb('options'),                          // type-specific config (choices, linked table, …)
  isPrimary: boolean('is_primary').notNull().default(false),
  description: text('description'),
  ...lifecycle,
}, (t) => ({ byTable: index('bo_at_fields_table_idx').on(t.tableId) }))

export const views = pgTable('bo_at_views', {
  viewId: text('view_id').primaryKey(),
  tableId: text('table_id').notNull(),
  baseId: text('base_id').notNull(),
  name: text('name').notNull(),
  type: text('type'),
  ...lifecycle,
}, (t) => ({ byTable: index('bo_at_views_table_idx').on(t.tableId) }))

// ---- Schema history ----

// Immutable full-schema snapshot per distinct version; hash-deduped.
export const schemaVersions = pgTable('bo_at_schema_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  baseId: text('base_id').notNull(),
  schemaHash: text('schema_hash').notNull(),
  schemaJson: jsonb('schema_json').notNull(),
  firstSeenRun: uuid('first_seen_run'),               // → bo_at_base_runs.id
}, (t) => ({
  uniqHash: uniqueIndex('bo_at_schema_versions_base_hash_uq').on(t.baseId, t.schemaHash),
}))

// Modifications only (add/remove are lifecycle). Self-contained before+after.
export const schemaUpdates = pgTable('bo_at_schema_updates', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').notNull(),                    // → bo_at_base_runs.id
  entityType: text('entity_type').notNull(),          // base|table|field|view|automation|interface
  entityId: text('entity_id').notNull(),
  baseId: text('base_id').notNull(),
  tableId: text('table_id'),
  changeType: text('change_type').notNull(),          // name|description|type|config|…
  changeTypeName: text('change_type_name'),
  beforeValue: jsonb('before_value'),
  afterValue: jsonb('after_value'),
  breaksData: boolean('breaks_data').notNull().default(false),
}, (t) => ({
  byRun: index('bo_at_schema_updates_run_idx').on(t.runId),
  byEntity: index('bo_at_schema_updates_entity_idx').on(t.entityType, t.entityId),
}))

// ---- Records (only populated when records_enabled) ----

export const records = pgTable('bo_at_records', {
  recordId: text('record_id').primaryKey(),
  tableId: text('table_id').notNull(),
  baseId: text('base_id').notNull(),
  createdTime: timestamp('created_time', { withTimezone: true }),   // Airtable's actual
  modifiedTime: timestamp('modified_time', { withTimezone: true }), // Airtable's actual
  status: text('status').notNull().default('active'),               // active|deleted|unknown
  firstSeenRun: uuid('first_seen_run'),
  firstUnseenRun: uuid('first_unseen_run'),
  lastSeenRun: uuid('last_seen_run'),
}, (t) => ({ byTable: index('bo_at_records_table_idx').on(t.tableId) }))

// Sparse-until-first-value: row created on first population, persists after,
// value→null on clear. No row = never populated. value is JSON-encoded text.
export const recordFieldData = pgTable('bo_at_record_field_data', {
  recordId: text('record_id').notNull(),
  fieldId: text('field_id').notNull(),
  tableId: text('table_id').notNull(),
  value: text('value'),
  firstSeenRun: uuid('first_seen_run'),
  lastSeenRun: uuid('last_seen_run'),
}, (t) => ({
  pk: primaryKey({ columns: [t.recordId, t.fieldId] }),
  byTableField: index('bo_at_rfd_table_field_idx').on(t.tableId, t.fieldId),
}))

// Superseded-value log: stores the OLD value being replaced; new value lives in
// record_field_data. First population logs nothing. Prunable by simple DELETE.
export const recordUpdates = pgTable('bo_at_record_updates', {
  id: uuid('id').defaultRandom().primaryKey(),
  recordId: text('record_id').notNull(),
  fieldId: text('field_id').notNull(),
  tableId: text('table_id').notNull(),
  runId: uuid('run_id').notNull(),                    // → bo_at_base_runs.id
  oldValue: text('old_value'),                        // superseded value (JSON-encoded)
}, (t) => ({
  byCell: index('bo_at_record_updates_cell_idx').on(t.recordId, t.fieldId),
  byRun: index('bo_at_record_updates_run_idx').on(t.runId),
}))

// ---- Attachments (binaries live in the file destination; metadata here) ----

export const attachments = pgTable('bo_at_attachments', {
  compositeId: text('composite_id').primaryKey(),     // {base}_{table}_{record}_{field}_{attachment}
  tableId: text('table_id').notNull(),
  fieldId: text('field_id').notNull(),
  recordId: text('record_id').notNull(),
  storageKey: text('storage_key').notNull(),          // key in the file destination
  contentHash: text('content_hash'),
  filename: text('filename'),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  mimeType: text('mime_type'),
  uploadStatus: text('upload_status').notNull().default('pending'), // pending|uploaded|failed
  firstSeenRun: uuid('first_seen_run'),
  lastSeenRun: uuid('last_seen_run'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }),
}, (t) => ({
  byRecord: index('bo_at_attachments_record_idx').on(t.recordId),
  byHash: index('bo_at_attachments_hash_idx').on(t.contentHash),
}))

// ---- Documentation (descriptions; Data Dictionary surface is V2) ----

export const documentation = pgTable('bo_at_documentation', {
  id: uuid('id').defaultRandom().primaryKey(),
  targetType: text('target_type').notNull(),          // base|table|field
  targetId: text('target_id').notNull(),
  description: text('description'),
  source: text('source').notNull(),                   // imported|ai|manual (don't clobber manual/ai on reimport)
  editedByUserId: uuid('edited_by_user_id'),          // → master users.id
  updatedAt: timestamp('updated_at', { withTimezone: true }),
}, (t) => ({
  uniqTarget: uniqueIndex('bo_at_documentation_target_uq').on(t.targetType, t.targetId),
}))

// ---- Health (rules live in the master DB) ----

export const healthScores = pgTable('bo_at_health_scores', {
  id: uuid('id').defaultRandom().primaryKey(),
  baseId: text('base_id').notNull(),
  runId: uuid('run_id').notNull(),
  score: integer('score').notNull(),                  // 0–100
  band: text('band').notNull(),                       // green (>=90) | yellow (60-89) | red (<60)
  categories: jsonb('categories'),
}, (t) => ({ byBase: index('bo_at_health_scores_base_idx').on(t.baseId) }))

export const healthIssues = pgTable('bo_at_health_issues', {
  id: uuid('id').defaultRandom().primaryKey(),
  baseId: text('base_id').notNull(),
  tableId: text('table_id'),
  fieldId: text('field_id'),
  runId: uuid('run_id').notNull(),
  ruleId: text('rule_id').notNull(),                  // → master health_score_rules.id
  severity: text('severity').notNull(),               // high|medium|low
  category: text('category'),
  message: text('message').notNull(),
  occurrenceCount: integer('occurrence_count'),
  airtableDeeplink: text('airtable_deeplink'),
}, (t) => ({ byBase: index('bo_at_health_issues_base_idx').on(t.baseId) }))

// ---- Inbound-captured metadata (Airtable API doesn't expose these) ----
// Submission-driven (Inbound API), not run-driven → own timestamps, not *_run.

export const automations = pgTable('bo_at_automations', {
  id: uuid('id').defaultRandom().primaryKey(),
  baseId: text('base_id').notNull(),
  airtableEntityId: text('airtable_entity_id'),
  name: text('name'),
  type: text('type'),
  definition: jsonb('definition'),
  status: text('status').notNull().default('active'), // active|removed|unknown
  submittedVia: text('submitted_via'),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
}, (t) => ({ byBase: index('bo_at_automations_base_idx').on(t.baseId) }))

export const interfaces = pgTable('bo_at_interfaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  baseId: text('base_id').notNull(),
  airtableEntityId: text('airtable_entity_id'),
  name: text('name'),
  type: text('type'),
  definition: jsonb('definition'),
  status: text('status').notNull().default('active'),
  submittedVia: text('submitted_via'),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
}, (t) => ({ byBase: index('bo_at_interfaces_base_idx').on(t.baseId) }))
