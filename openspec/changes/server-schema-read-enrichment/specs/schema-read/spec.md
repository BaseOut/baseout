## ADDED Requirements

### Requirement: The schema-read payload carries field configuration derived from captured options
The schema-read broker SHALL emit, per field, the type-specific configuration already
captured in `bo_at_fields.options`: linked-table target (`linkedTableId`,
`allowsMultiple`, `inverseFieldId`), formula (`formula`, `referencedFieldIds`),
lookup/rollup anchoring (`lookupViaFieldId`, `lookupTargetFieldId`), and select
`choices`. Fields whose type carries no such config SHALL emit nulls. Malformed or
absent options SHALL degrade to nulls, never an error.

#### Scenario: A linked-record field
- **WHEN** the broker reads a field of type `multipleRecordLinks` whose options name a linked table and an inverse link field
- **THEN** the payload row carries `linkedTableId`, `allowsMultiple` (false when `prefersSingleRecordLink`), and `inverseFieldId`

#### Scenario: A formula field
- **WHEN** the broker reads a `formula` field whose options carry the expression and referenced field ids
- **THEN** the payload row carries `formula` and `referencedFieldIds`

### Requirement: The schema-read payload carries annotations and removal dates
The schema-read broker SHALL emit, per base/table/field, the AI annotation
(`aiDescription`) and the internal override (`descriptionOverride`), and per entity of
any kind a `removedAt` ISO timestamp resolved from the lifecycle pointer
(`first_unseen_run` → that base-run's completion time) — null while the entity is
active or the run row lacks a completion time.

#### Scenario: A removed field
- **WHEN** the broker reads a field with `status='removed'` whose `first_unseen_run` points at a completed base run
- **THEN** the payload row carries `removedAt` equal to that run's completion timestamp
