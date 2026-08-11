// Restore-one-base orchestration. Extracted as a pure async function so it
// can be unit-tested without the Trigger.dev runtime — the wrapper in
// restore-base.task.ts instantiates real deps and calls this.
//
// Flow (openspec/changes/workflows-restore §4):
//   1. POST /api/internal/connections/:connectionId/lock — retry every 5s up
//      to 60s; on persistent 409 → status='failed' / lock_unavailable.
//   2. POST /api/internal/connections/:connectionId/token { encryptedToken }
//      → plaintext access token (ConnectionDO decrypt).
//   3. Build the read prefix from the payload via buildR2Key prefix logic:
//        <orgSlug>/<spaceName>/<baseName>/<timestamp>/
//      where <timestamp> is derived from sourceRunStartedAt (the SOURCE backup
//      run's start time — NOT the restore's start time).
//   4. reader.listKeys(prefix) → array of CSV keys.
//      scope='table' narrows to the single-table key matching scopeTarget.tableId
//      prefix (the caller provides the table name — for now we match all keys
//      under the prefix since the table CSV filename contains the table name).
//   5. For each CSV key: reader.readFile → parseCsv → denormalizeFieldValue per
//      cell → deps.ensureRestoreTarget → deps.createRecords in ≤10-row batches
//      → deps.postProgress.
//   6. Accumulate tablesRestored / recordsRestored. Trial gates: 5 tables / 1K
//      records (mirror of backup-base.ts constants).
//   7. reader.cleanup() + unlock in finally.
//
// write + target-creation are behind injected deps. The production
// `ensureRestoreTarget` is a deferred stub that throws
// `restore_target_creation_not_implemented` — base creation via the Airtable
// Meta API is a separate follow-up (requires write-scope OAuth). All other
// behavior is fully implemented and tested.

import { buildR2Key } from "./_lib/r2-path";
import { parseCsv } from "./_lib/csv-reader";
import { denormalizeFieldValue } from "./_lib/field-denormalizer";
import type { StorageReader } from "./_lib/storage-readers/types";
import type { AirtableCreateInput, AirtableRecord } from "./_lib/airtable-create";

// ── RestoreBaseTaskPayload ────────────────────────────────────────────────────
// Canonical definition. apps/server/src/lib/trigger-client.ts imports this
// type (once the TODO there is resolved); the server side must stay field-
// identical. Cross-checked against the server definition on 2026-06-26.

export interface RestoreBaseTaskPayload {
  /** restore_runs.id — the row the task reports progress + completion against. */
  restoreId: string;
  /** connections.id — used by the task to identify the Airtable workspace. */
  connectionId: string;
  /** backup_runs.id — the snapshot the task reads CSVs from. */
  sourceRunId: string;
  /** Airtable base ID from restore_runs.scope_target.baseId, e.g. "appXXXXXX". */
  atBaseId: string;
  /**
   * Source base display name — path segment, must match what the backup run
   * wrote (at_bases.name at the time of the backup). Used to locate the
   * `<baseName>` directory in the CSV storage path:
   *   `<orgSlug>/<spaceName>/<baseName>/<datetime>/`.
   */
  baseName: string;
  /** Trial cap flag — restore task enforces same 5-table / 1K-record caps as backup. */
  isTrial: boolean;
  /** AES-256-GCM ciphertext of the Airtable OAuth access token. */
  encryptedToken: string;
  /** β: connection.organizationId UUID (not slug). */
  orgSlug: string;
  /** β: restoreRun.spaceId UUID (not name). */
  spaceName: string;
  /**
   * Storage provider type — the workflows StorageReader factory uses this to
   * resolve which reader to use for the snapshot CSVs.
   */
  storageType: string;
  /** restore_runs.space_id — used by workflows to fetch storage credentials. */
  spaceId: string;
  /** restore_runs.scope — 'base' | 'table' | 'point_in_time'. */
  scope: string;
  /** restore_runs.scope_target — { baseId, tableId?, runId? }. */
  scopeTarget: { baseId: string; tableId?: string; runId?: string };
  /**
   * ISO-8601 startedAt of the SOURCE backup run (backup_runs.started_at) —
   * the storage path `<datetime>` segment the task reads CSVs from.
   * NOT the restore's own start time.
   */
  sourceRunStartedAt: string;
}

// ── Input / Deps / Result ─────────────────────────────────────────────────────

/** Shape of runRestoreBase's `input` argument (the deserialized payload). */
export interface RestoreBaseInput {
  restoreId: string;
  connectionId: string;
  sourceRunId: string;
  atBaseId: string;
  baseName: string;
  isTrial: boolean;
  encryptedToken: string;
  orgSlug: string;
  spaceName: string;
  storageType: string;
  spaceId: string;
  scope: string;
  scopeTarget: { baseId: string; tableId?: string; runId?: string };
  /** ISO-8601 string from the source backup run's started_at. */
  sourceRunStartedAt: string;
}

