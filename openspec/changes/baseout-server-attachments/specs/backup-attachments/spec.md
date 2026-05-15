## ADDED Requirements

### Requirement: Composite-ID attachment dedup

The engine SHALL dedupe attachments by the composite ID `{base_id}_{table_id}_{record_id}_{field_id}_{attachment_id}` per [PRD §2.8](../../../shared/Baseout_PRD.md). A new `attachment_dedup` table SHALL persist the mapping from composite ID to R2 object key. Before downloading any attachment, the engine SHALL check the dedup table; on hit, the existing R2 key SHALL be reused without a re-download.

#### Scenario: First-time attachment download

- **WHEN** the engine processes an attachment whose `composite_id` is not in `attachment_dedup`
- **THEN** the engine SHALL stream the file from Airtable to R2, INSERT a row into `attachment_dedup`, and return the new `r2_object_key`

#### Scenario: Dedup hit on second run

- **WHEN** the engine processes an attachment whose `composite_id` already exists in `attachment_dedup`
- **THEN** the engine SHALL UPDATE `last_seen_at = now()` and return the existing `r2_object_key` without re-downloading

#### Scenario: R2 write failure rolls back

- **WHEN** the engine attempts to stream an attachment to R2 and the R2 put fails
- **THEN** no row SHALL be inserted into `attachment_dedup` and the per-table page SHALL be marked failed for retry

### Requirement: Stream-through download

The engine SHALL stream attachment bytes from Airtable's CDN directly to the destination (managed R2 or BYOS) without buffering the full file to disk on Baseout infrastructure. The streaming SHALL use Workers' `ReadableStream` plumbing per [PRD §5.5](../../../shared/Baseout_PRD.md).

#### Scenario: Large attachment doesn't buffer

- **WHEN** an attachment > 100 MB is downloaded
- **THEN** the engine's memory footprint per attachment SHALL stay bounded (≈ 64 KB streaming buffer), regardless of file size

### Requirement: URL expiry refresh

Airtable attachment URLs expire ~1–2 hours after issue. When the engine encounters an attachment whose URL is older than 55 minutes (or whose freshness cannot be determined), the engine SHALL refresh the URL via the Airtable REST API before attempting the download.

#### Scenario: Stale URL is refreshed

- **WHEN** the engine reaches an attachment whose URL was issued > 55 minutes ago
- **THEN** the engine SHALL call `refreshAirtableUrl(ctx, attachmentId)` to obtain a fresh signed URL before fetching the bytes

### Requirement: CSV cell format

For Static-mode backups (CSV output), attachment field cells SHALL contain a semicolon-joined list of `r2_object_key` values, one per attachment in the field. The legacy `[N attachments]` placeholder SHALL no longer be written unless the Pro+ `skip_attachments` toggle is set.

#### Scenario: Cell with three attachments

- **WHEN** a record's attachment field has 3 attachments and the Space has `skip_attachments=false`
- **THEN** the CSV cell SHALL contain three R2 object keys joined by `;` (e.g. `<spaceId>/attachments/<hash1>/file1.jpg;<spaceId>/attachments/<hash2>/file2.jpg;<spaceId>/attachments/<hash3>/file3.jpg`)

#### Scenario: Empty attachment field

- **WHEN** a record's attachment field is empty
- **THEN** the CSV cell SHALL be empty (no semicolons, no count placeholder)

### Requirement: Engine progress includes attachment count

The `/runs/progress` callback payload SHALL include an `attachmentsDownloaded` counter that increments per attachment processed (dedup hit or miss both count). The `/runs/complete` payload SHALL include `attachmentCountByBase: { [baseId]: number }` for per-base aggregation into `backup_runs.attachment_count`.

#### Scenario: Progress event during attachment-heavy table

- **WHEN** the engine finishes a per-table page containing 50 attachments
- **THEN** the `/runs/progress` POST SHALL include `attachmentsDownloaded: 50` for that page tick

### Requirement: Pro+ opt-out toggle

`backup_configurations.skip_attachments` SHALL default to `false` and SHALL be editable only on Pro+ tiers. When set to `true`, the engine SHALL skip the attachment-download path entirely and write the legacy `[N attachments]` placeholder text in CSV cells.

#### Scenario: Lower-tier opt-out rejected

- **WHEN** a Launch Space PATCHes `skip_attachments=true` against `/api/spaces/:id/backup-config`
- **THEN** the route SHALL return 400 `{ error: 'skip_attachments_not_available_at_tier' }`

#### Scenario: Pro opt-out honored

- **WHEN** a Pro Space has `skip_attachments=true` and a backup run starts
- **THEN** the engine SHALL skip the downloader path, write zero R2 attachment objects, and emit `[N attachments]` placeholders in CSV cells
