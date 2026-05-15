## Overview

Six phases. The load-bearing chain is A (schema) → B (downloader) → C (observability). D (trial cap) and E (opt-out) layer on top and have explicit cross-change dependencies. F is doc cleanup.

The architectural call: **stream from Airtable's CDN through Worker memory directly to R2, never landing the bytes on disk.** This matches the design contract in [PRD §5.5 Encryption at Rest](../../../shared/Baseout_PRD.md) (attachments encrypted by Cloudflare's R2 server-side encryption) and the cost model (no per-Space disk billing). The per-base Trigger.dev task already streams record pages through memory; attachments use the same `ReadableStream` plumbing.

## Phase A — `attachment_dedup` schema

```sql
CREATE TABLE baseout.attachment_dedup (
  composite_id text PRIMARY KEY,
  space_id uuid NOT NULL REFERENCES baseout.spaces(id) ON DELETE CASCADE,
  r2_object_key text NOT NULL,
  content_hash text,
  size_bytes bigint,
  mime_type text,
  first_seen_at timestamp with time zone DEFAULT now(),
  last_seen_at timestamp with time zone DEFAULT now()
);

CREATE INDEX attachment_dedup_space_id_idx ON baseout.attachment_dedup (space_id);
CREATE INDEX attachment_dedup_last_seen_idx ON baseout.attachment_dedup (last_seen_at);
```

The `composite_id` shape per [PRD §2.8](../../../shared/Baseout_PRD.md): `{base_id}_{table_id}_{record_id}_{field_id}_{attachment_id}`. All five fields are Airtable IDs (already prefix-typed: `app`, `tbl`, `rec`, `fld`, `att`). Concatenated with underscore.

The `r2_object_key` shape: `<spaceId>/attachments/<sha256(composite_id).slice(0,16)>/<filename>`. The 16-char prefix gives ample collision resistance for the lifetime of a Space; the readable filename preserves usability when a human inspects the R2 bucket directly.

## Phase B — Downloader module

`apps/workflows/trigger/tasks/_lib/attachment-downloader.ts`:

```ts
type AirtableAttachment = {
  id: string             // 'att...'
  url: string            // Airtable CDN signed URL
  filename: string
  size: number
  type: string           // mime
}

type DownloadContext = {
  spaceId: string
  baseId: string
  tableId: string
  recordId: string
  fieldId: string
}

type AttachmentResult = {
  compositeId: string
  r2ObjectKey: string
  dedupHit: boolean
}

downloadAndStoreAttachment(
  attachment: AirtableAttachment,
  ctx: DownloadContext,
  deps: { db, r2, fetch, refreshAirtableUrl, now },
): Promise<AttachmentResult>
```

### Algorithm

1. Compute `compositeId = ${ctx.baseId}_${ctx.tableId}_${ctx.recordId}_${ctx.fieldId}_${attachment.id}`.
2. `SELECT * FROM attachment_dedup WHERE composite_id = $1`.
3. **Dedup hit** (row exists):
   - UPDATE `last_seen_at = now()` (no full-row write, partial).
   - Return `{ compositeId, r2ObjectKey: existing.r2_object_key, dedupHit: true }`.
4. **Dedup miss** (no row):
   - Check `attachment.url` expiry. Airtable's URL TTL is ~1–2 hours; if the URL was issued >55 minutes ago (header `Airtable-Issued-At` if present, else fall back to "refresh always for safety"), call `refreshAirtableUrl(ctx, attachment.id)` which re-fetches the field metadata for a fresh URL.
   - `fetch(attachment.url)` → `ReadableStream`.
   - Stream-pipe to `r2.put(r2ObjectKey, stream, { httpMetadata: { contentType: attachment.type } })`.
   - Stream's `size` matches `attachment.size`? If not, log mismatch (Airtable occasionally reports stale sizes); accept R2's reported size.
   - INSERT into `attachment_dedup` with `r2_object_key`, `size_bytes`, `mime_type`, `content_hash=null` (computed lazily; see Phase B.5).
   - Return `{ compositeId, r2ObjectKey, dedupHit: false }`.

### Streaming concerns

Cloudflare Workers v3 supports `ReadableStream` → R2 put without intermediate buffering. R2's `put` accepts a stream directly. Memory peak per attachment ≈ the streaming buffer, typically 64 KB. A 5 GB attachment streams through in seconds without OOM.

The Trigger.dev task's `maxDuration: 600` is the harder constraint. Mitigation:

- A base with 1000 attachments each averaging 30s download (large files) = 8.3 hours = 50× over budget. Realistic worst case is closer to 1000 × 0.5s = 8 minutes; still over budget.
- **Decision for MVP**: trust the 8min-or-less typical case. If a task fails on attachment count, the next scheduled run will hit ~all-dedup and complete quickly. The `baseout-backup-attachment-checkpointing` follow-up adds explicit resumability if this becomes an operational problem.

### URL refresh

`refreshAirtableUrl(ctx, attachmentId): Promise<string>` re-fetches the record via the Airtable REST API and extracts the fresh URL for the named attachment ID. Mirrors the existing field-metadata refresh logic in `runBackupBase`. Backs off + retries via the same ConnectionDO rate-limit gateway used for record fetches.

## Phase C — Observability

### Per-table progress

The existing `postProgress` callback (from `baseout-backup-history-live-status` and Phase 10d) gains an `attachmentsDownloaded: number` field. Wire it in `apps/workflows/trigger/tasks/backup-base.task.ts` after each per-table page completes.

### Structured logs

Inside `attachment-downloader.ts`:

