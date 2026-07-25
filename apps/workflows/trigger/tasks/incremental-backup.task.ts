// Trigger.dev task wrapper for runIncrementalBackup
// (openspec/changes/workflows-instant-webhook task 1.1).
//
// The pure orchestration lives in ./incremental-backup.ts so tests import it
// without pulling the Trigger.dev SDK. This file is what the runner picks up
// via trigger.config.ts `dirs`; it adapts the JSON payload (enqueued by the
// SpaceDO poll tick — server-instant-webhook Phase C) into the pure module's
// deps and reads BACKUP_ENGINE_URL + INTERNAL_TOKEN from process.env.
//
// WIRED (contractually fixed engine routes):
//   - POST /api/internal/webhook-subscriptions/:id/context  (payloads auth:
//     Airtable webhook id ach…, decrypted Connection token, lastReconciledAt
//     anchor — none ride the task payload; payloads are logged in Trigger.dev
//     run history and tokens must never appear there)
//   - POST /api/internal/spaces/:spaceId/incremental-apply  (engine-brokered
//     per-space writes, op-dispatched — createIncrementalDbTransport)
//   - POST /api/internal/webhook-subscriptions/:id/cursor   (monotonic; 409 = replay, OK)
//   - POST /api/internal/webhook-subscriptions/:id/fallback (full-backup fallback)
//   - POST /api/internal/runs/:runId/complete               (standard run contract,
//     fire-and-forget, aggregating created/updated/deleted/reconciled counts)
//
// STILL OPEN (server-dynamic-mode 4.3–4.5 / design follow-ups):
//   - Payload polls + reconciliation paging hit Airtable directly with the
//     resolved token (the airtable client's own 429 backoff applies); routing
//     them through the per-Connection ConnectionDO gateway (shared 5 rps
//     per-base budget with snapshot backups) is not wired yet.
//   - viewCaptureEnabled stays default-false — the Enterprise view-capture
//     gate isn't enforced anywhere yet (system-per-space-db 8.2).

import { logger, task } from "@trigger.dev/sdk";
import {
  createEngineCallbacks,
  createIncrementalDbTransport,
  fetchSubscriptionContext,
  runIncrementalBackup,
  type IncrementalAirtable,
  type IncrementalBackupResult,
} from "./incremental-backup";
import { fetchPayloadsPage } from "./_lib/airtable-payloads";
import { createAirtableClient } from "./_lib/airtable-client";

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

    const log = (event: Record<string, unknown>) =>
      logger.info("incremental-backup", event);

    let result: IncrementalBackupResult;
    try {
      // Payloads auth + reconciliation anchor — resolved per run, never
      // carried in the task payload. Throws on 409 token_unavailable (dead /
      // pending_reauth Connection): the catch below posts a failed completion
      // and the next poll tick retries.
      const context = await fetchSubscriptionContext({
        engineUrl,
        internalToken,
        subscriptionId: payload.subscriptionId,
      });

      const db = createIncrementalDbTransport({
        engineUrl,
        internalToken,
        spaceId: payload.spaceId,
        baseId: payload.baseId,
      });

      // Direct Airtable access with the resolved token. The shared client
      // owns 429/5xx backoff; ConnectionDO-gateway routing is a flagged
      // follow-up (see module header).
      const client = createAirtableClient({ accessToken: context.accessToken });
      const airtable: IncrementalAirtable = {
        fetchPayloadsPage: (cursor) =>
          fetchPayloadsPage({
            baseId: payload.baseId,
            webhookId: context.airtableWebhookId,
            cursor,
            accessToken: context.accessToken,
            log,
          }),
        getBaseSchema: () => client.getBaseSchema(payload.baseId),
        listRecordsPage: (tableId, opts) =>
          client.listRecords(payload.baseId, tableId, opts),
      };

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
          airtable,
          db,
          engine,
          log,
          lastReconciledAt: context.lastReconciledAt,
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
