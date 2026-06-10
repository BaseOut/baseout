## ADDED Requirements

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
