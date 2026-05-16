## ADDED Requirements

### Requirement: Workflows-side base-docs finalization
After all per-table CSVs land successfully, the backup-base task (or a dedicated `finalize-base-docs` task) SHALL fetch the Base's automation, interface, and extension lists via Airtable's Metadata API and POST the composed docs blob to the engine.

#### Scenario: docs blob posted at run end
- **WHEN** a backup-base run completes with `status='succeeded' | 'trial_truncated'`
- **THEN** the task SHALL call Airtable Metadata API endpoints for automations, interfaces, and extensions scoped to the current Base
- **AND** SHALL POST the composed blob to `/api/internal/runs/:runId/docs` with `x-internal-token`
- **AND** SHALL emit `event: 'base_docs_finalized'` once per Base

#### Scenario: Metadata API failure is non-fatal
- **WHEN** the Airtable Metadata API returns 5xx during finalization
- **THEN** the run status SHALL remain whatever the backup body produced (typically `'succeeded'`)
- **AND** the docs blob POST SHALL be skipped
- **AND** the task SHALL emit `event: 'base_docs_finalize_skipped'` with the upstream status code
