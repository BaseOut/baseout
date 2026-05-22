// Storage-writer factory.
//
// Filed by openspec/changes/shared-backup-run-delete (Phase A.1.2). Dispatches
// on `storage_type` (from backup_configurations) to a concrete StorageWriter.
//
// Today the only implementation is LocalFsWriter. The retired managed-R2
// path (`storage_type='r2_managed'`) and every BYOS value
// ('google_drive' | 'dropbox' | 'box' | 'onedrive' | 's3') currently route
// to the same local-fs implementation — matching what backup-base.ts has
// been doing since 8fc1f61 (refactor: write backup CSVs to local disk).
//
// The StoragePicker UI claiming `r2_managed` writes go to "Cloudflare R2
// (managed by Baseout) — encrypted at rest, no setup required" is a
// separate UX lie tracked by openspec/changes/web-storage-picker-honesty
// (proposed in Out of Scope of shared-backup-run-delete).
//
// TODO(shared-byos-google-drive | -dropbox | -box | -onedrive | -s3):
// register per-provider writers behind their respective storage_type values.
// Each will resolve Space-scoped OAuth tokens via payload threaded through
// the task — the engine handles encryption + refresh on its side and passes
// usable creds into the task payload.

import type { StorageWriter } from "../storage-writer";
import { LocalFsWriter } from "./local-fs";

export function resolveStorageWriter(storageType: string): StorageWriter {
  // Single-implementation dispatch. The `storageType` arg is kept on the
  // signature so the call site (backup-base.ts / delete-run-files.ts)
  // is already in the right shape when BYOS lands.
  void storageType;
  return new LocalFsWriter();
}
