// Backup-one-base orchestration. Extracted as a pure async function so it
// can be unit-tested without the Trigger.dev runtime — the wrapper in
// backup-base.task.ts (TODO Phase 7 sub-D) instantiates real deps and calls
// this.
//
// Flow (Phase 7.2 of the Backups MVP plan):
//   1. POST /api/internal/connections/:connectionId/lock — retry every 5s up
//      to 60s; on persistent 409 → status='failed' / lock_unavailable.
//   2. POST /api/internal/connections/:connectionId/token { encryptedToken }
//      → plaintext access token (ConnectionDO decrypt; cron keeps tokens fresh).
//   3. Airtable getBaseSchema → list of tables.
//   4. Trial gate on table count: if isTrial && tables>5, slice to 5 →
//      status='trial_truncated' on success.
//   5. Per table: page records → normalize per field type → pageToCsv →
//      writeCsvToLocalDisk at buildR2Key path (rooted under
//      apps/workflows/.backups/ — R2 has been removed entirely).
//   6. Trial gate on record count: cumulative >=1000 → trim, stop, status=
//      'trial_complete'.
//   7. POST .../unlock in finally.
//
// Phase 8 will own the call to /api/internal/runs/:runId/complete (status +
// counts persistence). Until then, the wrapper consumes this function's
// return value directly.

import {
  createAirtableClient,
  type AirtableSchema,
  type AirtableRecordsPage,
} from "./_lib/airtable-client";
import { buildR2Key, buildAttachmentKey } from "./_lib/r2-path";
import { pageToCsv } from "./_lib/csv-stream";
import { normalizeFieldValue } from "./_lib/field-normalizer";
import {
  resolveStorageWriter,
  type StorageWriterCreds,
  type R2WriterCreds,
} from "./_lib/storage-writers";
import {
  createAttachmentDownloader,
  type AirtableAttachment,
  type AttachmentDownloader,
  type AttachmentRecordEntry,
} from "./_lib/attachment-downloader";
import {
  fetchAutomations,
  fetchInterfacePages,
  fetchViews,
  type FetchAutomationsResult,
  type FetchInterfacePagesResult,
  type FetchViewsResult,
  type ViewsCapture,
} from "./_lib/mcp-client";
import {
  mcpCaptureOutcome,
  type McpCaptureOutcome,
} from "./_lib/mcp-capture-common";
import {
  captureCommentsForRecords,
  fetchRecordComments,
  type CommentRecordCaptureWire,
  type FetchRecordCommentsResult,
} from "./_lib/record-comments";

// Re-export for existing consumers (backup-base.task.ts, tests) — the type
// moved to _lib/record-comments.ts when the incremental capture step became
// its second call site (workflows-comments task 3.5).
export type { CommentRecordCaptureWire } from "./_lib/record-comments";
import {
  createMediaEmitter,
  type MediaAttachmentEntryWire,
  type MediaCaptureOutcome,
  type MediaRecordCaptureWire,
} from "./_lib/media-emitter";

// Airtable's field type for an attachments cell. Mirrors the constant in
// field-normalizer.ts (kept local so the downloader branch is self-contained).
const ATTACHMENTS_FIELD_TYPE = "multipleAttachments";

export interface BackupBaseInput {
  runId: string;
  connectionId: string;
  atBaseId: string;
  isTrial: boolean;
  encryptedToken: string;
  orgSlug: string;
  spaceName: string;
  baseName: string;
  runStartedAt: Date;
  /**
   * Selects the StorageWriter via resolveStorageWriter (Phase A.1 of
   * openspec/changes/shared-backup-run-delete). When 'google_drive' (the
   * first cloud destination — shared-byos-drive), the task fetches decrypted
   * credentials from the engine before constructing the writer; unknown /
   * missing values fall back to LocalFsWriter.
   */
  storageType: string;
  /**
   * Space ID — passed in the task payload so the workflows runner can fetch
   * cloud-storage credentials from the engine's internal route. Required for
   * BYOS destinations; ignored for `local_fs`.
   */
  spaceId: string;
  /**
   * 'full' (default) captures schema + data; 'schema' captures + syncs the base
   * schema only and skips the record / CSV / attachment loop
   * (openspec/changes/workflows-schema-only-backup). Set by the engine
   * run-start from backup_runs.kind (server-backup-scope).
   */
  kind?: "full" | "schema";
  /**
   * Gates the MCP interface-pages capture (workflows-mcp-interface-pages).
   * Stamped by the engine run-start from the Org's resolved tier (Growth+ —
   * server-mcp-interface-pages). Default false: below tier (or an older
   * engine) makes ZERO MCP requests, silently.
   */
  interfacesEnabled?: boolean;
  /**
   * Gates the MCP automations capture (workflows-mcp-automations). Same
   * contract as interfacesEnabled: stamped by the engine run-start (Growth+ —
   * server-mcp-automations); default false = zero automation MCP requests.
   */
  automationsEnabled?: boolean;
  /**
   * How this run captures views (workflows-mcp-views, stamped by the engine
   * run-start — server-mcp-views): 'rest' (enterprise-scope connection) keeps
   * today's behavior exactly (views ride the REST schema; no MCP call);
   * 'mcp' captures views via the Airtable MCP server per table and attaches
   * them to schema-sync's optional `views` field; 'off' captures nothing.
   * Absent (older engine payload) behaves like 'rest' — zero MCP view calls.
   */
  viewCaptureMode?: "rest" | "mcp" | "off";
  /**
   * Gates the REST comment capture (workflows-comments). Stamped by the
   * engine run-start from the Org's resolved tier (server-comments); absent /
   * false = zero comments-plan or comments-endpoint requests, and no
   * commentCount metadata on the record listing.
   */
  commentsEnabled?: boolean;
}

interface AirtableClientShape {
  getBaseSchema: (baseId: string) => Promise<AirtableSchema>;
  listRecords: (
    baseId: string,
    tableIdOrName: string,
    opts?: { offset?: string; pageSize?: number; recordMetadata?: string[] },
  ) => Promise<AirtableRecordsPage>;
}

export interface BackupBaseProgressEvent {
  /** Number of records uploaded by the just-completed table. */
  recordsAppended: number;
  /** Always true at the per-table call site; reserved for future per-page granularity. */
  tableCompleted: boolean;
}

