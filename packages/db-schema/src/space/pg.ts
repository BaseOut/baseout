/**
 * Per-Space DB schema — Postgres dialect (managed_pg + byodb backends).
 *
 * Canonical home of the per-Space schema (the applied implementation), kept in
 * lockstep with the design-of-record at openspec/changes/system-per-space-db
 * (design.md / spec.md). The SQLite/D1 mirror is ./sqlite.ts —
 * tests/space-schema-parity.test.ts enforces table/column parity. A separate
 * drizzle config (drizzle.space-pg.config.ts) generates this dialect's
 * migrations, distinct from the master-DB config (PRD §21.1).
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

// Documentation/annotation columns (inline; no separate table).
// The imported Airtable description is already captured as the `description`
// column (and in schema_versions JSON), so it is NOT duplicated here.
// Effective description = description_override ?? ai_description ?? description.
// Re-import only ever writes `description`, so ai/manual values are never clobbered.
const annotation = {
  aiDescription: text('ai_description'),
  aiOverview: text('ai_overview'),
  descriptionOverride: text('description_override'),
}

// Single-row, self-describing meta table. `schema_version` drives lazy
// on-access migration: when the engine opens this DB it compares this value to
// the code's target version and runs pending migrations before proceeding.
// (D1 could use PRAGMA user_version; this table is used on all backends for
// uniform code and Postgres parity.) Keyed 'singleton' — exactly one row.
export const meta = pgTable('bo_at_meta', {
  id: text('id').primaryKey().default('singleton'),
  schemaVersion: integer('schema_version').notNull(),
  spaceId: uuid('space_id').notNull(),                // → master spaces.id (self-identification)
  backend: text('backend').notNull(),                 // d1 | managed_pg | byodb
  platform: text('platform').notNull().default('airtable'),
  provisionedAt: timestamp('provisioned_at', { withTimezone: true }),
  lastMigratedAt: timestamp('last_migrated_at', { withTimezone: true }),
})

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
  description: text('description'),                    // Airtable's imported description
  ...annotation,
  ...lifecycle,
})

export const tables = pgTable('bo_at_tables', {
  tableId: text('table_id').primaryKey(),
  baseId: text('base_id').notNull(),
  name: text('name').notNull(),
  primaryFieldId: text('primary_field_id'),
  fieldCount: integer('field_count'),
  recordCount: integer('record_count'),
  description: text('description'),                    // Airtable's imported description
  ...annotation,
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
  description: text('description'),                    // Airtable's imported description
  ...annotation,
  ...lifecycle,
}, (t) => ({ byTable: index('bo_at_fields_table_idx').on(t.tableId) }))

export const views = pgTable('bo_at_views', {
  viewId: text('view_id').primaryKey(),
  tableId: text('table_id').notNull(),
  baseId: text('base_id').notNull(),
  name: text('name').notNull(),
  type: text('type'),
  ...annotation,
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
  ...annotation,                                       // records have no Airtable description; ai/override only
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

// Documentation lives inline as `ai_description` / `ai_overview` /
// `description_override` columns on bo_at_bases/tables/fields/records (the
// `annotation` set above) — no separate bo_at_documentation table. The Data
// Dictionary surface/export remains V2.

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

// ---- Health metric config + results (server-schema-health-scoring) ----
// The metric catalog + system-default prompts live in master health_score_rules;
// these per-Space tables hold the space-level / per-entity prompt overrides, the
// per-base enable/disable state, and per-metric sub-scores (breakdown +
// staleness). rule_id references master health_score_rules.id (cross-DB, plain).

export const healthMetricPrompts = pgTable('bo_at_health_metric_prompts', {
  id: uuid('id').defaultRandom().primaryKey(),
  ruleId: text('rule_id').notNull(),
  prompt: text('prompt').notNull(),                   // space-level prompt override
  updatedAt: timestamp('updated_at', { withTimezone: true }),
}, (t) => ({ byRule: index('bo_at_health_metric_prompts_rule_idx').on(t.ruleId) }))

export const healthMetricOverrides = pgTable('bo_at_health_metric_overrides', {
  id: uuid('id').defaultRandom().primaryKey(),
  ruleId: text('rule_id').notNull(),
  targetType: text('target_type').notNull(),          // base | table | field
  targetId: text('target_id').notNull(),              // Airtable entity id
  prompt: text('prompt').notNull(),                   // per-entity prompt override
  updatedAt: timestamp('updated_at', { withTimezone: true }),
}, (t) => ({ byRule: index('bo_at_health_metric_overrides_rule_idx').on(t.ruleId) }))

export const healthMetricState = pgTable('bo_at_health_metric_state', {
  id: uuid('id').defaultRandom().primaryKey(),
  baseId: text('base_id').notNull(),
  ruleId: text('rule_id').notNull(),
  enabled: boolean('enabled').notNull().default(true), // per-base enable/disable
}, (t) => ({ byBase: index('bo_at_health_metric_state_base_idx').on(t.baseId) }))

export const healthMetricScores = pgTable('bo_at_health_metric_scores', {
  id: uuid('id').defaultRandom().primaryKey(),
  baseId: text('base_id').notNull(),
  ruleId: text('rule_id').notNull(),
  runId: uuid('run_id').notNull(),
  score: integer('score').notNull(),                  // 0–100 sub-score
  lastGeneratedAt: timestamp('last_generated_at', { withTimezone: true }),
}, (t) => ({ byBase: index('bo_at_health_metric_scores_base_idx').on(t.baseId) }))

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

// ---- Documentation feature: user-authored docs about the schema ----
// Distinct from the inline ai_description/description_override annotations.
// A document tags any number of entities; those tags surface (clickable) on
// each entity's detail panel in the Browse tab. Within-DB references are kept
// as plain columns + indexes, matching the rest of this schema.

export const documents = pgTable('bo_at_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  body: jsonb('body'),                                // Plate (platejs.org) document model, incl. inline entity-tag nodes
  excerpt: text('excerpt'),                           // derived plain-text snippet for list/search
  createdByUserId: uuid('created_by_user_id'),        // → master users.id
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
})

export const documentTags = pgTable('bo_at_document_tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').notNull(),          // → bo_at_documents.id
  targetType: text('target_type').notNull(),          // base|table|field|view
  targetId: text('target_id').notNull(),              // Airtable entity id
  addedVia: text('added_via'),                        // inline|manual
}, (t) => ({
  byDocument: index('bo_at_document_tags_doc_idx').on(t.documentId),
  byTarget: index('bo_at_document_tags_target_idx').on(t.targetType, t.targetId),
  uniq: uniqueIndex('bo_at_document_tags_uq').on(t.documentId, t.targetType, t.targetId),
}))

export const documentLinks = pgTable('bo_at_document_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').notNull(),
  name: text('name'),
  url: text('url').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => ({ byDocument: index('bo_at_document_links_doc_idx').on(t.documentId) }))

export const documentDiagrams = pgTable('bo_at_document_diagrams', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').notNull(),
  name: text('name'),
  state: jsonb('state').notNull(),                    // serialized React Flow state (nodes / positions / visible fields)
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => ({ byDocument: index('bo_at_document_diagrams_doc_idx').on(t.documentId) }))

// ---- Relationships: synced-view candidates (server-relationships) ----
// API-derived relationships (linked records / formulas / rollups / lookups /
// lastModified) are computed on read from bo_at_fields — NOT persisted here.
// Only "synced view" candidates need a row: the engine can't see Airtable's Sync
// feature via the API, so the inference task (workflows-relationship-inference)
// proposes pairs by field overlap, and the user confirms/dismisses them. One row
// per unordered table pair (canonical source<dest). status: inferred | confirmed
// | dismissed. origin: inferred (engine) | user (manually created).
export const syncedViewCandidates = pgTable('bo_at_synced_view_candidates', {
  id: uuid('id').defaultRandom().primaryKey(),
  baseId: text('base_id').notNull(),
  sourceTableId: text('source_table_id').notNull(),
  destTableId: text('dest_table_id').notNull(),
  status: text('status').notNull().default('inferred'), // inferred|confirmed|dismissed
  origin: text('origin').notNull().default('inferred'), // inferred|user
  matchScore: integer('match_score'),                   // 0–100 (null for user-created)
  matchedPairs: jsonb('matched_pairs'),                 // [{sourceFieldName,destFieldName,type}]
  firstSeenRun: uuid('first_seen_run'),
  lastSeenRun: uuid('last_seen_run'),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
}, (t) => ({
  byBase: index('bo_at_synced_view_candidates_base_idx').on(t.baseId),
  uniqPair: uniqueIndex('bo_at_synced_view_candidates_pair_uq').on(t.baseId, t.sourceTableId, t.destTableId),
}))

// ---- Chat: AI conversations about the schema (server-schema-chat) ----
// Persisted threads + messages, like Docs but conversational. Context is scoped
// to bases/tables/fields (scope jsonb) + attached docs (attached_doc_ids); the AI
// reply is generated asynchronously in workflows (chat-respond) and written back,
// so the assistant message carries a status (pending|complete|error).
export const chatThreads = pgTable('bo_at_chat_threads', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull().default('New chat'),
  archived: boolean('archived').notNull().default(false),
  scope: jsonb('scope'),                              // { baseIds?, tableIds?, fieldIds? }; null = whole Space
  attachedDocIds: jsonb('attached_doc_ids'),          // string[] of bo_at_documents.id
  createdByUserId: uuid('created_by_user_id'),        // → master users.id
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
})

export const chatMessages = pgTable('bo_at_chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  threadId: uuid('thread_id').notNull(),              // → bo_at_chat_threads.id
  role: text('role').notNull(),                       // user | assistant
  status: text('status').notNull().default('complete'), // assistant: pending|complete|error
  content: text('content').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }),
}, (t) => ({ byThread: index('bo_at_chat_messages_thread_idx').on(t.threadId) }))