```ts
log({
  event: dedupHit ? 'attachment_dedup_hit' : 'attachment_dedup_miss',
  spaceId, compositeId,
  sizeBytes: dedupHit ? null : attachment.size,
  mimeType: attachment.type,
})
```

Plus a per-run aggregate logged at completion: `event: 'backup_run_attachments_summary'` with `{ runId, downloaded, dedupHits, totalBytes }`.

## Phase D — Trial cap interlock

Depends on `baseout-backup-trial-quota-enforcement`. Two integration points:

1. **Pre-flight quota check** — before `runBackupBase` enters the per-table page loop, the trial-cap path counts the Space's existing attachments. If already ≥ 100, refuse the run with `trial_truncated`.
2. **Mid-run check** — after each page's attachments are downloaded, count the cumulative `attachmentsDownloaded` across all bases in this run. If ≥ 100, stop processing further attachments (continue records + schema) and emit `event: 'trial_attachment_cap_hit'`.

This change documents the integration points. The actual implementation lands in the quota-enforcement change.

## Phase E — Pro+ opt-out

Schema addition:

```sql
ALTER TABLE baseout.backup_configurations
  ADD COLUMN skip_attachments boolean DEFAULT false NOT NULL;
```

Capability resolver gains `resolveAttachmentSkip(tier) → { editable: tier >= 'pro', default: false }`. The PATCH route for backup-config validates `skip_attachments` against the tier; lower tiers cannot set it to `true`.

When `skip_attachments=true`, `attachment-downloader.ts` is bypassed; `field-normalizer.ts` falls back to the legacy `[N attachments]` placeholder for those fields. The CSV records the count for human reference but no R2 download happens.

## Frontend ↔ engine wire shapes

| Direction | Path | Change |
|---|---|---|
| engine → engine (callback) | `/runs/progress` body | additive: `attachmentsDownloaded` per per-table tick |
| engine → engine (callback) | `/runs/complete` body | additive: `attachmentCountByBase: { [baseId]: number }` |
| apps/web → engine | none new | |
| apps/web → apps/web | `/api/spaces/:id/backup-config` PATCH | additive (Pro+): `skip_attachments` |

## Testing strategy

| Layer | Coverage |
|---|---|
| Pure | `compositeIdFor({ baseId, tableId, recordId, fieldId, attachmentId })` — pin shape against PRD §2.8 example. |
| Pure | `r2ObjectKeyFor(spaceId, compositeId, filename)` — collision-resistance smoke (1M synthetic composite IDs → distinct keys). |
| Integration | `attachment-downloader.test.ts`: dedup hit; dedup miss; URL refresh path; mismatched-size warning; R2 write failure rolls back DB insert. |
| Integration | `backup-base.task.attachments.test.ts` extends the existing task test: seeded base with attachments → assert R2 keys + dedup rows + CSV cells contain `r2_object_key` strings. |
| Trial | covered by `baseout-backup-trial-quota-enforcement` |
| Playwright | extend `backup-happy-path.spec.ts`: run a backup of a fixture base with attachments; assert the run history widget shows non-zero `attachmentCount`; click a row, verify the per-base attachment count column is populated. |

## Master DB migration

`apps/web/drizzle/0009_attachment_dedup.sql`:

```sql
CREATE TABLE baseout.attachment_dedup (
  composite_id text PRIMARY KEY,
  space_id uuid NOT NULL REFERENCES baseout.spaces(id) ON DELETE CASCADE,
  r2_object_key text NOT NULL,
  content_hash text,
  size_bytes bigint,
  mime_type text,
  first_seen_at timestamp with time zone DEFAULT now(),
  last_seen_at timestamp with time zone DEFAULT now()
);

CREATE INDEX attachment_dedup_space_id_idx ON baseout.attachment_dedup (space_id);
CREATE INDEX attachment_dedup_last_seen_idx ON baseout.attachment_dedup (last_seen_at);

-- Optional Phase E:
ALTER TABLE baseout.backup_configurations
  ADD COLUMN skip_attachments boolean NOT NULL DEFAULT false;
```

Engine mirror in `apps/server/src/db/schema/attachment-dedup.ts` (new) with header comment naming the canonical migration.

## Operational concerns

- **First run after deploy**: every Space with existing scheduled backups will redo every attachment on its next run. This is intentional but worth flagging to the operator. Optional: a feature flag `ATTACHMENTS_DRY_RUN=true` for the first prod day that runs the downloader without actually writing R2 (logs `would_download` events). Lets us validate the dedup-miss rate before committing to the R2 spend.
- **Airtable rate limits**: attachment URLs are CDN-served, not REST-API-metered. But the URL-refresh path re-hits the REST API. Per [PRD §15](../../../shared/Baseout_PRD.md), Airtable's REST limit is ~5 requests/sec/base via Personal Access Token. The existing ConnectionDO gateway already serializes calls; attachment refresh inherits its budget.
- **R2 storage growth**: tied to attachment churn in the source bases. Per the retention engine, `attachment_dedup.last_seen_at` is the prune key — attachments unseen for > tier-cap days get deleted from R2 + the dedup table. Coordinate with `baseout-backup-retention-and-cleanup` Phase G follow-up to add this attachment-cleanup pass.

## What this design deliberately doesn't change

- The per-base Trigger.dev task envelope (`maxDuration: 600`, ConnectionDO lock, R2 streaming). All inherited.
- The CSV format. Cells previously containing `[N attachments]` now contain a semicolon-joined list of R2 object keys, but the column shape is unchanged.
- The schema + records backup path. Unchanged.
- Restore. Out of scope; tracked separately.
