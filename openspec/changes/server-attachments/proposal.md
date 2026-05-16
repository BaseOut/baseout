> **Depends on**: [`system-r2-stance`](../system-r2-stance/proposal.md) — Phase B's R2-writing path requires [`server-byos-destinations`](../server-byos-destinations/proposal.md) Phase 0 to land first (R2 binding + `StorageWriter` interface). Phase A (schema + `attachment_dedup` table) is independent and can ship before that.

## Why

The `server` engine emits `[N attachments]` as a placeholder string in every cell where an Airtable attachment field has values. See [apps/workflows/trigger/tasks/_lib/field-normalizer.ts](../../../apps/workflows/trigger/tasks/_lib/field-normalizer.ts). No actual file bytes are downloaded; no R2 object is written. The CSV ends up with a count where the data should be.

This is the most-flagged MVP gap. [PRD §2.9](../../../shared/Baseout_PRD.md) lists attachments as `Automatic (REST API)` for every tier from Starter up — a `Must-Have` per [PRD §7.3](../../../shared/Baseout_PRD.md). [PRD §2.8](../../../shared/Baseout_PRD.md) defines the exact contract:

> - Composite unique ID per attachment: `{base_id}_{table_id}_{record_id}_{field_id}_{attachment_id}`
> - Deduplication check before processing
> - Proxy streaming for destinations that require it (Box, Dropbox)
> - Airtable URL expiry (~1–2 hrs) handled by refresh process
> - Attachment data → primary **storage** destination; relational data → **database** tier

The composite-ID dedup is the load-bearing decision. Without it, every snapshot of a base with attachments re-downloads + re-uploads every file — at scale this is gigabytes of egress per scheduled run.

The active change `server-schedule-and-cancel` explicitly defers attachments to this change by name in its Out-of-Scope table.

## What Changes

### Phase A — Attachment dedup table