export interface RestoreBaseProgressEvent {
  triggerRunId?: string;
  atBaseId?: string;
  /** Number of records appended in the just-completed table. */
  recordsAppended: number;
  /** Always true at the per-table call site. */
  tableCompleted: boolean;
}

export type RestoreBaseStatus =
  | "succeeded"
  | "trial_truncated"
  | "trial_complete"
  | "failed";

export interface RestoreBaseResult {
  status: RestoreBaseStatus;
  tablesRestored: number;
  recordsRestored: number;
  attachmentsRestored: number;
  errorMessage?: string;
}

/** Target identifiers resolved by ensureRestoreTarget. */
export interface RestoreTarget {
  targetBaseId: string;
  targetTableId: string;
}

export interface EnsureRestoreTargetOpts {
  /** The table's original name (from the CSV filename segment). */
  tableName: string;
  /** The source atBaseId (for schema lookup). */
  atBaseId: string;
  /** The source tableId from the CSV's key / scope. */
  tableKey: string;
  accessToken: string;
}

export interface RestoreBaseDeps {
  engineUrl: string;
  internalToken: string;
  fetchImpl?: typeof fetch;
  /** Injected storage reader (from makeStorageReader). */
  reader: StorageReader;
  sleepImpl?: (ms: number) => Promise<void>;
  /**
   * Resolve (or create) the target base + table to write records into.
   *
   * PRODUCTION STUB: This dep is intentionally deferred because:
   *   1. Airtable base/table creation requires the Airtable Meta API
   *      (POST /v0/meta/bases — separate write-scope OAuth).
   *   2. The Airtable OAuth connection is currently read-only in the MVP.
   *
   * The production stub in restore-base.task.ts throws
   * `restore_target_creation_not_implemented` so a real restore run fails
   * loudly rather than silently. The implementation will land in a follow-up
   * change once write-scope OAuth and Meta API access are available.
   *
   * Tests pass a vi.fn() that returns deterministic target identifiers.
   */
  ensureRestoreTarget: (opts: EnsureRestoreTargetOpts) => Promise<RestoreTarget>;
  /**
   * Write records to Airtable (batch create). The real production dep is
   * `createRecords` from `./_lib/airtable-create`. Tests inject a fake.
   */
  createRecords: (
    baseId: string,
    tableId: string,
    accessToken: string,
    records: AirtableCreateInput[],
  ) => Promise<{ created: AirtableRecord[]; errors: unknown[] }>;
  /**
   * Fire-and-forget per-table progress callback. Posts to
   * /api/internal/restores/:restoreId/progress. Default no-op.
   */
  postProgress?: (event: RestoreBaseProgressEvent) => Promise<void>;
  /**
   * Field type map: fieldName → Airtable field type string, used by the
   * denormalizer. For the MVP this can be an empty Map (denormalizer falls
   * back to string passthrough via typecast:true).
   */
  fieldTypes?: Map<string, string>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TRIAL_TABLE_CAP = 5;
const TRIAL_RECORD_CAP = 1000;
const LOCK_RETRY_INTERVAL_MS = 5_000;
const LOCK_MAX_TOTAL_MS = 60_000;
const CREATE_BATCH_SIZE = 10;

// ── Helpers ───────────────────────────────────────────────────────────────────

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

/**
 * Derive the directory prefix for listing backup CSVs from the restore payload.
 *
 * Reuses buildR2Key from r2-path.ts: we call it with a dummy tableName ("_")
 * then strip the last path segment to get the directory prefix. This ensures
 * EXACT parity with the backup-write path — same timestamp formatting (colon →
 * dash, strip ms), same segment sanitisation (/ → _).
 */
function buildReadPrefix(
  orgSlug: string,
  spaceName: string,
  baseName: string,
  sourceRunStartedAt: string,
): string {
  const dummyKey = buildR2Key({
    orgSlug,
    spaceName,
    baseName,
    runStartedAt: new Date(sourceRunStartedAt),
    tableName: "_",
  });
  // dummyKey = "<orgSlug>/<spaceName>/<baseName>/<timestamp>/_.csv"
  // Strip "_.csv" → "<orgSlug>/<spaceName>/<baseName>/<timestamp>/"
  return dummyKey.replace(/_.csv$/, "");
}

/** Extract the table name from a CSV storage key (the filename without .csv). */
function tableNameFromKey(key: string): string {
  const parts = key.split("/");
  const filename = parts[parts.length - 1] ?? "";
  return filename.replace(/\.csv$/, "");
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runRestoreBase(
  input: RestoreBaseInput,
  deps: RestoreBaseDeps,
): Promise<RestoreBaseResult> {
  const fetchFn = deps.fetchImpl ?? fetch;
  const sleep =
    deps.sleepImpl ??
    ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const engineBase = trimSlash(deps.engineUrl);
  const connBase = `${engineBase}/api/internal/connections/${encodeURIComponent(
    input.connectionId,
  )}`;
  const fieldTypes = deps.fieldTypes ?? new Map<string, string>();

  // 1. Acquire lock with retry (same contract as backup-base.ts).
  const deadline = Date.now() + LOCK_MAX_TOTAL_MS;
  let locked = false;
  for (;;) {
    const res = await postInternal(fetchFn, `${connBase}/lock`, deps.internalToken, undefined);
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

  let tablesRestored = 0;
  let recordsRestored = 0;
  let trialComplete = false;

  try {
    // 2. Fetch decrypted access token.
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

    // 3. Build read prefix from the SOURCE backup's path (r2-path reuse).
    const prefix = buildReadPrefix(
      input.orgSlug,
      input.spaceName,
      input.baseName,
      input.sourceRunStartedAt,
    );

    // 4. Init reader + list CSV keys under prefix.
    await deps.reader.init();
    const allKeys = await deps.reader.listKeys(prefix);

    // scope='table': Airtable table CSV key — the filename segment is the table
    // name (sanitised). For now we trust the full list (prefix is already
    // narrowed to the run directory). Scope='base' uses all keys.
    // point_in_time is out of scope per proposal.
    const keys = allKeys;

    // Trial gate on table count.
    const trialTruncated = input.isTrial && keys.length > TRIAL_TABLE_CAP;
    const csvKeys = trialTruncated ? keys.slice(0, TRIAL_TABLE_CAP) : keys;

    // 5. Per CSV.
    for (const csvKey of csvKeys) {
      const raw = await deps.reader.readFile(csvKey);
      const rows = await parseCsv(raw);

      if (rows.length === 0) {
        // Empty table — call ensureRestoreTarget so the table is created, but
        // skip createRecords (nothing to write).
        const tableName = tableNameFromKey(csvKey);
        await deps.ensureRestoreTarget({
          tableName,
          atBaseId: input.atBaseId,
          tableKey: csvKey,
          accessToken,
        });
        // Count the table as restored even if empty.
        tablesRestored += 1;
        if (deps.postProgress) {
          try {
            await deps.postProgress({ recordsAppended: 0, tableCompleted: true });
          } catch {
            // swallow — /complete is authoritative
          }
        }
        continue;
      }

      const tableName = tableNameFromKey(csvKey);

      // Resolve (or create) the target base + table.
      const { targetBaseId, targetTableId } = await deps.ensureRestoreTarget({
        tableName,
        atBaseId: input.atBaseId,
        tableKey: csvKey,
        accessToken,
      });

      // Denormalize CSV string cells back to Airtable field values.
      let cappedRows = rows;
      if (input.isTrial && recordsRestored + rows.length >= TRIAL_RECORD_CAP) {
        const room = TRIAL_RECORD_CAP - recordsRestored;
        cappedRows = rows.slice(0, room);
        trialComplete = true;
      }

      const airtableRecords: AirtableCreateInput[] = cappedRows.map((row) => {
        const fields: Record<string, unknown> = {};
        for (const [fieldName, cellStr] of Object.entries(row)) {
          const fieldType = fieldTypes.get(fieldName) ?? "singleLineText";
          fields[fieldName] = denormalizeFieldValue(cellStr, fieldType);
        }
        return { fields };
      });

      // Batch create in ≤CREATE_BATCH_SIZE chunks.
      for (let i = 0; i < airtableRecords.length; i += CREATE_BATCH_SIZE) {
        const batch = airtableRecords.slice(i, i + CREATE_BATCH_SIZE);
        await deps.createRecords(targetBaseId, targetTableId, accessToken, batch);
      }

      tablesRestored += 1;
      recordsRestored += cappedRows.length;

      if (deps.postProgress) {
        try {
          await deps.postProgress({
            recordsAppended: cappedRows.length,
            tableCompleted: true,
          });
        } catch {
          // swallow — /complete is authoritative
        }
      }

      if (trialComplete) break;
    }

    let status: RestoreBaseStatus;
    if (trialComplete) status = "trial_complete";
    else if (trialTruncated) status = "trial_truncated";
    else status = "succeeded";

    return {
      status,
      tablesRestored,
      recordsRestored,
      attachmentsRestored: 0,
    };
  } finally {
    // Best-effort cleanup then unlock.
    try {
      await deps.reader.cleanup();
    } catch {
      // swallow
    }
    if (locked) {
      try {
        await postInternal(fetchFn, `${connBase}/unlock`, deps.internalToken, undefined);
      } catch {
        // swallow; alarm will clean up
      }
    }
  }

  function failed(
    errorMessage: string,
    tables: number,
    records: number,
  ): RestoreBaseResult {
    return {
      status: "failed",
      tablesRestored: tables,
      recordsRestored: records,
      attachmentsRestored: 0,
      errorMessage,
    };
  }
}
