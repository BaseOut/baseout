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
}

interface AirtableClientShape {
  getBaseSchema: (baseId: string) => Promise<AirtableSchema>;
  listRecords: (
    baseId: string,
    tableIdOrName: string,
    opts?: { offset?: string; pageSize?: number },
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
  ) => Promise<Record<string, { storageKey: string; uploadStatus: string }>>;
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
  ) => Promise<{ recordsEnabled: boolean; baseRunId: string } | null>;
  syncRecords?: (args: {
    baseId: string;
    tableId: string;
    records: CapturedRecordWire[];
    confident: boolean;
  }) => Promise<void>;
}

export type BackupBaseStatus =
  | "succeeded"
  | "trial_truncated"
  | "trial_complete"
  | "failed";

export interface BackupBaseResult {
  status: BackupBaseStatus;
  tablesProcessed: number;
  recordsProcessed: number;
  attachmentsProcessed: number;
  errorMessage?: string;
}

const TRIAL_TABLE_CAP = 5;
const TRIAL_RECORD_CAP = 1000;
const LOCK_RETRY_INTERVAL_MS = 5_000;
const LOCK_MAX_TOTAL_MS = 60_000;

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
  const r2CredsRaw =
    input.storageType === "r2_managed" ? deps.getR2Creds?.() ?? null : null;
  if (input.storageType === "r2_managed" && !r2CredsRaw) {
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
  // Resolve cloud-storage credentials before constructing the writer. The
  // engine internal route decrypts + lazy-refreshes the access token; we
  // pass a refresh closure that re-hits the same route with `?refresh=1`
  // for mid-upload 401 retries.
  let storageCreds: StorageWriterCreds | null = null;
  // Only providers that need decrypted credentials trigger the engine
  // fetch. `local_fs` doesn't. `r2_managed` uses app-level env creds via
  // getR2Creds (not the engine route).
  if (
    input.storageType === "google_drive" ||
    input.storageType === "box" ||
    input.storageType === "dropbox" ||
    input.storageType === "onedrive"
  ) {
    const fetchCreds =
      deps.fetchStorageCreds ??
      ((spaceId: string) =>
        defaultFetchStorageCreds(
          fetchFn,
          engineBase,
          deps.internalToken,
          spaceId,
        ));
    storageCreds = await fetchCreds(input.spaceId);
  } else if (input.storageType === "r2_managed") {
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

    // 3. Schema.
    const client: AirtableClientShape =
      deps.airtableClient ??
      createAirtableClient({ accessToken, fetchImpl: fetchFn });
    const schema = await client.getBaseSchema(input.atBaseId);

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
      const sync = await deps.syncSchema(captured, true);
      if (sync) {
        recordsEnabled = sync.recordsEnabled;
        perSpaceBaseRunId = sync.baseRunId;
      }
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
            const { keys, downloaded } = await attachmentDownloader.processCell(
              value as AirtableAttachment[],
              {
                baseId: input.atBaseId,
                tableId: table.id,
                recordId: rec.id,
                fieldId: fieldIds.get(name) ?? "",
              },
            );
            out[name] = keys.join(";");
            attachmentsProcessed += downloaded;
          } else {
            out[name] = normalizeFieldValue(value, type);
          }
        }
        rows.push(out);
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

      tablesProcessed += 1;
      recordsProcessed += collected.length;

      if (trialComplete) break;
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
): Promise<StorageWriterCreds | null> {
  const url = `${engineBase}/api/internal/spaces/${encodeURIComponent(spaceId)}/storage-destination`;

  async function read(refresh: boolean): Promise<StorageDestinationResponse> {
    const target = refresh ? `${url}?refresh=1` : url;
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
