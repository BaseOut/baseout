# schema-relationships

Engine relationship read/write for the Relationships tab: API-derived
relationships computed on read, plus persisted synced-view candidates.

## ADDED Requirements

### Requirement: Derive API relationships from captured fields
The engine SHALL compute a base's API-derived relationships from `bo_at_fields`/
`bo_at_tables` without a separate persisted table: linked records, formulas,
rollups, lookups, and lastModified. Each derived relationship SHALL carry an
anchor, referenced entities, a computed validity, and a removed-history flag from
entity lifecycle status.

#### Scenario: Linked-record field
- **WHEN** a base has a `multipleRecordLinks` field pointing at another table
- **THEN** the read returns a `linkedRecords` relationship referencing that table, valid when both are active

#### Scenario: Reference to a removed entity
- **WHEN** a relationship's only referenced entity is removed from Airtable
- **THEN** it is returned with `valid=false` and `hasRemovedHistory=true`

### Requirement: Synced-view candidates with a lifecycle
The engine SHALL persist synced-view candidates (`bo_at_synced_view_candidates`,
per-Space schema v4): one row per unordered table pair, with status
`inferred|confirmed|dismissed` and origin `inferred|user`. The read SHALL exclude
dismissed candidates by default.

#### Scenario: Read excludes dismissed by default
- **WHEN** a base has a dismissed synced-view candidate
- **THEN** the default read omits it; an explicit include-dismissed read returns it

### Requirement: Engine-side inference, never re-proposing dismissals
The engine SHALL infer synced-view candidates from the per-Space schema (field
name + type overlap above a threshold) and upsert them, leaving dismissed pairs
untouched. Inference SHALL run on demand via `/relationships/sync` and best-effort
after each schema capture, and SHALL NOT fail the schema capture on error.

#### Scenario: Inference proposes a high-overlap pair
- **WHEN** two tables in a base share most field name+type signatures
- **THEN** a synced-view candidate is upserted with status `inferred` and a match score

#### Scenario: Dismissed pairs are not re-proposed
- **WHEN** a previously dismissed pair is re-evaluated by inference
- **THEN** it remains dismissed (not re-inserted as inferred)

### Requirement: Confirm / dismiss / create
The engine SHALL support confirming or dismissing an inferred candidate by id, and
creating a user-authored synced view by table pair (canonicalized + idempotent on
the unique pair). All relationship routes SHALL be `INTERNAL_TOKEN`-gated and
validate the space id + body.

#### Scenario: Confirm an inferred candidate
- **WHEN** a confirm is posted for a candidate id
- **THEN** its status becomes `confirmed` and it remains in the default read

#### Scenario: Create a user synced view
- **WHEN** a create is posted with a base + two distinct tables
- **THEN** a `confirmed` / `user` candidate exists for that pair (deduped on the canonical pair)
