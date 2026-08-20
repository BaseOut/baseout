/**
 * Internal-API client for @baseout/server (the backup engine).
 *
 * apps/web calls into the engine over a Cloudflare Worker service binding,
 * gated by INTERNAL_TOKEN sent as the `x-internal-token` header. Today this
 * client exposes a single method (`whoami`) that proves a Connection's
 * stored token still works against Airtable. Future engine endpoints (run-
 * now, cancel-run, list-progress, etc.) extend this same client — they
 * reuse the binding + token plumbing and the typed-error shape below.
 *
 * The internal token NEVER reaches the browser. This client runs server-side
 * inside the Astro Worker; the browser POSTs to apps/web routes that wrap it.
 *
 * Wire format mirrors the engine's status-code matrix at:
 *   apps/server/src/pages/api/internal/connections/whoami.ts
 *
 * Transport:
 *   - apps/web declares `services: [{ binding: "BACKUP_ENGINE", service:
 *     "baseout-server-<env>" }]` in wrangler.jsonc.example. At runtime
 *     `env.BACKUP_ENGINE` is a `Fetcher` that routes through Cloudflare's
 *     internal Worker-to-Worker network — never public DNS, no RFC1918
 *     edge ban, identical behaviour in `wrangler dev --remote` and in
 *     deployed envs.
 *   - The placeholder host on the request URL is irrelevant — Cloudflare
 *     binds by name, not by Host header. apps/server reads only the path
 *     + headers + body.
 *
 * Per CLAUDE.md §5.2 + §3.3 — same wire format used in production.
 */

export interface EngineWhoamiSuccess {
  ok: true;
  connectionId: string;
  airtable: {
    id: string;
    scopes: string[];
    email?: string;
  };
}

/**
 * Non-2xx outcomes from the engine. Callers map `code` to user-facing copy.
 *
 * `code` enumerates the known engine error codes (best-effort — unknown codes
 * fall through as `engine_error`). `status` is the HTTP status the engine
 * returned, useful for surfacing upstream details.
 */
export interface EngineWhoamiError {
  ok: false;
  code:
    | "unauthorized"
    | "invalid_connection_id"
    | "connection_not_found"
    | "connection_status"
    | "server_misconfigured"
    | "decrypt_failed"
    | "airtable_token_rejected"
    | "airtable_upstream"
    | "engine_unreachable"
    | "engine_error";
  status: number;
  /** Echo of the engine's `status` field on connection_status (e.g. 'pending_reauth'). */
  connectionStatus?: string;
  /** Echo of the engine's `upstream_status` on airtable_upstream. */
  upstreamStatus?: number;
}

export type EngineWhoamiResult = EngineWhoamiSuccess | EngineWhoamiError;

export interface EngineStartRunSuccess {
  ok: true;
  runId: string;
  /** One Trigger.dev run id per included base — order matches the at_bases selection. */
  triggerRunIds: string[];
}

export interface EngineStartRestoreSuccess {
  ok: true;
  restoreId: string;
  /** Trigger.dev run ID for the restore-base task. */
  triggerRunId: string;
}

/**
 * Non-2xx outcomes from POST /api/internal/restores/:restoreId/start. The
 * codes mirror `ProcessRestoreStartResult["error"]` in @baseout/server plus
 * the middleware's `unauthorized` and the client-only `engine_unreachable` /
 * `engine_error`.
 */
export interface EngineStartRestoreError {
  ok: false;
  code:
    | "unauthorized"
    | "restore_not_found"
    | "restore_already_started"
    | "source_run_not_restorable"
    | "engine_unreachable"
    | "engine_error";
  status: number;
}

export type EngineStartRestoreResult =
  | EngineStartRestoreSuccess
  | EngineStartRestoreError;

/**
 * Non-2xx outcomes from POST /api/internal/runs/:runId/start. The codes
 * mirror `ProcessRunStartResult["error"]` in @baseout/server (see
 * apps/server/src/lib/runs/start.ts) plus the middleware's `unauthorized`
 * and the client-only `engine_unreachable` / `engine_error`.
 */
export interface EngineStartRunError {
  ok: false;
  code:
    | "unauthorized"
    | "run_not_found"
    | "run_already_started"
    | "connection_not_found"
    | "invalid_connection"
    | "config_not_found"
    | "unsupported_storage_type"
    | "no_bases_selected"
    | "engine_unreachable"
    | "engine_error";
  status: number;
}

export type EngineStartRunResult = EngineStartRunSuccess | EngineStartRunError;

export interface EngineCancelRunSuccess {
  ok: true;
  /**
   * Trigger.dev run IDs the engine asked to cancel. Empty array when the
   * run was still 'queued' (no fan-out yet). Order matches the run row's
   * trigger_run_ids array.
   */
  cancelledTriggerRunIds: string[];
}

/**
 * Non-2xx outcomes from POST /api/internal/runs/:runId/cancel. Mirrors
 * `ProcessRunCancelResult["error"]` in @baseout/server (see
 * apps/server/src/lib/runs/cancel.ts) plus the middleware's `unauthorized`
 * and the client-only `engine_unreachable` / `engine_error`.
 */
export interface EngineCancelRunError {
  ok: false;
  code:
    | "unauthorized"
    | "run_not_found"
    | "run_already_terminal"
    | "engine_unreachable"
    | "engine_error";
  status: number;
}

export type EngineCancelRunResult =
  | EngineCancelRunSuccess
  | EngineCancelRunError;

export interface EngineDeleteRunSuccess {
  ok: true;
  /** Trigger.dev run id for the enqueued delete-run-files task. */
  triggerRunId: string;
}

/**
 * Non-2xx outcomes from POST /api/internal/runs/:runId/delete. Mirrors
 * `ProcessRunDeleteResult["error"]` in @baseout/server (see
 * apps/server/src/lib/runs/delete.ts) plus the middleware's `unauthorized`
 * and the client-only `engine_unreachable` / `engine_error`.
 */
export interface EngineDeleteRunError {
  ok: false;
  code:
    | "unauthorized"
    | "run_not_found"
    | "run_not_terminal"
    | "delete_in_progress"
    | "engine_unreachable"
    | "engine_error";
  status: number;
}

export type EngineDeleteRunResult =
  | EngineDeleteRunSuccess
  | EngineDeleteRunError;

export interface EngineSetSpaceFrequencySuccess {
  ok: true;
  /** Unix-ms of the next data (full) fire, or null when no data schedule. */
  dataNextFire: number | null;
  /** Unix-ms of the next schema fire, or null when no schema schedule. */
  schemaNextFire: number | null;
}

/** The scope-aware schedule sent to the engine (server-backup-scope). */
export interface SpaceScheduleInput {
  scope: string;
  dataFrequency: string | null;
  schemaFrequency: string | null;
}

/**
 * Non-2xx outcomes from POST /api/internal/spaces/:spaceId/set-frequency.
 * 400 codes come from the route's body/uuid guards; 502 wraps a non-2xx
 * from the SpaceDO itself (e.g. malformed frequency reaching the DO).
 */
export interface EngineSetSpaceFrequencyError {
  ok: false;
  code:
    | "unauthorized"
    | "invalid_request"
    | "invalid_frequency"
    | "space_do_error"
    | "engine_unreachable"
    | "engine_error";
  status: number;
}

export type EngineSetSpaceFrequencyResult =
  | EngineSetSpaceFrequencySuccess
  | EngineSetSpaceFrequencyError;

/**
 * Webhook registration lifecycle (web-instant-webhook; engine routes are
 * server-instant-webhook Phase E.1/E.3). `airtable_webhook_cap_reached` maps
 * Airtable's 2-webhooks-per-base-per-integration cap — the base is already
 * webhook-connected by the maximum number of organizations.
 */
export interface EngineWebhookLifecycleError {
  ok: false;
  code:
    | "unauthorized"
    | "invalid_request"
    | "space_not_found"
    | "connection_not_found"
    | "airtable_webhook_cap_reached"
    | "engine_unreachable"
    | "engine_error";
  status: number;
}

export type EngineWebhookLifecycleResult =
  | { ok: true }
  | EngineWebhookLifecycleError;

export interface EngineRescanBasesSuccess {
  ok: true;
  discovered: number;
  autoAdded: number;
  blockedByTier: number;
}

/**
 * Non-2xx outcomes from POST /api/internal/spaces/:spaceId/rescan-bases.
 * 404 codes come from the engine's context resolver (space, config); 409
 * means the Space has no active Airtable connection; 502 wraps Airtable
 * Meta API failures the engine couldn't absorb via retry.
 */
