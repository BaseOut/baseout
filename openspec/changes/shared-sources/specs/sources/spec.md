## ADDED Requirements

### Requirement: Manage Airtable sources at the account level
The system SHALL let a user connect and manage Airtable sources once on their account and reuse them across Spaces, presenting them in a dedicated account-level registry next to Destinations. An account MAY have multiple sources; a Space SHALL use exactly one.

#### Scenario: Sources registry
- **WHEN** the user opens account Sources
- **THEN** the system lists every Airtable source with its name, status, and the number of Spaces using it, with an option to add a source

#### Scenario: Multiple sources, one per Space
- **WHEN** an account has more than one Airtable source
- **THEN** each Space uses exactly one of them, and different Spaces may use different sources

#### Scenario: Add a source
- **WHEN** the user adds a source
- **THEN** the system connects Airtable (OAuth or API key) and the source becomes available to link to Spaces

### Requirement: Show which Spaces use a source, with per-Space meta
The system SHALL present, on each source, a table of the Spaces using it with meta that helps the user judge each Space's use of that source.

#### Scenario: Per-Space usage table
- **WHEN** the user opens a source
- **THEN** the system lists each Space using it with its meta (e.g. number of bases included, schedule, last backup, status)

### Requirement: Pick a source in a Space's setup
The system SHALL let a Space's backup setup choose which account source it backs up from, before selecting bases.

#### Scenario: Choose the source for a Space
- **WHEN** configuring a Space's backup and the account has one or more sources
- **THEN** the user picks exactly one source, and base selection then runs against that source's bases

#### Scenario: Add a source from setup
- **WHEN** no suitable source exists during setup
- **THEN** the user can add a new source, which is created at the account level and becomes available to use

### Requirement: Show source Platform availability
The system SHALL indicate, across the account Sources surfaces, that Airtable is available to connect now and which additional source Platforms are coming soon, drawing the Platform list from the same shared catalog used elsewhere.

#### Scenario: Coming-soon Platforms in the add flow
- **WHEN** the user opens the Add source flow
- **THEN** Airtable is connectable now, and future Platforms (Notion, HubSpot, Salesforce per Features §1) are shown as coming soon and are not selectable

#### Scenario: Coming-soon Platforms on the registry
- **WHEN** the user views account Sources
- **THEN** the surface teases the additional source Platforms that are coming soon, so the user knows more sources are planned
