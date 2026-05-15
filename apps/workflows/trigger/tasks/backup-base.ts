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
import { writeCsvToLocalDisk } from "./_lib/local-fs-write";

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

      await (deps.writeCsv ?? writeCsvToLocalDisk)(key, csv);

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
