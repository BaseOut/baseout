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
//      expiry), sha256 the bytes, writeBlob them, collect a record entry.
//   4. record() the new entries (idempotent upsert).
//   5. Return the storage keys (hits + new) in field order — the caller joins
//      them with ';' into the CSV cell, replacing the old "[N attachments]".
//
// Media-metadata tap (workflows-media-metadata design Decision 1): the result
// also carries per-attachment metadata — emitted for writes AND dedup-skips,
// in hand at exactly this moment, never re-derived. Writes hash their bytes
// (sha256, Web Crypto) and stamp the hash on the dedup record entry
// (contentHash — the engine's record route persists it); dedup-skips reuse
// the engine-stored hash when the lookup returns one, else fall back to the
// deterministic `att:<attachmentId>` surrogate (rows recorded before hashing
// existed have no stored hash; the surrogate keeps emission idempotent and
// self-heals into a real hash once the engine backfills/returns content_hash).
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
  /** Airtable ids the per-Space bo_at_attachments row needs (NOT NULL there). */
  tableId: string;
  fieldId: string;
  recordId: string;
  storageKey: string;
  sizeBytes?: number;
  mimeType?: string;
  contentHash?: string;
  /** Source filename from Airtable, retained for metadata. */
  filename?: string;
  /**
   * 'ready' = staged on local disk (local_fs) but not yet at a destination;
   * 'uploaded' = at the real destination (managed R2 / BYOS).
   */
  uploadStatus?: "ready" | "uploaded";
}

export interface AttachmentDownloaderDeps {
  writer: StorageWriter;
  spaceId: string;
  /** Builds the destination-relative storage key for an attachment. */
  buildKey: (compositeId: string, filename: string) => string;
  /**
   * Upload status stamped on every record entry this run writes. Injected once
   * per task run from the resolved storage destination: 'ready' for local_fs,
   * 'uploaded' for managed R2 / BYOS. Defaults to 'uploaded' when omitted.
   */
  uploadStatus?: "ready" | "uploaded";
  /**
   * Engine callback — batch dedup read. Returns compositeId →
   * { storageKey, uploadStatus, contentHash? }. `contentHash` is additive
   * (workflows-media-metadata): today's engine lookup route omits it, so
   * dedup-skip metadata falls back to the `att:<id>` surrogate checksum;
   * when the engine starts returning stored hashes, skips carry them.
   */
  lookup: (
    spaceId: string,
    compositeIds: string[],
  ) => Promise<
    Record<string, { storageKey: string; uploadStatus: string; contentHash?: string }>
  >;
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

/**
 * Per-attachment metadata surfaced by processCell (workflows-media-metadata).
 * Everything the media index needs, captured at the moment the attachment
 * finished processing — for writes AND dedup-skips (a skip still yields a new
 * ref with the existing asset's checksum).
 */
export interface ProcessedAttachmentMeta {
  /** Airtable attachment id (att…). */
  attachmentId: string;
  filename: string;
  storageKey: string;
  /**
   * `sha256:<hex>` when bytes were hashed this run; the engine-stored hash on
   * dedup hits that return one; `att:<attachmentId>` surrogate otherwise.
   */
  checksum: string;
  contentType?: string;
  sizeBytes?: number;
  /** True when bytes were NOT transferred this run (dedup hit). */
  dedupSkipped: boolean;
}

export interface ProcessCellResult {
  /** Storage keys in field order (dedup hits + newly written). */
  keys: string[];
  /** How many attachments were actually downloaded this call (misses). */
  downloaded: number;
  /**
   * Per-attachment metadata in field order (workflows-media-metadata).
   * Optional so pre-existing injected downloader fakes stay valid — the real
   * implementation always returns it; absent = no media emission.
   */
  attachments?: ProcessedAttachmentMeta[];
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

/** sha256 over the attachment bytes — Web Crypto, so the module keeps its
 * "web APIs only" property (runs in Node ≥18 and workerd alike). */
async function sha256Checksum(bytes: Uint8Array): Promise<string> {
  // The cast bridges a lib split between this app's tsc and apps/server's
  // (which follows the type-only @baseout/workflows import): one types
  // Uint8Array over ArrayBufferLike and rejects it as a digest source, the
  // other lacks the BufferSource name entirely. Runtime-safe — Web Crypto
  // accepts the view, and the buffer is never a SharedArrayBuffer (it comes
  // from Response bytes).
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
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
        return { keys: [], downloaded: 0, attachments: [] };
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
      const meta: ProcessedAttachmentMeta[] = [];

      const uploadStatus = deps.uploadStatus ?? "uploaded";

      for (const { attachment, compositeId } of composite) {
        const existing = hits[compositeId];
        if (existing) {
          keys.push(existing.storageKey);
          // Dedup-skip: bytes weren't transferred, so the checksum comes from
          // the engine's stored hash when available; the att:<id> surrogate
          // otherwise. Size/type come from Airtable's attachment metadata.
          meta.push({
            attachmentId: attachment.id,
            filename: attachment.filename,
            storageKey: existing.storageKey,
            checksum: existing.contentHash || `att:${attachment.id}`,
            ...(attachment.type ? { contentType: attachment.type } : {}),
            ...(attachment.size !== undefined ? { sizeBytes: attachment.size } : {}),
            dedupSkipped: true,
          });
          continue;
        }
        const storageKey = deps.buildKey(compositeId, attachment.filename);
        const bytes = await downloadBytes(attachment, ctx);
        const mimeType = attachment.type || "application/octet-stream";
        const checksum = await sha256Checksum(bytes);
        await deps.writer.writeBlob(storageKey, bytes, mimeType);
        keys.push(storageKey);
        toRecord.push({
          compositeId,
          tableId: ctx.tableId,
          fieldId: ctx.fieldId,
          recordId: ctx.recordId,
          storageKey,
          sizeBytes: bytes.byteLength,
          mimeType,
          contentHash: checksum,
          filename: attachment.filename,
          uploadStatus,
        });
        meta.push({
          attachmentId: attachment.id,
          filename: attachment.filename,
          storageKey,
          checksum,
          contentType: mimeType,
          sizeBytes: bytes.byteLength,
          dedupSkipped: false,
        });
      }

      if (toRecord.length > 0) {
        await deps.record(deps.spaceId, toRecord);
      }

      return { keys, downloaded: toRecord.length, attachments: meta };
    },
  };
}
