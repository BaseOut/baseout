// OneDriveWriter — fourth BYOS StorageWriter (Microsoft Graph).
//
// Filed by the onedrive-provider commit chain (3/3). Implements:
//   - writeCsv(relativeKey, csv) via Microsoft Graph createUploadSession +
//     single PUT to the returned pre-authorized session URL.
//   - deletePrefix(relativePrefix) via path-walk + Graph's recursive DELETE
//     on the leaf folder. Treats "not found" as a 0-count success (matches
//     LocalFsWriter idempotency via { force: true } / Drive's behavior).
//
// All Graph requests for METADATA go through `authedFetch`:
//   1. Proactive refresh — if `expiresAt - now < 5 min`, calls creds.refresh
//      and updates the local access-token state before issuing the request.
//   2. Reactive refresh — if the response is 401, calls creds.refresh and
//      retries the request once. Subsequent 401 surfaces as an error.
//
// The upload-session URL returned by createUploadSession is pre-authorized
// for the chunk PUT(s); we deliberately omit the Authorization header on the
// content PUT (per Microsoft Graph docs). Mirrors Drive's resumable-upload
// pattern at apps/workflows/trigger/tasks/_lib/storage-writers/google-drive.ts.
//
// Sub-folder structure: <rootFolderId>/<segment1>/<segment2>/.../<file.csv>
// — segments derived from the slash-separated relativeKey. Sub-folders are
// cached in an in-memory map per writer-instance so a single backup-base run
// reuses lookups across tables.
//
// Path-traversal guard mirrors LocalFsWriter + Drive: a `..` segment in the
// relative key or prefix throws `invalid_path`.
//
// AppFolder scope note: the Azure App is registered for the
// `Files.ReadWrite.AppFolder` delegated scope. Microsoft Graph sandboxes us
// to a per-user `/Apps/<AppDisplayName>/` folder; the `providerFolderId`
// passed in from the engine is the DriveItem id of `Baseout-<spaceId>` as a
// child of approot, NOT a path. All Graph calls here address items by id
// (`/me/drive/items/<id>`), which works under the AppFolder sandbox.

import type { StorageWriter } from "../storage-writer";

const MICROSOFT_GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const REFRESH_LEEWAY_MS = 5 * 60_000;

export interface OneDriveWriterCreds {
  accessToken: string;
  /** Absolute expiry. Used by the writer to proactively refresh. */
  expiresAt: Date;
  /** Graph DriveItem id of the Space-scoped Baseout-<spaceId> folder. */
  providerFolderId: string;
  /**
   * Fetches a fresh access token. Called on proactive (near-expiry) and
   * reactive (mid-request 401) refresh. The engine internal route is the
   * production implementation; tests pass an in-memory mock.
   */
  refresh: () => Promise<{ accessToken: string; expiresAt: Date }>;
}

export interface CreateOneDriveWriterOptions {
  creds: OneDriveWriterCreds;
  /** Override for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Override for tests. Defaults to MICROSOFT_GRAPH_BASE. */
  graphBase?: string;
}

interface DriveItem {
  id: string;
  name: string;
  folder?: { childCount?: number };
}

