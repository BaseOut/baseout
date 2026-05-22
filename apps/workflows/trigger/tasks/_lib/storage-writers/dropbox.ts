// Workflows-side Dropbox StorageWriter.
//
// Implements the buffered-input contract from ./types.ts against Dropbox's
// upload-session API. The OAuth Connect flow (apps/web) already created
// the destination's /Apps/Baseout/<spaceId> folder and persisted the
// folder path into storage_destinations.provider_folder_id; this writer
// just uploads CSVs into it.
//
// Dropbox upload protocol (always upload-session, single code path per
// shared-byos-drive-dropbox tasks.md C.3.2.2):
//   1. POST content.dropboxapi.com/2/files/upload_session/start with the
//      first 8 MB of the body. Header `Dropbox-API-Arg: {"close": false}`.
//      Returns `{ session_id }`.
//   2. POST .../upload_session/append_v2 with each intermediate 8 MB
//      chunk. Header `Dropbox-API-Arg: {"cursor":{"session_id","offset"}}`.
//   3. POST .../upload_session/finish with the final (possibly < 8 MB)
//      chunk. Header `Dropbox-API-Arg: {"cursor":{...},"commit":{"path":"...",
//      "mode":"add","autorename":false,"mute":true}}`. Returns the file
//      metadata including `id`.
//
// For files smaller than the 8 MB chunk threshold we still use the
// upload-session flow but with a single call: start({close:true}) +
// finish() merge into a single POST when the whole body is < the chunk
// threshold. (Dropbox supports `close:true` on start which finalizes
// without an append step — for tiny bodies we'd otherwise issue
// start({close:false}) then finish() back-to-back, which works but is
// one extra round-trip. Keeping the code straightforward: small files
// → start({close:true}); we still call finish() to land the commit
// metadata. The reduction is from 3 calls → 2 for small CSVs.)
//
// Refresh-on-401: same pattern as the Drive writer. init() refreshes
// proactively when within 5 min of expiry; writeFile() refreshes
// reactively on a single 401 and retries once.

import {
  StorageWriteError,
  type RefreshClient,
  type StorageWriter,
  type WriteResult,
} from "./types";

const DEFAULT_CONTENT_BASE = "https://content.dropboxapi.com/2";

const EXPIRY_SKEW_MS = 5 * 60 * 1000;

/** Dropbox accepts up to 150 MB per call but recommends 8 MB chunks for
 *  reliability + memory bound. CSVs above this size split into chunks. */
const CHUNK_BYTES = 8 * 1024 * 1024;

export interface DropboxWriterOptions {
  accessToken: string;
  refreshToken?: string;
  /** ISO timestamp the access token expires at. */
  oauthExpiresAt?: string;
  /** Dropbox folder path (`/Apps/Baseout/<spaceId>`) — Dropbox doesn't use IDs. */
  rootFolderPath: string;
  refreshClient: RefreshClient;
  /** Override fetch (tests). */
  fetchImpl?: typeof fetch;
  /** Override content upload base URL (tests). */
  contentBase?: string;
  /** Override chunk size (tests — exercise the multi-chunk path with small bodies). */
  chunkBytes?: number;
}

