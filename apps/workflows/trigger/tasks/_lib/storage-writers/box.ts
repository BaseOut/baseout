// BoxWriter — second cloud StorageWriter implementation (3/3 of the box-
// provider commit chain). Implements:
//   - writeCsv(relativeKey, csv) via Box's multipart single-shot upload to
//     https://upload.box.com/api/2.0/files/content. On 409 conflict (same-
//     name file already in the target folder) re-POSTs to
//     /files/{existing_id}/content to create a new version.
//   - deletePrefix(relativePrefix) by walking the folder path then DELETE
//     /folders/{leaf}?recursive=true. Box's recursive delete removes the
//     folder + all descendants in one call.
//
// All Box requests go through `authedFetch`:
//   1. Proactive refresh — if `expiresAt - now < 5 min`, calls creds.refresh
//      and updates the local access-token state before issuing the request.
//   2. Reactive refresh — if the response is 401, calls creds.refresh and
//      retries the request once. Subsequent 401 surfaces as an error.
//
// Sub-folder structure: <rootFolderId>/<segment1>/<segment2>/.../<file.csv>
// — segments derived from the slash-separated relativeKey. Sub-folder IDs are
// cached in an in-memory map per writer-instance so a single backup-base run
// reuses lookups across tables.
//
// Box folder model differs from Drive:
//   - Folders are numeric IDs (as strings); root is the string '0'.
//   - Listing is via GET /folders/:id/items?fields=type,id,name (filtered to
//     type='folder' in code) rather than a query string.
//   - Folder creation: POST /folders { name, parent: { id } }.
//
// Path-traversal guard mirrors LocalFsWriter / GoogleDriveWriter: a `..`
// segment in the relative key or prefix throws `invalid_path`.

import type { StorageWriter } from "../storage-writer";

const BOX_API_BASE = "https://api.box.com/2.0";
const BOX_UPLOAD_BASE = "https://upload.box.com/api/2.0";
const REFRESH_LEEWAY_MS = 5 * 60_000;

export interface BoxWriterCreds {
  accessToken: string;
  /** Absolute expiry. Used by the writer to proactively refresh. */
  expiresAt: Date;
  /** Box folder ID of the Space-scoped Baseout-<spaceId> folder. */
  providerFolderId: string;
  /**
   * Fetches a fresh access token. Called on proactive (near-expiry) and
   * reactive (mid-request 401) refresh. The engine internal route is the
   * production implementation; tests pass an in-memory mock.
   */
  refresh: () => Promise<{ accessToken: string; expiresAt: Date }>;
}

export interface CreateBoxWriterOptions {
  creds: BoxWriterCreds;
  /** Override for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Override for tests. Defaults to BOX_API_BASE. */
  apiBase?: string;
  /** Override for tests. Defaults to BOX_UPLOAD_BASE. */
  uploadBase?: string;
}

