// Batched attachment-metadata ingest → bo_at_assets / bo_at_asset_refs merge —
// PURE (no I/O), unit-tested (server-media-index; paired with
// workflows-media-metadata).
//
// The workflows backup task already computes everything this index needs at
// the moment its attachment writer finishes (or dedup-skips) an attachment:
// content checksum, type, size, storage locator, and the record context. It
// batches that metadata to POST /api/internal/spaces/:spaceId/media-sync; this
// module owns the wire types, batch extraction (malformed-entry leniency), the
// content-type classing map, and the asset/ref diff. Dedup = one asset per
// checksum, N refs (design Decision 1). Deletion safety mirrors comments-sync:
// refs are removed only on a `complete` re-capture of their record; assets are
// NEVER deleted by sync — zero live refs stamps `zero_ref_since` for the
// retention machinery (space-db-pg.ts owns that write).
//
// NOTE (implementation finding, 2026-07-27): the per-Space bo_at_attachments
// table (the writer's upload/dedup working set) already carries most ref-shaped
// facts. This pair is deliberately separate — lifecycle + read-path indexes +
// storage-kind discrimination that table lacks — and bo_at_attachments rows are
// a candidate SOURCE for the historical backfill open question.

// ───────────────────────── wire types ─────────────────────────

/** Body of POST …/media-sync — one streamed batch from the attachment fan-out. */
export interface MediaSyncBody {
  backupRunId: string;
  baseId: string;
  records: MediaRecordCapture[];
}

export interface MediaRecordCapture {
  recordId: string;
  tableId: string;
  /** True ONLY when every attachment of this record was processed — enables ref deletion. */
  complete?: boolean;
  attachments: unknown[]; // MediaAttachmentEntry, validated leniently
}

export interface MediaAttachmentEntry {
  /** Airtable attachment id (att…) — the ref identity. */
  attachmentId: string;
  fieldId: string;
  /** Filename as named in THAT record. */
  filename?: string;
  /** Content checksum — the asset identity (the writer's dedup hash). */
  checksum: string;
  contentType?: string;
  sizeBytes?: number;
  storage?:
    | { kind: "r2_managed"; key: string }
    | { kind: "destination"; provider: string; locator: string };
}

// ───────────────────────── content-type classing ─────────────────────────

export type ContentClass = "image" | "video" | "audio" | "document" | "other";

const DOCUMENT_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/rtf",
  "text/csv",
  "text/plain",
  "text/markdown",
]);

const EXT_CLASS: Record<string, ContentClass> = {
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", svg: "image", heic: "image", bmp: "image", tif: "image", tiff: "image",
  mp4: "video", mov: "video", webm: "video", avi: "video", mkv: "video",
  mp3: "audio", wav: "audio", m4a: "audio", ogg: "audio", flac: "audio",
  pdf: "document", doc: "document", docx: "document", xls: "document", xlsx: "document", ppt: "document", pptx: "document", csv: "document", txt: "document", md: "document", rtf: "document",
};

/**
 * Write-time classing (design Decision 5 — an indexed column, never LIKE
 * matching mime strings per query). Airtable occasionally omits mime types —
 * extension fallback, then `other` (design open question 1).
 */
