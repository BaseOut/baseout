## ADDED Requirements

### Requirement: Attachment upload-status tracking

The `attachment_dedup` table SHALL record, for each attachment, the source `filename`, an `upload_status` of `ready` or `uploaded`, and an `uploaded_at` timestamp. `ready` means the bytes are written to a staging location (local disk) but not yet at the real destination; `uploaded` means the bytes are at the destination (managed R2 or a BYOS provider). The `upload_status` column SHALL default to `uploaded` so pre-existing rows — all of which were written directly to a real destination — remain truthful without backfill.

#### Scenario: Recording a staged attachment

- **WHEN** the `/api/internal/attachments/record` endpoint receives an entry with `uploadStatus: "ready"`
- **THEN** the row SHALL persist `upload_status='ready'`, the supplied `filename`, and `uploaded_at` SHALL be NULL

#### Scenario: Recording an uploaded attachment

- **WHEN** the endpoint receives an entry with `uploadStatus: "uploaded"` (or with `uploadStatus` omitted)
- **THEN** the row SHALL persist `upload_status='uploaded'` and set `uploaded_at = now()`

#### Scenario: Legacy row default

- **WHEN** a row that predates this change (no `upload_status` written) is read back
- **THEN** its `upload_status` SHALL be `uploaded`

#### Scenario: Invalid status rejected

- **WHEN** a `/record` entry carries an `uploadStatus` that is neither `ready` nor `uploaded`
- **THEN** the endpoint SHALL respond `400 invalid_request` and persist nothing

### Requirement: Lookup returns upload status

The `/api/internal/attachments/lookup` endpoint SHALL return, for each composite-ID hit, both the `storageKey` and the `uploadStatus`, so a consumer can distinguish staged (`ready`) from shipped (`uploaded`) attachments without a second query. The `last_seen_at` bump on hits SHALL be preserved.

#### Scenario: Hit carries status

- **WHEN** a lookup matches a persisted composite ID
- **THEN** the response `hits` value for that composite ID SHALL be `{ storageKey, uploadStatus }` and the row's `last_seen_at` SHALL be bumped to `now()`