- **New table `attachment_dedup`** in master DB (or in the Space's client DB for dynamic-mode Spaces — see Open Question §1 below):
  - `composite_id text PRIMARY KEY` — `{base_id}_{table_id}_{record_id}_{field_id}_{attachment_id}`
  - `space_id uuid FK → spaces.id ON DELETE CASCADE`
  - `r2_object_key text NOT NULL` — `<spaceId>/attachments/<composite_id_hash>/<filename>`
  - `content_hash text` — sha256 of the file contents (computed on first download). Optional. Used to detect Airtable-side replacement of an attachment with the same composite ID.
  - `size_bytes bigint`
  - `mime_type text`
  - `first_seen_at timestamp with time zone`
  - `last_seen_at timestamp with time zone` — updated by every run that touches this attachment, so retention can hard-prune attachments not seen for > tier-cap days
- Index on `(space_id, composite_id)`.

### Phase B — Engine attachment download path

- **New module** `apps/workflows/trigger/tasks/_lib/attachment-downloader.ts`. Pure-ish; injectable HTTP client + R2 + dedup-table accessor.
- **Entry points**:
  - `downloadAndStoreAttachment(rec): Promise<AttachmentResult>` — given an Airtable attachment object `{ id, url, filename, size, type }` plus the surrounding `{ baseId, tableId, recordId, fieldId }`, compute the composite ID; check the dedup table; if hit, return existing `r2_object_key`; if miss, GET the Airtable URL with streaming, pipe to R2, INSERT dedup row, return `r2_object_key`. Refresh the Airtable URL via the field metadata if expiry < 1 hour away.
  - `serializeAttachmentForCsv(rec): string` — replaces the current placeholder with a stable reference. CSV format: `<r2_object_key>` (one per attachment, semicolon-joined within a cell if multiple). For dynamic mode (out of this change), record-level dedup table stores the references; for static mode, the CSV holds them directly.
- **Wire into** [apps/workflows/trigger/tasks/_lib/field-normalizer.ts](../../../apps/workflows/trigger/tasks/_lib/field-normalizer.ts) — replace the `[N attachments]` placeholder branch with a call to `downloadAndStoreAttachment` per attachment.

### Phase C — Per-base attachment counter + observability

- **`backup_run_bases.attachment_count`** (existing column) starts being populated with the real count (today: probably 0 or NULL). Sum into `backup_runs.attachment_count` on completion.
- **Engine progress event** — `postProgress` (already exists per Phase 10d) gains an `attachmentsDownloaded` count per per-table tick. The frontend renders it next to the existing record-count progress.
- **Structured logs** — `event: 'attachment_dedup_hit'` when an attachment already exists; `event: 'attachment_dedup_miss'` for first-time downloads. Per-run aggregate counts in the final completion log.

### Phase D — Trial cap update

The trial cap from [PRD §2.6](../../../shared/Baseout_PRD.md) and [Features §3](../../../shared/Baseout_Features.md): `100 attachments max`. The existing trial-cap enforcement (today: caps records + tables only — attachments are placeholder, count is meaningless) gains a real attachments check. On hitting 100, the trial run stops with `status='trial_truncated'` per the existing pattern. This phase depends on the trial-cap enforcement landing in `server-trial-quota-enforcement` (gap 8); coordinate sequencing.

### Phase E — Pro+ attachment opt-out toggle (optional)

[Features §4.2](../../../shared/Baseout_Features.md) shows attachment backup as automatic for all tiers Starter+. The Pro+ opt-out is not in the matrix but has been requested ("my base is mostly attachments and I only care about the schema"). This change adds a `backup_configurations.skip_attachments boolean` column gated to Pro+ via the capability resolver. If set, the engine emits the legacy `[N attachments]` placeholder string and bypasses the downloader entirely. Defaults to `false`.

This phase is small but optional. If it adds review burden, defer to a follow-up `server-attachments-opt-out`.

### Phase F — Doc sync

- Update [openspec/changes/server-schedule-and-cancel/proposal.md](../server-schedule-and-cancel/proposal.md) "Out of Scope" table — link this change as the resolved follow-up.
- Update [openspec/changes/server/proposal.md](../server/proposal.md) Out-of-Scope section if it still references attachments as a placeholder.

## Out of Scope

| Deferred to | Item |
|---|---|
| Future change `server-attachment-restore` | Restore-from-snapshot path for attachments. Today's restore engine doesn't exist; when it does, it'll need to map the composite ID back to an Airtable upload. Separate concern. |
| Future change `server-attachment-dedup-by-content` | Dedup by `content_hash` instead of composite ID. Today: composite-ID dedup means the same file with different `attachment_id` is downloaded twice. Future optimization. |
| Future change | Per-attachment retry policy with backoff. Today: a failed download fails the per-table page; the existing per-task retry handles the rest. |
| Future change | CDN-style URL signing on R2 object keys for direct-access exposure to customers. Today: customers don't see R2 keys; the restore engine will need this when it lands. |
| Bundled with `server-byos-destinations` | Proxy streaming for Box/Dropbox. The dedup table + downloader land here; the destination-strategy wrapper lands there. |
| Bundled with `server-dynamic-mode` | Storing attachment metadata in a per-Space client DB (D1 / Postgres). Today: dedup table is in master DB across all Spaces. Dynamic-mode change relocates it. |
| Bundled with `server-trial-quota-enforcement` | Trial-cap enforcement for the 100-attachment limit. Engine emits the count; quota enforcement is upstream of the per-attachment download. |

## Open Questions

1. **Dedup table location**: master DB (one table for all Spaces) vs. per-Space client DB (one table per Space, sized per the dynamic-mode tier). Recommendation: master DB for MVP, since attachments belong to the Space and Spaces are master-DB rows. Dynamic-mode change can migrate the rows out later.
2. **Filename collisions in R2**: `<spaceId>/attachments/<composite_id_hash>/<filename>` uses the filename verbatim. Airtable allows two attachments in the same field to share a filename; the composite ID makes the path unique, but the filename portion can still collide if hashed shorter. Recommendation: keep the full composite-ID hash as the path component; preserve the filename for human reads.

## Capabilities

### New capabilities

- `backup-attachments` — actual download + R2 write + composite-ID dedup. Owned by `apps/server`. Replaces the existing placeholder text.

### Modified capabilities

- `backup-engine` — per-base task gains attachment-download phase after schema + records. Progress events include attachment counts.
- `backup-config-policy` (apps/web) — gains optional `skip_attachments` knob gated Pro+ via the capability resolver. Phase E only.
- `field-normalizer` (apps/server) — replaces the `[N attachments]` placeholder branch.

## Impact

- **Master DB**: one additive migration. New `attachment_dedup` table.
- **R2**: significant new write volume on first scheduled run per Space — every existing attachment gets downloaded. After that, dedup means only NEW attachments add R2 writes.
- **Airtable API quota**: attachments are GET requests against Airtable's CDN URLs (not the metered REST API), so they don't consume the REST rate limit. Worth confirming in operational testing.
- **Trigger.dev task duration**: a base with thousands of attachments could blow past the 600s `maxDuration`. Mitigation: per-base task already streams page-by-page; attachment download happens within the same page loop. If a single page's attachments exceed budget, the task fails and the next scheduled run picks up via dedup (already-downloaded skips, only the failed remainder needs work). Watch in operational logs; if it's a recurring issue, follow up with `server-attachment-checkpointing`.
- **Cost**: R2 storage is the dominant cost. Hard to predict at MVP scale until we see real customer bases. The Smart Rolling Cleanup change keeps it bounded.
- **Security**: attachments are downloaded over HTTPS from Airtable's CDN. The Airtable URL is short-lived (~1–2hr expiry per PRD §2.8); the URL refresh path is unchanged from `runBackupBase`'s existing field-metadata refresh logic. Attachment bytes never touch disk on Baseout's side (streamed directly from Airtable to R2).
- **Cross-app contract**: no new wire shapes. Existing `/runs/start`, `/runs/progress`, `/runs/complete` payloads gain `attachmentsDownloaded` field (additive, optional).

## Reversibility

- **Phase A** (schema): additive. Reverting means leaving the table empty.
- **Phase B** (downloader): pure roll-forward. Reverting restores the `[N attachments]` placeholder; existing R2 attachment objects become orphaned (cleaned up eventually by the retention engine via `last_seen_at` aging).
- **Phase C** (counts): pure observability addition.
- **Phase D** (trial cap): blocking-dependent on `server-trial-quota-enforcement`; reversal removes the cap check.
- **Phase E** (opt-out): pure feature flag — `skip_attachments=false` is the existing behavior.
- **Phase F** (docs): `git revert`.

The only irreversibility is in R2: once attachments are downloaded, they accumulate until retention prunes them. The forward path of "start downloading" is itself reversible (turn off the feature), but the data written can't be un-written. Tasks include an operational dry-run (Phase B.4) where the downloader logs `would-download` events without actually writing R2 in a feature-flag mode for the first prod day.
