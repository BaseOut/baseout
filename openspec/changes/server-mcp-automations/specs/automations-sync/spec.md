# automations-sync

## ADDED Requirements

### Requirement: MCP-captured automations are persisted per Space with provenance and lifecycle

When a schema-sync request carries the optional `automations` field, the engine SHALL extract one entity per automation keyed by `airtable_entity_id` and persist it as a `bo_at_automations` row with `submitted_via='mcp'`, `enabled` state, definition payload, and first/last-seen lifecycle stamps, inside the same transaction as the schema diff. An absent `automations` field SHALL leave the automation working set untouched.

#### Scenario: First capture creates rows

- **WHEN** schema-sync arrives with an `automations` capture containing two automations for a Space with no prior automation rows
- **THEN** two `bo_at_automations` rows exist with `submitted_via='mcp'`, active status, and the run's stamps

#### Scenario: Absent field is not a deletion

- **WHEN** schema-sync arrives without an `automations` field for a Space with existing MCP-sourced automation rows
- **THEN** no automation row changes status and no automation changelog events are produced

### Requirement: Run-over-run automation changes feed the schema changelog

On each successful capture the engine SHALL diff the incoming entities against the prior MCP-sourced working set: additions and removals via lifecycle status (removal ONLY on a successful capture; reappearing ids resurrect), name changes as `bo_at_schema_updates` rows with `entity_type='automation'` and `change_type='name'`, and enabled-state or definition changes as `change_type='config'` rows storing the delta. An identical capture SHALL short-circuit the diff while still stamping the run.

#### Scenario: Automation disabled between runs

- **WHEN** a captured automation's `enabled` flips from true to false since the prior run
- **THEN** a `bo_at_schema_updates` row with `entity_type='automation'`, `change_type='config'` records the flip and it appears in the changelog union

#### Scenario: Automation deleted in Airtable

- **WHEN** a previously captured automation id is absent from a new successful capture
- **THEN** its row transitions to removed status with the run stamp, and a removal event is visible in the changelog

### Requirement: MCP capture coexists with manual submissions

MCP-sourced rows SHALL be authoritative for existence, name, and enabled state; manually-submitted automation rows (`submitted_via` ≠ 'mcp') SHALL never be deleted or overwritten by an MCP diff; the read path SHALL surface both, associated by `airtable_entity_id`.

#### Scenario: Manual submission survives MCP removal

- **WHEN** an automation with both a manual row and an MCP row disappears from a successful capture
- **THEN** the MCP row is marked removed and the manual row is untouched

### Requirement: Automation capture is tier-gated at payload assembly

The engine SHALL stamp `automationsEnabled` on the backup task payload, true only when the Space's resolved capabilities include automation backup (Growth+).

#### Scenario: Below-tier Space

- **WHEN** the engine assembles a backup payload for a Space below Growth
- **THEN** the payload carries `automationsEnabled: false`
