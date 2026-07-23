// Trigger.dev task wrapper for runIncrementalBackup
// (openspec/changes/workflows-instant-webhook task 1.1).
//
// The pure orchestration lives in ./incremental-backup.ts so tests import it
// without pulling the Trigger.dev SDK. This file is what the runner picks up
// via trigger.config.ts `dirs`; it adapts the JSON payload (enqueued by the
// SpaceDO poll tick — server-instant-webhook Phase C) into the pure module's
// deps and reads BACKUP_ENGINE_URL + INTERNAL_TOKEN from process.env.
//
// WIRED TODAY (contractually fixed routes):
//   - POST /api/internal/webhook-subscriptions/:id/cursor   (monotonic; 409 = replay, OK)
//   - POST /api/internal/webhook-subscriptions/:id/fallback (full-backup fallback)
//   - POST /api/internal/runs/:runId/complete               (standard run contract,
//     fire-and-forget, aggregating created/updated/deleted/reconciled counts)
//
// TODO(server-instant-webhook Phase D): the engine-brokered per-space write
// transport and the payloads-poll auth are NOT wired yet —
//   - IncrementalDb (openBaseRun / applySchemaEvents / applyRecordEvents /
//     getStoredRecords / insertSchemaVersion / getAppliedSchemaState /
//     regenerateViews / listStoredRecordIds / listTableIds) needs the engine's
//     incremental-apply internal routes (the engine brokers per-space writes,
//     Option B of system-per-space-db §3).
//   - IncrementalAirtable needs (a) the Airtable webhook id (ach…) for the
//     subscription and (b) a decrypted access token for the Connection — both
//     resolved via an engine internal route, since the task payload carries
//     neither (payloads are logged in Trigger.dev run history; tokens must
//     never ride in them). Payload polls + reconciliation paging must then go
//     through the per-Connection gateway (shared 5 rps per-base budget).
//   - The reconciliation anchor (subscription.last_reconciled_at) also comes
//     from that resolution step (deps.lastReconciledAt).
// Until Phase D lands, invoking any of those deps throws a descriptive error;
// the catch below posts a failed completion so the run never silently hangs.

import { logger, task } from "@trigger.dev/sdk";
import {
  createEngineCallbacks,
  runIncrementalBackup,
  type IncrementalAirtable,
  type IncrementalBackupResult,
  type IncrementalDb,
} from "./incremental-backup";

export interface IncrementalBackupTaskPayload {
  runId: string;
  spaceId: string;
  subscriptionId: string;
  baseId: string;
  connectionId: string;
  /** The subscription's payload_cursor at enqueue time. */
  cursor: number;
  /** True when last_reconciled_at exceeds the reconciliation cadence (default 7d). */
  reconcile: boolean;
}

function trimSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

// TODO(server-instant-webhook Phase D): replace with the real engine-brokered
// transports (see module header). Throwing keeps the failure loud + descriptive
// instead of silently writing nowhere.
function notYetWired(dep: string): never {
  throw new Error(
    `incremental-backup: ${dep} transport is not wired yet — lands with server-instant-webhook Phase D (engine-brokered per-space writes + payloads auth)`,
  );
}

const unwiredDb: IncrementalDb = {
  openBaseRun: async () => notYetWired("db.openBaseRun"),
  completeBaseRun: async () => notYetWired("db.completeBaseRun"),
  applySchemaEvents: async () => notYetWired("db.applySchemaEvents"),
  applyRecordEvents: async () => notYetWired("db.applyRecordEvents"),
  getStoredRecords: async () => notYetWired("db.getStoredRecords"),
  insertSchemaVersion: async () => notYetWired("db.insertSchemaVersion"),
  getAppliedSchemaState: async () => notYetWired("db.getAppliedSchemaState"),
  regenerateViews: async () => notYetWired("db.regenerateViews"),
  listStoredRecordIds: async () => notYetWired("db.listStoredRecordIds"),
  listTableIds: async () => notYetWired("db.listTableIds"),
};

const unwiredAirtable: IncrementalAirtable = {
  fetchPayloadsPage: async () => notYetWired("airtable.fetchPayloadsPage"),
  getBaseSchema: async () => notYetWired("airtable.getBaseSchema"),
  listRecordsPage: async () => notYetWired("airtable.listRecordsPage"),
};

// Standard run-contract completion (mirrors backup-base.task.ts postCompletion):
// fire-and-forget — the run-row state machine + run reconciliation are the
// safety nets for a missed POST. Aggregates the incremental counts the spec
// requires (created/updated/deleted/reconciled_records).
async function postCompletion(
  engineUrl: string,
  internalToken: string,
  payload: IncrementalBackupTaskPayload,
  triggerRunId: string,
  result: IncrementalBackupResult,
): Promise<void> {
  const url = `${trimSlash(engineUrl)}/api/internal/runs/${encodeURIComponent(
    payload.runId,
  )}/complete`;
  const body = {
    triggerRunId,
    atBaseId: payload.baseId,
    status: result.status,
    created: result.created,
    updated: result.updated,
    deleted: result.deleted,
    reconciledRecords: result.reconciledRecords,
    driftCount: result.driftCount,
    finalCursor: result.finalCursor,
    ...(result.fallbackReason ? { fallbackReason: result.fallbackReason } : {}),
    ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}),
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
    // Fire-and-forget; the engine's run reconciliation sweep self-heals.
  }
}

export const incrementalBackupTask = task({
  id: "incremental-backup",
  run: async (payload: IncrementalBackupTaskPayload, { ctx }) => {
    const engineUrl = process.env.BACKUP_ENGINE_URL;
    const internalToken = process.env.INTERNAL_TOKEN;
    if (!engineUrl) {
      throw new Error("BACKUP_ENGINE_URL is not set in the Trigger.dev env");
    }
    if (!internalToken) {
      throw new Error("INTERNAL_TOKEN is not set in the Trigger.dev env");
    }

    const engine = createEngineCallbacks({
      engineUrl,
      internalToken,
      subscriptionId: payload.subscriptionId,
    });

    let result: IncrementalBackupResult;
    try {
      result = await runIncrementalBackup(
        {
          runId: payload.runId,
          spaceId: payload.spaceId,
          subscriptionId: payload.subscriptionId,
          baseId: payload.baseId,
          connectionId: payload.connectionId,
          cursor: payload.cursor,
          reconcile: payload.reconcile,
        },
        {
          airtable: unwiredAirtable,
          db: unwiredDb,
          engine,
          log: (event) => logger.info("incremental-backup", event),
          // TODO(server-instant-webhook Phase D): lastReconciledAt +
          // viewCaptureEnabled resolved alongside the webhook id / token.
        },
      );
    } catch (err) {
      // Mirror backup-base.task.ts: an unexpected throw must still surface to
      // the master-DB run row via the completion POST, or the run stays
      // 'running' until the reconciliation sweep catches it.
      const errorMessage = err instanceof Error ? err.message : String(err);
      result = {
        status: "failed",
        created: 0,
        updated: 0,
        deleted: 0,
        reconciledRecords: 0,
        driftCount: 0,
        payloadsApplied: 0,
        reconcileRan: false,
        finalCursor: payload.cursor,
        errorMessage,
      };
    }

    await postCompletion(engineUrl, internalToken, payload, ctx.run.id, result);

    return result;
  },
});