// ── Per-Space DB sync wire shapes (openspec/changes/system-per-space-db §3) ──
// The POST body shapes for the engine's /schema-sync + /records-sync routes
// (Option B — engine-brokered writes). Kept in lockstep with the engine's
// CapturedBase / CapturedRecord (apps/server/src/lib/per-space/*-diff.ts); the
// routes validate the shape. Views/options/descriptions are not captured yet —
// the airtable-client schema type doesn't parse them (follow-up).

export interface CapturedFieldWire {
  fieldId: string;
  name: string;
  type: string;
  options?: unknown;
  isPrimary?: boolean;
  description?: string | null;
}
export interface CapturedTableWire {
  tableId: string;
  name: string;
  primaryFieldId?: string | null;
  fieldCount?: number | null;
  recordCount?: number | null;
  description?: string | null;
  fields: CapturedFieldWire[];
  views: { viewId: string; name: string; type?: string | null }[];
}
export interface CapturedBaseWire {
  baseId: string;
  name: string;
  description?: string | null;
  tables: CapturedTableWire[];
}
export interface CapturedRecordWire {
  recordId: string;
  createdTime?: string | null;
  modifiedTime?: string | null;
  /** fieldId → raw Airtable value. Only populated fields (Airtable omits empties). */
  cells: Record<string, unknown>;
}

export interface BackupBaseDeps {
  engineUrl: string;
  internalToken: string;
  fetchImpl?: typeof fetch;
  airtableClient?: AirtableClientShape;
  sleepImpl?: (ms: number) => Promise<void>;
  /**
   * Optional override for the storage-credential fetcher. The production
   * default reads from the engine's `/api/internal/spaces/:spaceId/storage-destination`
   * route (gated by INTERNAL_TOKEN). Tests pass a fake that returns deterministic
   * creds without touching the engine.
   */
  fetchStorageCreds?: (
    spaceId: string,
  ) => Promise<StorageWriterCreds | null>;
  /**
   * Supplies managed-R2 credentials (openspec/changes/workflows-r2-writer).
   * Unlike the BYOS providers, R2 creds are app-level env — not per-Space
   * OAuth — so they bypass `fetchStorageCreds`/the engine route entirely. The
   * Trigger.dev wrapper builds these from process.env; returning `null` (dev
   * without R2 provisioned) degrades gracefully to LocalFsWriter.
   */
  getR2Creds?: () => R2WriterCreds | null;
  /**
   * Fire-and-forget per-table progress callback (Phase 10d). Closure is owned
   * by the Trigger.dev wrapper, which captures runId + triggerRunId + atBaseId
   * and posts to /api/internal/runs/:runId/progress. Default no-op so existing
   * tests pass unchanged.
   */
  postProgress?: (event: BackupBaseProgressEvent) => Promise<void>;
  /**
   * Test seam for the local-disk CSV writer. Defaults to writeCsvToLocalDisk
   * which writes under apps/workflows/.backups/. The integration test harness
   * runs inside workerd-vitest where host-fs writes don't behave like Node,
   * so tests inject a recording fake here.
   */
  writeCsv?: (relativeKey: string, csv: string) => Promise<unknown>;
  /**
   * Attachment dedup engine callbacks (openspec/changes/workflows-attachments).
   * When BOTH are present, the per-record loop downloads Airtable attachments
   * through the resolved StorageWriter (so they land at the Space's chosen
   * destination — R2 or BYOS) and emits storage keys into the CSV cell. When
   * absent (e.g. existing tests, or attachments disabled), the loop keeps the
   * legacy `[N attachments]` placeholder from normalizeFieldValue.
   */
  attachmentLookup?: (
    spaceId: string,
    compositeIds: string[],
  ) => Promise<
    Record<string, { storageKey: string; uploadStatus: string; contentHash?: string }>
  >;
  attachmentRecord?: (
    spaceId: string,
    entries: AttachmentRecordEntry[],
  ) => Promise<void>;
  /** Optional Airtable CDN URL refresher for mid-run expiry; safety net. */
  refreshAttachmentUrl?: (
    attachment: AirtableAttachment,
    ctx: { baseId: string; tableId: string; recordId: string; fieldId: string },
  ) => Promise<string>;
  /**
   * Test seam: inject a prebuilt downloader instead of constructing one from
   * the lookup/record callbacks. Production omits this — the wrapper supplies
   * the callbacks and the downloader is built internally against the resolved
   * StorageWriter.
   */
  attachmentDownloader?: AttachmentDownloader;
  /**
   * Per-Space DB sync (openspec/changes/system-per-space-db §3, Option B —
   * engine-brokered). When present, the writer POSTs the captured base schema
   * to /schema-sync (returns whether records are enabled + the per-Space
   * base-run id), then POSTs each table's records to /records-sync when records
   * are enabled. Absent in existing tests / static-only setups → the writer
   * skips per-Space sync and only writes CSV snapshots (unchanged behavior).
   */
  syncSchema?: (
    captured: CapturedBaseWire,
    confident: boolean,
    /**
     * Optional MCP interface-pages capture riding the schema-sync POST
     * (workflows-mcp-interface-pages). Shape owned by the server change's
     * `InterfacePagesCapture` (apps/server/src/lib/per-space/interfaces-sync.ts).
     * Only attached on a successful capture — a skipped capture omits the
     * field entirely (absent ≠ "all interfaces deleted").
     */
    interfacePages?: { capturedAt: string; raw: unknown },
    // Optional MCP automations capture (workflows-mcp-automations) — same
    // attach-only-on-success contract as interfacePages.
    automations?: { capturedAt: string; raw: unknown },
    // Optional MCP views capture (workflows-mcp-views) — the per-table
    // aggregation of list_views_for_table envelopes. Same attach-only-on-
    // success contract; wire shape owned by the server change's ViewsCapture
    // (apps/server/src/lib/per-space/views-sync.ts).
    views?: ViewsCapture,
  ) => Promise<{ recordsEnabled: boolean; baseRunId: string } | null>;
  syncRecords?: (args: {
    baseId: string;
    tableId: string;
    records: CapturedRecordWire[];
    confident: boolean;
  }) => Promise<void>;
  /**
   * MCP interface-pages fetcher (workflows-mcp-interface-pages). Defaults to
   * the real client against https://mcp.airtable.com/mcp (endpoint overridable
   * via AIRTABLE_MCP_URL in the wrapper, for tests/failure drills). Tests
   * inject a fake. Only invoked when input.interfacesEnabled AND syncSchema is
   * wired (the capture has nowhere to land otherwise).
   */
  fetchInterfacePages?: (args: {
    baseId: string;
    accessToken: string;
  }) => Promise<FetchInterfacePagesResult>;
  /**
   * MCP automations fetcher (workflows-mcp-automations). Same contract as
   * fetchInterfacePages: defaults to the real client, tests inject a fake,
   * only invoked when input.automationsEnabled AND syncSchema is wired.
   */
  fetchAutomations?: (args: {
    baseId: string;
    accessToken: string;
  }) => Promise<FetchAutomationsResult>;
  /**
   * MCP views fetcher (workflows-mcp-views). Same contract as the other two:
   * defaults to the real client, tests inject a fake, only invoked when
   * input.viewCaptureMode === 'mcp' AND syncSchema is wired. Takes the run's
   * table ids (from the schema fetch) — the MCP view tool is per-table.
   */
  fetchViews?: (args: {
    baseId: string;
    tableIds: string[];
    accessToken: string;
  }) => Promise<FetchViewsResult>;
  /**
   * Count-delta refresh planning (workflows-comments design Decision 1b).
   * POSTs the observed commented subset to the engine's comments-plan route.
   * Returns the plan, or `null` when the per-Space DB isn't ready (409/501 —
   * the capture is skipped entirely). A THROW degrades to the pre-optimization
   * behavior: every observed commented record is refreshed.
   */
  planComments?: (args: {
    baseId: string;
    records: { recordId: string; commentCount: number }[];
  }) => Promise<{ refresh: string[]; zeroCandidates: string[] } | null>;
  /**
   * Streams one comment batch to the engine's comments-sync route
   * (workflows-comments design Decision 2). Comment capture only runs when
   * this is wired (the capture has nowhere to land otherwise). Throws on
   * engine errors — the capture step maps that to `partial`, never the run.
   */
  syncComments?: (args: {
    baseId: string;
    records: CommentRecordCaptureWire[];
  }) => Promise<void>;
  /**
   * Per-record comments fetcher (workflows-comments). Defaults to the real
   * REST client (_lib/record-comments.ts) with the run's injected fetch/sleep;
   * tests inject a fake. Only invoked for records the plan marks `refresh`.
   */
  fetchRecordComments?: (args: {
    baseId: string;
    tableId: string;
    recordId: string;
    accessToken: string;
  }) => Promise<FetchRecordCommentsResult>;
  /**
   * Streams one attachment-metadata batch to the engine's media-sync route
   * (workflows-media-metadata). Emission is active only when attachments are
   * being exported (the downloader is wired) AND this dep is present — no
   * payload flag; the index follows whatever attachment export already does.
   * Throws on engine errors — the emitter maps that to `partial`/`skipped`,
   * never the run.
   */
  syncMedia?: (args: {
    baseId: string;
    records: MediaRecordCaptureWire[];
  }) => Promise<void>;
}

