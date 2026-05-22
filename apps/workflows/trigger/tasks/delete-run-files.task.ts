// Trigger.dev task wrapper for delete-run-files (Phase C.5 of
// openspec/changes/shared-backup-run-delete).
//
// The pure orchestration lives in ./delete-run-files.ts so tests can import
// it without pulling the Trigger.dev SDK into the workerd test isolate.
// This file is what Trigger.dev's runner picks up via the trigger.config.ts
// dirs scan; it reads BACKUP_ENGINE_URL + INTERNAL_TOKEN from process.env,
// resolves a real StorageWriter via the factory, and posts the per-prefix
// outcome to /api/internal/runs/:runId/delete-complete.

import { task } from "@trigger.dev/sdk";
import { resolveStorageWriter } from "./_lib/storage-writers";
import {
  runDeleteRunFiles,
  type DeleteCompleteBody,
  type DeleteRunFilesPayload,
} from "./delete-run-files";

export type { DeleteRunFilesPayload };

function trimSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

async function postDeleteComplete(
  engineUrl: string,
  internalToken: string,
  body: DeleteCompleteBody,
): Promise<void> {
  const url = `${trimSlash(engineUrl)}/api/internal/runs/${encodeURIComponent(
    body.runId,
  )}/delete-complete`;
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
    // Fire-and-forget on transport errors. The row stays in 'deleting'
    // and the future server-retention-orphan-sweep change handles
    // reconciliation. For MVP, an operator reconciles via SQL.
  }
}

export const deleteRunFilesTask = task({
  id: "delete-run-files",
  maxDuration: 60,
  run: async (payload: DeleteRunFilesPayload) => {
    const engineUrl = process.env.BACKUP_ENGINE_URL;
    const internalToken = process.env.INTERNAL_TOKEN;
    if (!engineUrl) {
      throw new Error("BACKUP_ENGINE_URL is not set in the Trigger.dev env");
    }
    if (!internalToken) {
      throw new Error("INTERNAL_TOKEN is not set in the Trigger.dev env");
    }

    return runDeleteRunFiles(payload, {
      writer: resolveStorageWriter(payload.storageType),
      postDeleteComplete: (body) =>
        postDeleteComplete(engineUrl, internalToken, body),
    });
  },
});
