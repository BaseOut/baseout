// Backup-one-base orchestration. Extracted as a pure async function so it
// can be unit-tested without the Trigger.dev runtime — the wrapper in
// backup-base.task.ts (TODO Phase 7 sub-D) instantiates real deps and calls
// this.
//
// Flow (Phase 7.2 of the Backups MVP plan):
//   1. POST /api/internal/connections/:connectionId/lock — retry every 5s up
//      to 60s; on persistent 409 → status='failed' / lock_unavailable.
//   2. POST /api/internal/connections/:connectionId/token { encryptedToken }
//      → plaintext access token (DO caches; this proxy hop is what makes the
//      Node-side task able to reach the DO at all).
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
import { buildR2Key } from "./_lib/r2-path";
import { pageToCsv } from "./_lib/csv-stream";
import { normalizeFieldValue } from "./_lib/field-normalizer";
import {
  resolveStorageWriter,
  type StorageWriterCreds,
} from "./_lib/storage-writers";

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
  attachmentsProcessed: 0;
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
  // fetch. `local_fs` (and the legacy `r2_managed` default that maps to
  // local_fs in the factory) don't.
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
  }
  const writer = resolveStorageWriter(
    input.storageType,
    storageCreds ?? undefined,
  );

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

    // 5. Per table.
    for (const table of tables) {
      const fieldNames = table.fields.map((f) => f.name);
      const fieldTypes = new Map<string, string>(
        table.fields.map((f) => [f.name, f.type]),
      );

      const collected: AirtableRecordsPage["records"] = [];
      let offset: string | undefined = undefined;
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
          break;
        }
        offset = page.offset;
        if (!offset) break;
      }

      const rows = collected.map((rec) => {
        const out: Record<string, unknown> = {};
        for (const name of fieldNames) {
          out[name] = normalizeFieldValue(
            rec.fields[name],
            fieldTypes.get(name) ?? "",
          );
        }
        return out;
      });

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
      attachmentsProcessed: 0,
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
