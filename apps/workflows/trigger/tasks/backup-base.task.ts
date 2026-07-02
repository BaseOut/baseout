// Trigger.dev task wrapper for runBackupBase.
//
// The pure orchestration lives in ./backup-base.ts so tests can import it
// without pulling the Trigger.dev SDK into the workerd test isolate. This
// file is what Trigger.dev's runner picks up via the trigger.config.ts dirs
// scan; it converts the JSON-shaped payload back into the strongly-typed
// inputs runBackupBase expects, and reads engine URL + INTERNAL_TOKEN from
// process.env (the Trigger.dev runner is in Node, not workerd, so process.env
// is the canonical source).
//
// After runBackupBase returns, the wrapper POSTs the per-base result to
// /api/internal/runs/:runId/complete (Phase 8b). The triggerRunId is
// ctx.run.id — Trigger.dev's run ID — which the run-complete handler uses
// as the idempotency key (it lives in backup_runs.trigger_run_ids set by
// runs/start). Transport errors are swallowed per the plan: the
// ConnectionDO's lock alarm + Phase 11 reconciliation are the safety nets
// for missed completions.

import { task } from "@trigger.dev/sdk";
import {
  runBackupBase,
  type BackupBaseResult,
  type BackupTableDetail,
  type CapturedBaseWire,
  type CapturedRecordWire,
} from "./backup-base";
import type { AttachmentRecordEntry } from "./_lib/attachment-downloader";

export interface BackupBaseTaskPayload {
  runId: string;
  connectionId: string;
  atBaseId: string;
  isTrial: boolean;
  encryptedToken: string;
  orgSlug: string;
  spaceName: string;
  baseName: string;
  /** ISO-8601 string — Trigger.dev JSON-serializes payloads so Date is unsafe across the wire. */
  runStartedAt: string;
  /**
   * Selects the StorageWriter (Phase A of openspec/changes/shared-backup-run-delete).
   * Engine reads `storage_type` from backup_configurations and forwards it
   * here. Defaults to 'r2_managed' (legacy) at the engine boundary if the
   * column is null. When 'google_drive' (openspec/changes/shared-byos-drive),
   * the wrapper fetches decrypted creds from the engine before constructing
   * the writer. Unknown / missing values fall back to LocalFsWriter.
   */
  storageType: string;
  /**
   * Space ID — used by the workflows runner to fetch storage credentials
   * from the engine's `/api/internal/spaces/:spaceId/storage-destination`
   * route. Required for BYOS destinations; ignored for `local_fs`. Tokens
   * are NOT carried in the payload (Trigger.dev logs payloads in run
   * history); creds are fetched fresh at task start.
   */
  spaceId: string;
  /**
   * 'full' (default) or 'schema' — what to capture (server-backup-scope). A
   * 'schema' run skips records/attachments. The engine run-start forwards
   * backup_runs.kind here; flows into runBackupBase via the payload spread.
   */
  kind?: "full" | "schema";
}

function trimSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

// Managed-R2 creds come from app-level env on the Trigger.dev runner
// (openspec/changes/system-r2-revive) — NOT per-Space OAuth. Returns null
// when any var is unset so the pure function degrades to LocalFsWriter in
// dev; the hard guard below rejects an r2_managed run with missing creds.
function buildR2Creds():
  | {
      accountId: string;
      accessKeyId: string;
      secretAccessKey: string;
      bucket: string;
    }
  | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

// Phase 10d: per-table progress callback. Fires after each successful CSV
// upload so the frontend's history poll can render live counts before the
// final /complete call lands. Same x-internal-token + JSON shape as
// postCompletion; same fire-and-forget swallow on transport errors.
async function postProgress(
  engineUrl: string,
  internalToken: string,
  runId: string,
  triggerRunId: string,
  atBaseId: string,
  recordsAppended: number,
  tableCompleted: boolean,
): Promise<void> {
  const url = `${trimSlash(engineUrl)}/api/internal/runs/${encodeURIComponent(
    runId,
  )}/progress`;
  const body = {
    triggerRunId,
    atBaseId,
    recordsAppended,
    tableCompleted,
  };
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "x-internal-token": internalToken,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    // Fire-and-forget. /complete writes the authoritative final totals;
    // any missed progress event self-heals at end-of-run.
  }
}

