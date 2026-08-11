# media-index

## ADDED Requirements

### Requirement: Attachment metadata persists as deduplicated assets with references

The engine SHALL expose an INTERNAL_TOKEN-gated route `POST /api/internal/spaces/media-sync` accepting batched attachment metadata, upserting `bo_at_assets` by content checksum (content type, size, storage locator, first/last-seen) and `bo_at_asset_refs` by Airtable attachment id (base/table/record/field, per-record filename, lifecycle). Identical bytes appearing in multiple records SHALL yield one asset with multiple refs.

#### Scenario: Dedup across records

- **WHEN** a batch reports the same checksum from three records
- **THEN** one asset row exists with three ref rows

#### Scenario: Same bytes, different names

- **WHEN** two refs of one asset carry different filenames
- **THEN** each ref preserves its own filename

### Requirement: Ref lifecycle is deletion-safe per record

For records marked `complete` in a batch, refs absent from that record's capture SHALL be marked removed; records not in a batch SHALL leave their refs untouched. Assets reaching zero live refs SHALL be flagged for retention-driven cleanup and SHALL NOT be deleted by sync itself.

#### Scenario: Attachment removed from a record

- **WHEN** a `complete` re-capture of a record omits a previously seen attachment id
- **THEN** that ref is marked removed while the asset row survives for retention to judge

#### Scenario: Incremental run safety

- **WHEN** a batch omits a record entirely
- **THEN** that record's refs are unchanged

### Requirement: The library read API serves filtered, totaled, newest-first queries

The engine SHALL expose INTERNAL_TOKEN-gated read routes: a paginated asset listing filterable by content-type class, base/table, size range, and capture date (default newest-first, refs included); a totals route returning the filtered count and summed size; and an asset-detail route with all refs and capture history.

#### Scenario: Filtered totals

- **WHEN** the totals route is queried for images over 10 MB in one base
- **THEN** it returns that subset's count and combined size

#### Scenario: Newest-first listing

- **WHEN** the listing is queried without sort parameters
- **THEN** assets return by most-recent capture with keyset pagination

### Requirement: Downloads are storage-aware and never proxy customer storage

For Baseout-stored (managed R2) assets the engine SHALL stream the object via a read-only R2 bucket binding on a space-scoped, INTERNAL_TOKEN-gated download route. For destination-stored assets the API SHALL return the provider locator and SHALL NOT fetch or proxy bytes from customer storage.

#### Scenario: R2-stored download

- **WHEN** the download route is called for a managed-storage asset in the caller's Space
- **THEN** the object streams with correct content type and filename

#### Scenario: BYOS asset

- **WHEN** the detail route returns an asset stored only on a customer destination
- **THEN** it carries `{kind:'destination', provider, locator}` and the download route responds with a non-proxying redirect-style answer

#### Scenario: Cross-space access denied

- **WHEN** the download route is called for an asset outside the resolved Space
- **THEN** the request is rejected and no object access occurs