export interface EngineRescanBasesError {
  ok: false;
  code:
    | "unauthorized"
    | "invalid_request"
    | "space_not_found"
    | "config_not_found"
    | "connection_not_found"
    | "airtable_error"
    | "engine_unreachable"
    | "engine_error";
  status: number;
  /** Echo of the engine's `upstream_status` on airtable_error. */
  upstreamStatus?: number;
}

export type EngineRescanBasesResult =
  | EngineRescanBasesSuccess
  | EngineRescanBasesError;

// ── Workspace listing (web-workspace-bases; engine side server-mcp-workspaces) ──

export interface EngineWorkspaceSummary {
  id: string;
  name: string;
  permissionLevel?: string;
}

export interface EngineListWorkspacesSuccess {
  ok: true;
  workspaces: EngineWorkspaceSummary[];
  /** ISO timestamp of the engine's capture (short-TTL cache upstream). */
  capturedAt: string | null;
}

/**
 * Degraded outcome from GET /api/internal/connections/:connectionId/
 * workspaces. Contract (agreed with server-mcp-workspaces): the engine
 * returns `{ ok: true, workspaces: [{ id, name, permissionLevel? }],
 * capturedAt }` or `{ ok: false, degraded: true, reason }`. Web treats ANY
 * failure — transport, 404 while the engine half is unbuilt, non-2xx, or a
 * `degraded: true` payload — as "no workspace data" and proceeds without it
 * (design Decision 4: grouping is a progressive enhancement).
 */
export interface EngineListWorkspacesDegraded {
  ok: false;
  degraded: true;
  reason: string;
  status: number;
}

export type EngineListWorkspacesResult =
  | EngineListWorkspacesSuccess
  | EngineListWorkspacesDegraded;

export interface EngineProvisionDatabaseSuccess {
  ok: true;
  /** 'active' = provisioned now; 'already_active' = idempotent no-op. */
  status: "active" | "already_active";
  backend: string;
  /** Backend locator (managed_pg schema name); null on an already_active short-circuit. */
  locator: string | null;
}

/**
 * Non-2xx outcomes from POST /api/internal/spaces/:spaceId/provision-database.
 * Mirrors `ProvisionResult["code"]` in @baseout/server plus the middleware's
 * `unauthorized` and the client-only `engine_unreachable` / `engine_error`.
 */
export interface EngineProvisionDatabaseError {
  ok: false;
  code:
    | "unauthorized"
    | "invalid_request"
    | "invalid_backend"
    | "sovereign_requires_records"
    | "backend_not_implemented"
    | "provision_failed"
    | "engine_unreachable"
    | "engine_error";
  status: number;
  message?: string;
}

export type EngineProvisionDatabaseResult =
  | EngineProvisionDatabaseSuccess
  | EngineProvisionDatabaseError;

export interface ProvisionDatabaseOptions {
  /** 'd1' | 'managed_pg' | 'byodb'. Defaults to managed_pg engine-side. */
  backend?: string;
  recordsEnabled?: boolean;
  provisionedByUserId?: string | null;
}

// ───────────────────────── Schema Docs (shared-schema-docs §3) ─────────────────────────

/** Non-2xx outcomes shared by every Schema Docs broker route. */
export interface SchemaDocsError {
  ok: false;
  code:
    | "unauthorized"
    | "invalid_request"
    | "space_db_not_ready"
    | "backend_not_implemented"
    | "document_not_found"
    | "engine_unreachable"
    | "engine_error";
  status: number;
  message?: string;
}

export interface SchemaDocSummary {
  id: string;
  title: string;
  excerpt: string | null;
  createdByUserId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  tagCount: number;
}
export interface SchemaDocTag {
  id: string;
  documentId: string;
  targetType: string;
  targetId: string;
  addedVia: string | null;
  /** Read-time flag: the tagged entity is absent or removed from Airtable. */
  entityRemoved: boolean;
}
export interface SchemaDocLink {
  id: string;
  documentId: string;
  name: string | null;
  url: string;
  sortOrder: number;
}
export interface SchemaDocDiagram {
  id: string;
  documentId: string;
  name: string | null;
  state: unknown;
  sortOrder: number;
}
export interface SchemaDoc {
  id: string;
  title: string;
  body: unknown;
  excerpt: string | null;
  createdByUserId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  tags: SchemaDocTag[];
  links: SchemaDocLink[];
  diagrams: SchemaDocDiagram[];
}
/** A doc that tags a given entity — the Browse-tab detail surfacing. */
export interface SchemaDocEntityRef {
  documentId: string;
  addedVia: string | null;
  title: string;
  excerpt: string | null;
}

export type SchemaDocTargetType = "base" | "table" | "field" | "view";
export interface SchemaDocTagInput {
  targetType: SchemaDocTargetType;
  targetId: string;
  addedVia?: "inline" | "manual" | null;
}
export interface SchemaDocLinkInput {
  name?: string | null;
  url: string;
  sortOrder?: number;
}
export interface SchemaDocDiagramInput {
  name?: string | null;
  state: unknown;
  sortOrder?: number;
}
export interface CreateDocumentInput {
  title: string;
  body?: unknown;
  createdByUserId?: string | null;
  tags?: SchemaDocTagInput[];
  links?: SchemaDocLinkInput[];
  diagrams?: SchemaDocDiagramInput[];
}
export interface UpdateDocumentInput {
  title?: string;
  body?: unknown;
  tags?: SchemaDocTagInput[];
  links?: SchemaDocLinkInput[];
  diagrams?: SchemaDocDiagramInput[];
}

export type ListDocumentsResult = { ok: true; documents: SchemaDocSummary[] } | SchemaDocsError;
export type GetDocumentResult = { ok: true; document: SchemaDoc } | SchemaDocsError;
export type CreateDocumentResult = { ok: true; document: SchemaDoc } | SchemaDocsError;
export type UpdateDocumentResult = { ok: true; document: SchemaDoc } | SchemaDocsError;
export type DeleteDocumentResult = { ok: true } | SchemaDocsError;
export type DocsByEntityResult =
  | { ok: true; entityRemoved: boolean; documents: SchemaDocEntityRef[] }
  | SchemaDocsError;

export interface SchemaEntityBase {
  baseId: string;
  name: string;
  description: string | null;
  aiDescription: string | null;
  descriptionOverride: string | null;
  status: string;
  removedAt: string | null;
}
export interface SchemaEntityTable {
  tableId: string;
  baseId: string;
  name: string;
  recordCount: number | null;
  fieldCount: number | null;
  description: string | null;
  aiDescription: string | null;
  descriptionOverride: string | null;
  status: string;
  removedAt: string | null;
}
export interface SchemaEntityField {
  fieldId: string;
  tableId: string;
  baseId: string;
  name: string;
  type: string;
  isPrimary: boolean;
  description: string | null;
  aiDescription: string | null;
  descriptionOverride: string | null;
  status: string;
  removedAt: string | null;
  // Options-derived config (server-schema-read-enrichment) — null when the
  // field's type carries no such config or the captured options were malformed.
  linkedTableId: string | null;
  allowsMultiple: boolean | null;
  inverseFieldId: string | null;
  formula: string | null;
  referencedFieldIds: string[] | null;
  lookupViaFieldId: string | null;
  lookupTargetFieldId: string | null;
  choices: string[] | null;
}
export interface SchemaEntityView {
  viewId: string;
  tableId: string;
  baseId: string;
  name: string;
  type: string | null;
  status: string;
  removedAt: string | null;
}
export type GetSchemaResult =
  | {
      ok: true;
      bases: SchemaEntityBase[];
      tables: SchemaEntityTable[];
      fields: SchemaEntityField[];
      views: SchemaEntityView[];
    }
  | SchemaDocsError;

// Data browse / media wire shapes (Slice A) — defined in data-browse/engine-shapes
// so pure mappers stay free of the Fetcher client. Re-exported here for proxies.
export type {
  DataRecordRow,
  GetDataRecordsResult,
  DataRecordsQuery,
  DataChangelogRunRollup,
  DataChangelogChangeRow,
  GetDataChangelogResult,
  DataChangelogQuery,
  DataCommentRow,
  GetDataCommentsResult,
  DataCommentsQuery,
  MediaAssetRef,
  MediaAssetView,
  GetMediaResult,
  GetMediaTotalsResult,
  GetMediaAssetResult,
  MediaQuery,
} from "./data-browse/engine-shapes";
import type {
  DataRecordRow,
  GetDataRecordsResult,
  DataRecordsQuery,
  DataChangelogRunRollup,
  DataChangelogChangeRow,
  GetDataChangelogResult,
  DataChangelogQuery,
  DataCommentRow,
  GetDataCommentsResult,
  DataCommentsQuery,
  MediaAssetView,
  GetMediaResult,
  GetMediaTotalsResult,
  GetMediaAssetResult,
  MediaQuery,
} from "./data-browse/engine-shapes";

