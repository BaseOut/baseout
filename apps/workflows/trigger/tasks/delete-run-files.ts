// Pure-function orchestration for the delete-run-files Trigger.dev task
// (Phase C.5 of openspec/changes/shared-backup-run-delete).
//
// Iterates the per-base prefixes computed by the engine, calls
// StorageWriter.deletePrefix on each, accumulates per-prefix results, and
// POSTs the outcome to /api/internal/runs/:runId/delete-complete via the
// injected callback.
//
// Continues past per-prefix failures so partial cleanup completes even if
// one base's delete fails. The accumulated `ok` is true iff every prefix
// succeeded. On any failure the engine leaves the row in 'deleting' and
// logs the failure list — the future server-retention-orphan-sweep change
// will retry / escalate.

import type { StorageWriter } from "./_lib/storage-writer";

export interface DeleteRunFilesPayload {
  runId: string;
  storageType: string;
  prefixes: string[];
}

export interface DeletePrefixResult {
  prefix: string;
  deletedCount?: number;
  error?: string;
}

export interface DeleteCompleteBody {
  runId: string;
  ok: boolean;
  results: DeletePrefixResult[];
}

export interface RunDeleteRunFilesDeps {
  writer: StorageWriter;
  postDeleteComplete: (body: DeleteCompleteBody) => Promise<void>;
}

export interface RunDeleteRunFilesResult {
  ok: boolean;
  results: DeletePrefixResult[];
}

export async function runDeleteRunFiles(
  payload: DeleteRunFilesPayload,
  deps: RunDeleteRunFilesDeps,
): Promise<RunDeleteRunFilesResult> {
  const results: DeletePrefixResult[] = [];
  let allOk = true;

  for (const prefix of payload.prefixes) {
    try {
      const { deletedCount } = await deps.writer.deletePrefix(prefix);
      results.push({ prefix, deletedCount });
    } catch (err) {
      allOk = false;
      const message = err instanceof Error ? err.message : String(err);
      results.push({ prefix, error: message });
    }
  }

  await deps.postDeleteComplete({
    runId: payload.runId,
    ok: allOk,
    results,
  });

  return { ok: allOk, results };
}
