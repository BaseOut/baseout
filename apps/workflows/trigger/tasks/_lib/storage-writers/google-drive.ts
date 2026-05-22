// Workflows-side Google Drive StorageWriter.
//
// Implements the buffered-input contract from ./types.ts against Drive v3's
// resumable-upload endpoint. The OAuth Connect flow (apps/web) already
// created the destination's Baseout-<spaceId> folder and persisted the
// folder ID into storage_destinations.provider_folder_id; this writer just
// uploads CSVs into it.
//
// Drive resumable upload protocol:
//   1. POST upload/drive/v3/files?uploadType=resumable with metadata JSON
//      → 200 with `Location:` header carrying the session URL.
//   2. PUT body to that session URL with Content-Type from `mimeType`.
//      → 200/201 with the final file metadata (id, name, mimeType).
//
// We always use resumable rather than `multipart` even for small CSVs.
// One code path keeps the writer simpler and matches the size-agnostic
// design in shared-byos-drive-dropbox tasks.md C.1.2.2.
//
// Refresh-on-401: the writer holds the access token + expiry in mutable
// state. `init()` refreshes proactively when within 5 minutes of expiry;
// `writeFile()` refreshes reactively on a single 401 then retries once.
// Both paths call the injected `refreshClient` so the engine internal
// route stays the canonical token-persistence path.

import {
  StorageWriteError,
  type RefreshClient,
  type StorageWriter,
  type WriteResult,
} from "./types";

const DEFAULT_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";

const EXPIRY_SKEW_MS = 5 * 60 * 1000;

export interface GoogleDriveWriterOptions {
  accessToken: string;
  refreshToken?: string;
  /** ISO timestamp the access token expires at. */
  oauthExpiresAt?: string;
  /** Drive folder ID of the `Baseout-<spaceId>` folder. */
  rootFolderId: string;
  /** Injected callback for token refresh. Returns the new credentials so
   *  the writer can update its mutable token state. */
  refreshClient: RefreshClient;
  /** Override fetch (tests). */
  fetchImpl?: typeof fetch;
  /** Override upload endpoint base URL (tests). */
  uploadBase?: string;
}

export function createGoogleDriveWriter(
  opts: GoogleDriveWriterOptions,
): StorageWriter {
  let accessToken = opts.accessToken;
  let expiresAt = opts.oauthExpiresAt
    ? new Date(opts.oauthExpiresAt).getTime()
    : null;
  const uploadBase = opts.uploadBase ?? DEFAULT_UPLOAD_BASE;
  const fetchImpl = opts.fetchImpl ?? fetch;

  async function refresh(): Promise<void> {
    const next = await opts.refreshClient();
    accessToken = next.accessToken;
    expiresAt = next.oauthExpiresAt
      ? new Date(next.oauthExpiresAt).getTime()
      : null;
  }

  async function ensureFreshToken(): Promise<void> {
    if (expiresAt == null) return;
    if (expiresAt - Date.now() <= EXPIRY_SKEW_MS) {
      await refresh();
    }
  }

  function authHeader(): string {
    return `Bearer ${accessToken}`;
  }

  async function startResumableSession(
    fileName: string,
    parentFolderId: string,
    bodyByteLength: number,
    mimeType: string,
  ): Promise<string> {
    const res = await fetchImpl(
      `${uploadBase}/files?uploadType=resumable`,
      {
        method: "POST",
        headers: {
          authorization: authHeader(),
          "content-type": "application/json; charset=UTF-8",
          "x-upload-content-type": mimeType,
          "x-upload-content-length": String(bodyByteLength),
        },
        body: JSON.stringify({
          name: fileName,
          parents: [parentFolderId],
          mimeType,
        }),
      },
    );
    if (res.status === 401) {
      throw new StorageWriteError(
        "auth_failed",
        "Google Drive resumable session start returned 401",
        401,
      );
    }
    if (!res.ok) {
      throw new StorageWriteError(
        classifyKind(res.status),
        `Google Drive resumable session start failed: http_${res.status}`,
        res.status,
        retryAfterMs(res),
      );
    }
    const location = res.headers.get("location");
    if (!location) {
      throw new StorageWriteError(
        "unknown",
        "Google Drive resumable session start returned no Location header",
        res.status,
      );
    }
    return location;
  }

  async function putToSession(
    sessionUrl: string,
    body: Uint8Array,
    mimeType: string,
  ): Promise<{ id: string }> {
    const res = await fetchImpl(sessionUrl, {
      method: "PUT",
      headers: {
        "content-type": mimeType,
        "content-length": String(body.byteLength),
      },
      body,
    });
    if (res.status === 401) {
      throw new StorageWriteError(
        "auth_failed",
        "Google Drive resumable PUT returned 401",
        401,
      );
    }
    if (!res.ok) {
      throw new StorageWriteError(
        classifyKind(res.status),
        `Google Drive resumable PUT failed: http_${res.status}`,
        res.status,
        retryAfterMs(res),
      );
    }
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    if (!json.id) {
      throw new StorageWriteError(
        "unknown",
        "Google Drive resumable PUT returned no file id",
        res.status,
      );
    }
    return { id: json.id };
  }

  function basenameFromPath(path: string): string {
    const trimmed = path.replace(/\/+$/, "");
    const idx = trimmed.lastIndexOf("/");
    return idx === -1 ? trimmed : trimmed.slice(idx + 1);
  }

  function toBytes(body: Uint8Array | string): Uint8Array {
    return typeof body === "string" ? new TextEncoder().encode(body) : body;
  }

  return {
    proxyStreamMode: false,

    async init() {
      await ensureFreshToken();
    },

    async writeFile(
      body: Uint8Array | string,
      path: string,
      mimeType = "text/csv",
    ): Promise<WriteResult> {
      const bytes = toBytes(body);
      const fileName = basenameFromPath(path);

      async function attempt(): Promise<WriteResult> {
        const sessionUrl = await startResumableSession(
          fileName,
          opts.rootFolderId,
          bytes.byteLength,
          mimeType,
        );
        const { id } = await putToSession(sessionUrl, bytes, mimeType);
        return { destinationKey: id, sizeBytes: bytes.byteLength };
      }

      try {
        return await attempt();
      } catch (err) {
        if (err instanceof StorageWriteError && err.kind === "auth_failed") {
          await refresh();
          return await attempt();
        }
        throw err;
      }
    },
  };
}

function classifyKind(status: number): StorageWriteError["kind"] {
  if (status === 401 || status === 403) return "auth_failed";
  if (status === 429) return "rate_limited";
  if (status === 404) return "not_found";
  if (status >= 500) return "transient";
  if (status >= 400) return "bad_request";
  return "unknown";
}

function retryAfterMs(res: Response): number | undefined {
  const header = res.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const dateMs = Date.parse(header);
  if (!Number.isNaN(dateMs)) {
    const delta = dateMs - Date.now();
    return delta > 0 ? delta : undefined;
  }
  return undefined;
}