// Health tab (server-schema-health-scoring / web-health-tab).
export interface HealthOverviewMetricView {
  ruleId: string;
  name: string;
  weight: number;
  severity: string | null;
  entityTier: string | null;
  score: number;
  lastGeneratedAt: string | null;
}
export interface HealthOverviewIssueView {
  ruleId: string;
  severity: string;
  tableId: string | null;
  fieldId: string | null;
  message: string;
  airtableDeeplink: string | null;
}
export type GetHealthOverviewResult =
  | {
      ok: true;
      grade: { score: number; band: string } | null;
      metrics: HealthOverviewMetricView[];
      issues: HealthOverviewIssueView[];
    }
  | SchemaDocsError;

// Health Pro+ editor (server-schema-health-scoring §4.2c / web-health-tab).
export interface HealthConfigMetricView {
  ruleId: string;
  name: string;
  category: string | null;
  severity: string;
  weight: number;
  entityTier: string | null;
  enabled: boolean;
  effectivePrompt: string;
  promptSource: string; // override | space | system
  systemDefault: string;
  hasSpacePrompt: boolean;
  hasBaseOverride: boolean;
  scored: boolean;
  isStale: boolean;
}
export type GetHealthConfigResult =
  | { ok: true; metrics: HealthConfigMetricView[] }
  | SchemaDocsError;
export type HealthMutationResult = { ok: true } | SchemaDocsError;
export type RerunHealthResult =
  | { ok: true; enqueued: boolean; runId?: string; metricCount?: number }
  | SchemaDocsError;

// Relationships tab (server-relationships / web-relationships-tab).
export interface RelationshipRefView {
  tableId?: string;
  fieldId?: string;
  name: string;
  removed: boolean;
}
export interface DerivedRelationshipView {
  id: string;
  baseId: string;
  type: "linkedRecords" | "formulas" | "rollups" | "lookups" | "lastModified";
  anchorFieldId: string;
  anchorTableId: string;
  label: string;
  refs: RelationshipRefView[];
  inferred: false;
  hasRemovedHistory: boolean;
  valid: boolean;
}
export interface SyncedViewRelationshipView {
  id: string;
  baseId: string;
  type: "syncedViews";
  sourceTableId: string;
  sourceTableName: string;
  destTableId: string;
  destTableName: string;
  status: string; // inferred | confirmed | dismissed
  origin: string; // inferred | user
  inferred: boolean;
  matchScore: number | null;
  matchedPairs: unknown;
}
export type GetRelationshipsResult =
  | {
      ok: true;
      derived: DerivedRelationshipView[];
      syncedViews: SyncedViewRelationshipView[];
    }
  | SchemaDocsError;
export type MutateRelationshipResult = { ok: true; id?: string } | SchemaDocsError;

// Changelog tab (server-schema-changelog / web-schema-changelog).
export interface ChangelogEntryView {
  runId: string | null;
  at: string | null;
  entityType: "base" | "table" | "field" | "view";
  entityId: string;
  entityName: string | null;
  baseId: string;
  tableId: string | null;
  kind: "modified" | "removed";
  changeType: string | null;
  changeTypeName: string | null;
  before: unknown;
  after: unknown;
  breaksData: boolean;
}
export type GetSchemaChangelogResult =
  | { ok: true; entries: ChangelogEntryView[] }
  | SchemaDocsError;

// Inbox feed (server-notifications-inbox / web-notifications-inbox §5.1).

/**
 * One notification row from the engine's per-Space feed
 * (GET /api/internal/spaces/:spaceId/notifications). Mirrors the web
 * `InboxItem` (src/components/layout/inbox.ts) field-for-field EXCEPT `space`
 * / `spaceId`, which the web fan-out stamps when merging feeds across the
 * account's Spaces (lib/inbox-feed.ts). `kind` is a plain string on the wire —
 * the fan-out drops kinds the panel doesn't know instead of crashing a render
 * against a newer engine.
 */
export interface InboxItemView {
  id: string;
  kind: string;
  /** Row copy. `*markers*` render bold — composed engine-side. */
  title: string;
  detail?: string;
  /** Base display name — the panel's rollup key. */
  base?: string;
  /** Airtable base id — the mute-route key (`bo_at_inbox_mutes.base_id`). */
  baseId?: string;
  /** ISO timestamp. */
  at: string;
  href?: string;
  action?: { label: string; href: string; icon: string; primary?: boolean };
  read?: boolean;
  done?: boolean;
  snoozedUntil?: string | null;
  stateBacked?: boolean;
  resolved?: boolean;
}
export type GetNotificationsResult = { ok: true; items: InboxItemView[] } | SchemaDocsError;

export type InboxTriageAction =
  | "read"
  | "unread"
  | "done"
  | "undone"
  | "snooze"
  | "unsnooze";
export interface InboxTriageInput {
  itemId: string;
  action: InboxTriageAction;
  /** ISO timestamp; meaningful with action 'snooze'. */
  snoozedUntil?: string | null;
}
export type TriageNotificationResult = { ok: true } | SchemaDocsError;
export type MuteNotificationBaseResult = { ok: true } | SchemaDocsError;

// Chat tab (server-schema-chat / web-chat-tab).
export interface ChatThreadSummaryView {
  id: string;
  title: string;
  archived: boolean;
  updatedAt: string | null;
}
export interface ChatMessageView {
  id: string;
  role: string;
  status: string;
  content: string;
  createdAt: string | null;
}
export interface ChatThreadDetailView {
  id: string;
  title: string;
  archived: boolean;
  scope: { baseIds?: string[]; tableIds?: string[]; fieldIds?: string[] } | null;
  attachedDocIds: string[];
  messages: ChatMessageView[];
}
export type ListChatThreadsResult =
  | { ok: true; threads: ChatThreadSummaryView[] }
  | SchemaDocsError;
export type CreateChatThreadResult = { ok: true; id: string } | SchemaDocsError;
export type GetChatThreadResult = { ok: true; thread: ChatThreadDetailView } | SchemaDocsError;
export type PatchChatThreadResult = { ok: true } | SchemaDocsError;
export type SendChatMessageResult =
  | { ok: true; userMessageId: string; assistantMessageId: string }
  | SchemaDocsError;

// ───────────────────────── Run Detail (web-run-detail) ─────────────────────────

export interface EngineRunDetailTable {
  tableId: string;
  tableName: string;
  recordCount: number;
  fieldCount: number;
  attachmentCount: number;
}

export interface EngineRunDetailBase {
  atBaseId: string;
  baseName: string;
  status: string;
  tablesCount: number;
  recordsCount: number;
  attachmentsCount: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  tables: EngineRunDetailTable[];
}

export interface EngineRunDetailSuccess {
  ok: true;
  bases: EngineRunDetailBase[];
}

export interface EngineRunDetailError {
  ok: false;
  code:
    | "unauthorized"
    | "run_not_found"
    | "engine_unreachable"
    | "engine_error";
  status: number;
}

export type EngineRunDetailResult =
  | EngineRunDetailSuccess
  | EngineRunDetailError;

export interface BackupEngineOptions {
  /**
   * Service binding to the @baseout/server Worker. Provided by Cloudflare
   * at runtime as `env.BACKUP_ENGINE`. Tests inject a `Fetcher`-shaped stub.
   */
  binding: Fetcher;
  /** Shared secret matching the engine's INTERNAL_TOKEN. */
  internalToken: string;
}

