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
import { runBackupBase, type BackupBaseResult } from "./backup-base";

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
}

function trimSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
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

async function postCompletion(
  engineUrl: string,
  internalToken: string,
  runId: string,
  triggerRunId: string,
  atBaseId: string,
  result: BackupBaseResult,
): Promise<void> {
  const url = `${trimSlash(engineUrl)}/api/internal/runs/${encodeURIComponent(
    runId,
  )}/complete`;
  const body = {
    triggerRunId,
    atBaseId,
    status: result.status,
    tablesProcessed: result.tablesProcessed,
    recordsProcessed: result.recordsProcessed,
    attachmentsProcessed: result.attachmentsProcessed,
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
        },
        {
          engineUrl,
          internalToken,
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
      result,
    );

    return result;
  },
});
