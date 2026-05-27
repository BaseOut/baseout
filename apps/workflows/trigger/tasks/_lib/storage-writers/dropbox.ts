// DropboxWriter — third cloud StorageWriter implementation (dropbox-provider
// commit chain, 3/3). Implements:
//   - writeCsv(relativeKey, csv): resolves each ancestor folder via
//     create_folder_v2 (cached per writer-instance so we don't re-create on
//     subsequent calls under the same prefix), then POSTs the file bytes to
//     https://content.dropboxapi.com/2/files/upload with the upload args
//     packed into the `Dropbox-API-Arg` header and `mode: 'overwrite'`. The
//     overwrite mode keeps re-runs idempotent — no 409 dance needed.
//   - deletePrefix(relativePrefix): one POST to /2/files/delete_v2 with the
//     leaf path. Dropbox removes the folder + every descendant in one call.
//
// All Dropbox requests go through `authedFetch`:
//   1. Proactive refresh — if `expiresAt - now < 5 min`, calls creds.refresh
//      and updates the local access-token state before issuing the request.
//   2. Reactive refresh — if the response is 401, calls creds.refresh and
//      retries the request once. Subsequent 401 surfaces as an error.
//
// Dropbox folder model differs from Box and Drive:
//   - Paths are first-class identifiers. `providerFolderId` is the absolute
//     path string (e.g. `/Baseout-<spaceId>`), not a numeric ID.
//   - `create_folder_v2` creates only the leaf; ancestors must already
//     exist. The writer walks segment-by-segment, creating each ancestor on
//     first miss; treats `path/conflict_folder` errors as idempotent
//     successes.
//   - With the app registered as App-folder type, all paths are relative
//     to `/Apps/Baseout/` in the user's view (i.e., a `path: '/foo'` call
//     creates `/Apps/Baseout/foo`). From the API's perspective the app
//     folder IS the root — same call shapes as Full-Dropbox mode.
//
// Path-traversal guard mirrors LocalFsWriter / GoogleDriveWriter / BoxWriter:
// a `..` segment in the relative key or prefix throws `invalid_path`.

import type { StorageWriter } from "../storage-writer";

const DROPBOX_API_BASE = "https://api.dropboxapi.com/2";
const DROPBOX_CONTENT_BASE = "https://content.dropboxapi.com/2";
const REFRESH_LEEWAY_MS = 5 * 60_000;

export interface DropboxWriterCreds {
  accessToken: string;
  /** Absolute expiry. Used by the writer to proactively refresh. */
  expiresAt: Date;
  /**
   * Absolute Dropbox path of the Space-scoped Baseout-<spaceId> folder
   * (e.g. `/Baseout-<spaceId>`). All writeCsv / deletePrefix calls compose
   * paths under this prefix.
   */
  providerFolderId: string;
  /**
   * Fetches a fresh access token. Called on proactive (near-expiry) and
   * reactive (mid-request 401) refresh. The engine internal route is the
   * production implementation; tests pass an in-memory mock.
   */
  refresh: () => Promise<{ accessToken: string; expiresAt: Date }>;
}

export interface CreateDropboxWriterOptions {
  creds: DropboxWriterCreds;
  /** Override for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Override for tests. Defaults to DROPBOX_API_BASE. */
  apiBase?: string;
  /** Override for tests. Defaults to DROPBOX_CONTENT_BASE. */
  contentBase?: string;
}

function splitSegments(relativeKey: string): {
  dirSegments: string[];
  fileName: string;
} {
  if (relativeKey.includes("..")) {
    throw new Error("invalid_path");
  }
  const parts = relativeKey.split("/").filter((p) => p.length > 0);
  if (parts.length === 0) {
    throw new Error("invalid_path");
  }
  const fileName = parts[parts.length - 1]!;
  const dirSegments = parts.slice(0, parts.length - 1);
  return { dirSegments, fileName };
}

function isPathConflict(json: unknown): boolean {
  if (typeof json !== "object" || json === null) return false;
  const errSummary = (json as { error_summary?: unknown }).error_summary;
  if (
    typeof errSummary === "string" &&
    errSummary.startsWith("path/conflict")
  ) {
    return true;
  }
  const err = (json as { error?: unknown }).error;
  if (typeof err === "object" && err !== null) {
    const tag = (err as { ".tag"?: unknown })[".tag"];
    if (tag === "path") {
      const pathBranch = (err as { path?: unknown }).path;
      if (typeof pathBranch === "object" && pathBranch !== null) {
        const pathTag = (pathBranch as { ".tag"?: unknown })[".tag"];
        if (pathTag === "conflict") return true;
      }
    }
  }
  return false;
}