export type BackupBaseStatus =
  | "succeeded"
  | "trial_truncated"
  | "trial_complete"
  | "failed";

export interface BackupTableDetail {
  tableId: string;
  tableName: string;
  recordCount: number;
  fieldCount: number;
  attachmentCount: number;
}

export interface BackupBaseResult {
  status: BackupBaseStatus;
  tablesProcessed: number;
  recordsProcessed: number;
  attachmentsProcessed: number;
  errorMessage?: string;
  /** Per-table breakdown accumulated during the table loop. Present on
   * succeeded / trial_truncated / trial_complete; absent on early-exit
   * failed paths (lock_unavailable, missing_r2_creds, etc.). */
  tableDetail?: BackupTableDetail[];
  /**
   * MCP interface-pages capture outcome (workflows-mcp-interface-pages).
   * Present only when the capture was attempted (interfacesEnabled + sync
   * wired). `skipped` NEVER affects `status` — failure isolation is the spec's
   * hard rule. `notice: 'connection_scope'` flags a token the MCP server
   * rejected (401/403) so support can spot scope problems on the run.
   */
  interfacePages?: McpCaptureOutcome;
  /**
   * MCP automations capture outcome (workflows-mcp-automations). Identical
   * contract to interfacePages: present only when attempted, `skipped` NEVER
   * affects `status`, 401/403 carries the connection-scope notice.
   */
  automations?: McpCaptureOutcome;
  /**
   * MCP views capture outcome (workflows-mcp-views). Identical contract to
   * the other two: present only when attempted (viewCaptureMode 'mcp' + sync
   * wired), `skipped` NEVER affects `status`.
   */
  views?: McpCaptureOutcome;
  /**
   * REST comment capture outcome (workflows-comments design Decision 4).
   * Present only when attempted (commentsEnabled + syncComments wired + a
   * full run). NEVER affects `status` — comment capture is best-effort.
   * `captured`/`partial` counts are record captures DELIVERED to comments-sync
   * (fetched + zero-confirms) and comments delivered; `skippedByPlan` counts
   * observed commented records the count-delta plan let us skip. `partial` is
   * honest under mid-fan-out failure: only records whose pagination finished
   * were delivered `complete`.
   */
  comments?:
    | { status: "captured"; records: number; comments: number; skippedByPlan: number }
    | { status: "partial"; reason: string; records: number; comments: number; skippedByPlan: number }
    | { status: "skipped"; reason: string };
  /**
   * Media-metadata emission outcome (workflows-media-metadata). Present only
   * when attempted (attachment export active + syncMedia wired). NEVER
   * affects `status` — bytes are the product, the index is a view; gaps heal
   * idempotently on the next run. `assets` = distinct checksums delivered,
   * `refs` = attachment entries delivered.
   */
  media?: MediaCaptureOutcome;
}

const TRIAL_TABLE_CAP = 5;
const TRIAL_RECORD_CAP = 1000;
const LOCK_RETRY_INTERVAL_MS = 5_000;
const LOCK_MAX_TOTAL_MS = 60_000;

// BYOS provider storage types whose media locator is the relative storage key
// under the connected destination folder (workflows-media-metadata; see the
// change's tasks.md for per-provider locator-stability notes).
const BYOS_PROVIDER_TYPES = new Set([
  "google_drive",
  "box",
  "dropbox",
  "onedrive",
]);

