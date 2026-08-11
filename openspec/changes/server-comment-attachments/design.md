# server-comment-attachments — Design

## Context

`server-comments` persists record comments into `bo_at_comments`, including the `raw` payload, via the batched `comments-sync` internal route; `workflows-comments` captures them with count-delta fan-out control. Attachment references inside those payloads are currently dead weight: nothing extracts them, and Airtable attachment URLs expire shortly after issuance, so the bytes must be fetched in the same run that observes them.

The field-attachment pipeline this must align with: the workflows downloader calls `/api/internal/attachments/lookup` (dedup read) → downloads misses → writes via the active storage writer → `/api/internal/attachments/record` (registry upsert). The registry (`bo_at_attachments`) carries the `pending/ready/uploaded` lifecycle specced in `openspec/specs/backup-attachments/spec.md`. Identity there is a `composite_id` derived from `table + field + record`.

## Goals / Non-Goals

**Goals:**
- Register-first: a discovered comment attachment exists as a `pending` registry row *before* any download is attempted, so an interrupted run leaves a visible work item, not a silent gap (founder direction, 2026-07-29).
- Same-run download of the pending set (URL expiry), with a recovery path for rows that survive a failed run.
- One canonical extraction point; idempotent under task retries.
- Storage layout: `attachments/comments/<commentId>/<filename>` within the base output.

**Non-Goals:**
- Byte-level cross-source dedup at write time (a field attachment and comment attachment with identical bytes both get written; the media index's `content_hash`/checksum machinery is the future dedup layer — `server-media-index` owns that).
- Web UI for browsing comment attachments (follow-up web change once rows exist).
- Restore of comment attachments (comments restore is itself unsolved — Airtable has no comment-write API; explicitly out of scope, same as `server-comments`).

## Decisions

**1. Separate `bo_at_comment_attachments` table, not a `source` column on `bo_at_attachments`.**
The field registry's primary key is a composite of `table + field + record` — comment attachments have no field anchor, so a shared table means a nullable `fieldId`, a second composite-id scheme, and a discriminator threaded through every registry query and the dedup-skip contract. A dedicated table keyed `(airtable_comment_id, airtable_attachment_id)` reuses the *lifecycle* (the part that's proven) without contaminating the *identity* (the part that doesn't fit). Alternative considered and rejected: hanging comment attachments off `bo_at_asset_refs` with a nullable `fieldId` — the media index is an overlay, not the upload work-queue; `upload_status` semantics live in the registries.

**2. Extraction happens engine-side, inside comments-sync persistence.**
The engine already receives every comment payload; parsing attachment references there gives one canonical parser colocated with persistence, register-first semantics for free, and zero extra Airtable calls. The sync **response** returns the pending set `{commentAttachmentId, url, filename, recordId, commentId}` so the in-flight workflows task downloads immediately while URLs are live. Alternative rejected: workflows-side extraction — it duplicates payload parsing in a second codebase and creates registry rows only after download succeeds, violating register-first.

**3. Pending recovery rides the comments-plan refresh set.**
If a run dies between registration and upload, the pending row's URL is expired and the count-delta optimization would skip the comment forever (unchanged count → no re-fetch → no fresh URL). Fix: `comments-plan` SHALL include, in its `refresh` set, any record with `bo_at_comment_attachments` rows stuck non-`uploaded` — forcing a comment re-fetch that yields fresh URLs and a new pending set. Bounded cost: proportional to stuck rows, which are rare and self-healing.

**4. Registry endpoints widen rather than fork.**
`/attachments/lookup` and `/record` accept a `source: 'comment'` entry shape (comment-scoped key instead of composite id) and answer with the same `{storageKey, uploadStatus}` contract. One downloader code path in workflows, two registries behind the endpoint. Alternative rejected: separate `/comment-attachments/*` routes — more surface, same semantics.

**5. Filename collisions within a comment.**
Layout is `attachments/comments/<commentId>/<filename>`; if two attachments on one comment share a filename, the writer applies the same disambiguation convention as the field-attachment writer (suffix with the attachment id). The `<commentId>` folder level makes cross-comment collisions structurally impossible.

**6. Lifecycle mirrors comments.**
Comment deleted, or attachment absent from a re-captured comment → row marked `deleted` (soft), bytes retained per record-backup retention (`server-retention-and-cleanup`). Comment-attachment bytes count toward the same storage metering as field attachments (pricing direction, 2026-07-29).

## Payload shape (confirmed from Airtable API docs, 2026-07-29)

The comment object carries an optional `attachments` array; each entry:

| API field | Registry column | Notes |
|---|---|---|
| `id` (required) | `airtable_attachment_id` | unique attachment id |
| `filename` (required) | `filename` | |
| `url` (required) | `url` | **expires exactly 2 hours** after being returned — Airtable's own docs say download, don't persist the URL |
| `type` (optional) | `mime_type` | content type |
| `size` (optional) | `size_bytes` | |
| `width`/`height` (optional) | *not stored* | image dimensions — regenerable metadata; the media index can carry them later if wanted |
| `thumbnails` (optional) | *not stored* | we back up originals; thumbnails are derived artifacts |

`content_hash` is computed at download time (the API provides none). The base comment shape (`id`, `author`, `text`, `createdTime`, `lastUpdatedTime`, `mentioned`, `parentCommentId`) is unchanged from what `server-comments` already persists.

## Risks / Trade-offs
- **[2-hour URL expiry inside large runs]** A big comment sweep could deliver pending URLs that expire before the downloader reaches them (hard 2-hour window per Airtable docs) → downloader treats 4xx-on-download as "leave pending"; recovery path (Decision 3) picks them up next run.
- **[Retry double-processing]** Task retries re-POST the same capture → extraction upsert is idempotent on `(airtable_comment_id, airtable_attachment_id)`; download re-checks lookup before writing.
- **[Registry growth]** Comment attachments inflate the per-Space DB → same seen-run stamps and retention hooks as everything else; volume expected small relative to field attachments (On2Air telemetry: comments usage is currently zero, so this is forward-looking coverage, not a migration burden).

## Migration Plan

Per-Space schema-version bump adding the table (all three mirrors), sequenced atop `system-per-space-db` — identical mechanics to the `bo_at_comments` migration. Rollback: table is additive; endpoints ignore unknown source shapes when the flag is off.

## Open Questions

- Whether an attachment-only edit to a comment (attachment added/removed, text unchanged) bumps `lastUpdatedTime` or affects `commentCount` — determines whether count-delta can miss attachment changes on existing comments. Verify during the fixture-capture task; if invisible, it's a documented blind spot alongside the existing same-count edit case.
- Whether the PRD/Features amendment names comment attachments inside the comments entity row or as its own line (owner: Dan, rides the existing `server-comments` blocker).
