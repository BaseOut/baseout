// Storage-writer abstraction for backup output.
//
// Filed by openspec/changes/shared-backup-run-delete (Phase A). The interface
// covers both write (existing path, used by backup-base.ts) and delete (new
// path, used by delete-run-files.task.ts).
//
// Today the only implementation is LocalFsWriter — files land under
// apps/workflows/.backups/ on the Trigger.dev runner's disk. Future BYOS
// providers (Google Drive, Dropbox, Box, OneDrive, S3) each add a class
// behind the same interface, registered in storage-writers/index.ts.

export interface StorageWriter {
  /**
   * Write a CSV at `relativeKey` under the writer's configured root.
   * Returns the absolute path written and the byte size of the CSV.
   * Throws on path-traversal segments (`..`) or any underlying write error.
   */
  writeCsv(
    relativeKey: string,
    csv: string,
  ): Promise<{ path: string; size: number }>;

  /**
   * Recursively delete everything under `relativePrefix` (a directory in
   * filesystem terms, a folder-or-prefix in BYOS-provider terms).
   *
   * Idempotent — re-running against an already-deleted prefix returns
   * `{ deletedCount: 0 }` or `{ deletedCount: 1 }` depending on whether
   * the implementation can distinguish. Throws on path-traversal segments
   * (`..`).
   *
   * `deletedCount` is the unit each implementation finds most natural to
   * report. For local-fs that's "1 if the prefix existed, else 0". For
   * BYOS providers it may be the number of API-level objects removed.
   */
  deletePrefix(
    relativePrefix: string,
  ): Promise<{ deletedCount: number }>;
}
