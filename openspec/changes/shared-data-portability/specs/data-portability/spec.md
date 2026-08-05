# data-portability

Customer-facing "export all my data / leave Airtable" portable full-export — a one-click, self-contained archive of every base's latest snapshot across an organization's Spaces.

## ADDED Requirements

### Requirement: Customer-initiated full-organization export

An organization SHALL be able to initiate, in one click, an export of all of its data across every Space it owns. Initiation SHALL be restricted to organization administrators and SHALL be gated by an entitlement resolved through the DB-native `resolveEntitlements` choke point — never a Stripe product-name string or product metadata. Initiation SHALL be validated server-side and audited, and only one export SHALL be in flight per organization at a time.

#### Scenario: Entitled admin initiates an export

- **WHEN** an organization administrator on an entitled tier clicks "Export all my data"
- **THEN** a full-organization export is enqueued for that organization and the initiation is recorded in the audit trail

#### Scenario: Unentitled tier is blocked

- **WHEN** a member of an organization whose resolved entitlements do not include data export attempts to initiate one
- **THEN** the export is refused and no export task is enqueued

#### Scenario: Non-admin or unauthenticated request is rejected

- **WHEN** a non-admin member, or an unauthenticated request, hits the export-initiation surface
- **THEN** the existing auth/authorization enforcement rejects it exactly as it does any other admin-only mutating action

### Requirement: Self-contained archive built from the latest snapshots

The export SHALL assemble a single self-contained archive from each base's most recent completed backup snapshot (the existing per-table CSVs), organized as `{SpaceName}/{BaseName}/{TableName}.csv`, without re-scanning Airtable. The archive SHALL succeed even when the organization's Airtable connection is invalid or absent. A base that has no completed snapshot SHALL be represented explicitly in the manifest rather than silently omitted.

#### Scenario: Archive mirrors the snapshot layout

- **WHEN** an organization with two Spaces, each holding backed-up bases, exports its data
- **THEN** the archive contains one folder per Space, one sub-folder per Base, and one CSV per table, drawn from each base's latest snapshot

#### Scenario: Export works without a live Airtable connection

- **WHEN** an organization whose Airtable connection has been invalidated initiates an export and completed snapshots exist
- **THEN** the export still produces a complete archive from those snapshots

#### Scenario: A base with no snapshot is disclosed

- **WHEN** an organization owns a base that has never completed a backup
- **THEN** the manifest lists that base with a null snapshot rather than the archive silently excluding it

### Requirement: Machine-readable manifest with schema and record counts

The archive SHALL include a root `manifest.json` describing the export: the organization identity, the generation timestamp, the record format(s) included, a manifest schema version, and — for every Space, Base, and Table — the field list with field types, the record count, and the source snapshot's timestamp. Record counts in the manifest SHALL match the rows present in the corresponding CSV (excluding the header).

#### Scenario: Manifest counts match the CSVs

- **WHEN** a table's snapshot CSV contains 1,240 data rows
- **THEN** the manifest reports a record count of 1,240 for that table and names its fields and types

#### Scenario: Manifest stamps snapshot provenance

- **WHEN** a base was last backed up at a known time
- **THEN** the manifest records that snapshot timestamp for the base, so the customer knows how fresh the exported data is

### Requirement: Human-safe CSV serialization

CSV files in the export SHALL be neutralized against spreadsheet formula injection — any cell whose value begins with a formula trigger (`=`, `+`, `-`, `@`, tab, carriage return, or line feed) SHALL be rendered as text — and SHALL be RFC-4180 quoted with embedded quotes doubled, matching the guard already used for schema export. This applies to the human-facing CSV format specifically; the machine round-trip format is exempt from the text-neutralizing prefix.

#### Scenario: A formula-shaped value is exported as text

- **WHEN** a record field's value is `=CMD()` and the base is exported to CSV
- **THEN** the exported cell is prefixed so a spreadsheet treats it as literal text rather than evaluating it as a formula

### Requirement: Selectable record format (CSV baseline, JSON optional)

The export SHALL always produce CSV. WHEN JSON output is selected, the archive SHALL additionally include a JSON record file per table, preserving native array/object values losslessly, and the selected format(s) SHALL be recorded in the manifest.

#### Scenario: JSON requested alongside CSV

- **WHEN** a staff-entitled member selects the CSV + JSON format and exports a base
- **THEN** the archive contains both a CSV and a JSON file for each table, and the manifest records that both formats are present

### Requirement: Archive delivery is authenticated and organization-scoped

The completed archive SHALL be delivered either by writing it to the organization's configured Storage Destination via the existing storage-writer factory, or via a time-boxed, authenticated download link, or both. Any download link SHALL be authenticated, scoped to the initiating organization, and expiring; it SHALL NOT expose another organization's archive and SHALL stop working after it expires. Delivery SHALL be audited.

#### Scenario: Delivered to the organization's storage destination

- **WHEN** an export completes for an organization with a configured Storage Destination
- **THEN** the archive is written to that destination and the delivery is recorded

#### Scenario: Download link is scoped and expiring

- **WHEN** a download link for an organization's archive is requested by a member of another organization, or after the link has expired
- **THEN** the request is rejected and the archive is not served

### Requirement: Progress reporting and completion notification

The export SHALL report progress while the archive is being assembled and SHALL notify the initiating user when it completes, mirroring the backup-run lifecycle. On failure, the export SHALL surface a reason rather than completing silently.

#### Scenario: Completion is notified

- **WHEN** an export finishes assembling and delivering the archive
- **THEN** the initiating user is notified that the export is ready, with the retrieval location or link

#### Scenario: Failure surfaces a reason

- **WHEN** an export fails during assembly
- **THEN** the export is marked failed with a reason surfaced to the initiator, and no partial archive is presented as complete

### Requirement: Data boundary — organization-scoped, metadata-safe

An export SHALL read only the initiating organization's own snapshots and the master-DB metadata that organization owns. It SHALL NOT read any other organization's data, and SHALL NOT expose token values, `*_enc`-derived data, or plaintext credentials anywhere in the archive or manifest.

#### Scenario: Cross-organization isolation

- **WHEN** an export runs for organization A
- **THEN** the archive contains only organization A's Spaces, Bases, and records, and nothing belonging to any other organization

#### Scenario: No secrets in the archive

- **WHEN** an archive and its manifest are produced
- **THEN** they contain record data and schema/count metadata only — never OAuth tokens, encrypted-column values, or storage credentials

### Requirement: No cross-platform write (V1 boundary)

The export SHALL produce a portable archive only and SHALL NOT write data into any second platform — it SHALL NOT create Airtable bases, push records into another SaaS, or otherwise load the exported data anywhere on the customer's behalf. Cross-platform migration and cloning remain V2 (PRD §3.8) and depend on a separate platform-abstraction write-adapter outside this change.

#### Scenario: Export never calls a platform write API

- **WHEN** an export runs to completion
- **THEN** it only reads snapshots and writes the archive to storage — it never invokes an Airtable (or other platform) record- or base-creation API
