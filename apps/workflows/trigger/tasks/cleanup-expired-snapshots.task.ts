// Trigger.dev v3 scheduled-task wrapper for cleanup-expired-snapshots
// (openspec/changes/workflows-retention-and-cleanup).
//
// Hourly cron. The pure orchestration lives in ./cleanup-expired-snapshots.ts
// so tests import it without pulling the Trigger.dev SDK. This file is what the
// runner picks up via trigger.config.ts `dirs`. It reads BACKUP_ENGINE_URL +
// INTERNAL_TOKEN from process.env, fetches the delete plan from the engine,
// deletes each planned run's storage prefixes via a real StorageWriter, and
// posts the outcome back so the engine soft-deletes the confirmed rows.
//
// Emits the structured pass summary as the task's return value (Trigger.dev
// logs it); the engine logs `event: 'backup_cleanup_pass'` on the
// cleanup-complete write. No per-run progress callbacks — the sweep is short.
//
// Storage-writer resolution mirrors delete-run-files.task.ts: resolveStorageWriter
// is called WITHOUT per-Space creds, so it returns LocalFsWriter for the MVP
// (backups currently write to local disk; R2 binding was removed in 8fc1f61).
// When the run-delete path gains R2/BYOS credential passing (tracked alongside
// the R2 revival + a future orphan-sweep change), this task adopts the same.

import { schedules } from "@trigger.dev/sdk";
import { resolveStorageWriter } from "./_lib/storage-writers";
import {
  runCleanupSweep,
  type CleanupCompletion,
  type CleanupPlan,
} from "./cleanup-expired-snapshots";

function trimSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

async function fetchPlan(
  engineUrl: string,
  internalToken: string,
): Promise<CleanupPlan> {
  const res = await fetch(`${trimSlash(engineUrl)}/api/internal/cleanup-plan`, {
    method: "POST",
    headers: {
      "x-internal-token": internalToken,
      accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`cleanup-plan returned ${res.status}`);
  }
  return (await res.json()) as CleanupPlan;
}

async function postComplete(
  engineUrl: string,
  internalToken: string,
  completed: CleanupCompletion[],
): Promise<void> {
  const res = await fetch(
    `${trimSlash(engineUrl)}/api/internal/cleanup-complete`,
    {
      method: "POST",
      headers: {
        "x-internal-token": internalToken,
        "content-type": "application/json",
      },
      body: JSON.stringify({ completed }),
    },
  );
  if (!res.ok) {
    throw new Error(`cleanup-complete returned ${res.status}`);
  }
}

export const cleanupExpiredSnapshotsTask = schedules.task({
  id: "cleanup-expired-snapshots",
  cron: "0 * * * *", // hourly — worst-case skew between a policy edit and a prune is ≤1h
  run: async () => {
    const engineUrl = process.env.BACKUP_ENGINE_URL;
    const internalToken = process.env.INTERNAL_TOKEN;
    if (!engineUrl) {
      throw new Error("BACKUP_ENGINE_URL is not set in the Trigger.dev env");
    }
    if (!internalToken) {
      throw new Error("INTERNAL_TOKEN is not set in the Trigger.dev env");
    }

    return runCleanupSweep({
      fetchPlan: () => fetchPlan(engineUrl, internalToken),
      resolveWriter: (storageType) => resolveStorageWriter(storageType),
      postComplete: (completed) =>
        postComplete(engineUrl, internalToken, completed),
    });
  },
});
