// Workflows-side StorageWriter contract.
//
// Mirrors apps/server/src/lib/storage/storage-writer.ts but for the Node
// Trigger.dev runner: pure HTTP, no Worker bindings, buffered input
// (CSVs are already buffered by pageToCsv per shared-byos-drive-dropbox
// design.md "What this design deliberately doesn't change"). When the
// streaming-CSV refactor lands (shared-byos-drive-dropbox tasks.md OUT-10)
// this `body: Uint8Array | string` becomes `ReadableStream<Uint8Array>`.
//
// The factory in ./index.ts dispatches on `StorageDestination.type`. Per
// design.md, BYOS strategies (google_drive, dropbox, future box/onedrive/
// s3/frame_io) live here in apps/workflows; `r2_managed` is handled
// server-side (apps/server) via the Worker binding — the workflows runner
// can't reach the binding directly so r2_managed routes through the
// engine's proxy upload route (OUT-5 in shared-byos-drive-dropbox).

/**
 * Mirror of `StorageDestinationType` from apps/server/src/lib/storage/
 * storage-writer.ts. Keep in sync — the engine's internal route returns
 * one of these values and the factory here must accept all of them.
 */
export type StorageDestinationType =
  | "r2_managed"
  | "google_drive"
  | "dropbox"
  | "box"
  | "local_fs";

/**
 * Resolved destination handed to the factory. Mirrors the apps/server
 * `StorageDestination` shape so the engine internal route's response can
 * be passed straight through without re-mapping.
 */
export interface StorageDestination {
  type: StorageDestinationType;
  /** Decrypted OAuth access token. Set for Drive + Dropbox (+ future Box). */
  accessToken?: string;
  /** Decrypted OAuth refresh token. Set for Drive + Dropbox (+ future Box). */
  refreshToken?: string;
  /** ISO timestamp the access token expires at. */
  oauthExpiresAt?: string;
  /** Provider folder pointer (Drive folderId, Dropbox folder path, etc.). */
  providerFolderId?: string;
  /** Provider account display id. */
  providerAccountId?: string;
}

/**
 * Replacement-credential payload returned by the refresh callback.
 * The writer updates its internal state with these values after a
 * successful refresh. `refreshToken` is only present when the provider
 * rotates refresh tokens on every refresh (Box does; Drive + Dropbox
 * usually don't).
 */
export interface RefreshedCredentials {
  accessToken: string;
  refreshToken?: string;
  /** ISO timestamp the new access token expires at. */
  oauthExpiresAt?: string;
}

/**
 * Callback used by the writer when it needs fresh credentials — either
 * proactively in `init()` (when the access token is within ~5 min of
 * expiry) or reactively on a 401. Typically calls back into the engine's
 * `POST /api/internal/spaces/:id/storage-destination` route so the new
 * tokens get persisted under transactional lock before being handed back.
 */
export type RefreshClient = () => Promise<RefreshedCredentials>;

/**
 * Typed error surface every writer uses. Lets the caller branch on
 * `kind` instead of regexing message strings — important for the
 * backup-base task wrapper's retry/fail decisions.
 */
export class StorageWriteError extends Error {
  constructor(
    public readonly kind:
      | "auth_failed"
      | "rate_limited"
      | "transient"
      | "bad_request"
      | "not_found"
      | "unknown",
    message: string,
    public readonly status?: number,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "StorageWriteError";
  }
}

export interface WriteResult {
  /** The canonical key the destination assigned (e.g. Drive file ID,
   *  Dropbox file path, Box file ID). May differ from the requested
   *  `path` for providers that rewrite paths. */
  destinationKey: string;
  sizeBytes: number;
}

export interface StorageWriter {
  /**
   * When `true`, the workflows runner must proxy CSV streams through the
   * engine's upload route rather than streaming directly. Dropbox + Box
   * set this because their upload APIs require server-side chunk
   * accounting. Drive doesn't need it (resumable upload accepts a single
   * PUT). Today the runner consumes buffered CSV anyway so the flag is
   * informational; it matters once the streaming-CSV refactor lands.
   */
  readonly proxyStreamMode?: boolean;

  /**
   * Per-run setup: refresh access token if it's within ~5 minutes of
   * expiry, ensure the destination folder exists, etc. Cheap +
   * idempotent — callable multiple times per run.
   */
  init(): Promise<void>;

  /**
   * Write `body` to `path` inside the destination. `path` is the
   * relative path the backup task computes (e.g. `<orgSlug>/<spaceName>/
   * <runStartedAt>/<base>/<table>.csv`). Providers that use IDs rather
   * than paths (Drive, Box) treat the basename as the file name and
   * place it inside the destination's root folder.
   */
  writeFile(
    body: Uint8Array | string,
    path: string,
    mimeType?: string,
  ): Promise<WriteResult>;

  /**
   * Optional run-teardown hook. Today this is a no-op for every BYOS
   * provider; reserved so future writers (multi-part session abort on
   * failure, etc.) can plug in without an interface change.
   */
  cleanup?(): Promise<void>;
}
