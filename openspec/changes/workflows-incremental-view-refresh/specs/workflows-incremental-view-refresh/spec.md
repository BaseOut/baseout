## ADDED Requirements

### Requirement: Record passes refresh the affected query views

An incremental backup pass SHALL call `IncrementalDb.regenerateViews` exactly once at end-of-pass, after reconciliation, with the deduplicated union of (a) tables affected by applied schema events and (b) tables that received applied record writes (payload-derived or reconciliation-derived). The call SHALL be skipped only when that union is empty. A record-only pass SHALL still make zero Airtable API calls beyond payload/reconciliation paging — in particular no `getBaseSchema` fetch and no `insertSchemaVersion`.

#### Scenario: Record-only pass refreshes the touched table

- **WHEN** a pass applies only record events for table `tbl1`
- **THEN** `regenerateViews(["tbl1"])` is called once, and `getBaseSchema`/`insertSchemaVersion` are not called

#### Scenario: Schema + record pass unions the sets

- **WHEN** a pass applies schema events touching `tbl1` and record events touching `tbl2`
- **THEN** `regenerateViews` is called once with both tables (order irrelevant, no duplicates)

#### Scenario: Reconciliation-touched tables are included

- **WHEN** the pass's payload work touches nothing but reconciliation applies record writes to `tbl3`
- **THEN** the end-of-pass call includes `tbl3`

#### Scenario: Nothing applied, nothing regenerated

- **WHEN** a pass applies no schema events and no record writes
- **THEN** `regenerateViews` is not called

### Requirement: View regeneration failure does not fail the pass

A thrown `regenerateViews` (engine unreachable, apply error) SHALL be caught and logged via the structured-log callback; the pass SHALL still complete with its normal status and counts. Records already applied and the advanced cursor SHALL be unaffected.

#### Scenario: Engine 500 on regenerate-views

- **WHEN** every prior write succeeded and `regenerateViews` rejects
- **THEN** the pass completes `succeeded`, a structured log event records the failure, and no retry loop is entered (the next pass or full run rebuilds)
