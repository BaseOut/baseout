// Storage-writer factory.
//
// Filed by openspec/changes/shared-backup-run-delete (Phase A.1.2). Dispatches
// on `storage_type` (from backup_configurations) to a concrete StorageWriter.
//
// openspec/changes/shared-byos-drive Phase 4 widened the factory signature to
// accept optional credentials. When `storage_type === 'google_drive'` AND
// creds are present, the factory returns a GoogleDriveWriter; otherwise it
// falls back to LocalFsWriter. Missing-creds is intentional graceful
// degradation: dev iteration without Drive provisioning still writes (to
// local disk) rather than failing the run.
//
// Until subsequent BYOS providers (Dropbox / Box / OneDrive / S3 / Frame.io)
// land, every other `storage_type` value also routes to LocalFsWriter —
// matching what backup-base.ts has been doing since 8fc1f61 (refactor: write
// backup CSVs to local disk).
//
// TODO(shared-byos-dropbox | -box | -onedrive | -s3): register per-provider
// writers behind their respective storage_type values, mirroring the Drive
// shape — each adds a class behind the same StorageWriter interface and
// dispatches when the matching creds union variant is supplied.

import type { StorageWriter } from "../storage-writer";
import { LocalFsWriter } from "./local-fs";
import {
  createGoogleDriveWriter,
  type DriveWriterCreds,
} from "./google-drive";

/**
 * Union of credential shapes accepted by `resolveStorageWriter`. Today only
 * Drive is represented; each future BYOS provider adds its own variant
 * (Dropbox/Box/etc.) and the factory dispatches on `kind`.
 */
export type StorageWriterCreds =
  | ({ kind: "google_drive" } & DriveWriterCreds);

export type { DriveWriterCreds } from "./google-drive";

export function resolveStorageWriter(
  storageType: string,
  creds?: StorageWriterCreds,
): StorageWriter {
  if (storageType === "google_drive" && creds?.kind === "google_drive") {
    return createGoogleDriveWriter({ creds });
  }
  // Defensive fallback: unknown type, missing creds, or local_fs all land here.
  // The `storageType` arg is intentionally inspected only for the cases the
  // factory explicitly supports; the rest fall through to local disk.
  void storageType;
  return new LocalFsWriter();
}