export function createDropboxWriter(opts: DropboxWriterOptions): StorageWriter {
  let accessToken = opts.accessToken;
  let expiresAt = opts.oauthExpiresAt
    ? new Date(opts.oauthExpiresAt).getTime()
    : null;
  const contentBase = opts.contentBase ?? DEFAULT_CONTENT_BASE;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const chunkBytes = opts.chunkBytes ?? CHUNK_BYTES;

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

  function commitArg(filePath: string): string {
    return JSON.stringify({
      path: filePath,
      mode: "add",
      autorename: false,
      mute: true,
    });
  }

  async function callContentEndpoint(
    endpoint: string,
    apiArg: object,
    body: Uint8Array,
  ): Promise<Response> {
    return fetchImpl(`${contentBase}/files/${endpoint}`, {
      method: "POST",
      headers: {
        authorization: authHeader(),
        "content-type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify(apiArg),
      },
      body,
    });
  }

  async function startSession(
    chunk: Uint8Array,
    closeOnStart: boolean,
  ): Promise<string> {
    const res = await callContentEndpoint(
      "upload_session/start",
      { close: closeOnStart },
      chunk,
    );
    if (res.status === 401) {
      throw new StorageWriteError(
        "auth_failed",
        "Dropbox upload_session/start returned 401",
        401,
      );
    }
    if (!res.ok) {
      throw new StorageWriteError(
        classifyKind(res.status),
        `Dropbox upload_session/start failed: http_${res.status}`,
        res.status,
        retryAfterMs(res),
      );
    }
    const json = (await res.json().catch(() => ({}))) as {
      session_id?: string;
    };
    if (!json.session_id) {
      throw new StorageWriteError(
        "unknown",
        "Dropbox upload_session/start returned no session_id",
        res.status,
      );
    }
    return json.session_id;
  }

  async function appendChunk(
    sessionId: string,
    offset: number,
    chunk: Uint8Array,
  ): Promise<void> {
    const res = await callContentEndpoint(
      "upload_session/append_v2",
      { cursor: { session_id: sessionId, offset } },
      chunk,
    );
    if (res.status === 401) {
      throw new StorageWriteError(
        "auth_failed",
        "Dropbox upload_session/append_v2 returned 401",
        401,
      );
    }
    if (!res.ok) {
      throw new StorageWriteError(
        classifyKind(res.status),
        `Dropbox upload_session/append_v2 failed: http_${res.status}`,
        res.status,
        retryAfterMs(res),
      );
    }
  }

  async function finishSession(
    sessionId: string,
    offset: number,
    finalChunk: Uint8Array,
    filePath: string,
  ): Promise<{ id: string }> {
    const res = await callContentEndpoint(
      "upload_session/finish",
      {
        cursor: { session_id: sessionId, offset },
        commit: JSON.parse(commitArg(filePath)),
      },
      finalChunk,
    );
    if (res.status === 401) {
      throw new StorageWriteError(
        "auth_failed",
        "Dropbox upload_session/finish returned 401",
        401,
      );
    }
    if (!res.ok) {
      throw new StorageWriteError(
        classifyKind(res.status),
        `Dropbox upload_session/finish failed: http_${res.status}`,
        res.status,
        retryAfterMs(res),
      );
    }
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    if (!json.id) {
      throw new StorageWriteError(
        "unknown",
        "Dropbox upload_session/finish returned no file id",
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
    proxyStreamMode: true,

    async init() {
      await ensureFreshToken();
    },

    async writeFile(
      body: Uint8Array | string,
      path: string,
      _mimeType = "text/csv",
    ): Promise<WriteResult> {
      const bytes = toBytes(body);
      const fileName = basenameFromPath(path);
      const filePath = `${opts.rootFolderPath}/${fileName}`;

      async function attempt(): Promise<WriteResult> {
        const sessionId = await startSession(
          bytes.subarray(0, Math.min(chunkBytes, bytes.byteLength)),
          // close-on-start when the whole body fits in one chunk; finish()
          // still runs to land the commit (path + mode) — Dropbox requires
          // an explicit finish to materialize the file.
          bytes.byteLength <= chunkBytes,
        );

        let offset = Math.min(chunkBytes, bytes.byteLength);
        while (offset < bytes.byteLength - chunkBytes) {
          const end = Math.min(offset + chunkBytes, bytes.byteLength);
          await appendChunk(sessionId, offset, bytes.subarray(offset, end));
          offset = end;
        }
        const finalChunk = bytes.subarray(offset, bytes.byteLength);
        const { id } = await finishSession(
          sessionId,
          offset,
          finalChunk,
          filePath,
        );
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
