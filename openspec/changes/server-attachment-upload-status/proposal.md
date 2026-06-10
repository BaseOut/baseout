> **Pairs with**: [`workflows-attachment-upload-status`](../workflows-attachment-upload-status/proposal.md) — the downloader that stamps `filename` + `upload_status` on each recorded attachment. This change owns the schema columns and the engine endpoints; the paired change owns the consumer. Ship this first — the paired change depends on the `/record` request shape and the `/lookup` response shape defined here.
>
> **Extends**: [`server-attachments`](../server-attachments/proposal.md) (the `attachment_dedup` table + `/lookup` + `/record` endpoints, landed 2026-06-08 on branch `autumn/backup-fix-local`).

## Why

The **Jun 10, 2026 Dan / Autumn Sync** aligned on tracking each attachment's upload status to "prevent processing the same file multiple times," with an explicit **`ready` vs `uploaded`** field and the file's name retained for metadata.

The `attachment_dedup` table already delivers most of this — composite-ID uniqueness (`{base_id}_{table_id}_{record_id}_{field_id}_{attachment_id}` per [PRD §2.8](../../../shared/Baseout_PRD.md)), `space_id`, `storage_key`, `size_bytes`, `mime_type`, and `first_seen_at`/`last_seen_at`. A lookup hit already prevents re-download today.

What it does **not** capture is the distinction the meeting drew: a file whose bytes are staged on local disk (`ready`) versus one that has reached the real destination (`uploaded`). Without that field there's no way to drive the deferred standalone-upload phase, and the dedup table can't report "downloaded but not yet shipped." It also drops the human filename, which the meeting called out as required metadata.

Per the aligned decision, this change prioritizes **functional completion over performance optimization**; the chunks-of-100 expiry mitigation stays deferred.

## What Changes

### Schema — three new columns on `attachment_dedup`

Canonical writer is [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts) (master-DB schema is owned by apps/web per [CLAUDE.md §2](../../../CLAUDE.md)); the engine mirrors it in [apps/server/src/db/schema/attachment-dedup.ts](../../../apps/server/src/db/schema/attachment-dedup.ts). The migration is filed under this server-prefixed change, matching the `0013_attachment_dedup` precedent.

- `filename text` — the source filename from Airtable. Nullable (legacy rows have none).
- `upload_status text NOT NULL DEFAULT 'uploaded'` — `'ready'` = bytes written to a staging location (local disk), not yet at the destination; `'uploaded'` = bytes are at the real destination (managed R2 or a BYOS provider). The `'uploaded'` default backfills every historical row correctly — they were all written straight to a real destination.
- `uploaded_at timestamptz` — set when a row is recorded/updated as `uploaded`. Nullable.

### Endpoints — `/api/internal/attachments/{lookup,record}`

Both handlers live in [apps/server/src/pages/api/internal/attachments/lookup.ts](../../../apps/server/src/pages/api/internal/attachments/lookup.ts), INTERNAL_TOKEN-gated.

- **`/record`** — the `RecordEntry` shape gains optional `filename` and `uploadStatus` (`'ready' | 'uploaded'`, validated). They are written on insert and refreshed in the `ON CONFLICT … DO UPDATE` set. `uploaded_at` is set to `now()` whenever the recorded status is `uploaded`.
- **`/lookup`** — the response hit value changes from a bare storage-key string to `{ storageKey, uploadStatus }`, so the workflows downloader (and a future upload phase) can reason about `ready` rows without a second query. The `last_seen_at` bump is unchanged.

### Out of scope

- The downloader change that supplies `filename` + `uploadStatus` — paired [`workflows-attachment-upload-status`](../workflows-attachment-upload-status/proposal.md).
- A standalone phase that uploads `ready` rows and flips them to `uploaded` — deferred follow-up.
- Chunks-of-100 to beat Airtable URL expiry — deferred per the meeting.

## Security review

No new auth surface, secret, or external integration. The endpoints stay behind the existing `x-internal-token` gate; input validation extends to the new enum (`upload_status` must be `ready` or `uploaded`). SQL stays parameterized via Drizzle.
