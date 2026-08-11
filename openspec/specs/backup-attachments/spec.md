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

### Requirement: Downloader stamps filename and upload status

When the attachment downloader records a newly written attachment, it SHALL include the source `filename` and an `uploadStatus` that reflects the active storage destination: `ready` when the active writer stages to local disk (`local_fs`), `uploaded` when the writer targets a real destination (managed R2 or a BYOS provider). The status SHALL be injected once per task run from the resolved `storageType`.

#### Scenario: Local-disk write records ready

- **WHEN** the downloader writes an attachment miss while the active `storageType` is `local_fs`
- **THEN** the recorded entry SHALL carry `uploadStatus: "ready"` and the attachment's `filename`

#### Scenario: Destination write records uploaded

- **WHEN** the downloader writes an attachment miss while the active `storageType` is managed R2 or a BYOS provider
- **THEN** the recorded entry SHALL carry `uploadStatus: "uploaded"` and the attachment's `filename`

### Requirement: Dedup skip preserves prevention of redundant uploads

The downloader SHALL continue to skip downloading and writing any attachment whose composite ID is already present, using the widened lookup response that carries `{ storageKey, uploadStatus }`.

#### Scenario: Hit short-circuits the write

- **WHEN** `lookup` returns a hit for an attachment's composite ID
- **THEN** the downloader SHALL return the existing `storageKey` without re-downloading or re-writing the bytes
