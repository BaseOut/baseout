## ADDED Requirements

### Requirement: Registry endpoints accept comment-scoped entries

The `/api/internal/attachments/lookup` and `/api/internal/attachments/record` endpoints SHALL accept entries carrying `source: 'comment'` with a comment-scoped key (`airtableCommentId` + `airtableAttachmentId`) in place of the field-attachment composite ID. Comment-scoped entries SHALL be served from `bo_at_comment_attachments` with the same response contract as field entries — lookup hits return `{ storageKey, uploadStatus }` and bump `last_seen_at`; record upserts persist `upload_status` per the existing `ready`/`uploaded` semantics (staged to local disk vs. written to the real destination). Entries without a `source` SHALL default to the field-attachment behavior unchanged.

#### Scenario: Comment-scoped lookup hit

- **WHEN** a lookup entry with `source: 'comment'` matches a registered comment attachment
- **THEN** the response SHALL carry that row's `{ storageKey, uploadStatus }` and the row's `last_seen_at` SHALL be bumped

#### Scenario: Comment-scoped record after destination write

- **WHEN** a record entry with `source: 'comment'` and `uploadStatus: "uploaded"` arrives after the downloader wrote the bytes to the active destination
- **THEN** the registry row SHALL persist `upload_status='uploaded'`, the `storage_key`, and `uploaded_at = now()`

#### Scenario: Sourceless entries unaffected

- **WHEN** a lookup or record entry arrives without a `source` value
- **THEN** it SHALL be handled exactly as before this change (field-attachment composite-ID semantics)

#### Scenario: Invalid source rejected

- **WHEN** an entry carries a `source` that is neither omitted nor `'comment'`
- **THEN** the endpoint SHALL respond `400 invalid_request` and persist nothing