interface UploadSessionResponse {
  uploadUrl: string;
  expirationDateTime?: string;
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

function assertSegmentSafe(name: string): void {
  // Microsoft Graph rejects names with these characters in any path segment.
  // Surface as invalid_path for parity with Drive + LocalFs guards.
  if (
    name.length === 0 ||
    name.length > 200 ||
    name.includes("/") ||
    name.includes("\\") ||
    name.includes("..") ||
    name.startsWith(".") ||
    name.endsWith(".")
  ) {
    throw new Error("invalid_path");
  }
}

export function createOneDriveWriter(
  opts: CreateOneDriveWriterOptions,
): StorageWriter {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const graphBase = (opts.graphBase ?? MICROSOFT_GRAPH_BASE).replace(/\/$/, "");
  const rootFolderId = opts.creds.providerFolderId;

  // Mutable creds state — refresh updates these in-place.
  let accessToken = opts.creds.accessToken;
  let expiresAt = opts.creds.expiresAt;
  const refresh = opts.creds.refresh;

  // Per-instance cache of "directory path under root → Graph folder id".
  // Key is `"/"`-joined segments, value is the resolved folder id.
  const folderCache = new Map<string, string>();
  folderCache.set("", rootFolderId);

  async function authedFetch(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    // Proactive refresh if expiry is within REFRESH_LEEWAY_MS.
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

  async function findChildFolder(
    parentId: string,
    name: string,
  ): Promise<DriveItem | null> {
    assertSegmentSafe(name);
    // Path-syntax lookup of a child by name under a known parent id.
    // GET /me/drive/items/<parentId>:/<encoded-name>:
    const url =
      `${graphBase}/me/drive/items/${encodeURIComponent(parentId)}` +
      `:/${encodeURIComponent(name)}` +
      `?$select=id,name,folder`;
    const res = await authedFetch(url, { method: "GET" });
    if (res.ok) {
      return (await res.json()) as DriveItem;
    }
    if (res.status === 404) return null;
    const body = await res.text().catch(() => "");
    throw new Error(
      `graph items lookup ${res.status}: ${body.slice(0, 200)}`,
    );
  }

  async function createChildFolder(
    parentId: string,
    name: string,
  ): Promise<DriveItem> {
    assertSegmentSafe(name);
    const url = `${graphBase}/me/drive/items/${encodeURIComponent(parentId)}/children`;
    const res = await authedFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        folder: {},
        "@microsoft.graph.conflictBehavior": "fail",
      }),
    });
    if (res.ok) {
      return (await res.json()) as DriveItem;
    }
    if (res.status === 409) {
      // Race — another writer created it between our lookup and our create.
      // Re-lookup and reuse.
      const existing = await findChildFolder(parentId, name);
      if (existing) return existing;
    }
    const body = await res.text().catch(() => "");
    throw new Error(
      `graph items create ${res.status}: ${body.slice(0, 200)}`,
    );
  }

  async function resolveFolderPath(segments: string[]): Promise<string> {
    let parentId = rootFolderId;
    const traversed: string[] = [];
    for (const seg of segments) {
      traversed.push(seg);
      const cacheKey = traversed.join("/");
      const cached = folderCache.get(cacheKey);
      if (cached) {
        parentId = cached;
        continue;
      }
      const existing = await findChildFolder(parentId, seg);
      const folder = existing ?? (await createChildFolder(parentId, seg));
      folderCache.set(cacheKey, folder.id);
      parentId = folder.id;
    }
    return parentId;
  }

  async function uploadCsv(
    parentFolderId: string,
    fileName: string,
    csv: string,
  ): Promise<{ id: string; size: number }> {
    assertSegmentSafe(fileName);

    // 1. Open an upload session. POST returns { uploadUrl, expirationDateTime }.
    //    `conflictBehavior: 'replace'` lets a re-run overwrite the prior CSV.
    const initRes = await authedFetch(
      `${graphBase}/me/drive/items/${encodeURIComponent(parentFolderId)}` +
        `:/${encodeURIComponent(fileName)}:/createUploadSession`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          item: {
            name: fileName,
            "@microsoft.graph.conflictBehavior": "replace",
          },
        }),
      },
    );
    if (!initRes.ok) {
      const body = await initRes.text().catch(() => "");
      throw new Error(
        `graph createUploadSession ${initRes.status}: ${body.slice(0, 200)}`,
      );
    }
    const { uploadUrl } = (await initRes.json()) as UploadSessionResponse;
    if (!uploadUrl) {
      throw new Error("graph createUploadSession missing uploadUrl");
    }

    // 2. PUT the bytes to the session URL. Session URL is pre-authorized —
    //    do NOT add Authorization header. Single PUT works for CSVs up to
    //    Microsoft's session-payload cap (which is comfortably > any in-
    //    memory CSV we hand to writeCsv).
    const bytes = new TextEncoder().encode(csv);
    const total = bytes.byteLength;
    const putRes = await fetchImpl(uploadUrl, {
      method: "PUT",
      headers: {
        "content-type": "text/csv",
        "content-length": String(total),
        // Graph requires Content-Range even for a single-chunk session PUT.
        // Empty payload edge case: `0-${total-1}/${total}` is illegal when
        // total=0; bytes 0-0/0 is the documented empty-file form. We
        // shouldn't see total=0 from real backups, but guard defensively.
        "content-range":
          total === 0 ? "bytes 0-0/0" : `bytes 0-${total - 1}/${total}`,
      },
      body: bytes,
    });
    if (putRes.status !== 200 && putRes.status !== 201) {
      const body = await putRes.text().catch(() => "");
      throw new Error(
        `graph upload session put ${putRes.status}: ${body.slice(0, 200)}`,
      );
    }
    const json = (await putRes.json().catch(() => ({}))) as { id?: string };
    return { id: json.id ?? "", size: total };
  }

  async function deleteItem(itemId: string): Promise<number> {
    // Graph DELETE on a folder removes the folder and its descendants in
    // one call — recursive by default. Use that to keep the count predictable
    // and the request count bounded to one per prefix.
    const res = await authedFetch(
      `${graphBase}/me/drive/items/${encodeURIComponent(itemId)}`,
      { method: "DELETE" },
    );
    if (res.status === 404) return 0;
    if (res.status === 204 || res.status === 200) return 1;
    const body = await res.text().catch(() => "");
    throw new Error(`graph items delete ${res.status}: ${body.slice(0, 200)}`);
  }

  return {
    async writeCsv(relativeKey, csv) {
      const { dirSegments, fileName } = splitSegments(relativeKey);
      const parentId = await resolveFolderPath(dirSegments);
      const { size } = await uploadCsv(parentId, fileName, csv);
      return {
        path: `onedrive://${parentId}/${fileName}`,
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
      // Walk the path segment-by-segment looking up child folders. If any
      // step returns null the prefix doesn't exist — idempotent 0.
      let parentId = rootFolderId;
      for (const seg of segments) {
        const found = await findChildFolder(parentId, seg);
        if (!found) return { deletedCount: 0 };
        parentId = found.id;
      }
      const removed = await deleteItem(parentId);
      return { deletedCount: removed };
    },
  };
}
