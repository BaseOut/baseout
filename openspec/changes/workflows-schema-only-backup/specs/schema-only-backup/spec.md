## ADDED Requirements

### Requirement: Schema-only runs skip record and attachment capture

The per-base backup task SHALL accept a `kind` of `full` or `schema` in its payload. For `kind='schema'`, the task SHALL capture the base schema and sync it (as a full run does) but SHALL NOT page records, write CSVs, or download attachments, and SHALL report `recordsProcessed=0` and `attachmentsProcessed=0`. For `kind='full'`, behavior is unchanged.

#### Scenario: Schema run captures structure only

- **WHEN** the task runs with `kind='schema'`
- **THEN** the base schema is captured and synced, no CSV is written and no attachment is downloaded, and the completion reports zero records and zero attachments with the per-table schema detail

#### Scenario: Full run unchanged

- **WHEN** the task runs with `kind='full'` (or `kind` absent, treated as `full`)
- **THEN** the task captures schema and data exactly as before
