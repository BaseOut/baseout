> **Depends on**: [`system-r2-park`](../system-r2-park/proposal.md) — Managed R2 is paused. Phase B's destination-writing path now targets the BYOS `StorageWriter` from [`server-byos-destinations`](../server-byos-destinations/proposal.md) Phase B (interface) + Phase C (per-provider strategies). The "pipe to R2" framing is parked pending R2 revival; the dedup table (Phase A) is independent and ships first.

## Why

The `server` engine emits `[N attachments]` as a placeholder string in every cell where an Airtable attachment field has values. See [apps/workflows/trigger/tasks/_lib/field-normalizer.ts](../../../apps/workflows/trigger/tasks/_lib/field-normalizer.ts). No actual file bytes are downloaded; no destination object is written. The CSV ends up with a count where the data should be.

This is the most-flagged MVP gap. [PRD §2.9](../../../shared/Baseout_PRD.md) lists attachments as `Automatic (REST API)` for every tier from Starter up — a `Must-Have` per [PRD §7.3](../../../shared/Baseout_PRD.md). [PRD §2.8](../../../shared/Baseout_PRD.md) defines the exact contract:

> - Composite unique ID per attachment: `{base_id}_{table_id}_{record_id}_{field_id}_{attachment_id}`
> - Deduplication check before processing
> - Proxy streaming for destinations that require it (Box, Dropbox)
> - Airtable URL expiry (~1–2 hrs) handled by refresh process
> - Attachment data → primary **storage** destination; relational data → **database** tier

