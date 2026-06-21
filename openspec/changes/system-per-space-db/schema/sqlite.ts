/**
 * Per-Space DB schema — SQLite / Cloudflare D1 dialect (d1 backend).
 *
 * MIRROR of ./pg.ts — same tables, columns, and semantics; only the dialect and
 * column types differ. Keep the two in lockstep (a parity test should assert that
 * table names and column names match across pg.ts and sqlite.ts).
 *
 * Type mapping vs Postgres:
 *   uuid       → text            (app-generated ids; no gen_random_uuid in SQLite)
 *   jsonb      → text mode:'json'
 *   timestamp  → text            (ISO-8601 strings)
 *   bigint     → integer         (SQLite integers are 64-bit)
 *   boolean    → integer mode:'boolean'
 *   integer    → integer
 */
import {
  sqliteTable, text, integer, primaryKey, index, uniqueIndex,
} from 'drizzle-orm/sqlite-core'

const lifecycle = {
  status: text('status').notNull().default('active'),
  firstSeenRun: text('first_seen_run'),
  firstUnseenRun: text('first_unseen_run'),
  lastSeenRun: text('last_seen_run'),
}

export const baseRuns = sqliteTable('bo_at_base_runs', {
  id: text('id').primaryKey(),
  backupRunId: text('backup_run_id').notNull(),
  baseId: text('base_id').notNull(),
  status: text('status').notNull().default('queued'),
  currStep: text('curr_step'),
  schemaVersionId: text('schema_version_id'),
  schemaHash: text('schema_hash'),
  tablesCount: integer('tables_count'),
  recordsCount: integer('records_count'),
  attachmentsCount: integer('attachments_count'),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  errorMessage: text('error_message'),
}, (t) => ({
  byBackupRun: index('bo_at_base_runs_backup_run_idx').on(t.backupRunId),
  byBase: index('bo_at_base_runs_base_idx').on(t.baseId),
}))

export const bases = sqliteTable('bo_at_bases', {
  baseId: text('base_id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  ...lifecycle,
})

export const tables = sqliteTable('bo_at_tables', {
  tableId: text('table_id').primaryKey(),
  baseId: text('base_id').notNull(),
  name: text('name').notNull(),
  primaryFieldId: text('primary_field_id'),
  fieldCount: integer('field_count'),
  recordCount: integer('record_count'),
  description: text('description'),
  ...lifecycle,
}, (t) => ({ byBase: index('bo_at_tables_base_idx').on(t.baseId) }))

export const fields = sqliteTable('bo_at_fields', {
  fieldId: text('field_id').primaryKey(),
  tableId: text('table_id').notNull(),
  baseId: text('base_id').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  options: text('options', { mode: 'json' }),
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  description: text('description'),
  ...lifecycle,
}, (t) => ({ byTable: index('bo_at_fields_table_idx').on(t.tableId) }))

export const views = sqliteTable('bo_at_views', {
  viewId: text('view_id').primaryKey(),
  tableId: text('table_id').notNull(),
  baseId: text('base_id').notNull(),
  name: text('name').notNull(),
  type: text('type'),
  ...lifecycle,
}, (t) => ({ byTable: index('bo_at_views_table_idx').on(t.tableId) }))

export const schemaVersions = sqliteTable('bo_at_schema_versions', {
  id: text('id').primaryKey(),
  baseId: text('base_id').notNull(),
  schemaHash: text('schema_hash').notNull(),
  schemaJson: text('schema_json', { mode: 'json' }).notNull(),
  firstSeenRun: text('first_seen_run'),
}, (t) => ({
  uniqHash: uniqueIndex('bo_at_schema_versions_base_hash_uq').on(t.baseId, t.schemaHash),
}))

export const schemaUpdates = sqliteTable('bo_at_schema_updates', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  baseId: text('base_id').notNull(),
  tableId: text('table_id'),
  changeType: text('change_type').notNull(),
  changeTypeName: text('change_type_name'),
  beforeValue: text('before_value', { mode: 'json' }),
  afterValue: text('after_value', { mode: 'json' }),
  breaksData: integer('breaks_data', { mode: 'boolean' }).notNull().default(false),
}, (t) => ({
  byRun: index('bo_at_schema_updates_run_idx').on(t.runId),
  byEntity: index('bo_at_schema_updates_entity_idx').on(t.entityType, t.entityId),
}))

export const records = sqliteTable('bo_at_records', {
  recordId: text('record_id').primaryKey(),
  tableId: text('table_id').notNull(),
  baseId: text('base_id').notNull(),
  createdTime: text('created_time'),
  modifiedTime: text('modified_time'),
  status: text('status').notNull().default('active'),
  firstSeenRun: text('first_seen_run'),
  firstUnseenRun: text('first_unseen_run'),
  lastSeenRun: text('last_seen_run'),
}, (t) => ({ byTable: index('bo_at_records_table_idx').on(t.tableId) }))

