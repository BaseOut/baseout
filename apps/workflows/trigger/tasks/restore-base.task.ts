// Trigger.dev task wrapper for runRestoreBase.
//
// The pure orchestration lives in ./restore-base.ts so tests can import it
// without pulling the Trigger.dev SDK into the test isolate. This file is
// what Trigger.dev's runner picks up via the trigger.config.ts dirs scan.
//
// After runRestoreBase returns, the wrapper POSTs the per-base result to
// /api/internal/restores/:restoreId/complete on BOTH success and thrown-error
// branches. Transport errors in postCompletion are swallowed — the engine's
// reconciliation + lock alarm are the safety nets.
//
// DEFERRED STUB: The production `ensureRestoreTarget` dep throws
// `restore_target_creation_not_implemented`. This is intentional:
//   - Airtable base/table creation requires the Airtable Meta API (write-scope
//     OAuth), which is currently a separate follow-up change.
//   - A loud throw (not silent fallback) ensures any accidental real-run
//     attempts surface immediately rather than creating phantom records in a
//     wrong base.
//   - The full implementation will replace this stub once write-scope OAuth
//     and Meta API access land.

import { task } from "@trigger.dev/sdk";
import {
  runRestoreBase,
  type RestoreBaseResult,
  type RestoreBaseTaskPayload,
  type EnsureRestoreTargetOpts,
} from "./restore-base";
import { makeStorageReader } from "./_lib/storage-readers";
import { createRecords } from "./_lib/airtable-create";

export type { RestoreBaseTaskPayload };

function trimSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

/**
 * DEFERRED STUB — ensureRestoreTarget production implementation.
 *
 * Airtable Meta API base/table creation is gated behind write-scope OAuth
 * (a separate follow-up). Until that lands, a real restore run will fail
 * loudly here with a clear error code rather than silently writing into the
 * wrong base or creating corrupted data.
 *
 * When the Meta API follow-up lands, replace this stub with the real
 * implementation that:
 *   1. Creates a new Airtable base named `<originalName>-restored-<datetime>`
 *      via POST /v0/meta/bases (Meta API).
 *   2. Creates tables matching the source schema (POST /v0/meta/bases/:baseId/tables).
 *   3. Returns { targetBaseId, targetTableId } for the newly-created entities.
 */
async function ensureRestoreTargetStub(
  _opts: EnsureRestoreTargetOpts,
): Promise<{ targetBaseId: string; targetTableId: string }> {
  // This error code is checked by the engine's complete handler to surface a
  // user-facing "restore target creation not yet supported" message rather
  // than a generic failure.
  throw new Error("restore_target_creation_not_implemented");
}

// Per-restore progress callback. Mirrors postProgress from backup-base.task.ts.
async function postRestoreProgress(
  engineUrl: string,
  internalToken: string,
  restoreId: string,
  triggerRunId: string,
  atBaseId: string,
  recordsAppended: number,
  tableCompleted: boolean,
): Promise<void> {
  const url = `${trimSlash(engineUrl)}/api/internal/restores/${encodeURIComponent(restoreId)}/progress`;
  const body = { triggerRunId, atBaseId, recordsAppended, tableCompleted };
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
    // Fire-and-forget. /complete writes authoritative final totals.
  }
}

async function postCompletion(
  engineUrl: string,
  internalToken: string,
  restoreId: string,
  triggerRunId: string,
  atBaseId: string,
  result: RestoreBaseResult,
): Promise<void> {
  const url = `${trimSlash(engineUrl)}/api/internal/restores/${encodeURIComponent(restoreId)}/complete`;
  const body = {
    triggerRunId,
    atBaseId,
    status: result.status,
    tablesRestored: result.tablesRestored,
    recordsRestored: result.recordsRestored,
    attachmentsRestored: result.attachmentsRestored,
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
    // Fire-and-forget.
  }
}

export const restoreBaseTask = task({
  id: "restore-base",
  maxDuration: 600,
  run: async (payload: RestoreBaseTaskPayload, { ctx }) => {
    const engineUrl = process.env.BACKUP_ENGINE_URL;
    const internalToken = process.env.INTERNAL_TOKEN;
    if (!engineUrl) {
      throw new Error("BACKUP_ENGINE_URL is not set in the Trigger.dev env");
    }
    if (!internalToken) {
      throw new Error("INTERNAL_TOKEN is not set in the Trigger.dev env");
    }

    // Build the storage reader from the payload's storageType.
    // R2 managed creds come from app-level env (same as backup-base).
    const r2Creds = (() => {
      if (payload.storageType !== "r2_managed") return undefined;
      const accountId = process.env.R2_ACCOUNT_ID;
      const accessKeyId = process.env.R2_ACCESS_KEY_ID;
      const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
      const bucket = process.env.R2_BUCKET;
      if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return undefined;
      return { kind: "r2" as const, accountId, accessKeyId, secretAccessKey, bucket };
    })();
    const reader = makeStorageReader(payload.storageType, r2Creds);

    let result: RestoreBaseResult;
    try {
      result = await runRestoreBase(payload, {
        engineUrl,
        internalToken,
        reader,
        // DEFERRED STUB — see module-level comment.
        ensureRestoreTarget: ensureRestoreTargetStub,
        createRecords,
        postProgress: (event) =>
          postRestoreProgress(
            engineUrl,
            internalToken,
            payload.restoreId,
            ctx.run.id,
            payload.atBaseId,
            event.recordsAppended,
            event.tableCompleted,
          ),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      result = {
        status: "failed",
        tablesRestored: 0,
        recordsRestored: 0,
        attachmentsRestored: 0,
        errorMessage,
      };
    }

    await postCompletion(
      engineUrl,
      internalToken,
      payload.restoreId,
      ctx.run.id,
      payload.atBaseId,
      result,
    );

    return result;
  },
});