The composite-ID dedup is the load-bearing decision. Without it, every snapshot of a base with attachments re-downloads + re-uploads every file — at scale this is gigabytes of egress per scheduled run. (Dedup matters even more now that managed R2 is paused per [`system-r2-park`](../system-r2-park/proposal.md): all writes go through external BYOS APIs whose rate limits are tighter than R2's would have been.)

The active change `server-schedule-and-cancel` explicitly defers attachments to this change by name in its Out-of-Scope table.

## What Changes

### Phase A — Attachment dedup table

- **New table `attachment_dedup`** in master DB (or in the Space's client DB for dynamic-mode Spaces — see Open Question §1 below):
  - `composite_id text PRIMARY KEY` — `{base_id}_{table_id}_{record_id}_{field_id}_{attachment_id}`
  - `space_id uuid FK → spaces.id ON DELETE CASCADE`
  - `destination_key text NOT NULL` — provider-agnostic destination identifier (e.g. Google Drive file ID, Dropbox path, S3 object key, Box file ID). Spec-level rename from the pre-`system-r2-park` name `r2_object_key`; no migration needed because the column hasn't shipped yet.
  - `content_hash text` — sha256 of the file contents (computed on first download). Optional. Used to detect Airtable-side replacement of an attachment with the same composite ID.
  - `size_bytes bigint`
  - `mime_type text`
  - `first_seen_at timestamp with time zone`
  - `last_seen_at timestamp with time zone` — updated by every run that touches this attachment, so retention can hard-prune attachments not seen for > tier-cap days
- Index on `(space_id, composite_id)`.

### Phase B — Engine attachment download path

- **New module** `apps/workflows/trigger/tasks/_lib/attachment-downloader.ts`. Pure-ish; injectable HTTP client + `StorageWriter` + dedup-table accessor.
- **Entry points**:
  - `downloadAndStoreAttachment(rec): Promise<AttachmentResult>` — given an Airtable attachment object `{ id, url, filename, size, type }` plus the surrounding `{ baseId, tableId, recordId, fieldId }`, compute the composite ID; check the dedup table via the engine-callback endpoint (B.2); if hit, return existing `destination_key`; if miss, GET the Airtable URL with streaming, pipe to the Space's `StorageWriter` (per [`server-byos-destinations`](../server-byos-destinations/proposal.md) Phase B), INSERT dedup row, return `destination_key`. Refresh the Airtable URL via the field metadata if expiry < 1 hour away.
  - `serializeAttachmentForCsv(rec): string` — replaces the current placeholder with a stable reference. CSV format: `<destination_key>` (one per attachment, semicolon-joined within a cell if multiple). For dynamic mode (out of this change), record-level dedup table stores the references; for static mode, the CSV holds them directly.
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
| Future change — R2 revival (per [`system-r2-park`](../system-r2-park/proposal.md)) | Per-base attachment-write to managed R2. Phase B's downloader now writes through the BYOS `StorageWriter` from [`server-byos-destinations`](../server-byos-destinations/proposal.md). A future `server-r2-revive` change would re-enable R2 as a strategy without changing the downloader. |
| Future change `server-attachment-restore` | Restore-from-snapshot path for attachments. Today's restore engine doesn't exist; when it does, it'll need to map the composite ID back to an Airtable upload. Separate concern. |
| Future change `server-attachment-dedup-by-content` | Dedup by `content_hash` instead of composite ID. Today: composite-ID dedup means the same file with different `attachment_id` is downloaded twice. Future optimization. |
| Future change | Per-attachment retry policy with backoff. Today: a failed download fails the per-table page; the existing per-task retry handles the rest. |
| Future change | CDN-style URL signing on `destination_key` for direct-access exposure to customers. Today: customers don't see destination keys; the restore engine will need this when it lands. |
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
- **Destination write volume**: significant new volume on first scheduled run per Space — every existing attachment gets downloaded and written to the Space's connected BYOS destination. After that, dedup means only NEW attachments add destination writes.
- **Airtable API quota**: attachments are GET requests against Airtable's CDN URLs (not the metered REST API), so they don't consume the REST rate limit. Worth confirming in operational testing.
- **BYOS provider rate limits**: per [`system-r2-park`](../system-r2-park/proposal.md), every write goes through an external provider whose API limits are tighter than managed R2's would have been (Google Drive: 1000 req/100s/user; Dropbox: 1000 req/min file-write; Box: 10 req/sec/user). Dedup reduces this dramatically after the first pass, but the first pass on a large base is bounded by the provider's quota.
- **Trigger.dev task duration**: a base with thousands of attachments could blow past the 600s `maxDuration`. Mitigation: per-base task already streams page-by-page; attachment download happens within the same page loop. If a single page's attachments exceed budget, the task fails and the next scheduled run picks up via dedup (already-downloaded skips, only the failed remainder needs work). Watch in operational logs; if it's a recurring issue, follow up with `server-attachment-checkpointing`.
- **Cost**: storage cost lands on the customer (BYOS) per [`system-r2-park`](../system-r2-park/proposal.md). Baseout-side cost is bandwidth + Trigger.dev compute only.
- **Security**: attachments are downloaded over HTTPS from Airtable's CDN. The Airtable URL is short-lived (~1–2hr expiry per PRD §2.8); the URL refresh path is unchanged from `runBackupBase`'s existing field-metadata refresh logic. Attachment bytes are streamed directly from Airtable through the Trigger.dev runner to the customer's BYOS destination — they never persist on Baseout's disk.
- **Cross-app contract**: no new wire shapes. Existing `/runs/start`, `/runs/progress`, `/runs/complete` payloads gain `attachmentsDownloaded` field (additive, optional).

## Reversibility

- **Phase A** (schema): additive. Reverting means leaving the table empty.
- **Phase B** (downloader): pure roll-forward. Reverting restores the `[N attachments]` placeholder; existing destination-side attachment objects become orphaned in the customer's BYOS store (Baseout no longer prunes them — BYOS retention is the customer's responsibility per Features §6.6).
- **Phase C** (counts): pure observability addition.
- **Phase D** (trial cap): blocking-dependent on `server-trial-quota-enforcement`; reversal removes the cap check.
- **Phase E** (opt-out): pure feature flag — `skip_attachments=false` is the existing behavior.
- **Phase F** (docs): `git revert`.

The only irreversibility is in the customer's BYOS destination: once attachments are written, Baseout cannot un-write them (BYOS retention is the customer's responsibility per Features §6.6). The forward path of "start downloading" is itself reversible (turn off the feature), but the data written can't be un-written. Tasks include an operational dry-run (Phase B.4) where the downloader logs `would-download` events without actually writing to the destination in a feature-flag mode for the first prod day.