// Attachment dedup engine callbacks (openspec/changes/workflows-attachments).
// Unlike progress/completion these are NOT fire-and-forget: the lookup result
// gates whether bytes are downloaded, and the record upsert is what makes the
// NEXT run dedup. A non-200 throws so the per-table page fails and the task's
// retry (or the next scheduled run, via the rows already recorded) re-attempts.
async function attachmentLookup(
  engineUrl: string,
  internalToken: string,
  spaceId: string,
  compositeIds: string[],
): Promise<Record<string, { storageKey: string; uploadStatus: string }>> {
  const url = `${trimSlash(engineUrl)}/api/internal/attachments/lookup`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-internal-token": internalToken,
      "content-type": "application/json",
    },
    body: JSON.stringify({ spaceId, compositeIds }),
  });
  // 409/501 = per-Space DB not provisioned / not managed_pg → degrade to
  // no-dedup (every attachment treated as a miss; still written to the
  // destination). Other non-2xx is a real error → throw so the task retries.
  if (res.status === 409 || res.status === 501) return {};
  if (!res.ok) {
    throw new Error(`attachments/lookup ${res.status}`);
  }
  const json = (await res.json()) as {
    hits?: Record<string, { storageKey: string; uploadStatus: string }>;
  };
  return json.hits ?? {};
}

async function attachmentRecord(
  engineUrl: string,
  internalToken: string,
  spaceId: string,
  entries: AttachmentRecordEntry[],
): Promise<void> {
  const url = `${trimSlash(engineUrl)}/api/internal/attachments/record`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-internal-token": internalToken,
      "content-type": "application/json",
    },
    body: JSON.stringify({ spaceId, entries }),
  });
  // 409/501 = per-Space DB not ready → the bytes are already at the destination;
  // we just skip recording dedup metadata (next run re-downloads). Other non-2xx
  // throws so the task retries.
  if (res.status === 409 || res.status === 501) return;
  if (!res.ok) {
    throw new Error(`attachments/record ${res.status}`);
  }
}

// Per-Space DB sync (openspec/changes/system-per-space-db §3, Option B). NOT
// fire-and-forget — these are the per-Space write path. A 409 (space DB not yet
// provisioned/active) or 501 (backend not managed_pg) returns null/void so the
// run still produces its CSV snapshot; any other non-2xx throws so the task
// retries.
async function syncSchema(
  engineUrl: string,
  internalToken: string,
  spaceId: string,
  backupRunId: string,
  captured: CapturedBaseWire,
  confident: boolean,
): Promise<{ recordsEnabled: boolean; baseRunId: string } | null> {
  const url = `${trimSlash(engineUrl)}/api/internal/spaces/${encodeURIComponent(spaceId)}/schema-sync`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "x-internal-token": internalToken, "content-type": "application/json" },
    body: JSON.stringify({ backupRunId, captured, confident }),
  });
  if (res.status === 409 || res.status === 501) return null;
  if (!res.ok) throw new Error(`schema-sync ${res.status}`);
  const json = (await res.json()) as { recordsEnabled: boolean; baseRunId: string };
  return { recordsEnabled: json.recordsEnabled, baseRunId: json.baseRunId };
}

async function syncRecords(
  engineUrl: string,
  internalToken: string,
  spaceId: string,
  backupRunId: string,
  args: { baseId: string; tableId: string; records: CapturedRecordWire[]; confident: boolean },
): Promise<void> {
  const url = `${trimSlash(engineUrl)}/api/internal/spaces/${encodeURIComponent(spaceId)}/records-sync`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "x-internal-token": internalToken, "content-type": "application/json" },
    body: JSON.stringify({ backupRunId, ...args }),
  });
  if (res.status === 409 || res.status === 501) return;
  if (!res.ok) throw new Error(`records-sync ${res.status}`);
}

