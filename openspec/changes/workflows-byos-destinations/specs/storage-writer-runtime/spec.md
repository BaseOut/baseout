## ADDED Requirements

### Requirement: StorageWriter is the only write surface in the backup-base task
`apps/workflows/trigger/tasks/backup-base.task.ts` SHALL load the active `StorageDestination` via engine-callback, instantiate the matching `StorageWriter` via `makeStorageWriter`, and route every CSV + attachment write through `writer.writeFile`. Direct R2 / fs writes from the task body are FORBIDDEN.

#### Scenario: writer lifecycle per task invocation
- **WHEN** a backup-base task starts
- **THEN** it SHALL call `loadStorageDestination(spaceId)` via `POST /api/internal/spaces/:id/storage-destination`
- **AND** SHALL instantiate the writer via `makeStorageWriter(destination, env, masterKey)`
- **AND** SHALL call `writer.init()` before the per-table loop
- **AND** SHALL call `writer.cleanup()` in the `finally` block — even on task failure

#### Scenario: per-provider strategy
- **WHEN** a `StorageDestination` row specifies a non-R2 provider (Google Drive, Dropbox, Box, OneDrive, S3, Frame.io)
- **THEN** `makeStorageWriter` SHALL dispatch to the corresponding `_lib/storage-writers/<provider>.ts` implementation
- **AND** the implementation SHALL respect provider-specific upload patterns (resumable session, multipart, etc.) declared in the implementation's `proxyStreamMode` flag