export function classifyContentType(
  contentType: string | null | undefined,
  filename: string | null | undefined,
): ContentClass {
  const mime = (contentType ?? "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (DOCUMENT_MIME.has(mime)) return "document";
  const ext = (filename ?? "").toLowerCase().split(".").pop() ?? "";
  return EXT_CLASS[ext] ?? "other";
}

// ───────────────────────── batch extraction ─────────────────────────

export interface ExtractedAttachment {
  attachmentId: string;
  recordId: string;
  tableId: string;
  fieldId: string;
  filename: string | null;
  checksum: string;
  contentType: string | null;
  contentClass: ContentClass;
  sizeBytes: number | null;
  storageKind: string | null;
  storageProvider: string | null;
  storageRef: string | null;
}

export interface ExtractedMediaBatch {
  records: { recordId: string; tableId: string; complete: boolean; attachments: ExtractedAttachment[] }[];
  dropped: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Lenient batch extraction — malformed record/attachment entries dropped + counted. */
export function extractMediaBatch(records: unknown[]): ExtractedMediaBatch {
  const out: ExtractedMediaBatch["records"] = [];
  let dropped = 0;
  for (const entry of records) {
    if (
      !isRecord(entry) ||
      typeof entry.recordId !== "string" ||
      typeof entry.tableId !== "string" ||
      !Array.isArray(entry.attachments)
    ) {
      dropped++;
      continue;
    }
    const attachments: ExtractedAttachment[] = [];
    for (const a of entry.attachments) {
      if (
        !isRecord(a) ||
        typeof a.attachmentId !== "string" ||
        typeof a.fieldId !== "string" ||
        typeof a.checksum !== "string" ||
        a.checksum.length === 0
      ) {
        dropped++;
        continue;
      }
      const storage = isRecord(a.storage) ? a.storage : null;
      const kind = storage && typeof storage.kind === "string" ? storage.kind : null;
      const filename = typeof a.filename === "string" ? a.filename : null;
      const contentType = typeof a.contentType === "string" ? a.contentType : null;
      attachments.push({
        attachmentId: a.attachmentId,
        recordId: entry.recordId,
        tableId: entry.tableId,
        fieldId: a.fieldId,
        filename,
        checksum: a.checksum,
        contentType,
        contentClass: classifyContentType(contentType, filename),
        sizeBytes: typeof a.sizeBytes === "number" ? a.sizeBytes : null,
        storageKind: kind === "r2_managed" || kind === "destination" ? kind : null,
        storageProvider:
          kind === "destination" && typeof storage?.provider === "string" ? storage.provider : null,
        storageRef:
          kind === "r2_managed" && typeof storage?.key === "string"
            ? storage.key
            : kind === "destination" && typeof storage?.locator === "string"
              ? storage.locator
              : null,
      });
    }
    out.push({
      recordId: entry.recordId,
      tableId: entry.tableId,
      complete: entry.complete === true,
      attachments,
    });
  }
  return { records: out, dropped };
}

// ───────────────────────── diff ─────────────────────────

/** Prior asset-ref rows for the batch's record ids (readMediaWorkingSet). */
export interface PriorAssetRef {
  attachmentId: string;
  recordId: string;
  status: string; // active | removed
}

export interface AssetUpsertOp {
  checksum: string;
  contentType: string | null;
  contentClass: ContentClass;
  sizeBytes: number | null;
  storageKind: string | null;
  storageProvider: string | null;
  storageRef: string | null;
}

export interface RefUpsertOp {
  attachmentId: string;
  checksum: string;
  baseId: string;
  tableId: string;
  recordId: string;
  fieldId: string;
  filename: string | null;
}

export interface MediaDiffResult {
  /** One per distinct checksum in the batch (first entry's metadata wins). */
  assetUpserts: AssetUpsertOp[];
  /** One per captured attachment — upsert by attachment id (resurrects removed). */
  refUpserts: RefUpsertOp[];
  /** Attachment ids to flip to 'removed' (absent from a `complete` record capture). */
  refRemovals: string[];
  addedRefs: number;
}

/**
 * Diff one batch: dedup assets by checksum, upsert every ref, remove refs
 * absent from `complete` records (per-record deletion rule — unvisited records
 * untouched by construction; the caller reads only the batch's record ids).
 */
export function diffMediaBatch(args: {
  baseId: string;
  batch: ExtractedMediaBatch;
  prior: PriorAssetRef[];
}): MediaDiffResult {
  const { baseId, batch, prior } = args;
  const priorById = new Map(prior.map((p) => [p.attachmentId, p]));

  const assetsByChecksum = new Map<string, AssetUpsertOp>();
  const refUpserts: RefUpsertOp[] = [];
  const refRemovals: string[] = [];
  let addedRefs = 0;

  for (const rec of batch.records) {
    const capturedIds = new Set<string>();
    for (const a of rec.attachments) {
      capturedIds.add(a.attachmentId);
      if (!assetsByChecksum.has(a.checksum)) {
        assetsByChecksum.set(a.checksum, {
          checksum: a.checksum,
          contentType: a.contentType,
          contentClass: a.contentClass,
          sizeBytes: a.sizeBytes,
          storageKind: a.storageKind,
          storageProvider: a.storageProvider,
          storageRef: a.storageRef,
        });
      }
      refUpserts.push({
        attachmentId: a.attachmentId,
        checksum: a.checksum,
        baseId,
        tableId: a.tableId,
        recordId: a.recordId,
        fieldId: a.fieldId,
        filename: a.filename,
      });
      const p = priorById.get(a.attachmentId);
      if (!p) addedRefs++;
    }
    if (rec.complete) {
      for (const p of prior) {
        if (p.recordId !== rec.recordId) continue;
        if (p.status === "active" && !capturedIds.has(p.attachmentId)) {
          refRemovals.push(p.attachmentId);
        }
      }
    }
  }

  return {
    assetUpserts: [...assetsByChecksum.values()],
    refUpserts,
    refRemovals,
    addedRefs,
  };
}
