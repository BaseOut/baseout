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
// Phase 8's POST /api/internal/runs/:runId/start handler is the canonical
// enqueue site: it joins backup_runs + connections + spaces + organizations +
// at_bases to assemble this payload before calling tasks.trigger("backup-base").

import { task } from "@trigger.dev/sdk";
import { runBackupBase } from "./backup-base";

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

export const backupBaseTask = task({
  id: "backup-base",
  maxDuration: 600,
  run: async (payload: BackupBaseTaskPayload) => {
    const engineUrl = process.env.BACKUP_ENGINE_URL;
    const internalToken = process.env.INTERNAL_TOKEN;
    if (!engineUrl) {
      throw new Error("BACKUP_ENGINE_URL is not set in the Trigger.dev env");
    }
    if (!internalToken) {
      throw new Error("INTERNAL_TOKEN is not set in the Trigger.dev env");
    }

    return runBackupBase(
      {
        ...payload,
        runStartedAt: new Date(payload.runStartedAt),
      },
      { engineUrl, internalToken },
    );
  },
});
