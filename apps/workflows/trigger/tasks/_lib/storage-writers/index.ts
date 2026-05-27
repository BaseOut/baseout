// Storage-writer factory.
//
// Filed by openspec/changes/shared-backup-run-delete (Phase A.1.2). Dispatches
// on `storage_type` (from backup_configurations) to a concrete StorageWriter.
//
// openspec/changes/shared-byos-drive Phase 4 widened the factory signature to
// accept optional credentials. When `storage_type` matches a registered BYOS
// provider AND creds with the matching `kind` are present, the factory
// returns the provider-specific writer; otherwise it falls back to
// LocalFsWriter. Missing-creds is intentional graceful degradation: dev
// iteration without BYOS provisioning still writes (to local disk) rather
// than failing the run.
//
// Until the remaining BYOS providers (Dropbox / OneDrive / S3 / Frame.io)
// land, those `storage_type` values also route to LocalFsWriter — matching
// what backup-base.ts has been doing since 8fc1f61.

import type { StorageWriter } from "../storage-writer";
import { LocalFsWriter } from "./local-fs";
import {
  createGoogleDriveWriter,
  type DriveWriterCreds,
} from "./google-drive";
import { createBoxWriter, type BoxWriterCreds } from "./box";
import { createDropboxWriter, type DropboxWriterCreds } from "./dropbox";

/**
 * Union of credential shapes accepted by `resolveStorageWriter`. Each
 * registered BYOS provider adds its own variant; the factory dispatches on
 * `kind`.
 */
export type StorageWriterCreds =
  | ({ kind: "google_drive" } & DriveWriterCreds)
  | ({ kind: "box" } & BoxWriterCreds)
  | ({ kind: "dropbox" } & DropboxWriterCreds);

export type { DriveWriterCreds } from "./google-drive";
export type { BoxWriterCreds } from "./box";
export type { DropboxWriterCreds } from "./dropbox";

export function resolveStorageWriter(
  storageType: string,
  creds?: StorageWriterCreds,
): StorageWriter {
  if (storageType === "google_drive" && creds?.kind === "google_drive") {
    return createGoogleDriveWriter({ creds });
  }
  if (storageType === "box" && creds?.kind === "box") {
    return createBoxWriter({ creds });
  }
  if (storageType === "dropbox" && creds?.kind === "dropbox") {
    return createDropboxWriter({ creds });
  }
  // Defensive fallback: unknown type, missing creds, or local_fs all land here.
  // The `storageType` arg is intentionally inspected only for the cases the
  // factory explicitly supports; the rest fall through to local disk.
  void storageType;
  return new LocalFsWriter();
}
