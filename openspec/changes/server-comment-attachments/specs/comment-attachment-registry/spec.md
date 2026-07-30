## ADDED Requirements

### Requirement: Comment-attachment registry table

The per-Space schema SHALL include a `bo_at_comment_attachments` table, mirrored in `packages/db-schema/src/space/sqlite.ts`, `space/pg.ts`, and `space/pg-ddl.ts`, recording for each comment-sourced attachment: `airtable_comment_id`, `airtable_attachment_id`, `base_id`/`table_id`/`record_id` tie-backs, source `url`, `filename`, `size_bytes`, `mime_type`, `content_hash`, `storage_key`, an `upload_status` (`pending` | `ready` | `uploaded`), a lifecycle `status` (`active` | `deleted`), first/last-seen run and timestamp stamps, and `uploaded_at`. The table SHALL be unique on `(airtable_comment_id, airtable_attachment_id)`.

#### Scenario: Registry row identity

- **WHEN** the same attachment on the same comment is registered twice (task retry)
- **THEN** exactly one row SHALL exist for that `(airtable_comment_id, airtable_attachment_id)` pair, with its seen stamps updated

### Requirement: Extraction during comments-sync persistence

When the engine persists a comment capture via the `comments-sync` route, it SHALL parse the comment object's optional `attachments` array (per entry: required `id`, `filename`, `url`; optional `type`, `size`, `width`, `height`, `thumbnails`) and upsert a `bo_at_comment_attachments` row per attachment with `upload_status='pending'`, mapping `id → airtable_attachment_id`, `type → mime_type`, `size → size_bytes` (width/height/thumbnails are not stored — derived metadata). A row whose identity already exists in `ready` or `uploaded` state SHALL NOT be regressed. The sync response SHALL include the resulting pending set — per entry: `commentAttachmentId`, `commentId`, `recordId`, the source `url`, and `filename` — so the in-flight capture task can download while the URL is live.

#### Scenario: New comment attachment discovered

- **WHEN** a synced comment payload contains an attachment reference not present in the registry
- **THEN** a `pending` row SHALL be created and the entry SHALL appear in the sync response's pending set

#### Scenario: Already-uploaded attachment re-observed

- **WHEN** a synced comment payload contains an attachment whose registry row is `uploaded`
- **THEN** the row's `upload_status` SHALL remain `uploaded` and the entry SHALL NOT appear in the pending set

### Requirement: Pending recovery through comments-plan

The `comments-plan` route SHALL include in its `refresh` set any record having `bo_at_comment_attachments` rows that are `active` and not `uploaded`, regardless of comment-count delta, so a subsequent capture re-fetches those comments and yields fresh attachment URLs.

#### Scenario: Stuck pending row forces re-fetch

- **WHEN** a run dies after registering a pending comment attachment and the next run's observed comment count for that record is unchanged
- **THEN** the plan response SHALL still list that record in `refresh`

### Requirement: Comment-attachment lifecycle follows comments

When a comment is marked deleted, or a re-captured comment no longer includes a previously registered attachment, the corresponding registry rows SHALL be marked `status='deleted'`. Stored bytes SHALL be retained per the record-backup retention rules — deletion is a lifecycle marker, not a purge.

#### Scenario: Parent comment deleted

- **WHEN** the comment-diffing lifecycle marks a comment deleted
- **THEN** all of that comment's attachment registry rows SHALL be marked `deleted` and their bytes SHALL remain in storage

### Requirement: Storage layout for comment attachments

Comment attachments SHALL be written under `attachments/comments/<commentId>/<filename>` within the base's backup output, for every storage destination (managed R2 and BYOS alike). Filename collisions within a single comment SHALL be disambiguated with the attachment id, matching the field-attachment writer convention.

#### Scenario: Two attachments on one comment share a filename

- **WHEN** a comment carries two attachments both named `photo.jpg`
- **THEN** both SHALL be written under that comment's folder with distinct names, at least one carrying the attachment-id suffix

### Requirement: Tier gating rides the comments capability

Comment-attachment extraction, registration, and download SHALL be governed by the same `commentsEnabled` capability flag as comment backup — no separate gate. When the flag is off, comments-sync SHALL NOT create registry rows and the pending set SHALL be empty.

#### Scenario: Comments disabled for the tier

- **WHEN** a capture arrives for a Space whose tier has `commentsEnabled=false`
- **THEN** no `bo_at_comment_attachments` rows SHALL be created