/**
 * Map the run's storage type + the writer's storage key onto the media-sync
 * `storage` locator (workflows-media-metadata design Decision 1: only what's
 * in hand — the relative key IS what the dedup table stores and what every
 * writer addressed). local_fs (and unknown types) omit storage entirely: the
 * bytes are only staged on the runner's disk, but the index still fills.
 */
function mediaStorageFor(
  storageType: string,
  key: string,
): MediaAttachmentEntryWire["storage"] {
  if (storageType === "r2_managed") return { kind: "r2_managed", key };
  if (BYOS_PROVIDER_TYPES.has(storageType)) {
    return { kind: "destination", provider: storageType, locator: key };
  }
  return undefined;
}

function trimSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

async function postInternal(
  fetchFn: typeof fetch,
  url: string,
  internalToken: string,
  body: unknown,
): Promise<Response> {
  return fetchFn(url, {
    method: "POST",
    headers: {
      "x-internal-token": internalToken,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function runBackupBase(
  input: BackupBaseInput,
  deps: BackupBaseDeps,
): Promise<BackupBaseResult> {
  const fetchFn = deps.fetchImpl ?? fetch;
  const sleep =
    deps.sleepImpl ??
    ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const engineBase = trimSlash(deps.engineUrl);
  const connBase = `${engineBase}/api/internal/connections/${encodeURIComponent(
    input.connectionId,
  )}`;

  // Fail fast: r2_managed requires app-level S3-API creds in the runner env.
  // resolveStorageWriter would otherwise silently fall back to LocalFsWriter
  // when creds are absent — masking an R2 backup as a local-disk write. By
  // returning a structured `failed` result here (instead of throwing in the
  // wrapper before its try/catch, as the previous design did), the wrapper's
  // postCompletion fires and the engine flips the backup_runs row out of
  // 'running' — preventing the silent-hang failure mode that surfaced on
  // 2026-06-09 when a Space had Box connected but storage_type was still the
  // legacy r2_managed default. The cached value is reused below to avoid
  // calling deps.getR2Creds twice.
  // Schema-only runs never touch storage (no CSV / attachments), so the
  // r2_managed creds guard and credential fetch below don't apply
  // (workflows-schema-only-backup).
  const isSchemaOnly = input.kind === "schema";
  const r2CredsRaw =
    !isSchemaOnly && input.storageType === "r2_managed"
      ? deps.getR2Creds?.() ?? null
      : null;
  if (!isSchemaOnly && input.storageType === "r2_managed" && !r2CredsRaw) {
    return failed("missing_r2_creds", 0, 0);
  }

  // 1. Acquire lock with retry.
  const deadline = Date.now() + LOCK_MAX_TOTAL_MS;
  let locked = false;
  for (;;) {
    const res = await postInternal(
      fetchFn,
      `${connBase}/lock`,
      deps.internalToken,
      undefined,
    );
    if (res.status === 200) {
      locked = true;
      break;
    }
    if (res.status === 409) {
      if (Date.now() + LOCK_RETRY_INTERVAL_MS > deadline) {
        return failed("lock_unavailable", 0, 0);
      }
      await sleep(LOCK_RETRY_INTERVAL_MS);
      continue;
    }
    return failed(`lock_unexpected_${res.status}`, 0, 0);
  }

  let tablesProcessed = 0;
  let recordsProcessed = 0;
  let trialComplete = false;
  const tableDetail: BackupTableDetail[] = [];

  // Comment capture (workflows-comments) — gated on the tier flag, a FULL run
  // (schema-only runs have no listing pass to observe counts on), and
  // syncComments being wired (the capture has nowhere to land otherwise).
  // When active, the EXISTING record-listing pass requests commentCount
  // metadata (Decision 1 — no second pass) and these accumulators collect the
  // observed commented subset + the zero-count sightings the plan's
  // zeroCandidates handshake needs.
  const captureComments =
    input.commentsEnabled === true && !isSchemaOnly && !!deps.syncComments;
  const observedCommented: { recordId: string; tableId: string; commentCount: number }[] = [];
  const observedZero = new Map<string, string>(); // recordId → tableId
  // Resolve cloud-storage credentials before constructing the writer. The
  // engine internal route decrypts + lazy-refreshes the access token; we
  // pass a refresh closure that re-hits the same route with `?refresh=1`
  // for mid-upload 401 retries.
  let storageCreds: StorageWriterCreds | null = null;
  // Only providers that need decrypted credentials trigger the engine
  // fetch. `local_fs` doesn't. `r2_managed` uses app-level env creds via
  // getR2Creds (not the engine route).
  if (
    !isSchemaOnly &&
    (input.storageType === "google_drive" ||
      input.storageType === "box" ||
      input.storageType === "dropbox" ||
      input.storageType === "onedrive")
  ) {
    const fetchCreds =
      deps.fetchStorageCreds ??
      ((spaceId: string) =>
        defaultFetchStorageCreds(
          fetchFn,
          engineBase,
          deps.internalToken,
          spaceId,
          input.storageType,
        ));
    storageCreds = await fetchCreds(input.spaceId);
  } else if (!isSchemaOnly && input.storageType === "r2_managed") {
    // r2CredsRaw is guaranteed non-null here — the guard at the top of this
    // function returns `failed` before reaching the lock-acquire step when
    // creds are absent. Reuse the cached value rather than re-invoking the
    // closure (the unit test pins one call only).
    storageCreds = { kind: "r2", ...r2CredsRaw! };
  }
  const writer = resolveStorageWriter(
    input.storageType,
    storageCreds ?? undefined,
  );

  let attachmentsProcessed = 0;
  // Build the attachment downloader only when the engine dedup callbacks are
  // wired. It writes through the SAME resolved `writer`, so attachments land
  // at whatever destination the Space selected (R2 / BYOS / local-fs).
  const attachmentDownloader =
    deps.attachmentDownloader ??
    (deps.attachmentLookup && deps.attachmentRecord
      ? createAttachmentDownloader({
          writer,
          spaceId: input.spaceId,
          buildKey: (compositeId, filename) =>
            buildAttachmentKey({
              orgSlug: input.orgSlug,
              spaceName: input.spaceName,
              baseName: input.baseName,
              compositeId,
              filename,
            }),
          lookup: deps.attachmentLookup,
          record: deps.attachmentRecord,
          // local_fs stages bytes on the runner's disk ('ready'); R2/BYOS land
          // at the real destination ('uploaded').
          uploadStatus: input.storageType === "local_fs" ? "ready" : "uploaded",
          fetchImpl: fetchFn,
          refreshUrl: deps.refreshAttachmentUrl,
        })
      : null);

  // Media-metadata emitter (workflows-media-metadata): report what the
  // attachment export already knows to the engine's media index. Active only
  // when attachments are exported (downloader wired) AND syncMedia is present
  // — no payload flag, emission follows the export. Fire-and-forget by
  // construction: the emitter never throws and the outcome never touches the
  // run status.
  const mediaEmitter =
    attachmentDownloader && deps.syncMedia
      ? createMediaEmitter({
          syncMedia: (records) =>
            deps.syncMedia!({ baseId: input.atBaseId, records }),
        })
      : null;

  try {
    // 2. Token.
    const tokenRes = await postInternal(
      fetchFn,
      `${connBase}/token`,
      deps.internalToken,
      { encryptedToken: input.encryptedToken },
    );
    if (tokenRes.status !== 200) {
      return failed(`token_${tokenRes.status}`, 0, 0);
    }
    const { accessToken } = (await tokenRes.json()) as { accessToken: string };

    // 2b. MCP interface-pages capture (workflows-mcp-interface-pages) —
    // kicked off here so it runs CONCURRENTLY with the Airtable schema fetch
    // below (it needs only the token + baseId), and awaited right before the
    // schema-sync POST it rides on. Happy path adds ~0s of wall-clock; the
    // worst failing path adds the client's 30s timeout before schema-sync.
    // Gated on the tier flag AND on syncSchema being wired (without the sync
    // the capture has nowhere to land). The client never throws, and the
    // defensive .catch keeps an injected fake from failing the run either —
    // no MCP failure mode may touch the backup outcome.
    const captureInterfaces =
      input.interfacesEnabled === true && !!deps.syncSchema;
    const interfaceCapturePromise: Promise<FetchInterfacePagesResult> | null =
      captureInterfaces
        ? (deps.fetchInterfacePages ??
            ((a: { baseId: string; accessToken: string }) =>
              fetchInterfacePages({ ...a, fetchImpl: fetchFn })))({
            baseId: input.atBaseId,
            accessToken,
          }).catch(
            (): FetchInterfacePagesResult => ({ ok: false, reason: "transport" }),
          )
        : null;

    // 2c. MCP automations capture (workflows-mcp-automations) — the automation
    // twin of 2b: same concurrency, same gating shape, same failure isolation.
    // The two captures are independent — either can fail without touching the
    // other or the run.
    const captureAutomations =
      input.automationsEnabled === true && !!deps.syncSchema;
    const automationCapturePromise: Promise<FetchAutomationsResult> | null =
      captureAutomations
        ? (deps.fetchAutomations ??
            ((a: { baseId: string; accessToken: string }) =>
              fetchAutomations({ ...a, fetchImpl: fetchFn })))({
            baseId: input.atBaseId,
            accessToken,
          }).catch(
            (): FetchAutomationsResult => ({ ok: false, reason: "transport" }),
          )
        : null;

    // 3. Schema.
    const client: AirtableClientShape =
      deps.airtableClient ??
      createAirtableClient({ accessToken, fetchImpl: fetchFn });
    const schema = await client.getBaseSchema(input.atBaseId);

    // 3b. MCP views capture (workflows-mcp-views) — the third capture kind.
    // Unlike 2b/2c it needs the table ids, so it starts right AFTER the schema
    // fetch (the MCP view tool is per-table — spike 2026-07-27) and runs
    // concurrently with the interface/automation awaits below, landing before
    // the schema-sync POST it rides. Table ids are the FULL schema's tables —
    // matching the schema-sync body (which also sends all tables) so a
    // successful capture is a full sighting server-side. Same gating shape
    // ('mcp' mode + syncSchema wired) and the same failure isolation: the
    // client never throws, the defensive .catch covers injected fakes, and no
    // failure mode may touch the backup outcome. 'rest'/'off'/absent → zero
    // MCP view calls ('rest' runs behave exactly as before this change).
    const captureViews =
      input.viewCaptureMode === "mcp" && !!deps.syncSchema;
    const viewsCapturePromise: Promise<FetchViewsResult> | null = captureViews
      ? (deps.fetchViews ??
          ((a: { baseId: string; tableIds: string[]; accessToken: string }) =>
            fetchViews({ ...a, fetchImpl: fetchFn })))({
          baseId: input.atBaseId,
          tableIds: schema.tables.map((t) => t.id),
          accessToken,
        }).catch((): FetchViewsResult => ({ ok: false, reason: "transport" }))
      : null;

    // 4. Trial gate on table count.
    const trialTruncated =
      input.isTrial && schema.tables.length > TRIAL_TABLE_CAP;
    const tables = trialTruncated
      ? schema.tables.slice(0, TRIAL_TABLE_CAP)
      : schema.tables;

    // 4b. Per-Space DB schema sync (engine-brokered). Send the FULL base schema
    // — getBaseSchema enumerates every table, so this is a confident capture —
    // and learn whether the Space stores records, so we know to follow up with
    // /records-sync per table. Skipped when the dep is absent (static-only).
    let recordsEnabled = false;
    let perSpaceBaseRunId: string | null = null;
    // Await the concurrent MCP capture just before the schema-sync it rides.
    // Success → the raw envelope is attached as the optional `interfacePages`
    // field; any failure → the field is OMITTED (never partial, never empty)
    // and the outcome is reported on the task result instead.
    let interfacePagesField: { capturedAt: string; raw: unknown } | undefined;
    let interfacePagesOutcome: BackupBaseResult["interfacePages"];
    if (interfaceCapturePromise) {
      const capture = await interfaceCapturePromise;
      if (capture.ok) {
        interfacePagesField = { capturedAt: capture.capturedAt, raw: capture.raw };
      }
      interfacePagesOutcome = mcpCaptureOutcome(capture);
    }
    let automationsField: { capturedAt: string; raw: unknown } | undefined;
    let automationsOutcome: BackupBaseResult["automations"];
    if (automationCapturePromise) {
      const capture = await automationCapturePromise;
      if (capture.ok) {
        automationsField = { capturedAt: capture.capturedAt, raw: capture.raw };
      }
      automationsOutcome = mcpCaptureOutcome(capture);
    }
    let viewsField: ViewsCapture | undefined;
    let viewsOutcome: BackupBaseResult["views"];
    if (viewsCapturePromise) {
      const capture = await viewsCapturePromise;
      if (capture.ok) {
        viewsField = capture.capture;
      }
      viewsOutcome = mcpCaptureOutcome(capture);
    }
    if (deps.syncSchema) {
      const captured: CapturedBaseWire = {
        baseId: input.atBaseId,
        name: input.baseName,
        description: null,
        tables: schema.tables.map((t) => ({
          tableId: t.id,
          name: t.name,
          primaryFieldId: t.primaryFieldId,
          fieldCount: t.fields.length,
          recordCount: null,
          description: t.description ?? null,
          fields: t.fields.map((f) => ({
            fieldId: f.id,
            name: f.name,
            type: f.type,
            options: f.options ?? null,
            isPrimary: f.id === t.primaryFieldId,
            description: f.description ?? null,
          })),
          views: (t.views ?? []).map((v) => ({
            viewId: v.id,
            name: v.name,
            type: v.type ?? null,
          })),
        })),
      };
      const sync = await deps.syncSchema(
        captured,
        true,
        interfacePagesField,
        automationsField,
        viewsField,
      );
      if (sync) {
        recordsEnabled = sync.recordsEnabled;
        perSpaceBaseRunId = sync.baseRunId;
      }
    }

    // workflows-schema-only-backup: a schema run captures + syncs the base
    // structure only. Skip the record / CSV / attachment loop entirely and
    // report zero records/attachments with per-table field counts. The finally
    // block still unlocks the connection.
    if (isSchemaOnly) {
      return {
        status: trialTruncated ? "trial_truncated" : "succeeded",
        tablesProcessed: tables.length,
        recordsProcessed: 0,
        attachmentsProcessed: 0,
        tableDetail: tables.map((t) => ({
          tableId: t.id,
          tableName: t.name,
          recordCount: 0,
          fieldCount: t.fields.length,
          attachmentCount: 0,
        })),
        ...(interfacePagesOutcome ? { interfacePages: interfacePagesOutcome } : {}),
        ...(automationsOutcome ? { automations: automationsOutcome } : {}),
        ...(viewsOutcome ? { views: viewsOutcome } : {}),
      };
    }

    // 5. Per table.
    for (const table of tables) {
      const fieldNames = table.fields.map((f) => f.name);
      const fieldTypes = new Map<string, string>(
        table.fields.map((f) => [f.name, f.type]),
      );
      // Field IDs are needed for the attachment composite ID (PRD §2.8).
      const fieldIds = new Map<string, string>(
        table.fields.map((f) => [f.name, f.id]),
      );

      const collected: AirtableRecordsPage["records"] = [];
      let offset: string | undefined = undefined;
      // True when the trial cap truncated THIS table's records → the per-Space
      // record sync for this table is a partial capture (confident=false), so
      // absent records must NOT be marked deleted.
      let cappedHere = false;
      for (;;) {
        const page = await client.listRecords(input.atBaseId, table.id, {
          offset,
          // Decision 1: commentCount rides the existing listing pass — array
          // form, zero-inclusive (workflows-comments spike 2026-07-27).
          // Disabled runs request NO comment metadata (spec scenario).
          ...(captureComments ? { recordMetadata: ["commentCount"] } : {}),
        });
        collected.push(...page.records);

        // 6. Trial cap on cumulative records.
        if (
          input.isTrial &&
          recordsProcessed + collected.length >= TRIAL_RECORD_CAP
        ) {
          const room = TRIAL_RECORD_CAP - recordsProcessed;
          collected.length = room;
          trialComplete = true;
          cappedHere = true;
          break;
        }
        offset = page.offset;
        if (!offset) break;
      }

      const rows: Record<string, unknown>[] = [];
      for (const rec of collected) {
        // Collect the observed comment counts during the existing pass —
        // trial-trimmed records were spliced out of `collected` above, so
        // only records this run actually captured are observed.
        if (captureComments) {
          const count = typeof rec.commentCount === "number" ? rec.commentCount : 0;
          if (count > 0) {
            observedCommented.push({ recordId: rec.id, tableId: table.id, commentCount: count });
          } else {
            observedZero.set(rec.id, table.id);
          }
        }
        const out: Record<string, unknown> = {};
        for (const name of fieldNames) {
          const type = fieldTypes.get(name) ?? "";
          const value = rec.fields[name];
          if (
            attachmentDownloader &&
            type === ATTACHMENTS_FIELD_TYPE &&
            Array.isArray(value)
          ) {
            // Download (or dedup-skip) each attachment; the cell holds the
            // semicolon-joined storage keys instead of "[N attachments]".
            const cellResult = await attachmentDownloader.processCell(
              value as AirtableAttachment[],
              {
                baseId: input.atBaseId,
                tableId: table.id,
                recordId: rec.id,
                fieldId: fieldIds.get(name) ?? "",
              },
            );
            out[name] = cellResult.keys.join(";");
            attachmentsProcessed += cellResult.downloaded;
            // Media-metadata tap (workflows-media-metadata Decision 1):
            // emission fires per processed attachment — writes AND
            // dedup-skips (a skip is a new ref on an existing asset).
            // Injected downloader fakes without metadata emit nothing.
            if (mediaEmitter && cellResult.attachments) {
              for (const m of cellResult.attachments) {
                const storage = mediaStorageFor(input.storageType, m.storageKey);
                mediaEmitter.attachment(
                  { recordId: rec.id, tableId: table.id },
                  {
                    attachmentId: m.attachmentId,
                    fieldId: fieldIds.get(name) ?? "",
                    filename: m.filename,
                    checksum: m.checksum,
                    ...(m.contentType !== undefined ? { contentType: m.contentType } : {}),
                    ...(m.sizeBytes !== undefined ? { sizeBytes: m.sizeBytes } : {}),
                    ...(storage ? { storage } : {}),
                  },
                );
              }
            }
          } else {
            out[name] = normalizeFieldValue(value, type);
          }
        }
        rows.push(out);
        // This record's attachment cells are all processed — mark it complete
        // for the media batcher (deletion safety: `complete` only after ALL
        // of the record's attachments finished). No-op for records that
        // emitted nothing. Never throws.
        if (mediaEmitter) await mediaEmitter.recordDone(rec.id);
      }

      const csv = pageToCsv({ fields: fieldNames, rows });
      const key = buildR2Key({
        orgSlug: input.orgSlug,
        spaceName: input.spaceName,
        baseName: input.baseName,
        runStartedAt: input.runStartedAt,
        tableName: table.name,
      });

      await (deps.writeCsv ?? ((k, c) => writer.writeCsv(k, c)))(key, csv);

      // Phase 10d: fire-and-forget progress event after the table CSV lands
      // on disk. Bumps backup_runs.{record_count,table_count} so the
      // frontend's poll picks up live counts before /complete writes the
      // final totals. Wrapped in try/catch as belt-and-braces; the
      // wrapper's helper already swallows transport errors.
      if (deps.postProgress) {
        try {
          await deps.postProgress({
            recordsAppended: collected.length,
            tableCompleted: true,
          });
        } catch {
          // swallow — /complete is authoritative and will overwrite final totals
        }
      }

      // Per-Space DB record sync (engine-brokered EAV). Only when the Space
      // stores records and the schema sync established a base-run. Sends raw
      // Airtable cell values keyed by fieldId — the engine diffs vs the current
      // bo_at_record_field_data and writes cells + the superseded-value log.
      if (recordsEnabled && deps.syncRecords && perSpaceBaseRunId) {
        const records: CapturedRecordWire[] = collected.map((rec) => {
          const cells: Record<string, unknown> = {};
          for (const [name, val] of Object.entries(rec.fields)) {
            const fid = fieldIds.get(name);
            if (fid) cells[fid] = val;
          }
          return {
            recordId: rec.id,
            createdTime: rec.createdTime,
            modifiedTime: null,
            cells,
          };
        });
        await deps.syncRecords({
          baseId: input.atBaseId,
          tableId: table.id,
          records,
          confident: !cappedHere,
        });
      }

      // Accumulate per-table detail for the completion POST
      // (workflows-run-detail). attachmentCount is the delta of
      // attachmentsProcessed for this table's pass only. The snapshot is
      // appended here so trial-truncated runs still capture all processed tables.
      tableDetail.push({
        tableId: table.id,
        tableName: table.name,
        recordCount: collected.length,
        fieldCount: table.fields.length,
        attachmentCount: attachmentsProcessed - (tableDetail.reduce((s, t) => s + t.attachmentCount, 0)),
      });

      tablesProcessed += 1;
      recordsProcessed += collected.length;

      if (trialComplete) break;
    }

    // 5a. Media-metadata finish (workflows-media-metadata): flush the batch
    // remainder and settle the outcome. finish() never throws; the outcome
    // never touches the run status.
    const mediaOutcome: MediaCaptureOutcome | undefined = mediaEmitter
      ? await mediaEmitter.finish()
      : undefined;

    // 5b. Comment capture (workflows-comments) — sequenced AFTER the record /
    // attachment loop for the base (design Decision 3: core backup content
    // never queues behind comment chatter). Best-effort: runCommentCapture
    // never throws by construction, and the belt-and-braces catch keeps an
    // unexpected throw from an injected fake off the run outcome too.
    let commentsOutcome: BackupBaseResult["comments"];
    if (captureComments && deps.syncComments) {
      const fetchComments = deps.fetchRecordComments
        ? deps.fetchRecordComments
        : (a: { baseId: string; tableId: string; recordId: string; accessToken: string }) =>
            fetchRecordComments({ ...a, fetchImpl: fetchFn, sleepImpl: deps.sleepImpl });
      try {
        commentsOutcome = await runCommentCapture({
          baseId: input.atBaseId,
          accessToken,
          observedCommented,
          observedZero,
          planComments: deps.planComments,
          syncComments: deps.syncComments,
          fetchComments,
        });
      } catch {
        commentsOutcome = { status: "skipped", reason: "transport" };
      }
    }

    let status: BackupBaseStatus;
    if (trialComplete) status = "trial_complete";
    else if (trialTruncated) status = "trial_truncated";
    else status = "succeeded";

    return {
      status,
      tablesProcessed,
      recordsProcessed,
      attachmentsProcessed,
      tableDetail,
      ...(interfacePagesOutcome ? { interfacePages: interfacePagesOutcome } : {}),
      ...(automationsOutcome ? { automations: automationsOutcome } : {}),
      ...(viewsOutcome ? { views: viewsOutcome } : {}),
      ...(commentsOutcome ? { comments: commentsOutcome } : {}),
      ...(mediaOutcome ? { media: mediaOutcome } : {}),
    };
  } finally {
    if (locked) {
      // Best-effort. A failed unlock leaves the DO's alarm safety net to
      // clear the lock at LOCK_TTL_MS — see ConnectionDO.alarm().
      try {
        await postInternal(
          fetchFn,
          `${connBase}/unlock`,
          deps.internalToken,
          undefined,
        );
      } catch {
        // swallow; alarm will clean up
      }
    }
  }

  function failed(
    errorMessage: string,
    tables: number,
    records: number,
  ): BackupBaseResult {
    return {
      status: "failed",
      tablesProcessed: tables,
      recordsProcessed: records,
      attachmentsProcessed: 0,
      errorMessage,
    };
  }
}

type CommentCaptureOutcome = NonNullable<BackupBaseResult["comments"]>;

/**
 * The comment capture step (workflows-comments Decisions 1b/2/4), extracted
 * from runBackupBase for readability. Never throws.
 *
 * Flow: POST the observed counts to comments-plan → fetch ONLY the `refresh`
 * list → confirm zeroCandidates observed at count 0 as empty `complete`
 * captures (no fetch) → stream batches to comments-sync as the fan-out
 * progresses, marking each record `complete: true` only when its pagination
 * finished. Plan failure (throw) falls back to refreshing ALL observed
 * commented records; a plan `null` (space DB not ready) skips the capture.
 * Mid-fan-out failure flushes the already-finished records best-effort and
 * reports `partial` — delivered counts only reflect successful sync POSTs.
 */
async function runCommentCapture(args: {
  baseId: string;
  accessToken: string;
  observedCommented: { recordId: string; tableId: string; commentCount: number }[];
  observedZero: Map<string, string>;
  planComments: BackupBaseDeps["planComments"];
  syncComments: NonNullable<BackupBaseDeps["syncComments"]>;
  fetchComments: (a: {
    baseId: string;
    tableId: string;
    recordId: string;
    accessToken: string;
  }) => Promise<FetchRecordCommentsResult>;
}): Promise<CommentCaptureOutcome> {
  // 1. Plan (Decision 1b — count-delta skip). Equal counts cost zero fetches.
  let refreshIds: Set<string>;
  const zeroConfirms: { recordId: string; tableId: string }[] = [];
  let skippedByPlan = 0;
  if (args.planComments) {
    try {
      const plan = await args.planComments({
        baseId: args.baseId,
        records: args.observedCommented.map(({ recordId, commentCount }) => ({
          recordId,
          commentCount,
        })),
      });
      if (plan === null) {
        // Per-Space DB not ready (409/501) — comments-sync would fail too.
        return { status: "skipped", reason: "space_db_not_ready" };
      }
      refreshIds = new Set(plan.refresh);
      // Confirm only zeroCandidates this run actually saw listed at count 0;
      // unvisited/deleted records are not this feature's job.
      for (const recordId of plan.zeroCandidates) {
        const tableId = args.observedZero.get(recordId);
        if (tableId !== undefined) zeroConfirms.push({ recordId, tableId });
      }
      skippedByPlan = args.observedCommented.filter(
        (r) => !refreshIds.has(r.recordId),
      ).length;
    } catch {
      // Plan failure degrades to the pre-optimization behavior: refresh every
      // observed commented record. The optimization only ever reduces work.
      refreshIds = new Set(args.observedCommented.map((r) => r.recordId));
    }
  } else {
    refreshIds = new Set(args.observedCommented.map((r) => r.recordId));
  }

  // 2. Streamed fan-out (Decision 2) — shared with the incremental capture
  // step (_lib/record-comments.ts). Zero-confirms ride the FIRST batch.
  const toFetch = args.observedCommented.filter((r) => refreshIds.has(r.recordId));
  const outcome = await captureCommentsForRecords({
    toFetch: toFetch.map(({ recordId, tableId }) => ({ recordId, tableId })),
    seed: zeroConfirms.map(({ recordId, tableId }) => ({
      recordId,
      tableId,
      complete: true,
      comments: [],
    })),
    fetchComments: (ref) =>
      args.fetchComments({
        baseId: args.baseId,
        tableId: ref.tableId,
        recordId: ref.recordId,
        accessToken: args.accessToken,
      }),
    syncComments: (records) => args.syncComments({ baseId: args.baseId, records }),
  });
  return {
    ...outcome,
    skippedByPlan,
  };
}

interface StorageDestinationResponse {
  type: string;
  accessToken?: string;
  expiresAt?: string;
  providerFolderId?: string;
}

/**
 * Production fetcher for storage credentials. POSTs to the engine's internal
 * route with `x-internal-token` and shapes the response into the
 * StorageWriterCreds discriminated union. Returns null for `local_fs` (the
 * factory falls back to LocalFsWriter); throws on transport / engine errors
 * so the task wrapper's outer try/catch fails the run cleanly.
 *
 * Exported only for the wrapper to use the same shape in tests; the
 * production call site is via the optional dep `fetchStorageCreds` in
 * BackupBaseDeps.
 */
export async function defaultFetchStorageCreds(
  fetchFn: typeof fetch,
  engineBase: string,
  internalToken: string,
  spaceId: string,
  storageType: string,
): Promise<StorageWriterCreds | null> {
  const url = `${engineBase}/api/internal/spaces/${encodeURIComponent(spaceId)}/storage-destination`;
  // Pin every read to the run's enqueue-time storageType. A Space holds one
  // destination row per provider type (shared-multi-destinations); without
  // the pin, a mid-run primary swap could flip which creds come back between
  // the initial read and a ?refresh=1 re-read.
  const typeQuery = `type=${encodeURIComponent(storageType)}`;

  async function read(refresh: boolean): Promise<StorageDestinationResponse> {
    const target = refresh ? `${url}?refresh=1&${typeQuery}` : `${url}?${typeQuery}`;
    const res = await fetchFn(target, {
      method: "GET",
      headers: { "x-internal-token": internalToken },
    });
    if (!res.ok) {
      throw new Error(
        `engine storage-destination fetch ${res.status}`,
      );
    }
    return (await res.json()) as StorageDestinationResponse;
  }

  const initial = await read(false);
  if (initial.type === "local_fs") return null;
  if (
    (initial.type !== "google_drive" &&
      initial.type !== "box" &&
      initial.type !== "dropbox" &&
      initial.type !== "onedrive") ||
    !initial.accessToken ||
    !initial.expiresAt ||
    !initial.providerFolderId
  ) {
    throw new Error("engine storage-destination response is malformed");
  }
  const initialType = initial.type;
  const refresh = async () => {
    const refreshed = await read(true);
    // Engine never changes the provider mid-Space, so we pin to the type
    // observed on the first read. A mid-stream type flip indicates a bug
    // — treat as malformed.
    if (
      refreshed.type !== initialType ||
      !refreshed.accessToken ||
      !refreshed.expiresAt
    ) {
      throw new Error("engine storage-destination refresh malformed");
    }
    return {
      accessToken: refreshed.accessToken,
      expiresAt: new Date(refreshed.expiresAt),
    };
  };
  if (initialType === "google_drive") {
    return {
      kind: "google_drive",
      accessToken: initial.accessToken,
      expiresAt: new Date(initial.expiresAt),
      providerFolderId: initial.providerFolderId,
      refresh,
    };
  }
  if (initialType === "box") {
    return {
      kind: "box",
      accessToken: initial.accessToken,
      expiresAt: new Date(initial.expiresAt),
      providerFolderId: initial.providerFolderId,
      refresh,
    };
  }
  if (initialType === "dropbox") {
    return {
      kind: "dropbox",
      accessToken: initial.accessToken,
      expiresAt: new Date(initial.expiresAt),
      providerFolderId: initial.providerFolderId,
      refresh,
    };
  }
  // initialType === "onedrive"
  return {
    kind: "onedrive",
    accessToken: initial.accessToken,
    expiresAt: new Date(initial.expiresAt),
    providerFolderId: initial.providerFolderId,
    refresh,
  };
}
