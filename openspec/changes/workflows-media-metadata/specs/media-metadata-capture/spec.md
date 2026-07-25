# media-metadata-capture

## ADDED Requirements

### Requirement: Attachment metadata is emitted during export

For every attachment the backup task processes (written or dedup-skipped), it SHALL emit metadata — checksum, content type, size, storage locator, Airtable attachment id, base/table/record/field ids, per-record filename — delivered in batches to the engine's media-sync route during the fan-out, marking a record `complete` only when all its attachments processed.

#### Scenario: Written attachment

- **WHEN** the writer stores a new attachment to managed R2
- **THEN** a metadata entry with its checksum and R2 locator reaches media-sync in a batch

#### Scenario: Dedup-skipped attachment

- **WHEN** the writer skips bytes because the checksum already exists
- **THEN** a metadata entry still emits with that checksum and the new record's ref context

### Requirement: Metadata delivery never compromises the backup

Media-sync delivery SHALL be best-effort: transport failures record `media: partial|skipped (reason)` in run progress without changing the run outcome or the attachment export; records with unfinished attachment processing SHALL NOT be marked `complete`; only records visited by the run SHALL appear in batches.

#### Scenario: Media-sync outage mid-run

- **WHEN** the media-sync route is unreachable during a run
- **THEN** attachments export normally, the run completes with its normal status, and progress shows `media: skipped` with the transport reason

#### Scenario: Incremental run

- **WHEN** an incremental run visits 20 of 5,000 records
- **THEN** only those 20 records' attachment metadata is delivered
