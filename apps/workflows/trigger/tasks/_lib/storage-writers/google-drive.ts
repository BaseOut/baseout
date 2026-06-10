// GoogleDriveWriter — first cloud StorageWriter implementation.
//
// Filed by openspec/changes/shared-byos-drive Phase 4. Implements:
//   - writeCsv(relativeKey, csv) via Drive v3 resumable upload.
//   - deletePrefix(relativePrefix) via files.list + files.delete loop. The
//     contract treats "not found" as a 0-count success (matches LocalFsWriter
//     idempotency via { force: true }).
//
// All Drive requests go through `authedFetch`:
//   1. Proactive refresh — if `expiresAt - now < 5 min`, calls creds.refresh
//      and updates the local access-token state before issuing the request.
//   2. Reactive refresh — if the response is 401, calls creds.refresh and
//      retries the request once. Subsequent 401 surfaces as an error.
//
// Sub-folder structure: <rootFolderId>/<segment1>/<segment2>/.../<file.csv>
// — segments derived from the slash-separated relativeKey. Sub-folders are
// cached in an in-memory map per writer-instance so a single backup-base run
// reuses lookups across tables.
//
// Path-traversal guard mirrors LocalFsWriter: a `..` segment in the
// relative key or prefix throws `invalid_path`.

import type { StorageWriter } from "../storage-writer";
import { toFetchBody } from "./fetch-body";

const GOOGLE_DRIVE_API_BASE = "https://www.googleapis.com";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const REFRESH_LEEWAY_MS = 5 * 60_000;

export interface DriveWriterCreds {
  accessToken: string;
  /** Absolute expiry. Used by the writer to proactively refresh. */
  expiresAt: Date;
  /** Drive folder ID of the Space-scoped Baseout-<spaceId> folder. */
  providerFolderId: string;
  /**
   * Fetches a fresh access token. Called on proactive (near-expiry) and
   * reactive (mid-request 401) refresh. The engine internal route is the
   * production implementation; tests pass an in-memory mock.
   */
  refresh: () => Promise<{ accessToken: string; expiresAt: Date }>;
}

export interface CreateGoogleDriveWriterOptions {
  creds: DriveWriterCreds;
  /** Override for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Override for tests. Defaults to GOOGLE_DRIVE_API_BASE. */
  apiBase?: string;
}