export function createDropboxWriter(
  opts: CreateDropboxWriterOptions,
): StorageWriter {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const apiBase = (opts.apiBase ?? DROPBOX_API_BASE).replace(/\/$/, "");
  const contentBase = (opts.contentBase ?? DROPBOX_CONTENT_BASE).replace(
    /\/$/,
    "",
  );
  const rootPath = opts.creds.providerFolderId.replace(/\/$/, "");
  if (!rootPath.startsWith("/")) {
    throw new Error("providerFolderId must be an absolute Dropbox path");
  }

  // Mutable creds state — refresh updates these in-place.
  let accessToken = opts.creds.accessToken;
  let expiresAt = opts.creds.expiresAt;
  const refresh = opts.creds.refresh;

  // Set of paths we've already created in this writer instance. We seed it
  // with the root path (assumed to exist; the OAuth callback creates it on
  // initial Connect). Subsequent writeCsv calls under the same sub-prefix
  // short-circuit the create_folder_v2 dance.
  const createdPaths = new Set<string>();
  createdPaths.add(rootPath);

  async function authedFetch(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    if (expiresAt.getTime() - Date.now() < REFRESH_LEEWAY_MS) {
      const fresh = await refresh();
      accessToken = fresh.accessToken;
      expiresAt = fresh.expiresAt;
    }
    const doFetch = () =>
      fetchImpl(url, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          authorization: `Bearer ${accessToken}`,
        },
      });
    const res = await doFetch();
    if (res.status !== 401) return res;
    // Reactive refresh — try once more with a fresh token.
    const fresh = await refresh();
    accessToken = fresh.accessToken;
    expiresAt = fresh.expiresAt;
    return doFetch();
  }

  async function createFolder(path: string): Promise<void> {
    if (createdPaths.has(path)) return;
    const res = await authedFetch(`${apiBase}/files/create_folder_v2`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path, autorename: false }),
    });
    if (res.ok) {
      createdPaths.add(path);
      return;
    }
    if (res.status === 409) {
      const json = await res.json().catch(() => ({}));
      if (isPathConflict(json)) {
        // Folder already exists — idempotent success.
        createdPaths.add(path);
        return;
      }
    }
    const body = await res.text().catch(() => "");
    throw new Error(
      `dropbox create_folder_v2 ${res.status}: ${body.slice(0, 200)}`,
    );
  }

  async function resolveFolderPath(segments: string[]): Promise<string> {
    let current = rootPath;
    for (const seg of segments) {
      if (seg.includes("\\") || seg.includes("/")) {
        throw new Error("invalid_path");
      }
      current = `${current}/${seg}`;
      await createFolder(current);
    }
    return current;
  }

  async function uploadCsv(
    parentFolderPath: string,
    fileName: string,
    csv: string,
  ): Promise<{ path: string; size: number }> {
    if (fileName.includes("\\") || fileName.includes("/")) {
      throw new Error("invalid_path");
    }
    const path = `${parentFolderPath}/${fileName}`;
    const bytes = new TextEncoder().encode(csv);

    // Dropbox-API-Arg is a header-encoded JSON value for content endpoints.
    // We use `mode: 'overwrite'` so re-running a backup over the same key
    // replaces the prior file — no 409 handling needed.
    const arg = JSON.stringify({
      path,
      mode: "overwrite",
      autorename: false,
      mute: true,
      strict_conflict: false,
    });

    const res = await authedFetch(`${contentBase}/files/upload`, {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        "dropbox-api-arg": arg,
      },
      body: bytes,
    });

    if (res.status !== 200) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `dropbox files/upload ${res.status}: ${body.slice(0, 200)}`,
      );
    }
    return { path, size: bytes.byteLength };
  }

  async function deleteRecursive(path: string): Promise<number> {
    // POST /2/files/delete_v2 removes the path and every descendant in one
    // call. Returns 200 on success, 409 on path/not_found (idempotent → 0).
    const res = await authedFetch(`${apiBase}/files/delete_v2`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path }),
    });
    if (res.ok) return 1;
    if (res.status === 409) {
      const json = (await res.json().catch(() => ({}))) as {
        error_summary?: string;
        error?: { ".tag"?: string };
      };
      const summary = json.error_summary ?? "";
      const tag = json.error?.[".tag"] ?? "";
      if (summary.startsWith("path_lookup") || tag === "path_lookup") {
        // Path doesn't exist — idempotent success.
        return 0;
      }
    }
    const body = await res.text().catch(() => "");
    throw new Error(
      `dropbox files/delete_v2 ${res.status}: ${body.slice(0, 200)}`,
    );
  }

  return {
    async writeCsv(relativeKey, csv) {
      const { dirSegments, fileName } = splitSegments(relativeKey);
      const parentPath = await resolveFolderPath(dirSegments);
      const { path, size } = await uploadCsv(parentPath, fileName, csv);
      return {
        path: `dropbox://${path}`,
        size,
      };
    },

    async deletePrefix(relativePrefix) {
      if (relativePrefix.includes("..")) {
        throw new Error("invalid_path");
      }
      const segments = relativePrefix
        .split("/")
        .filter((p) => p.length > 0);
      if (segments.length === 0) {
        // Refuse to delete the root folder itself — that would un-connect
        // the destination.
        throw new Error("invalid_path");
      }
      const targetPath = `${rootPath}/${segments.join("/")}`;
      const removed = await deleteRecursive(targetPath);
      // Best-effort cache prune: drop any cached paths under the deleted
      // target so a subsequent writeCsv re-issues create_folder_v2.
      for (const p of createdPaths) {
        if (p === targetPath || p.startsWith(`${targetPath}/`)) {
          createdPaths.delete(p);
        }
      }
      return { deletedCount: removed };
    },
  };
}
