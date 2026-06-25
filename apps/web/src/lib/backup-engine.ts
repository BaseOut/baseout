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
  /** Unix-ms the SpaceDO scheduled the next alarm for. */
  nextFireMs: number;
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
  status: string;
}
export interface SchemaEntityTable {
  tableId: string;
  baseId: string;
  name: string;
  recordCount: number | null;
  fieldCount: number | null;
  description: string | null;
  status: string;
}
export interface SchemaEntityField {
  fieldId: string;
  tableId: string;
  baseId: string;
  name: string;
  type: string;
  isPrimary: boolean;
  description: string | null;
  status: string;
}
export interface SchemaEntityView {
  viewId: string;
  tableId: string;
  baseId: string;
  name: string;
  type: string | null;
  status: string;
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
  cancelRun(runId: string): Promise<EngineCancelRunResult>;
  deleteRun(runId: string): Promise<EngineDeleteRunResult>;
  setSpaceFrequency(
    spaceId: string,
    frequency: string,
  ): Promise<EngineSetSpaceFrequencyResult>;
  rescanBases(spaceId: string): Promise<EngineRescanBasesResult>;
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
}

const KNOWN_SCHEMA_DOCS_ERROR_CODES: ReadonlySet<SchemaDocsError["code"]> = new Set([
  "unauthorized",
  "invalid_request",
  "space_db_not_ready",
  "backend_not_implemented",
  "document_not_found",
]);

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

    async setSpaceFrequency(spaceId, frequency) {
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
          body: JSON.stringify({ frequency }),
        });
      } catch {
        return { ok: false, code: "engine_unreachable", status: 0 };
      }

      if (res.ok) {
        const body = (await res.json()) as { ok: true; nextFireMs: number };
        return { ok: true, nextFireMs: body.nextFireMs };
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
  };
}
