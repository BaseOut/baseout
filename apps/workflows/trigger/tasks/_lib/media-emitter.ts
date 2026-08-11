// Media-metadata batch emitter (workflows-media-metadata, design Decisions
// 2/3). The backup task's attachment-export path reports what it already
// knows — per-attachment identity, checksum, size/type, storage locator —
// and this module streams those facts to the engine's media-sync route in
// batches during the record fan-out.
//
// Batching + `complete` semantics are COPIED from the comments batcher, not
// shared with it (house YAGNI rule — parallel constants until a third batched
// emitter exists, the same discipline the MCP captures followed before views
// made three). Batches flush at record boundaries only, so every delivered
// record capture is `complete: true` — a record enters the batch exclusively
// via recordDone(), i.e. after ALL its attachments processed. Records that
// yielded no attachment entries are never emitted.
//
// Failure isolation (design Decision 3 — fire-and-forget with idempotent
// self-healing): no method ever throws. The first sync failure stops all
// further delivery (accumulation ceases too); finish() reports honestly —
// `captured` / `partial` (something delivered, then failure) / `skipped`
// (nothing delivered). Delivered counts reflect successful POSTs only. Gaps
// heal on the next run that visits the record: the engine upserts assets by
// checksum and refs by attachment id.

/**
 * One attachment's metadata entry — MIRROR of the canonical
 * `MediaAttachmentEntry` in apps/server/src/lib/per-space/media-sync.ts
 * (server-media-index owns it); do not import across apps.
 */
export interface MediaAttachmentEntryWire {
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

/**
 * One record's capture on a media-sync batch — MIRROR of the canonical
 * `MediaRecordCapture` (same module as above). `complete: true` ONLY when
 * every attachment of the record was processed (enables ref deletion).
 */
export interface MediaRecordCaptureWire {
  recordId: string;
  tableId: string;
  complete?: boolean;
  attachments: MediaAttachmentEntryWire[];
}

export type MediaCaptureOutcome =
  | { status: "captured"; records: number; assets: number; refs: number }
  | { status: "partial"; reason: string; records: number; assets: number; refs: number }
  | { status: "skipped"; reason: string };

export interface MediaEmitter {
  /** Report one processed attachment for the record currently being walked. */
  attachment(rec: { recordId: string; tableId: string }, entry: MediaAttachmentEntryWire): void;
  /**
   * Mark the current record's attachment processing finished. Safe to call
   * for every record — records without pending entries are a no-op. May
   * flush a batch; never throws.
   */
  recordDone(recordId: string): Promise<void>;
  /** Flush the remainder and report the run-progress outcome. Never throws. */
  finish(): Promise<MediaCaptureOutcome>;
}

// Parallel to (not shared with) COMMENT_BATCH_MAX_* in backup-base.ts —
// design Decision 2.
const MEDIA_BATCH_MAX_RECORDS = 50;
const MEDIA_BATCH_MAX_ATTACHMENTS = 500;

export interface CreateMediaEmitterArgs {
  /** POSTs one batch to the engine's media-sync route. Throws on failure. */
  syncMedia: (records: MediaRecordCaptureWire[]) => Promise<void>;
  /** Test seams — production uses the constants. */
  maxBatchRecords?: number;
  maxBatchAttachments?: number;
}

export function createMediaEmitter(args: CreateMediaEmitterArgs): MediaEmitter {
  const maxRecords = args.maxBatchRecords ?? MEDIA_BATCH_MAX_RECORDS;
  const maxAttachments = args.maxBatchAttachments ?? MEDIA_BATCH_MAX_ATTACHMENTS;

  let current: MediaRecordCaptureWire | null = null;
  let batch: MediaRecordCaptureWire[] = [];
  let batchAttachments = 0;
  let deliveredRecords = 0;
  let deliveredRefs = 0;
  const deliveredChecksums = new Set<string>();
  let failureReason: string | null = null;

  async function flush(): Promise<void> {
    if (failureReason !== null || batch.length === 0) {
      batch = [];
      batchAttachments = 0;
      return;
    }
    const records = batch;
    const refsInBatch = batchAttachments;
    batch = [];
    batchAttachments = 0;
    try {
      await args.syncMedia(records);
      deliveredRecords += records.length;
      deliveredRefs += refsInBatch;
      for (const r of records) {
        for (const a of r.attachments) deliveredChecksums.add(a.checksum);
      }
    } catch (err) {
      failureReason =
        err instanceof Error && err.message ? err.message : "sync_failed";
    }
  }

  return {
    attachment(rec, entry) {
      if (failureReason !== null) return; // delivery stopped — don't accumulate
      if (!current || current.recordId !== rec.recordId) {
        // Defensive: the orchestration calls recordDone between records, so a
        // record switch with a pending current shouldn't happen — but if it
        // does, the pending record DID finish its attachments (records are
        // walked sequentially), so completing it is correct.
        if (current) {
          batch.push(current);
          batchAttachments += current.attachments.length;
        }
        current = {
          recordId: rec.recordId,
          tableId: rec.tableId,
          complete: true,
          attachments: [],
        };
      }
      current.attachments.push(entry);
    },

    async recordDone(recordId) {
      if (!current || current.recordId !== recordId) return;
      batch.push(current);
      batchAttachments += current.attachments.length;
      current = null;
      if (batch.length >= maxRecords || batchAttachments >= maxAttachments) {
        await flush();
      }
    },

    async finish() {
      if (current) {
        batch.push(current);
        batchAttachments += current.attachments.length;
        current = null;
      }
      await flush();
      if (failureReason !== null) {
        if (deliveredRecords > 0 || deliveredRefs > 0) {
          return {
            status: "partial",
            reason: failureReason,
            records: deliveredRecords,
            assets: deliveredChecksums.size,
            refs: deliveredRefs,
          };
        }
        return { status: "skipped", reason: failureReason };
      }
      return {
        status: "captured",
        records: deliveredRecords,
        assets: deliveredChecksums.size,
        refs: deliveredRefs,
      };
    },
  };
}
