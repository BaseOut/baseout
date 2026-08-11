## ADDED Requirements

### Requirement: Two-scope navigation (Space and Account)
The system SHALL group the sidebar into a Space scope (switched by the Space selector) and an Account scope, so account-level connections are visible and labelled rather than hidden in settings.

#### Scenario: Space-scoped items follow the active Space
- **WHEN** the user switches the active Space
- **THEN** the Space group (overview, backups, restore, schema, reports) reflects that Space, while the Account group is unchanged

#### Scenario: Account-level connections are top-level
- **WHEN** the user looks at the sidebar
- **THEN** Sources and Destinations appear under an Account heading as top-level destinations, not nested inside Settings

### Requirement: A Space's page is its backup overview (a Connection)
The system SHALL present each Space's page as its backup overview — the pairing of one Source, the selected bases, a schedule, and one or more Destinations — and SHALL NOT ask the user to connect a platform from scratch there; connecting happens once on a Source.

#### Scenario: Configured Space overview
- **WHEN** a Space has a Source, bases, and a Destination
- **THEN** its overview shows the pipeline (from the Source, the bases it backs up, to the Destination with the Space's folder), the schedule and last / next run, and actions to configure or run

#### Scenario: A source or destination is broken
- **WHEN** the Space's Source or a Destination has lost access
- **THEN** the overview shows that backups are paused and links to reconnect that account object (one reconnect restores every Space using it)

#### Scenario: A Space not yet set up
- **WHEN** a Space has no Source, bases, or Destination yet
- **THEN** the overview guides the user to set up the backup by picking a Source, bases, a Destination, and a schedule

#### Scenario: Connecting happens on the Source, not the Space
- **WHEN** the user wants to connect Airtable
- **THEN** they connect it once on an account Source (reused across Spaces); the Space references that Source rather than re-connecting
