// StorageWriter interface + factory dispatch.
//
// Single Worker-side contract every storage destination strategy implements.
// Per openspec/changes/system-r2-park, managed R2 is paused: the `r2_managed`
// value remains in the type union (the storage_destinations.type CHECK
// constraint still permits it, so revival is a one-flag flip rather than a
// migration) but the factory throws for it. Drive + Dropbox cases land in
// Phase C of shared-byos-drive-dropbox; Box lands via shared-byos-box. Until
// each provider's strategy ships, the factory throws for it.
//
// Per design.md (shared-byos-drive-dropbox): the interface is full-shape
// from day one so per-provider follow-ups don't reshape it. The factory is
// the narrow surface — adding a provider = open a strategy file + add a
// dispatch case.

import type { Env } from "../../env";

export type StorageDestinationType =
  | "r2_managed"
  | "google_drive"
  | "dropbox"
  | "box"
  | "local_fs";

/**
 * Resolved storage destination handed to the factory. Carries the decrypted
 * OAuth tokens for Drive / Dropbox and the per-provider folder pointer.
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
   * engine's upload route rather than streaming directly. Dropbox sets
   * this because its upload-session API requires server-side chunk
   * accounting.
   */
  readonly proxyStreamMode?: boolean;

  /**
   * Per-run setup: token refresh if expired, folder ensure, etc. Cheap +
   * idempotent.
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
   * not exercise this method.
   */
  getDownloadUrl(path: string): string;

  /** Remove `path` from the destination. */
  delete(path: string): Promise<void>;
}

/**
 * Dispatch to the right strategy for the given destination row. `masterKey`
 * will be used by Drive + Dropbox once Phase C of shared-byos-drive-dropbox
 * lands (refresh-on-401 needs the encryption key to persist refreshed tokens
 * back). `env` is currently unused but kept on the signature so per-provider
 * follow-ups don't have to reshape the factory.
 */
export function makeStorageWriter(
  dest: StorageDestination,
  _env: Env,
  _masterKey?: string,
): StorageWriter {
  switch (dest.type) {
    case "r2_managed":
      throw new Error(
        "managed R2 paused per system-r2-park (revive via a server-r2-revive change)",
      );
    case "google_drive":
    case "dropbox":
      throw new Error(
        `StorageWriter for type '${dest.type}' lands in Phase C of shared-byos-drive-dropbox`,
      );
    case "box":
      throw new Error(
        "StorageWriter for type 'box' lands in Phase C.s of shared-byos-box",
      );
    case "local_fs":
      // local_fs is a Node-fs writer (lives in apps/workflows). The Worker
      // has no local filesystem, so instantiating one here is a misroute by
      // construction — fail loudly at the factory rather than silently on
      // the first writeFile. See openspec/changes/system-local-fs-dev-writer.
      throw new Error(
        "local_fs StorageWriter is workflows-runner-only (Node fs) — the Worker never instantiates one",
      );
    default:
      throw new Error(
        `No StorageWriter for destination type: ${(dest as { type: string }).type}`,
      );
  }
}
