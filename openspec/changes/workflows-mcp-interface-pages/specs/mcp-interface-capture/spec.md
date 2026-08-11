## ADDED Requirements

### Requirement: Interface pages are captured via the Airtable MCP server during backup

For every backup run of a Base whose Space tier includes interface backup (Growth+), the backup task SHALL call the Airtable MCP server tool `list_pages_for_base` for that Base, authenticated with the Connection's existing Airtable OAuth access token, and SHALL forward the captured payload (interface apps, pages, standalone forms — raw, with a `capturedAt` timestamp) to the engine on the schema-sync callback as the optional `interfacePages` field.

#### Scenario: Successful capture rides schema-sync

- **WHEN** a backup run executes for a Growth+ Space and the MCP tool returns a valid envelope
- **THEN** the schema-sync POST for that base includes `interfacePages` with the raw capture and the run progress records the capture as succeeded

#### Scenario: Below-tier Space skips the call

- **WHEN** a backup run executes for a Space whose tier excludes interface backup
- **THEN** no MCP request is made and `interfacePages` is omitted from schema-sync

### Requirement: MCP capture failures never fail the backup run

Any MCP failure — timeout (30s), HTTP error, auth rejection, or an envelope that does not validate (`interfaces` / `standaloneForms` arrays) — SHALL be recorded as `interfacePages: {status:'skipped', reason}` in run progress, SHALL omit the field from schema-sync, and SHALL NOT change the backup run's outcome, statuses, or record/attachment capture.

#### Scenario: MCP outage during a backup

- **WHEN** the MCP endpoint times out during a run
- **THEN** the run completes with its normal status and progress shows interface capture skipped with reason `timeout`

#### Scenario: Token rejected by the MCP server

- **WHEN** the MCP server returns 401 for the Connection's token
- **THEN** the run completes normally, capture is skipped with reason `auth`, and a connection-scope notice is surfaced on the run