export interface BackupEngineClient {
  whoami(connectionId: string): Promise<EngineWhoamiResult>;
  startRun(runId: string): Promise<EngineStartRunResult>;
  startRestore(restoreId: string): Promise<EngineStartRestoreResult>;
  cancelRun(runId: string): Promise<EngineCancelRunResult>;
  deleteRun(runId: string): Promise<EngineDeleteRunResult>;
  setSpaceFrequency(
    spaceId: string,
    schedule: SpaceScheduleInput,
  ): Promise<EngineSetSpaceFrequencyResult>;
  /** Register webhooks for every included base (transition TO instant). */
  registerWebhooks(spaceId: string): Promise<EngineWebhookLifecycleResult>;
  /** Drop this Space's webhook subscriptions (transition AWAY from instant). */
  unregisterWebhooks(spaceId: string): Promise<EngineWebhookLifecycleResult>;
  rescanBases(spaceId: string): Promise<EngineRescanBasesResult>;
  /** Workspace listing for a Connection (web-workspace-bases). NEVER throws
   * — every failure shape collapses to `{ ok:false, degraded:true }`. */
  listConnectionWorkspaces(
    connectionId: string,
  ): Promise<EngineListWorkspacesResult>;
  provisionDatabase(
    spaceId: string,
    opts?: ProvisionDatabaseOptions,
  ): Promise<EngineProvisionDatabaseResult>;
  listDocuments(spaceId: string): Promise<ListDocumentsResult>;
  getDocument(spaceId: string, documentId: string): Promise<GetDocumentResult>;
  createDocument(spaceId: string, input: CreateDocumentInput): Promise<CreateDocumentResult>;
  updateDocument(
    spaceId: string,
    documentId: string,
    patch: UpdateDocumentInput,
  ): Promise<UpdateDocumentResult>;
  deleteDocument(spaceId: string, documentId: string): Promise<DeleteDocumentResult>;
  docsByEntity(
    spaceId: string,
    targetType: SchemaDocTargetType,
    targetId: string,
  ): Promise<DocsByEntityResult>;
  getSchema(spaceId: string): Promise<GetSchemaResult>;
  getHealthOverview(spaceId: string, baseId: string): Promise<GetHealthOverviewResult>;
  getHealthConfig(spaceId: string, baseId: string): Promise<GetHealthConfigResult>;
  setHealthPrompt(
    spaceId: string,
    body:
      | { ruleId: string; level: "space"; prompt: string | null }
      | { ruleId: string; level: "entity"; targetType: string; targetId: string; prompt: string | null },
  ): Promise<HealthMutationResult>;
  setHealthEnable(
    spaceId: string,
    body: { baseId: string; ruleId: string; enabled: boolean },
  ): Promise<HealthMutationResult>;
  rerunHealth(spaceId: string, baseId: string): Promise<RerunHealthResult>;
  getRelationships(spaceId: string, baseId: string, includeDismissed?: boolean): Promise<GetRelationshipsResult>;
  getSchemaChangelog(spaceId: string, baseId: string, limit?: number): Promise<GetSchemaChangelogResult>;
  getNotifications(spaceId: string): Promise<GetNotificationsResult>;
  triageNotification(spaceId: string, input: InboxTriageInput): Promise<TriageNotificationResult>;
  muteNotificationBase(spaceId: string, baseId: string, muted: boolean): Promise<MuteNotificationBaseResult>;
  mutateRelationship(
    spaceId: string,
    body:
      | { action: "confirm" | "dismiss"; id: string }
      | { action: "create"; baseId: string; sourceTableId: string; destTableId: string },
  ): Promise<MutateRelationshipResult>;
  listChatThreads(spaceId: string, includeArchived?: boolean): Promise<ListChatThreadsResult>;
  createChatThread(spaceId: string, createdByUserId?: string | null): Promise<CreateChatThreadResult>;
  getChatThread(spaceId: string, threadId: string): Promise<GetChatThreadResult>;
  patchChatThread(
    spaceId: string,
    threadId: string,
    body:
      | { title: string }
      | { archived: boolean }
      | { scope: ChatThreadDetailView["scope"]; attachedDocIds: string[] },
  ): Promise<PatchChatThreadResult>;
  sendChatMessage(spaceId: string, threadId: string, message: string): Promise<SendChatMessageResult>;
  getRunDetail(runId: string): Promise<EngineRunDetailResult>;
  /** Keyset-paginated record page for one table (Data ▸ Records). */
  getDataRecords(
    spaceId: string,
    tableId: string,
    query?: DataRecordsQuery,
  ): Promise<GetDataRecordsResult>;
  /** Space-wide record data changelog — rollup (default) or per-run rows. */
  getDataChangelog(spaceId: string, query?: DataChangelogQuery): Promise<GetDataChangelogResult>;
  /** Keyset-paginated record-comment feed (Data ▸ Comments). */
  getDataComments(spaceId: string, query?: DataCommentsQuery): Promise<GetDataCommentsResult>;
  /** Captured-attachment listing (Data ▸ Attachments). */
  getMedia(spaceId: string, query?: MediaQuery): Promise<GetMediaResult>;
  /** Count + summed size for the current media filter. */
  getMediaTotals(spaceId: string, query?: MediaQuery): Promise<GetMediaTotalsResult>;
  /** One captured file's detail (all refs). */
  getMediaAsset(spaceId: string, assetId: string): Promise<GetMediaAssetResult>;
  /** Raw download passthrough — streams stored object or BYOS locator JSON. */
  mediaDownload(spaceId: string, assetId: string): Promise<Response>;

  // Reports (web-reports-page task 2.1) — over the server-reports engine API.
  /** List a Space's report definitions, each with its latest run. */
  listReportDefinitions(spaceId: string): Promise<ListReportsResult>;
  /** One definition + its run history. */
  getReportDefinition(spaceId: string, defId: string): Promise<GetReportResult>;
  createReportDefinition(spaceId: string, input: ReportDefinitionInput): Promise<MutateReportResult>;
  updateReportDefinition(spaceId: string, defId: string, patch: ReportDefinitionInput): Promise<MutateReportResult>;
  deleteReportDefinition(spaceId: string, defId: string): Promise<DeleteReportResult>;
  /** Run-now; optional { windowStart, windowEnd } override → ad-hoc. */
  generateReportNow(spaceId: string, defId: string, body?: Record<string, unknown>): Promise<GenerateReportResult>;
  /** A run's rendered document JSON + the run row. */
  getReportRun(spaceId: string, runId: string): Promise<GetReportRunResult>;
  /** Raw artifact passthrough (pdf|html) — caller streams the Response. */
  getReportArtifact(spaceId: string, runId: string, format: "pdf" | "html"): Promise<Response>;
  /** Re-send failed deliveries for a run. */
  resendReportDelivery(spaceId: string, runId: string): Promise<ResendReportResult>;
}

const KNOWN_SCHEMA_DOCS_ERROR_CODES: ReadonlySet<SchemaDocsError["code"]> = new Set([
  "unauthorized",
  "invalid_request",
  "space_db_not_ready",
  "backend_not_implemented",
  "document_not_found",
]);

/** Build `?a=1&b=2` from sparse params (omits nullish / empty). */
function engineQuery(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Shared fetch + JSON + error-mapping for the Schema Docs broker routes. On a
 * non-2xx, maps the engine's `error` string to a known code (else
 * `engine_error`); on a transport throw, `engine_unreachable`. Returns the
 * parsed success body for the caller to shape.
 */
