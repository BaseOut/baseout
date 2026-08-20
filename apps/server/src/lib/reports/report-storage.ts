// Report artifact storage — the versioned document JSON lives in R2 keyed by
// run; the workflow render leg writes the PDF/HTML artifacts alongside it. When
// BACKUPS_R2 is unbound (dev without the managed bucket — see the R2-revive
// program), these throw `storage_unavailable` so callers surface a clear 503
// rather than silently losing the document. Parallel dependency to the EMAIL
// binding for delivery.

import type { ReportDetail } from "./types";

export class StorageUnavailableError extends Error {
  constructor() {
    super("storage_unavailable");
    this.name = "StorageUnavailableError";
  }
}

/** Storage key for a run's assembled JSON document. */
export function documentKey(spaceId: string, runId: string): string {
  return `reports/${spaceId}/${runId}/document.json`;
}

export async function putDocument(
  bucket: R2Bucket | undefined,
  spaceId: string,
  runId: string,
  doc: ReportDetail,
): Promise<string> {
  if (!bucket) throw new StorageUnavailableError();
  const key = documentKey(spaceId, runId);
  await bucket.put(key, JSON.stringify(doc), {
    httpMetadata: { contentType: "application/json" },
  });
  return key;
}

export async function getDocument(
  bucket: R2Bucket | undefined,
  location: string,
): Promise<ReportDetail | null> {
  if (!bucket) throw new StorageUnavailableError();
  const obj = await bucket.get(location);
  if (!obj) return null;
  return (await obj.json()) as ReportDetail;
}

/** Resolve a rendered artifact (pdf|html) for streaming. */
export async function getArtifact(
  bucket: R2Bucket | undefined,
  location: string,
): Promise<R2ObjectBody | null> {
  if (!bucket) throw new StorageUnavailableError();
  return await bucket.get(location);
}
