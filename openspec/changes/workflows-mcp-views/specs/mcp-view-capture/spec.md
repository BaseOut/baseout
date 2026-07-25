# mcp-view-capture

## ADDED Requirements

### Requirement: Views are captured via MCP when the payload says so

For every backup run whose payload carries `viewCaptureMode: 'mcp'`, the backup task SHALL call the Airtable MCP view-listing tool per base with the Connection's OAuth token and forward the raw envelope with a `capturedAt` timestamp as the optional `views` field on that base's schema-sync POST. Runs with `viewCaptureMode: 'rest'` or `'off'` SHALL make no MCP view call, and `'rest'` runs SHALL behave exactly as before this change.

#### Scenario: MCP-mode capture rides schema-sync

- **WHEN** a run executes with `viewCaptureMode: 'mcp'` and the tool returns a valid envelope
- **THEN** schema-sync carries `views` with the raw capture and run progress records the capture as succeeded

#### Scenario: REST mode is untouched

- **WHEN** a run executes with `viewCaptureMode: 'rest'`
- **THEN** no MCP view request is made and the schema-sync body matches pre-change behavior

### Requirement: View-capture failures never fail the run

Any MCP failure SHALL be recorded as `views: {status:'skipped', reason}` in run progress, SHALL omit the field from schema-sync, and SHALL NOT change the run outcome or the independent interface-pages/automations captures.

#### Scenario: Views tool errors while other captures succeed

- **WHEN** the views `tools/call` fails but interface-pages and automations succeed in the same run
- **THEN** schema-sync carries those two fields without `views`, and only the view capture reports skipped

### Requirement: Existing capture behavior survives the shared-constants extraction

Extracting the shared skip-reason/progress helpers SHALL NOT change the observable behavior of the interface-pages or automations captures; their existing test matrices pass unmodified.

#### Scenario: Existing tests

- **WHEN** the shared extraction ships
- **THEN** the pre-existing interface-pages and automations capture tests pass unmodified
