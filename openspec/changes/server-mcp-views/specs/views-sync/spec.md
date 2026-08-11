# views-sync

## ADDED Requirements

### Requirement: View capture mode is resolved per run

The engine SHALL stamp `viewCaptureMode` on each backup task payload: `'rest'` for enterprise-scope connections, `'mcp'` for non-enterprise connections with view capture enabled, `'off'` otherwise — honoring the existing override setting. REST-mode runs SHALL behave exactly as before this change.

#### Scenario: Non-enterprise connection

- **WHEN** the engine assembles a payload for a non-enterprise connection with view capture enabled
- **THEN** the payload carries `viewCaptureMode: 'mcp'`

#### Scenario: Enterprise connection unchanged

- **WHEN** the engine assembles a payload for an enterprise-scope connection
- **THEN** the payload carries `'rest'` and the run's view handling matches pre-change behavior

### Requirement: MCP-captured views are persisted and diffed per Space

When schema-sync carries the optional `views` field, the engine SHALL merge the entities into `bo_at_views` (keyed by view id, with table/base refs, name, type, lifecycle stamps) inside the same transaction as the schema diff, emitting `bo_at_schema_updates` rows with `entity_type='view'` for additions, removals, renames — and `change_type='config'` deltas when definitions are captured. An absent `views` field SHALL leave the view working set untouched.

#### Scenario: First MCP capture fills views

- **WHEN** schema-sync arrives with a `views` capture for a Space whose view rows were empty
- **THEN** view rows exist with active status and the run's stamps

#### Scenario: View deleted in Airtable

- **WHEN** a previously captured view id is absent from a new successful capture
- **THEN** its row transitions through the removal lifecycle and a removal event appears in the changelog

#### Scenario: Absent field is not a deletion

- **WHEN** schema-sync arrives without `views` for a Space with existing view rows
- **THEN** no view row changes status from that field's absence

### Requirement: Unknown-sweep only fires when no source captured views

Active view rows SHALL be swept to `unknown` only when a run captured views from neither the REST payload nor MCP. A successful MCP capture SHALL count as a full sighting for lifecycle purposes.

#### Scenario: MCP capture prevents the sweep

- **WHEN** a non-enterprise run's MCP view capture succeeds
- **THEN** no active view rows are swept to `unknown`, and views absent from the capture are removed, not unknowned

#### Scenario: Both sources absent

- **WHEN** an `'mcp'`-mode run's capture fails and the REST payload carries no views
- **THEN** the pre-change sweep behavior applies
