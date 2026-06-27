// Storage-reader factory — the read-side mirror of storage-writers/index.ts.
//
// Filed by openspec/changes/workflows-restore (section 1.3).
//
// Dispatches on `storage_type` (from backup_configurations / the run payload)
// to a concrete StorageReader. The factory mirrors resolveStorageWriter in
// storage-writers/index.ts: unknown / local_fs types fall back to LocalFsReader,
// matching what LocalFsWriter does on the write side.
//
// The orchestration (restore-base.ts — sections 4–6, later dispatch) calls
// makeStorageReader(destination, env, masterKey) and injects the result into
// runRestoreBase's deps.

import type { StorageReader } from "./types";
import { LocalFsReader } from "./local-fs";
import { createR2Reader, type R2ReaderCreds } from "./r2";

export type { StorageReader } from "./types";

/**
 * Credential shapes accepted by `makeStorageReader`. Mirrors
 * StorageWriterCreds from storage-writers/index.ts.
 *
 * `r2` is the managed-R2 variant. Credentials come from process.env,
 * same as R2Writer: R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY /
 * R2_BUCKET.
 */
export type StorageReaderCreds = { kind: "r2" } & R2ReaderCreds;

export type { R2ReaderCreds } from "./r2";

/**
 * Factory: given a storage_type string and optional credentials, return the
 * matching StorageReader implementation.
 *
 * Falls back to LocalFsReader for unknown types or missing credentials,
 * matching the graceful-degradation posture of the writer factory.
 */
export function makeStorageReader(
  storageType: string,
  creds?: StorageReaderCreds,
): StorageReader {
  if (storageType === "r2_managed" && creds?.kind === "r2") {
    return createR2Reader({ creds });
  }
  // All other storage_type values (local_fs, google_drive, box, dropbox,
  // onedrive — BYOS reader implementations are follow-ups) fall through to
  // LocalFsReader. This matches what LocalFsWriter does on the backup side:
  // BYOS providers without a reader implementation still read from local disk.
  void storageType;
  return new LocalFsReader();
}
