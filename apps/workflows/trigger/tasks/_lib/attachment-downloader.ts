// Attachment downloader (openspec/changes/workflows-attachments).
//
// Streams Airtable attachment bytes into the active StorageWriter (R2 or any
// BYOS provider — both behind the same `writeBlob` interface), with
// composite-ID dedup (PRD §2.8) so a re-run skips files it has already
// persisted. Pure/injectable: the engine-callback lookup/record fns, the
// StorageWriter, the key builder, and `fetch` are all injected so the module
// is unit-testable without the Trigger.dev runtime or a live engine.
//
// Per-cell flow (one Airtable attachment field value for one record):
//   1. Compute each attachment's composite ID.
//   2. lookup() the batch → existing { compositeId: storageKey } hits.
//   3. For misses: GET the Airtable CDN URL (one refresh retry on auth
//      expiry), writeBlob the bytes, collect a record entry.
//   4. record() the new entries (idempotent upsert).
//   5. Return the storage keys (hits + new) in field order — the caller joins
//      them with ';' into the CSV cell, replacing the old "[N attachments]".
//
// Dedup round-trips are per-cell for MVP simplicity. Batching lookups across a
// whole record page is a future optimization (see workflows-attachments
// proposal) — correctness is unaffected.

import type { StorageWriter } from "./storage-writer";

export interface AirtableAttachment {
  id: string;
  url: string;
  filename: string;
  /** MIME type, e.g. "image/png". Airtable provides this as `type`. */
  type?: string;
  size?: number;
}

export interface DownloadContext {
  baseId: string;
  tableId: string;
  recordId: string;
  fieldId: string;
}

export interface AttachmentRecordEntry {
  compositeId: string;
  storageKey: string;
  sizeBytes?: number;
  mimeType?: string;
  contentHash?: string;
}

export interface AttachmentDownloaderDeps {
  writer: StorageWriter;
  spaceId: string;
  /** Builds the destination-relative storage key for an attachment. */
  buildKey: (compositeId: string, filename: string) => string;
  /** Engine callback — batch dedup read. Returns compositeId → storageKey. */
  lookup: (
    spaceId: string,
    compositeIds: string[],
  ) => Promise<Record<string, string>>;
  /** Engine callback — batch dedup upsert. */
  record: (
    spaceId: string,
    entries: AttachmentRecordEntry[],
  ) => Promise<void>;
  /** Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /**
   * Optional: refresh an expired Airtable CDN URL. Called once on a 401/403/410
   * from the CDN. Airtable URLs live ~1–2h; within a single short run they're
   * usually still valid, so this is a safety net.
   */
  refreshUrl?: (
    attachment: AirtableAttachment,
    ctx: DownloadContext,
  ) => Promise<string>;
}

export interface ProcessCellResult {
  /** Storage keys in field order (dedup hits + newly written). */
  keys: string[];
  /** How many attachments were actually downloaded this call (misses). */
  downloaded: number;
}

export function compositeIdFor(
  ctx: DownloadContext,
  attachmentId: string,
): string {
  return `${ctx.baseId}_${ctx.tableId}_${ctx.recordId}_${ctx.fieldId}_${attachmentId}`;
}

export interface AttachmentDownloader {
  processCell(
    attachments: AirtableAttachment[],
    ctx: DownloadContext,
  ): Promise<ProcessCellResult>;
}

export function createAttachmentDownloader(
  deps: AttachmentDownloaderDeps,
): AttachmentDownloader {
  const fetchFn = deps.fetchImpl ?? fetch;

  async function downloadBytes(
    attachment: AirtableAttachment,
    ctx: DownloadContext,
  ): Promise<Uint8Array> {
    let res = await fetchFn(attachment.url);
    if (
      (res.status === 401 || res.status === 403 || res.status === 410) &&
      deps.refreshUrl
    ) {
      const freshUrl = await deps.refreshUrl(attachment, ctx);
      res = await fetchFn(freshUrl);
    }
    if (!res.ok) {
      throw new Error(
        `attachment download ${res.status} for ${attachment.filename}`,
      );
    }
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  }

  return {
    async processCell(attachments, ctx) {
      if (attachments.length === 0) {
        return { keys: [], downloaded: 0 };
      }

      const composite = attachments.map((a) => ({
        attachment: a,
        compositeId: compositeIdFor(ctx, a.id),
      }));

      const hits = await deps.lookup(
        deps.spaceId,
        composite.map((c) => c.compositeId),
      );

      const keys: string[] = [];
      const toRecord: AttachmentRecordEntry[] = [];

      for (const { attachment, compositeId } of composite) {
        const existing = hits[compositeId];
        if (existing) {
          keys.push(existing);
          continue;
        }
        const storageKey = deps.buildKey(compositeId, attachment.filename);
        const bytes = await downloadBytes(attachment, ctx);
        const mimeType = attachment.type || "application/octet-stream";
        await deps.writer.writeBlob(storageKey, bytes, mimeType);
        keys.push(storageKey);
        toRecord.push({
          compositeId,
          storageKey,
          sizeBytes: bytes.byteLength,
          mimeType,
        });
      }

      if (toRecord.length > 0) {
        await deps.record(deps.spaceId, toRecord);
      }

      return { keys, downloaded: toRecord.length };
    },
  };
}