export const recordFieldData = sqliteTable('bo_at_record_field_data', {
  recordId: text('record_id').notNull(),
  fieldId: text('field_id').notNull(),
  tableId: text('table_id').notNull(),
  value: text('value'),
  firstSeenRun: text('first_seen_run'),
  lastSeenRun: text('last_seen_run'),
}, (t) => ({
  pk: primaryKey({ columns: [t.recordId, t.fieldId] }),
  byTableField: index('bo_at_rfd_table_field_idx').on(t.tableId, t.fieldId),
}))

export const recordUpdates = sqliteTable('bo_at_record_updates', {
  id: text('id').primaryKey(),
  recordId: text('record_id').notNull(),
  fieldId: text('field_id').notNull(),
  tableId: text('table_id').notNull(),
  runId: text('run_id').notNull(),
  oldValue: text('old_value'),
}, (t) => ({
  byCell: index('bo_at_record_updates_cell_idx').on(t.recordId, t.fieldId),
  byRun: index('bo_at_record_updates_run_idx').on(t.runId),
}))

export const attachments = sqliteTable('bo_at_attachments', {
  compositeId: text('composite_id').primaryKey(),
  tableId: text('table_id').notNull(),
  fieldId: text('field_id').notNull(),
  recordId: text('record_id').notNull(),
  storageKey: text('storage_key').notNull(),
  contentHash: text('content_hash'),
  filename: text('filename'),
  sizeBytes: integer('size_bytes'),
  mimeType: text('mime_type'),
  uploadStatus: text('upload_status').notNull().default('pending'),
  firstSeenRun: text('first_seen_run'),
  lastSeenRun: text('last_seen_run'),
  uploadedAt: text('uploaded_at'),
}, (t) => ({
  byRecord: index('bo_at_attachments_record_idx').on(t.recordId),
  byHash: index('bo_at_attachments_hash_idx').on(t.contentHash),
}))

export const documentation = sqliteTable('bo_at_documentation', {
  id: text('id').primaryKey(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  description: text('description'),
  source: text('source').notNull(),
  editedByUserId: text('edited_by_user_id'),
  updatedAt: text('updated_at'),
}, (t) => ({
  uniqTarget: uniqueIndex('bo_at_documentation_target_uq').on(t.targetType, t.targetId),
}))

export const healthScores = sqliteTable('bo_at_health_scores', {
  id: text('id').primaryKey(),
  baseId: text('base_id').notNull(),
  runId: text('run_id').notNull(),
  score: integer('score').notNull(),
  band: text('band').notNull(),
  categories: text('categories', { mode: 'json' }),
}, (t) => ({ byBase: index('bo_at_health_scores_base_idx').on(t.baseId) }))

export const healthIssues = sqliteTable('bo_at_health_issues', {
  id: text('id').primaryKey(),
  baseId: text('base_id').notNull(),
  tableId: text('table_id'),
  fieldId: text('field_id'),
  runId: text('run_id').notNull(),
  ruleId: text('rule_id').notNull(),
  severity: text('severity').notNull(),
  category: text('category'),
  message: text('message').notNull(),
  occurrenceCount: integer('occurrence_count'),
  airtableDeeplink: text('airtable_deeplink'),
}, (t) => ({ byBase: index('bo_at_health_issues_base_idx').on(t.baseId) }))

export const automations = sqliteTable('bo_at_automations', {
  id: text('id').primaryKey(),
  baseId: text('base_id').notNull(),
  airtableEntityId: text('airtable_entity_id'),
  name: text('name'),
  type: text('type'),
  definition: text('definition', { mode: 'json' }),
  status: text('status').notNull().default('active'),
  submittedVia: text('submitted_via'),
  firstSeenAt: text('first_seen_at'),
  lastSeenAt: text('last_seen_at'),
}, (t) => ({ byBase: index('bo_at_automations_base_idx').on(t.baseId) }))

export const interfaces = sqliteTable('bo_at_interfaces', {
  id: text('id').primaryKey(),
  baseId: text('base_id').notNull(),
  airtableEntityId: text('airtable_entity_id'),
  name: text('name'),
  type: text('type'),
  definition: text('definition', { mode: 'json' }),
  status: text('status').notNull().default('active'),
  submittedVia: text('submitted_via'),
  firstSeenAt: text('first_seen_at'),
  lastSeenAt: text('last_seen_at'),
}, (t) => ({ byBase: index('bo_at_interfaces_base_idx').on(t.baseId) }))