interface BoxEntry {
  type?: string;
  id?: string;
  name?: string;
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

export function createBoxWriter(opts: CreateBoxWriterOptions): StorageWriter {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const apiBase = (opts.apiBase ?? BOX_API_BASE).replace(/\/$/, "");
  const uploadBase = (opts.uploadBase ?? BOX_UPLOAD_BASE).replace(/\/$/, "");
  const rootFolderId = opts.creds.providerFolderId;

  // Mutable creds state — refresh updates these in-place.
  let accessToken = opts.creds.accessToken;
  let expiresAt = opts.creds.expiresAt;
  const refresh = opts.creds.refresh;

  // Per-instance cache of "directory path under root → Box folder ID".
  // Key is `"/"`-joined segments, value is the resolved folder ID.
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

  async function listFolderItems(parentId: string): Promise<BoxEntry[]> {
    // Box returns up to 1000 entries per page. Pagination via `offset`.
    const collected: BoxEntry[] = [];
    let offset = 0;
    const limit = 1000;
    // Guard against runaway loops on a server that always returns full pages
    // with the same `total_count` (unlikely, but defensive).
    for (let i = 0; i < 100; i++) {
      const url = new URL(`${apiBase}/folders/${parentId}/items`);
      url.searchParams.set("fields", "type,id,name");
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("offset", String(offset));
      const res = await authedFetch(url.toString(), { method: "GET" });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `box folders/${parentId}/items ${res.status}: ${body.slice(0, 200)}`,
        );
      }
      const json = (await res.json()) as {
        entries?: BoxEntry[];
        total_count?: number;
      };
      const entries = json.entries ?? [];
      collected.push(...entries);
      if (entries.length < limit) break;
      offset += entries.length;
    }
    return collected;
  }

  async function findChildFolder(
    parentId: string,
    name: string,
  ): Promise<BoxEntry | null> {
    const entries = await listFolderItems(parentId);
    return (
      entries.find((e) => e.type === "folder" && e.name === name) ?? null
    );
  }

  async function findChildFile(
    parentId: string,
    name: string,
  ): Promise<BoxEntry | null> {
    const entries = await listFolderItems(parentId);
    return entries.find((e) => e.type === "file" && e.name === name) ?? null;
  }

  async function createChildFolder(
    parentId: string,
    name: string,
  ): Promise<BoxEntry> {
    const res = await authedFetch(`${apiBase}/folders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, parent: { id: parentId } }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `box POST /folders ${res.status}: ${body.slice(0, 200)}`,
      );
    }
    return (await res.json()) as BoxEntry;
  }

  async function resolveFolderPath(segments: string[]): Promise<string> {
    let parentId = rootFolderId;
    const traversed: string[] = [];
    for (const seg of segments) {
      if (seg.includes("\\") || seg.includes("/")) {
        throw new Error("invalid_path");
      }
      traversed.push(seg);
      const cacheKey = traversed.join("/");
      const cached = folderCache.get(cacheKey);
      if (cached) {
        parentId = cached;
        continue;
      }
      const existing = await findChildFolder(parentId, seg);
      const folder = existing ?? (await createChildFolder(parentId, seg));
      if (!folder.id) {
        throw new Error(`box resolveFolderPath: missing id for ${seg}`);
      }
      folderCache.set(cacheKey, folder.id);
      parentId = folder.id;
    }
    return parentId;
  }

  function buildUploadForm(
    parentFolderId: string | null,
    fileName: string,
    body: Uint8Array,
    contentType: string,
  ): FormData {
    const form = new FormData();
    const attrs: Record<string, unknown> = { name: fileName };
    if (parentFolderId !== null) attrs.parent = { id: parentFolderId };
    form.append("attributes", JSON.stringify(attrs));
    // The Content-Type tags the part (e.g. text/csv for CSVs, the attachment's
    // own type for blobs). `body.slice()` makes a fresh copy so the BlobPart is
    // a plain ArrayBuffer — sidesteps the SharedArrayBuffer/BlobPart type-
    // friction on Uint8Array.
    const blob = new Blob([body.slice()], { type: contentType });
    form.append("file", blob, fileName);
    return form;
  }

  async function uploadBytes(
    parentFolderId: string,
    fileName: string,
    body: Uint8Array,
    contentType: string,
  ): Promise<{ id: string; size: number }> {
    const size = body.byteLength;

    const form = buildUploadForm(parentFolderId, fileName, body, contentType);
    const res = await authedFetch(`${uploadBase}/files/content`, {
      method: "POST",
      body: form,
    });

    if (res.status === 201 || res.status === 200) {
      const json = (await res.json()) as {
        entries?: Array<{ id?: string }>;
        id?: string;
      };
      const id = json.entries?.[0]?.id ?? json.id ?? "";
      return { id, size };
    }

    if (res.status === 409) {
      // Conflict — Box returns context_info.conflicts[0].id for the existing
      // file. Upload a new version to that file id instead.
      const json = (await res.json().catch(() => ({}))) as {
        context_info?: { conflicts?: Array<{ id?: string }> };
      };
      const conflictId = json.context_info?.conflicts?.[0]?.id;
      if (!conflictId) {
        // Fall back to listing — find the file id by name. Slower path; only
        // hit when Box's 409 body shape diverges from current docs.
        const existing = await findChildFile(parentFolderId, fileName);
        if (!existing || !existing.id) {
          throw new Error(
            `box upload 409 but no conflict id surfaced for ${fileName}`,
          );
        }
        return uploadNewVersion(existing.id, fileName, body, contentType);
      }
      return uploadNewVersion(conflictId, fileName, body, contentType);
    }

    const body_ = await res.text().catch(() => "");
    throw new Error(`box upload ${res.status}: ${body_.slice(0, 200)}`);
  }

  async function uploadNewVersion(
    fileId: string,
    fileName: string,
    body: Uint8Array,
    contentType: string,
  ): Promise<{ id: string; size: number }> {
    // POST /files/:id/content creates a new version of an existing file.
    // No `parent` in `attributes` for the version endpoint — file id pins it.
    const form = buildUploadForm(null, fileName, body, contentType);
    const res = await authedFetch(`${uploadBase}/files/${fileId}/content`, {
      method: "POST",
      body: form,
    });
    if (res.status !== 200 && res.status !== 201) {
      const errBody = await res.text().catch(() => "");
      throw new Error(
        `box upload new-version ${res.status}: ${errBody.slice(0, 200)}`,
      );
    }
    const json = (await res.json()) as {
      entries?: Array<{ id?: string }>;
      id?: string;
    };
    const id = json.entries?.[0]?.id ?? json.id ?? fileId;
    return { id, size: body.byteLength };
  }

  async function deleteFolderRecursive(folderId: string): Promise<number> {
    // Box's DELETE /folders/:id requires `?recursive=true` to remove a folder
    // with descendants — otherwise it 400s.
    const url = new URL(`${apiBase}/folders/${folderId}`);
    url.searchParams.set("recursive", "true");
    const res = await authedFetch(url.toString(), { method: "DELETE" });
    if (res.status === 404) return 0;
    if (res.status === 204 || res.status === 200) return 1;
    const body = await res.text().catch(() => "");
    throw new Error(
      `box DELETE /folders/${folderId} ${res.status}: ${body.slice(0, 200)}`,
    );
  }

  return {
    async writeCsv(relativeKey, csv) {
      const { dirSegments, fileName } = splitSegments(relativeKey);
      if (fileName.includes("\\") || fileName.includes("/")) {
        throw new Error("invalid_path");
      }
      const parentId = await resolveFolderPath(dirSegments);
      const { size } = await uploadBytes(
        parentId,
        fileName,
        new TextEncoder().encode(csv),
        "text/csv",
      );
      return {
        path: `box://${parentId}/${fileName}`,
        size,
      };
    },

    async writeBlob(relativeKey, body, contentType) {
      const { dirSegments, fileName } = splitSegments(relativeKey);
      if (fileName.includes("\\") || fileName.includes("/")) {
        throw new Error("invalid_path");
      }
      const parentId = await resolveFolderPath(dirSegments);
      await uploadBytes(parentId, fileName, body, contentType);
      return {
        path: `box://${parentId}/${fileName}`,
        size: body.byteLength,
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
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]!;
        const found = await findChildFolder(parentId, seg);
        if (!found || !found.id) return { deletedCount: 0 };
        parentId = found.id;
      }
      const removed = await deleteFolderRecursive(parentId);
      return { deletedCount: removed };
    },
  };
}