async function schemaDocsRequest(
  options: BackupEngineOptions,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: true; body: Record<string, unknown> } | SchemaDocsError> {
  let res: Response;
  try {
    res = await options.binding.fetch(`https://engine${path}`, {
      method,
      headers: {
        "x-internal-token": options.internalToken,
        accept: "application/json",
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    return { ok: false, code: "engine_unreachable", status: 0 };
  }

  let parsed: Record<string, unknown> = {};
  try {
    parsed = (await res.json()) as Record<string, unknown>;
  } catch {
    // engine returned non-JSON (rare); fall through with empty body
  }
  if (res.ok) return { ok: true, body: parsed };

  const rawCode = typeof parsed.error === "string" ? parsed.error : undefined;
  const code: SchemaDocsError["code"] =
    rawCode && KNOWN_SCHEMA_DOCS_ERROR_CODES.has(rawCode as SchemaDocsError["code"])
      ? (rawCode as SchemaDocsError["code"])
      : "engine_error";
  const out: SchemaDocsError = { ok: false, code, status: res.status };
  if (typeof parsed.message === "string") out.message = parsed.message;
  return out;
}

// --- Reports (web-reports-page task 2.1) ---------------------------------

/** Schedule recipient — matches lib/reports/types.ts `Recipient`. */
export interface ReportRecipient {
  kind: "member" | "external";
  email: string;
  name?: string;
}

/** A report definition as returned by the engine (wire shape). */
export interface ReportDefinitionView {
  id: string;
  spaceId: string;
  name: string;
  sections: string[];
  baseScope: string[] | null;
  windowKind: string;
  windowDays: number | null;
  isDefault: boolean;
  scheduleCadence: string | null;
  scheduleDay: number | null;
  scheduleTime: string | null;
  scheduleFormats: string[];
  scheduleRecipients: ReportRecipient[];
  scheduleSuppressEmpty: boolean;
  scheduleEnabled: boolean;
  nextRunAt: string | null;
  createdBy: string | null;
  createdAt: string;
  modifiedAt: string;
}

/** A report run row (history). */
export interface ReportRunView {
  id: string;
  spaceId: string;
  reportDefinitionId: string;
  windowStart: string;
  windowEnd: string;
  adHoc: boolean;
  triggerKind: string;
  triggerBy: string | null;
  generationState: string;
  status: string | null;
  backupsOk: number;
  backupsFailed: number;
  documentLocation: string | null;
  artifactPdfLocation: string | null;
  artifactHtmlLocation: string | null;
  error: string | null;
  createdAt: string;
  generatedAt: string | null;
}

export interface ReportDefinitionWithLatestRun {
  definition: ReportDefinitionView;
  latestRun: ReportRunView | null;
}

/** Writable fields for create/update (the engine validates server-side). */
export interface ReportDefinitionInput {
  name: string;
  sections: string[];
  baseScope?: string[] | null;
  windowKind: string;
  windowDays?: number | null;
  scheduleCadence?: string | null;
  scheduleDay?: number | null;
  scheduleTime?: string | null;
  scheduleFormats?: string[];
  scheduleRecipients?: ReportRecipient[];
  scheduleSuppressEmpty?: boolean;
  scheduleEnabled?: boolean;
}

export interface ReportsError {
  ok: false;
  code:
    | "unauthorized"
    | "invalid_request"
    | "not_found"
    | "already_running"
    | "default_report_protected"
    | "limit_reached"
    | "capability_required"
    | "storage_unavailable"
    | "engine_unreachable"
    | "engine_error";
  status: number;
  message?: string;
}

export type ListReportsResult =
  | { ok: true; definitions: ReportDefinitionWithLatestRun[] }
  | ReportsError;
export type GetReportResult =
  | { ok: true; definition: ReportDefinitionView; runs: ReportRunView[] }
  | ReportsError;
export type MutateReportResult =
  | { ok: true; definition: ReportDefinitionView }
  | ReportsError;
export type DeleteReportResult = { ok: true } | ReportsError;
export type GenerateReportResult = { ok: true; runId: string } | ReportsError;
export type GetReportRunResult =
  | { ok: true; run: ReportRunView; document: Record<string, unknown> | null }
  | ReportsError;
export type ResendReportResult =
  | { ok: true; resent: number; failed: number }
  | ReportsError;

const KNOWN_REPORTS_ERROR_CODES: ReadonlySet<ReportsError["code"]> = new Set([
  "unauthorized",
  "invalid_request",
  "not_found",
  "already_running",
  "default_report_protected",
  "limit_reached",
  "capability_required",
  "storage_unavailable",
]);

/** Shared fetch + JSON + error-mapping for the Reports broker routes. */
async function reportsRequest(
  options: BackupEngineOptions,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: true; body: Record<string, unknown> } | ReportsError> {
  let res: Response;
  try {
    res = await options.binding.fetch(`https://engine${path}`, {
      method,
      headers: {
        "x-internal-token": options.internalToken,
        accept: "application/json",
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    return { ok: false, code: "engine_unreachable", status: 0 };
  }
  let parsed: Record<string, unknown> = {};
  try {
    parsed = (await res.json()) as Record<string, unknown>;
  } catch {
    // non-JSON body (rare)
  }
  if (res.ok) return { ok: true, body: parsed };
  const rawCode = typeof parsed.error === "string" ? parsed.error : undefined;
  const code: ReportsError["code"] =
    rawCode && KNOWN_REPORTS_ERROR_CODES.has(rawCode as ReportsError["code"])
      ? (rawCode as ReportsError["code"])
      : "engine_error";
  const out: ReportsError = { ok: false, code, status: res.status };
  if (typeof parsed.message === "string") out.message = parsed.message;
  return out;
}

const KNOWN_ERROR_CODES: ReadonlySet<EngineWhoamiError["code"]> = new Set([
  "unauthorized",
  "invalid_connection_id",
  "connection_not_found",
  "connection_status",
  "server_misconfigured",
  "decrypt_failed",
  "airtable_token_rejected",
  "airtable_upstream",
]);

const KNOWN_START_RUN_ERROR_CODES: ReadonlySet<EngineStartRunError["code"]> =
  new Set([
    "unauthorized",
    "run_not_found",
    "run_already_started",
    "connection_not_found",
    "invalid_connection",
    "config_not_found",
    "unsupported_storage_type",
    "no_bases_selected",
  ]);

const KNOWN_START_RESTORE_ERROR_CODES: ReadonlySet<
  EngineStartRestoreError["code"]
> = new Set([
  "unauthorized",
  "restore_not_found",
  "restore_already_started",
  "source_run_not_restorable",
]);

const KNOWN_CANCEL_RUN_ERROR_CODES: ReadonlySet<EngineCancelRunError["code"]> =
  new Set([
    "unauthorized",
    "run_not_found",
    "run_already_terminal",
  ]);

const KNOWN_DELETE_RUN_ERROR_CODES: ReadonlySet<EngineDeleteRunError["code"]> =
  new Set([
    "unauthorized",
    "run_not_found",
    "run_not_terminal",
    "delete_in_progress",
  ]);

const KNOWN_SET_FREQUENCY_ERROR_CODES: ReadonlySet<
  EngineSetSpaceFrequencyError["code"]
> = new Set([
  "unauthorized",
  "invalid_request",
  "invalid_frequency",
  "space_do_error",
]);

const KNOWN_WEBHOOK_LIFECYCLE_ERROR_CODES: ReadonlySet<
  EngineWebhookLifecycleError["code"]
> = new Set([
  "unauthorized",
  "invalid_request",
  "space_not_found",
  "connection_not_found",
  "airtable_webhook_cap_reached",
]);

/**
 * Shared POST for the two webhook-lifecycle routes (web-instant-webhook;
 * engine side is server-instant-webhook Phase E). Same transport + error
 * mapping shape as setSpaceFrequency.
 */
async function webhookLifecycleCall(
  options: BackupEngineOptions,
  spaceId: string,
  action: "register-webhooks" | "unregister-webhooks",
): Promise<EngineWebhookLifecycleResult> {
  const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/${action}`;
  let res: Response;
  try {
    res = await options.binding.fetch(`https://engine${path}`, {
      method: "POST",
      headers: {
        "x-internal-token": options.internalToken,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: "{}",
    });
  } catch {
    return { ok: false, code: "engine_unreachable", status: 0 };
  }

  if (res.ok) return { ok: true };

  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    // engine returned non-JSON (rare); fall through with empty body
  }
  const rawCode = typeof body.error === "string" ? body.error : undefined;
  const code: EngineWebhookLifecycleError["code"] =
    rawCode &&
    KNOWN_WEBHOOK_LIFECYCLE_ERROR_CODES.has(
      rawCode as EngineWebhookLifecycleError["code"],
    )
      ? (rawCode as EngineWebhookLifecycleError["code"])
      : "engine_error";
  return { ok: false, code, status: res.status };
}

const KNOWN_RESCAN_BASES_ERROR_CODES: ReadonlySet<
  EngineRescanBasesError["code"]
> = new Set([
  "unauthorized",
  "invalid_request",
  "space_not_found",
  "config_not_found",
  "connection_not_found",
  "airtable_error",
]);

const KNOWN_PROVISION_DATABASE_ERROR_CODES: ReadonlySet<
  EngineProvisionDatabaseError["code"]
> = new Set([
  "unauthorized",
  "invalid_request",
  "invalid_backend",
  "sovereign_requires_records",
  "backend_not_implemented",
  "provision_failed",
]);

const KNOWN_RUN_DETAIL_ERROR_CODES: ReadonlySet<EngineRunDetailError["code"]> =
  new Set(["unauthorized", "run_not_found"]);

export function createBackupEngine(
  options: BackupEngineOptions,
): BackupEngineClient {
  return {
    async whoami(connectionId) {
      const path = `/api/internal/connections/${encodeURIComponent(connectionId)}/whoami`;
      // Service bindings expose `.fetch(input, init?)` exactly like global
      // fetch. The base URL is irrelevant — Cloudflare routes by binding,
      // not by Host header — but `Fetcher.fetch()` requires an absolute URL
      // input, so we use a stable placeholder. apps/server reads only the
      // path + headers + body.
      let res: Response;
      try {
        res = await options.binding.fetch(`https://engine${path}`, {
          method: "POST",
          headers: {
            "x-internal-token": options.internalToken,
            accept: "application/json",
          },
        });
      } catch {
        return { ok: false, code: "engine_unreachable", status: 0 };
      }

      if (res.ok) {
        const body = (await res.json()) as Omit<EngineWhoamiSuccess, "ok">;
        return { ok: true, ...body };
      }

      let body: Record<string, unknown> = {};
      try {
        body = (await res.json()) as Record<string, unknown>;
      } catch {
        // engine returned non-JSON (rare); fall through with empty body
      }
      const rawCode = typeof body.error === "string" ? body.error : undefined;
      const code: EngineWhoamiError["code"] =
        rawCode && KNOWN_ERROR_CODES.has(rawCode as EngineWhoamiError["code"])
          ? (rawCode as EngineWhoamiError["code"])
          : "engine_error";
      const out: EngineWhoamiError = {
        ok: false,
        code,
        status: res.status,
      };
      if (typeof body.status === "string") out.connectionStatus = body.status;
      if (typeof body.upstream_status === "number") {
        out.upstreamStatus = body.upstream_status;
      }
      return out;
    },

    async startRun(runId) {
      const path = `/api/internal/runs/${encodeURIComponent(runId)}/start`;
      let res: Response;
      try {
        res = await options.binding.fetch(`https://engine${path}`, {
          method: "POST",
          headers: {
            "x-internal-token": options.internalToken,
            accept: "application/json",
          },
        });
      } catch {
        return { ok: false, code: "engine_unreachable", status: 0 };
      }

      if (res.ok) {
        const body = (await res.json()) as Omit<EngineStartRunSuccess, "ok">;
        return { ok: true, ...body };
      }

      let body: Record<string, unknown> = {};
      try {
        body = (await res.json()) as Record<string, unknown>;
      } catch {
        // engine returned non-JSON (rare); fall through with empty body
      }
      const rawCode = typeof body.error === "string" ? body.error : undefined;
      const code: EngineStartRunError["code"] =
        rawCode &&
        KNOWN_START_RUN_ERROR_CODES.has(rawCode as EngineStartRunError["code"])
          ? (rawCode as EngineStartRunError["code"])
          : "engine_error";
      return { ok: false, code, status: res.status };
    },

    async startRestore(restoreId) {
      const path = `/api/internal/restores/${encodeURIComponent(restoreId)}/start`;
      let res: Response;
      try {
        res = await options.binding.fetch(`https://engine${path}`, {
          method: "POST",
          headers: {
            "x-internal-token": options.internalToken,
            accept: "application/json",
          },
        });
      } catch {
        return { ok: false, code: "engine_unreachable", status: 0 };
      }

      if (res.ok) {
        const body = (await res.json()) as Omit<EngineStartRestoreSuccess, "ok">;
        return { ok: true, ...body };
      }

      let body: Record<string, unknown> = {};
      try {
        body = (await res.json()) as Record<string, unknown>;
      } catch {
        // engine returned non-JSON (rare); fall through with empty body
      }
      const rawCode = typeof body.error === "string" ? body.error : undefined;
      const code: EngineStartRestoreError["code"] =
        rawCode &&
        KNOWN_START_RESTORE_ERROR_CODES.has(
          rawCode as EngineStartRestoreError["code"],
        )
          ? (rawCode as EngineStartRestoreError["code"])
          : "engine_error";
      return { ok: false, code, status: res.status };
    },

    async provisionDatabase(spaceId, opts) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/provision-database`;
      let res: Response;
      try {
        res = await options.binding.fetch(`https://engine${path}`, {
          method: "POST",
          headers: {
            "x-internal-token": options.internalToken,
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            backend: opts?.backend,
            recordsEnabled: opts?.recordsEnabled ?? false,
            provisionedByUserId: opts?.provisionedByUserId ?? null,
          }),
        });
      } catch {
        return { ok: false, code: "engine_unreachable", status: 0 };
      }

      if (res.ok) {
        const body = (await res.json()) as Omit<
          EngineProvisionDatabaseSuccess,
          "ok"
        >;
        return { ok: true, ...body };
      }

      let body: Record<string, unknown> = {};
      try {
        body = (await res.json()) as Record<string, unknown>;
      } catch {
        // engine returned non-JSON (rare); fall through with empty body
      }
      const rawCode = typeof body.error === "string" ? body.error : undefined;
      const code: EngineProvisionDatabaseError["code"] =
        rawCode &&
        KNOWN_PROVISION_DATABASE_ERROR_CODES.has(
          rawCode as EngineProvisionDatabaseError["code"],
        )
          ? (rawCode as EngineProvisionDatabaseError["code"])
          : "engine_error";
      const out: EngineProvisionDatabaseError = {
        ok: false,
        code,
        status: res.status,
      };
      if (typeof body.message === "string") out.message = body.message;
      return out;
    },

    async setSpaceFrequency(spaceId, schedule) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/set-frequency`;
      let res: Response;
      try {
        res = await options.binding.fetch(`https://engine${path}`, {
          method: "POST",
          headers: {
            "x-internal-token": options.internalToken,
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify(schedule),
        });
      } catch {
        return { ok: false, code: "engine_unreachable", status: 0 };
      }

      if (res.ok) {
        const body = (await res.json()) as {
          ok: true;
          dataNextFire: number | null;
          schemaNextFire: number | null;
        };
        return {
          ok: true,
          dataNextFire: body.dataNextFire ?? null,
          schemaNextFire: body.schemaNextFire ?? null,
        };
      }

      let body: Record<string, unknown> = {};
      try {
        body = (await res.json()) as Record<string, unknown>;
      } catch {
        // engine returned non-JSON (rare); fall through with empty body
      }
      const rawCode = typeof body.error === "string" ? body.error : undefined;
      const code: EngineSetSpaceFrequencyError["code"] =
        rawCode &&
        KNOWN_SET_FREQUENCY_ERROR_CODES.has(
          rawCode as EngineSetSpaceFrequencyError["code"],
        )
          ? (rawCode as EngineSetSpaceFrequencyError["code"])
          : "engine_error";
      return { ok: false, code, status: res.status };
    },

    async registerWebhooks(spaceId) {
      return webhookLifecycleCall(options, spaceId, "register-webhooks");
    },

    async unregisterWebhooks(spaceId) {
      return webhookLifecycleCall(options, spaceId, "unregister-webhooks");
    },

    async rescanBases(spaceId) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/rescan-bases`;
      let res: Response;
      try {
        res = await options.binding.fetch(`https://engine${path}`, {
          method: "POST",
          headers: {
            "x-internal-token": options.internalToken,
            "content-type": "application/json",
            accept: "application/json",
          },
          body: "{}",
        });
      } catch {
        return { ok: false, code: "engine_unreachable", status: 0 };
      }

      if (res.ok) {
        const body = (await res.json()) as Omit<
          EngineRescanBasesSuccess,
          "ok"
        >;
        return { ok: true, ...body };
      }

      let body: Record<string, unknown> = {};
      try {
        body = (await res.json()) as Record<string, unknown>;
      } catch {
        // engine returned non-JSON (rare); fall through with empty body
      }
      const rawCode = typeof body.error === "string" ? body.error : undefined;
      const code: EngineRescanBasesError["code"] =
        rawCode &&
        KNOWN_RESCAN_BASES_ERROR_CODES.has(
          rawCode as EngineRescanBasesError["code"],
        )
          ? (rawCode as EngineRescanBasesError["code"])
          : "engine_error";
      const out: EngineRescanBasesError = {
        ok: false,
        code,
        status: res.status,
      };
      if (typeof body.upstream_status === "number") {
        out.upstreamStatus = body.upstream_status;
      }
      return out;
    },

    async listConnectionWorkspaces(connectionId) {
      const path = `/api/internal/connections/${encodeURIComponent(connectionId)}/workspaces`;
      let res: Response;
      try {
        res = await options.binding.fetch(`https://engine${path}`, {
          method: "GET",
          headers: {
            "x-internal-token": options.internalToken,
            accept: "application/json",
          },
        });
      } catch {
        return { ok: false, degraded: true, reason: "engine_unreachable", status: 0 };
      }

      let body: Record<string, unknown> = {};
      try {
        body = (await res.json()) as Record<string, unknown>;
      } catch {
        // engine returned non-JSON (rare); fall through with empty body
      }

      // Any non-2xx (including 404 while server-mcp-workspaces is unbuilt)
      // and any `ok:false` / `degraded:true` payload = no workspace data.
      if (!res.ok || body.ok === false || body.degraded === true) {
        const reason =
          typeof body.reason === "string"
            ? body.reason
            : typeof body.error === "string"
              ? body.error
              : "engine_error";
        return { ok: false, degraded: true, reason, status: res.status };
      }

      const workspaces = Array.isArray(body.workspaces)
        ? (body.workspaces as EngineWorkspaceSummary[]).filter(
            (w) => typeof w?.id === "string" && typeof w?.name === "string",
          )
        : [];
      return {
        ok: true,
        workspaces,
        capturedAt: typeof body.capturedAt === "string" ? body.capturedAt : null,
      };
    },

    async deleteRun(runId) {
      const path = `/api/internal/runs/${encodeURIComponent(runId)}/delete`;
      let res: Response;
      try {
        res = await options.binding.fetch(`https://engine${path}`, {
          method: "POST",
          headers: {
            "x-internal-token": options.internalToken,
            accept: "application/json",
          },
        });
      } catch {
        return { ok: false, code: "engine_unreachable", status: 0 };
      }

      if (res.ok) {
        const body = (await res.json()) as { ok: true; triggerRunId: string };
        return { ok: true, triggerRunId: body.triggerRunId };
      }

      let body: Record<string, unknown> = {};
      try {
        body = (await res.json()) as Record<string, unknown>;
      } catch {
        // engine returned non-JSON (rare); fall through with empty body
      }
      const rawCode = typeof body.error === "string" ? body.error : undefined;
      const code: EngineDeleteRunError["code"] =
        rawCode &&
        KNOWN_DELETE_RUN_ERROR_CODES.has(
          rawCode as EngineDeleteRunError["code"],
        )
          ? (rawCode as EngineDeleteRunError["code"])
          : "engine_error";
      return { ok: false, code, status: res.status };
    },

    async cancelRun(runId) {
      const path = `/api/internal/runs/${encodeURIComponent(runId)}/cancel`;
      let res: Response;
      try {
        res = await options.binding.fetch(`https://engine${path}`, {
          method: "POST",
          headers: {
            "x-internal-token": options.internalToken,
            accept: "application/json",
          },
        });
      } catch {
        return { ok: false, code: "engine_unreachable", status: 0 };
      }

      if (res.ok) {
        const body = (await res.json()) as {
          ok: true;
          cancelledTriggerRunIds: string[];
        };
        return {
          ok: true,
          cancelledTriggerRunIds: body.cancelledTriggerRunIds ?? [],
        };
      }

      let body: Record<string, unknown> = {};
      try {
        body = (await res.json()) as Record<string, unknown>;
      } catch {
        // engine returned non-JSON (rare); fall through with empty body
      }
      const rawCode = typeof body.error === "string" ? body.error : undefined;
      const code: EngineCancelRunError["code"] =
        rawCode &&
        KNOWN_CANCEL_RUN_ERROR_CODES.has(
          rawCode as EngineCancelRunError["code"],
        )
          ? (rawCode as EngineCancelRunError["code"])
          : "engine_error";
      return { ok: false, code, status: res.status };
    },

    async listDocuments(spaceId) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/documents`;
      const res = await schemaDocsRequest(options, "GET", path);
      if (!res.ok) return res;
      return { ok: true, documents: (res.body.documents ?? []) as SchemaDocSummary[] };
    },

    async getDocument(spaceId, documentId) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/documents/${encodeURIComponent(documentId)}`;
      const res = await schemaDocsRequest(options, "GET", path);
      if (!res.ok) return res;
      return { ok: true, document: res.body.document as SchemaDoc };
    },

    async createDocument(spaceId, input) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/documents`;
      const res = await schemaDocsRequest(options, "POST", path, input);
      if (!res.ok) return res;
      return { ok: true, document: res.body.document as SchemaDoc };
    },

    async updateDocument(spaceId, documentId, patch) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/documents/${encodeURIComponent(documentId)}`;
      const res = await schemaDocsRequest(options, "PATCH", path, patch);
      if (!res.ok) return res;
      return { ok: true, document: res.body.document as SchemaDoc };
    },

    async deleteDocument(spaceId, documentId) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/documents/${encodeURIComponent(documentId)}`;
      const res = await schemaDocsRequest(options, "DELETE", path);
      if (!res.ok) return res;
      return { ok: true };
    },

    async docsByEntity(spaceId, targetType, targetId) {
      const path =
        `/api/internal/spaces/${encodeURIComponent(spaceId)}/docs-by-entity` +
        `?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`;
      const res = await schemaDocsRequest(options, "GET", path);
      if (!res.ok) return res;
      return {
        ok: true,
        entityRemoved: Boolean(res.body.entityRemoved),
        documents: (res.body.documents ?? []) as SchemaDocEntityRef[],
      };
    },

    async getSchema(spaceId) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/schema`;
      const res = await schemaDocsRequest(options, "GET", path);
      if (!res.ok) return res;
      return {
        ok: true,
        bases: (res.body.bases ?? []) as SchemaEntityBase[],
        tables: (res.body.tables ?? []) as SchemaEntityTable[],
        fields: (res.body.fields ?? []) as SchemaEntityField[],
        views: (res.body.views ?? []) as SchemaEntityView[],
      };
    },

    async getHealthOverview(spaceId, baseId) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/health-overview?baseId=${encodeURIComponent(baseId)}`;
      const res = await schemaDocsRequest(options, "GET", path);
      if (!res.ok) return res;
      return {
        ok: true,
        grade: (res.body.grade ?? null) as { score: number; band: string } | null,
        metrics: (res.body.metrics ?? []) as HealthOverviewMetricView[],
        issues: (res.body.issues ?? []) as HealthOverviewIssueView[],
      };
    },

    async getHealthConfig(spaceId, baseId) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/health-config?baseId=${encodeURIComponent(baseId)}`;
      const res = await schemaDocsRequest(options, "GET", path);
      if (!res.ok) return res;
      return { ok: true, metrics: (res.body.metrics ?? []) as HealthConfigMetricView[] };
    },

    async setHealthPrompt(spaceId, body) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/health-prompt`;
      const res = await schemaDocsRequest(options, "POST", path, body);
      if (!res.ok) return res;
      return { ok: true };
    },

    async setHealthEnable(spaceId, body) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/health-enable`;
      const res = await schemaDocsRequest(options, "POST", path, body);
      if (!res.ok) return res;
      return { ok: true };
    },

    async rerunHealth(spaceId, baseId) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/health-rerun`;
      const res = await schemaDocsRequest(options, "POST", path, { baseId });
      if (!res.ok) return res;
      return {
        ok: true,
        enqueued: Boolean(res.body.enqueued),
        runId: res.body.runId as string | undefined,
        metricCount: res.body.metricCount as number | undefined,
      };
    },

    async getRelationships(spaceId, baseId, includeDismissed) {
      const q = includeDismissed ? "&includeDismissed=1" : "";
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/relationships?baseId=${encodeURIComponent(baseId)}${q}`;
      const res = await schemaDocsRequest(options, "GET", path);
      if (!res.ok) return res;
      return {
        ok: true,
        derived: (res.body.derived ?? []) as DerivedRelationshipView[],
        syncedViews: (res.body.syncedViews ?? []) as SyncedViewRelationshipView[],
      };
    },

    async getSchemaChangelog(spaceId, baseId, limit) {
      const q = limit != null ? `&limit=${encodeURIComponent(String(limit))}` : "";
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/schema-changelog?baseId=${encodeURIComponent(baseId)}${q}`;
      const res = await schemaDocsRequest(options, "GET", path);
      if (!res.ok) return res;
      return { ok: true, entries: (res.body.entries ?? []) as ChangelogEntryView[] };
    },

    async getNotifications(spaceId) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/notifications`;
      const res = await schemaDocsRequest(options, "GET", path);
      if (!res.ok) return res;
      return { ok: true, items: (res.body.items ?? []) as InboxItemView[] };
    },

    async triageNotification(spaceId, input) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/notifications/triage`;
      const res = await schemaDocsRequest(options, "POST", path, input);
      if (!res.ok) return res;
      return { ok: true };
    },

    async muteNotificationBase(spaceId, baseId, muted) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/notifications/mute`;
      const res = await schemaDocsRequest(options, "POST", path, { baseId, muted });
      if (!res.ok) return res;
      return { ok: true };
    },

    async mutateRelationship(spaceId, body) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/relationships/mutate`;
      const res = await schemaDocsRequest(options, "POST", path, body);
      if (!res.ok) return res;
      return { ok: true, id: (res.body.id as string | undefined) ?? undefined };
    },

    async listChatThreads(spaceId, includeArchived) {
      const q = includeArchived ? "?includeArchived=1" : "";
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/chat/threads${q}`;
      const res = await schemaDocsRequest(options, "GET", path);
      if (!res.ok) return res;
      return { ok: true, threads: (res.body.threads ?? []) as ChatThreadSummaryView[] };
    },

    async createChatThread(spaceId, createdByUserId) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/chat/threads`;
      const res = await schemaDocsRequest(options, "POST", path, { createdByUserId: createdByUserId ?? null });
      if (!res.ok) return res;
      return { ok: true, id: res.body.id as string };
    },

    async getChatThread(spaceId, threadId) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/chat/threads/${encodeURIComponent(threadId)}`;
      const res = await schemaDocsRequest(options, "GET", path);
      if (!res.ok) return res;
      return { ok: true, thread: res.body.thread as ChatThreadDetailView };
    },

    async patchChatThread(spaceId, threadId, body) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/chat/threads/${encodeURIComponent(threadId)}`;
      const res = await schemaDocsRequest(options, "PATCH", path, body);
      if (!res.ok) return res;
      return { ok: true };
    },

    async sendChatMessage(spaceId, threadId, message) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/chat/send`;
      const res = await schemaDocsRequest(options, "POST", path, { threadId, message });
      if (!res.ok) return res;
      return {
        ok: true,
        userMessageId: res.body.userMessageId as string,
        assistantMessageId: res.body.assistantMessageId as string,
      };
    },

    async getRunDetail(runId) {
      const path = `/api/internal/runs/${encodeURIComponent(runId)}/detail`;
      let res: Response;
      try {
        res = await options.binding.fetch(`https://engine${path}`, {
          method: "GET",
          headers: {
            "x-internal-token": options.internalToken,
            accept: "application/json",
          },
        });
      } catch {
        return { ok: false, code: "engine_unreachable", status: 0 };
      }

      if (res.ok) {
        const body = (await res.json()) as { bases?: unknown };
        return {
          ok: true,
          bases: (body.bases ?? []) as EngineRunDetailBase[],
        };
      }

      let body: Record<string, unknown> = {};
      try {
        body = (await res.json()) as Record<string, unknown>;
      } catch {
        // engine returned non-JSON (rare); fall through with empty body
      }
      const rawCode = typeof body.error === "string" ? body.error : undefined;
      const code: EngineRunDetailError["code"] =
        rawCode &&
        KNOWN_RUN_DETAIL_ERROR_CODES.has(rawCode as EngineRunDetailError["code"])
          ? (rawCode as EngineRunDetailError["code"])
          : "engine_error";
      return { ok: false, code, status: res.status };
    },

    async getDataRecords(spaceId, tableId, query) {
      const qs = engineQuery({ ...query });
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/data/tables/${encodeURIComponent(tableId)}/records${qs}`;
      const res = await schemaDocsRequest(options, "GET", path);
      if (!res.ok) return res;
      return {
        ok: true,
        records: (res.body.records ?? []) as DataRecordRow[],
        nextCursor: (res.body.nextCursor ?? null) as string | null,
        total: Number(res.body.total ?? 0),
        approximate: Boolean(res.body.approximate),
        filterErrors: (res.body.filterErrors ?? []) as string[],
      };
    },

    async getDataChangelog(spaceId, query) {
      const qs = engineQuery({ ...query });
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/data/changelog${qs}`;
      const res = await schemaDocsRequest(options, "GET", path);
      if (!res.ok) return res;
      if (res.body.mode === "rows") {
        return {
          ok: true,
          mode: "rows" as const,
          runId: String(res.body.runId ?? ""),
          changeType: String(res.body.changeType ?? "updated"),
          rows: (res.body.rows ?? []) as DataChangelogChangeRow[],
          nextCursor: (res.body.nextCursor ?? null) as string | null,
        };
      }
      return {
        ok: true,
        mode: "rollup" as const,
        runs: (res.body.runs ?? []) as DataChangelogRunRollup[],
        nextCursor: (res.body.nextCursor ?? null) as string | null,
      };
    },

    async getDataComments(spaceId, query) {
      const qs = engineQuery({ ...query });
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/data/comments${qs}`;
      const res = await schemaDocsRequest(options, "GET", path);
      if (!res.ok) return res;
      return {
        ok: true,
        comments: (res.body.comments ?? []) as DataCommentRow[],
        nextCursor: (res.body.nextCursor ?? null) as string | null,
        total: Number(res.body.total ?? 0),
        approximate: Boolean(res.body.approximate),
      };
    },

    async getMedia(spaceId, query) {
      const qs = engineQuery({ ...query });
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/media${qs}`;
      const res = await schemaDocsRequest(options, "GET", path);
      if (!res.ok) return res;
      return {
        ok: true,
        items: (res.body.items ?? []) as MediaAssetView[],
        nextCursor: (res.body.nextCursor ?? null) as string | null,
      };
    },

    async getMediaTotals(spaceId, query) {
      const qs = engineQuery({ ...query });
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/media/totals${qs}`;
      const res = await schemaDocsRequest(options, "GET", path);
      if (!res.ok) return res;
      return {
        ok: true,
        count: Number(res.body.count ?? 0),
        sizeBytes: Number(res.body.sizeBytes ?? 0),
      };
    },

    async getMediaAsset(spaceId, assetId) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/media/${encodeURIComponent(assetId)}`;
      const res = await schemaDocsRequest(options, "GET", path);
      if (!res.ok) return res;
      return { ok: true, asset: res.body.asset as MediaAssetView };
    },

    async mediaDownload(spaceId, assetId) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/media/${encodeURIComponent(assetId)}/download`;
      return options.binding.fetch(`https://engine${path}`, {
        method: "GET",
        headers: { "x-internal-token": options.internalToken },
      });
    },

    // Reports (web-reports-page task 2.1).
    async listReportDefinitions(spaceId) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/reports`;
      const res = await reportsRequest(options, "GET", path);
      if (!res.ok) return res;
      return {
        ok: true,
        definitions: (res.body.definitions ?? []) as ReportDefinitionWithLatestRun[],
      };
    },

    async getReportDefinition(spaceId, defId) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/reports/${encodeURIComponent(defId)}`;
      const res = await reportsRequest(options, "GET", path);
      if (!res.ok) return res;
      return {
        ok: true,
        definition: res.body.definition as ReportDefinitionView,
        runs: (res.body.runs ?? []) as ReportRunView[],
      };
    },

    async createReportDefinition(spaceId, input) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/reports`;
      const res = await reportsRequest(options, "POST", path, input);
      if (!res.ok) return res;
      return { ok: true, definition: res.body.definition as ReportDefinitionView };
    },

    async updateReportDefinition(spaceId, defId, patch) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/reports/${encodeURIComponent(defId)}`;
      const res = await reportsRequest(options, "PATCH", path, patch);
      if (!res.ok) return res;
      return { ok: true, definition: res.body.definition as ReportDefinitionView };
    },

    async deleteReportDefinition(spaceId, defId) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/reports/${encodeURIComponent(defId)}`;
      const res = await reportsRequest(options, "DELETE", path);
      if (!res.ok) return res;
      return { ok: true };
    },

    async generateReportNow(spaceId, defId, body) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/reports/${encodeURIComponent(defId)}/generate`;
      const res = await reportsRequest(options, "POST", path, body ?? {});
      if (!res.ok) return res;
      return { ok: true, runId: res.body.runId as string };
    },

    async getReportRun(spaceId, runId) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/reports/runs/${encodeURIComponent(runId)}`;
      const res = await reportsRequest(options, "GET", path);
      if (!res.ok) return res;
      return {
        ok: true,
        run: res.body.run as ReportRunView,
        document: (res.body.document ?? null) as Record<string, unknown> | null,
      };
    },

    async getReportArtifact(spaceId, runId, format) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/reports/runs/${encodeURIComponent(runId)}/artifact?format=${format}`;
      return options.binding.fetch(`https://engine${path}`, {
        method: "GET",
        headers: { "x-internal-token": options.internalToken },
      });
    },

    async resendReportDelivery(spaceId, runId) {
      const path = `/api/internal/spaces/${encodeURIComponent(spaceId)}/reports/runs/${encodeURIComponent(runId)}/resend`;
      const res = await reportsRequest(options, "POST", path, {});
      if (!res.ok) return res;
      return {
        ok: true,
        resent: Number(res.body.resent ?? 0),
        failed: Number(res.body.failed ?? 0),
      };
    },
  };
}