async function postCompletion(
  engineUrl: string,
  internalToken: string,
  runId: string,
  triggerRunId: string,
  atBaseId: string,
  baseName: string,
  result: BackupBaseResult,
): Promise<void> {
  const url = `${trimSlash(engineUrl)}/api/internal/runs/${encodeURIComponent(
    runId,
  )}/complete`;
  const body: Record<string, unknown> = {
    triggerRunId,
    atBaseId,
    status: result.status,
    tablesProcessed: result.tablesProcessed,
    recordsProcessed: result.recordsProcessed,
    attachmentsProcessed: result.attachmentsProcessed,
    ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}),
  };
  // workflows-run-detail: include per-table detail when the pure function
  // accumulated it (succeeded / trial_* paths). The server handler treats
  // these fields as optional — absent on early-exit failed paths (e.g.
  // lock_unavailable) — so we spread conditionally to preserve additive
  // contract.
  if (result.tableDetail) {
    body.baseName = baseName;
    body.tables = result.tableDetail.map((t: BackupTableDetail) => ({
      tableId: t.tableId,
      tableName: t.tableName,
      recordCount: t.recordCount,
      fieldCount: t.fieldCount,
      attachmentCount: t.attachmentCount,
    }));
  }
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "x-internal-token": internalToken,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    // Fire-and-forget. The DO alarm + Phase 11 reconciliation will catch
    // missed completions if the POST fails transport-wise.
  }
}

export const backupBaseTask = task({
  id: "backup-base",
  maxDuration: 600,
  run: async (payload: BackupBaseTaskPayload, { ctx }) => {
    const engineUrl = process.env.BACKUP_ENGINE_URL;
    const internalToken = process.env.INTERNAL_TOKEN;
    if (!engineUrl) {
      throw new Error("BACKUP_ENGINE_URL is not set in the Trigger.dev env");
    }
    if (!internalToken) {
      throw new Error("INTERNAL_TOKEN is not set in the Trigger.dev env");
    }

    // Managed R2 requires app-level S3-API creds in the runner env. The
    // r2_managed-without-creds guard now lives inside runBackupBase
    // (returns a structured `failed` result rather than throwing), so the
    // outer try/catch + postCompletion sequence below handles it identically
    // to any other startup failure. Removing the duplicate throw closes the
    // 2026-06-09 silent-hang bug where a pre-try throw caused the engine's
    // backup_runs row to stay status='running' forever.
    const r2Creds = buildR2Creds();

    // Wrap runBackupBase in try/catch so an unexpected throw (Airtable 401,
    // network reset, R2 proxy failure, etc.) still surfaces to the master
    // DB row via postCompletion. Without this, a throw inside the task body
    // leaves backup_runs.status='running' forever — the DO lock alarm
    // releases the ConnectionDO lock, but no other observer flips the run
    // status. Phase 11 reconciliation was the planned safety net; this
    // catch is the cheaper interim mitigation.
    let result: BackupBaseResult;
    try {
      result = await runBackupBase(
        {
          ...payload,
          runStartedAt: new Date(payload.runStartedAt),
          storageType: payload.storageType,
        },
        {
          engineUrl,
          internalToken,
          getR2Creds: () => r2Creds,
          attachmentLookup: (spaceId, compositeIds) =>
            attachmentLookup(engineUrl, internalToken, spaceId, compositeIds),
          attachmentRecord: (spaceId, entries) =>
            attachmentRecord(engineUrl, internalToken, spaceId, entries),
          postProgress: (event) =>
            postProgress(
              engineUrl,
              internalToken,
              payload.runId,
              ctx.run.id,
              payload.atBaseId,
              event.recordsAppended,
              event.tableCompleted,
            ),
          syncSchema: (captured, confident) =>
            syncSchema(
              engineUrl,
              internalToken,
              payload.spaceId,
              payload.runId,
              captured,
              confident,
            ),
          syncRecords: (args) =>
            syncRecords(
              engineUrl,
              internalToken,
              payload.spaceId,
              payload.runId,
              args,
            ),
        },
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      result = {
        status: "failed",
        tablesProcessed: 0,
        recordsProcessed: 0,
        attachmentsProcessed: 0,
        errorMessage,
      };
    }

    await postCompletion(
      engineUrl,
      internalToken,
      payload.runId,
      ctx.run.id,
      payload.atBaseId,
      payload.baseName,
      result,
    );

    return result;
  },
});
