# mcp-automation-capture

## ADDED Requirements

### Requirement: Automations are captured via the Airtable MCP server during backup

For every backup run of a Base whose Space tier includes automation backup (Growth+), the backup task SHALL call the Airtable MCP server's automations tool for that Base, authenticated with the Connection's existing Airtable OAuth access token, and SHALL forward the captured payload (raw envelope, with a `capturedAt` timestamp) to the engine on the schema-sync callback as the optional `automations` field.

#### Scenario: Successful capture rides schema-sync

- **WHEN** a backup run executes for a Growth+ Space and the MCP automations tool returns a valid envelope
- **THEN** the schema-sync POST for that base includes `automations` with the raw capture and the run progress records the capture as succeeded

#### Scenario: Below-tier Space skips the call

- **WHEN** a backup run executes for a Space whose tier excludes automation backup
- **THEN** no MCP automations request is made and `automations` is omitted from schema-sync

### Requirement: MCP automation-capture failures never fail the backup run

Any MCP failure — timeout, transport error, auth rejection, envelope validation failure, or oversized payload — SHALL be recorded as `automations: {status:'skipped', reason}` in run progress, SHALL omit the field from schema-sync, and SHALL NOT change the backup run's outcome, statuses, record/attachment capture, or the independent interface-pages capture.

#### Scenario: MCP outage during a backup

- **WHEN** the MCP endpoint is unreachable during a run
- **THEN** the run completes with its normal status and progress shows automation capture skipped with a transport/timeout reason

#### Scenario: Automations tool errors while interface capture succeeds

- **WHEN** the automations `tools/call` fails but `list_pages_for_base` succeeds in the same run
- **THEN** schema-sync carries `interfacePages` without `automations`, and only the automation capture reports skipped

### Requirement: Interface-pages capture behavior is preserved through the client refactor

Generalizing the MCP client into a shared `tools/call` core SHALL NOT change `fetchInterfacePages` observable behavior: its request sequence, validation, failure taxonomy, and existing test matrix remain intact.

#### Scenario: Existing interface-capture tests

- **WHEN** the refactored client ships
- **THEN** the pre-existing `mcp-client` interface-pages tests pass unmodified
