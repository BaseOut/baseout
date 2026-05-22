// Workflows-side StorageWriter factory.
//
// Dispatches on `StorageDestination.type` to the right per-provider writer.
// Mirrors the apps/server factory shape from
// apps/server/src/lib/storage/storage-writer.ts but lives here because
// BYOS strategies run in the Node Trigger.dev runner (pure HTTP), not in
// the Worker (which only handles r2_managed via the binding).
//
// Adding a provider = open a new file under this directory + add a
// `case` here. Same pattern as the apps/server factory.

import { createDropboxWriter } from "./dropbox";
import { createGoogleDriveWriter } from "./google-drive";
import { createLocalFsWriter } from "./local-fs";
import type {
  RefreshClient,
  StorageDestination,
  StorageWriter,
} from "./types";

export type { RefreshClient, RefreshedCredentials } from "./types";
export {
  StorageWriteError,
  type StorageDestination,
  type StorageDestinationType,
  type StorageWriter,
  type WriteResult,
} from "./types";

export interface MakeStorageWriterOptions {
  /** Injected callback the writer uses to refresh credentials. The wrapping
   *  task supplies one that POSTs back to the engine's
   *  `/api/internal/spaces/:id/storage-destination` route so the new tokens
   *  get persisted under transactional lock. */
  refreshClient: RefreshClient;
  /** Override fetch (tests). */
  fetchImpl?: typeof fetch;
}

export function makeStorageWriter(
  destination: StorageDestination,
  opts: MakeStorageWriterOptions,
): StorageWriter {
  switch (destination.type) {
    case "google_drive": {
      if (!destination.accessToken) {
        throw new Error(
          "Google Drive destination missing decrypted accessToken",
        );
      }
      if (!destination.providerFolderId) {
        throw new Error(
          "Google Drive destination missing providerFolderId (Baseout-<spaceId> folder ID)",
        );
      }
      return createGoogleDriveWriter({
        accessToken: destination.accessToken,
        refreshToken: destination.refreshToken,
        oauthExpiresAt: destination.oauthExpiresAt,
        rootFolderId: destination.providerFolderId,
        refreshClient: opts.refreshClient,
        fetchImpl: opts.fetchImpl,
      });
    }
    case "dropbox": {
      if (!destination.accessToken) {
        throw new Error(
          "Dropbox destination missing decrypted accessToken",
        );
      }
      if (!destination.providerFolderId) {
        throw new Error(
          "Dropbox destination missing providerFolderId (/Apps/Baseout/<spaceId> path)",
        );
      }
      return createDropboxWriter({
        accessToken: destination.accessToken,
        refreshToken: destination.refreshToken,
        oauthExpiresAt: destination.oauthExpiresAt,
        rootFolderPath: destination.providerFolderId,
        refreshClient: opts.refreshClient,
        fetchImpl: opts.fetchImpl,
      });
    }
    case "local_fs":
      // Dev-runner-only writer. Mechanics mirror the legacy
      // _lib/local-fs-write.ts (same apps/workflows/.backups/ root, same
      // path-traversal guard). The engine auto-provisions a local_fs row
      // when a Space has no OAuth-connected destination — see
      // openspec/changes/system-local-fs-dev-writer.
      return createLocalFsWriter();
    case "box":
      throw new Error(
        "Box StorageWriter lands in Phase C.s of shared-byos-box (workflows-side W.1)",
      );
    case "r2_managed":
      // R2 lives in apps/server (uses the Worker binding). When a Space's
      // destination is r2_managed, the workflows runner must proxy through
      // the engine's upload route — see shared-byos-drive-dropbox OUT-5
      // (`server-byos-r2-proxy-upload`). Until that ships, dev backups
      // route through the `local_fs` case above.
      throw new Error(
        "r2_managed StorageWriter not yet available from the workflows runner " +
          "(awaiting server-byos-r2-proxy-upload)",
      );
    default:
      throw new Error(
        `No StorageWriter for destination type: ${(destination as { type: string }).type}`,
      );
  }
}
