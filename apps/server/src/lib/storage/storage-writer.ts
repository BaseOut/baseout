// StorageWriter interface + factory dispatch.
//
// Single Worker-side contract every storage destination strategy implements.
// The factory dispatches on `dest.type` — at this phase (shared-byos-drive-
// dropbox Phase B.1) it only knows `r2_managed`; Drive + Dropbox land in
// Phase C. Future per-provider follow-ups (Box, OneDrive, S3, Frame.io)
// extend the `case` block and the `StorageDestinationType` union.
//
// Per design.md (shared-byos-drive-dropbox): the interface is full-shape
// from day one so per-provider follow-ups don't reshape it. The factory is
// the narrow surface — adding a provider = open a strategy file + add a
// dispatch case.

import type { Env } from "../../env";
import { R2ManagedWriter } from "./strategies/r2-managed";

export type StorageDestinationType = "r2_managed" | "google_drive" | "dropbox";

/**
 * Resolved storage destination handed to the factory. Carries the decrypted
 * OAuth tokens for Drive / Dropbox and the per-provider folder pointer.
 * For `r2_managed`, all token fields are unused — the writer reads from the
 * `env.BACKUPS_R2` binding directly.
 */
export interface StorageDestination {
  type: StorageDestinationType;
  /** Decrypted OAuth access token. Set for Drive + Dropbox. */
  accessToken?: string;
  /** Decrypted OAuth refresh token. Set for Drive + Dropbox. */
  refreshToken?: string;
  /** ISO timestamp the access token expires at. Set for Drive + Dropbox. */
  oauthExpiresAt?: string;
  /** Provider folder pointer (Drive folderId, Dropbox folder path, etc.). */
  providerFolderId?: string;
  /** Provider account display id. */
  providerAccountId?: string;
}

export interface StorageWriter {
  /**
   * When `true`, the workflows runner must proxy CSV streams through the
   * engine's R2 upload route rather than streaming directly. Dropbox sets
   * this because its upload-session API requires server-side chunk
   * accounting. R2-managed + Drive do not proxy.
   */
  readonly proxyStreamMode?: boolean;

  /**
   * Per-run setup: token refresh if expired, folder ensure, etc. Cheap +
   * idempotent. R2-managed is a no-op.
   */
  init(): Promise<void>;

  /**
   * Stream `stream` to `path` inside the destination. Returns the canonical
   * key the destination assigned (may differ from `path` for providers that
   * rewrite paths) and the bytes written.
   */
  writeFile(
    stream: ReadableStream<Uint8Array>,
    path: string,
    mimeType?: string,
  ): Promise<{ destinationKey: string; sizeBytes: number }>;

  /**
   * Short-lived signed URL for downloading `path` later. Consumed by the
   * restore engine; the MVP smoke (Drive + Dropbox CSV-lands check) does
   * not exercise this method. For R2-managed it currently returns a
   * proxy-route URL with an `expires` query param — the real signing
   * lands when the download-proxy route does (OUT-5 / OUT-9).
   */
  getDownloadUrl(path: string): string;

  /** Remove `path` from the destination. */
  delete(path: string): Promise<void>;
}

/**
 * Dispatch to the right strategy for the given destination row. `env` carries
 * the R2 binding for `r2_managed`; `masterKey` will be used by Drive +
 * Dropbox once Phase C lands (refresh-on-401 needs the encryption key to
 * persist refreshed tokens back).
 */
export function makeStorageWriter(
  dest: StorageDestination,
  env: Env,
  _masterKey?: string,
): StorageWriter {
  switch (dest.type) {
    case "r2_managed":
      return new R2ManagedWriter(env.BACKUPS_R2);
    case "google_drive":
    case "dropbox":
      throw new Error(
        `StorageWriter for type '${dest.type}' lands in Phase C of shared-byos-drive-dropbox`,
      );
    default:
      throw new Error(
        `No StorageWriter for destination type: ${(dest as { type: string }).type}`,
      );
  }
}