interface DriveFile {
  id: string;
  name: string;
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

function escapeDriveQuoteSegment(name: string): string {
  // Drive v3 query strings use single-quoted literals; backslash-escape any
  // embedded apostrophes per https://developers.google.com/drive/api/guides/search-files.
  return name.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

export function createGoogleDriveWriter(
  opts: CreateGoogleDriveWriterOptions,
): StorageWriter {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const apiBase = (opts.apiBase ?? GOOGLE_DRIVE_API_BASE).replace(/\/$/, "");
  const rootFolderId = opts.creds.providerFolderId;

  // Mutable creds state — refresh updates these in-place.
  let accessToken = opts.creds.accessToken;
  let expiresAt = opts.creds.expiresAt;
  const refresh = opts.creds.refresh;

  // Per-instance cache of "directory path under root → Drive folder ID".
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

  async function findChildFolder(
    parentId: string,
    name: string,
  ): Promise<DriveFile | null> {
    if (name.includes("'") || name.includes("\\")) {
      // Be conservative: the path segments we produce are slug-safe in
      // practice. Surface any unexpected chars as invalid_path rather than
      // attempt-and-fail at the Drive API.
      throw new Error("invalid_path");
    }
    const q = `'${escapeDriveQuoteSegment(parentId)}' in parents and name = '${escapeDriveQuoteSegment(name)}' and mimeType = '${FOLDER_MIME}' and trashed = false`;
    const url = new URL(`${apiBase}/drive/v3/files`);
    url.searchParams.set("q", q);
    url.searchParams.set("fields", "files(id,name)");
    url.searchParams.set("spaces", "drive");
    const res = await authedFetch(url.toString(), { method: "GET" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`drive files.list ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { files?: DriveFile[] };
    return json.files?.[0] ?? null;
  }

  async function createChildFolder(
    parentId: string,
    name: string,
  ): Promise<DriveFile> {
    const res = await authedFetch(`${apiBase}/drive/v3/files?fields=id,name`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        mimeType: FOLDER_MIME,
        parents: [parentId],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`drive files.create ${res.status}: ${body.slice(0, 200)}`);
    }
    return (await res.json()) as DriveFile;
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

  async function uploadBytes(
    parentFolderId: string,
    fileName: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<{ id: string; size: number }> {
    // Resumable upload — single code path even for small payloads. Two-step:
    //   1. POST /upload/drive/v3/files?uploadType=resumable with metadata in body.
    //      Response header Location is the session URL.
    //   2. PUT the bytes to the session URL.
    const initRes = await authedFetch(
      `${apiBase}/upload/drive/v3/files?uploadType=resumable&fields=id`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json; charset=UTF-8",
          "x-upload-content-type": contentType,
        },
        body: JSON.stringify({
          name: fileName,
          parents: [parentFolderId],
          mimeType: contentType,
        }),
      },
    );
    if (initRes.status !== 200) {
      const body = await initRes.text().catch(() => "");
      throw new Error(
        `drive upload init ${initRes.status}: ${body.slice(0, 200)}`,
      );
    }
    const sessionUrl = initRes.headers.get("location");
    if (!sessionUrl) {
      throw new Error("drive upload init missing Location header");
    }

    // PUT to the session URL — the session URL itself encodes the upload_id
    // so we don't add x-internal-token or Authorization here. (Google's docs
    // explicitly note the session URL is pre-authorized.)
    const putRes = await fetchImpl(sessionUrl, {
      method: "PUT",
      headers: { "content-type": contentType },
      body: toFetchBody(bytes),
    });
    if (putRes.status !== 200 && putRes.status !== 201) {
      const body = await putRes.text().catch(() => "");
      throw new Error(
        `drive upload put ${putRes.status}: ${body.slice(0, 200)}`,
      );
    }
    const json = (await putRes.json().catch(() => ({}))) as { id?: string };
    return {
      id: json.id ?? "",
      size: bytes.byteLength,
    };
  }

  async function findChildByName(
    parentId: string,
    name: string,
    onlyFolders: boolean,
  ): Promise<DriveFile | null> {
    if (name.includes("'") || name.includes("\\")) {
      throw new Error("invalid_path");
    }
    const baseQ = `'${escapeDriveQuoteSegment(parentId)}' in parents and name = '${escapeDriveQuoteSegment(name)}' and trashed = false`;
    const q = onlyFolders ? `${baseQ} and mimeType = '${FOLDER_MIME}'` : baseQ;
    const url = new URL(`${apiBase}/drive/v3/files`);
    url.searchParams.set("q", q);
    url.searchParams.set("fields", "files(id,name)");
    url.searchParams.set("spaces", "drive");
    const res = await authedFetch(url.toString(), { method: "GET" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`drive files.list ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { files?: DriveFile[] };
    return json.files?.[0] ?? null;
  }

  async function listChildren(parentId: string): Promise<DriveFile[]> {
    const collected: DriveFile[] = [];
    let pageToken: string | undefined;
    do {
      const q = `'${escapeDriveQuoteSegment(parentId)}' in parents and trashed = false`;
      const url = new URL(`${apiBase}/drive/v3/files`);
      url.searchParams.set("q", q);
      url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType)");
      url.searchParams.set("spaces", "drive");
      url.searchParams.set("pageSize", "200");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const res = await authedFetch(url.toString(), { method: "GET" });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `drive files.list ${res.status}: ${body.slice(0, 200)}`,
        );
      }
      const json = (await res.json()) as {
        files?: DriveFile[];
        nextPageToken?: string;
      };
      if (json.files) collected.push(...json.files);
      pageToken = json.nextPageToken;
    } while (pageToken);
    return collected;
  }

  async function deleteFile(fileId: string): Promise<void> {
    const res = await authedFetch(
      `${apiBase}/drive/v3/files/${encodeURIComponent(fileId)}`,
      { method: "DELETE" },
    );
    if (res.status === 404 || res.status === 204 || res.status === 200) return;
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`drive files.delete ${res.status}: ${body.slice(0, 200)}`);
    }
  }

  async function deleteFolderRecursive(folderId: string): Promise<number> {
    // Drive's DELETE on a folder removes the folder and its descendants in
    // one call. Use that to keep the count predictable + the request count
    // bounded to one per prefix.
    const res = await authedFetch(
      `${apiBase}/drive/v3/files/${encodeURIComponent(folderId)}`,
      { method: "DELETE" },
    );
    if (res.status === 404) return 0;
    if (res.status !== 204 && !res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`drive files.delete ${res.status}: ${body.slice(0, 200)}`);
    }
    return 1;
  }

  return {
    async writeCsv(relativeKey, csv) {
      const { dirSegments, fileName } = splitSegments(relativeKey);
      const parentId = await resolveFolderPath(dirSegments);
      const { size } = await uploadBytes(
        parentId,
        fileName,
        new TextEncoder().encode(csv),
        "text/csv",
      );
      return {
        path: `drive://${parentId}/${fileName}`,
        size,
      };
    },

    async writeBlob(relativeKey, body, contentType) {
      const { dirSegments, fileName } = splitSegments(relativeKey);
      const parentId = await resolveFolderPath(dirSegments);
      const { size } = await uploadBytes(parentId, fileName, body, contentType);
      return {
        path: `drive://${parentId}/${fileName}`,
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
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]!;
        const found = await findChildByName(parentId, seg, true);
        if (!found) return { deletedCount: 0 };
        parentId = found.id;
      }
      // parentId is now the leaf folder. Sanity-check: list children so the
      // caller can audit if needed; then DELETE the folder which recursively
      // removes everything under it.
      const children = await listChildren(parentId);
      void children; // currently unused; kept so a future audit log can read it
      const removed = await deleteFolderRecursive(parentId);
      return { deletedCount: removed };
    },
  };
}
