# server-comment-attachments — Proposal

## Why

Airtable record comments can carry attachments, and the backup pipeline silently drops them today: [`server-comments`](../server-comments/proposal.md) persists the comment rows (including the raw payload where attachment references appear), but nothing downloads the bytes — and Airtable attachment URLs expire shortly after issuance, so a comment attachment that isn't captured in the same run that observed it is unrecoverable once the source record or base is lost. This closes the last known gap in media coverage (2026-07-29 founder direction, raised during the pricing-workshop review of what "comments backup" includes).

## What Changes

- **New per-Space table `bo_at_comment_attachments`** — the upload registry for comment-sourced media, deliberately separate from `bo_at_attachments`: that registry's identity is a `composite_id` derived from `table + field + record` (all NOT NULL), and comment attachments have no field anchor. Keyed by `(airtable_comment_id, airtable_attachment_id)` with record/table/base tie-backs, source URL + filename/size/mime, `content_hash`, `storage_key`, and the **same `pending → ready → uploaded` upload-status lifecycle** as the field-attachment registry (see `openspec/specs/backup-attachments/spec.md`). Mirrored in all three schema files (`packages/db-schema/src/space/{sqlite,pg,pg-ddl}.ts`) per the established pattern.
- **Extraction on comments-sync:** when the engine persists a comment capture (the existing `comments-sync` route), it SHALL parse attachment references out of the comment payload and upsert `bo_at_comment_attachments` rows with `upload_status='pending'`, and the sync response SHALL return the pending set (id + expiring URL) so the in-flight workflows task can download within the same run.
- **Comment-scoped registry endpoints:** the internal attachment registry contract (`/api/internal/attachments/lookup` + `/record`) gains comment-scoped handling so the downloader can dedup-check and record comment attachments with the same semantics as field attachments (content-hash dedup applies across both sources).
- **Lifecycle:** a comment attachment whose parent comment is deleted (or which disappears from a re-captured comment) is marked deleted, following the comment-diffing lifecycle — bytes are retained per the record-backup retention rules, same as field attachments.
- **Capture/download half is the paired [`workflows-comment-attachments`](../workflows-comment-attachments/proposal.md)** — this change owns the table, the extraction, and the endpoint contract; land this change first (same sequencing as server-comments → workflows-comments).

**Scope flag** (per CLAUDE.md §1): inherits the `server-comments` scope conflict — comment backup is absent from the v1.1 scope-locked PRD/Features matrix, and the pending amendment (entity row, capability, tier) must cover attachments-in-comments explicitly. Tier gating rides the comments capability (`commentsEnabled`): if a tier backs up comments, it backs up their attachments — no separate gate. Comment-attachment bytes count toward the same storage metering as field attachments (pricing-workshop direction, 2026-07-29).

## Capabilities

### New Capabilities

- `comment-attachment-registry`: engine-side registry and lifecycle for comment-sourced attachments — the `bo_at_comment_attachments` table, extraction of attachment references during comments-sync persistence (returning the pending set for in-run download), comment-scoped lookup/record endpoint handling, and deletion/retention lifecycle aligned with comments and field attachments.

### Modified Capabilities

- `backup-attachments`: the registry endpoint contract widens to cover comment-scoped entries (lookup/record accept and return the comment source shape); the `pending/ready/uploaded` lifecycle requirement now governs both registries.

## Impact

- **App:** `apps/server` — comments-sync persistence gains extraction + response widening; attachments lookup/record routes gain comment-scoped handling; per-Space migration for the new table (sequenced atop `system-per-space-db`, same as `bo_at_comments`).
- **Package:** `packages/db-schema` — new table in `space/sqlite.ts`, `space/pg.ts`, `space/pg-ddl.ts`.
- **Cross-repo contract:** the widened comments-sync response and comment-scoped record/lookup shapes are owned by THIS change's spec; `workflows-comment-attachments` consumes them.
- **Storage layout contract:** comment attachments live under `attachments/comments/<commentId>/<filename>` within the base's backup output (folder convention consumed by the workflows change and any BYOS writer).
- **No new secrets. No OAuth scope change** (`data.recordComments:read` already granted). **No master-DB schema change.**
- **Blockers:** `server-comments` must land first (table + sync route this extends); PRD/Features amendment per the scope flag.
