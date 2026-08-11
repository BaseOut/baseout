## ADDED Requirements

### Requirement: Connect an Airtable platform
The system SHALL let a user connect Airtable to a Space via OAuth or an API key, and SHALL state that access is read-only before the user authorizes.

#### Scenario: No connection yet
- **WHEN** a Space has no Airtable connection
- **THEN** the screen shows a focused "Connect Airtable" call to action with a read-only access promise and no other platform cards

#### Scenario: Connect via OAuth
- **WHEN** the user chooses to connect with OAuth
- **THEN** the system starts the Airtable OAuth flow and, on return, establishes the connection

#### Scenario: Connect via API key
- **WHEN** the user chooses to connect with an API key and pastes a valid key
- **THEN** the system establishes the connection without the OAuth redirect

#### Scenario: Connection succeeds
- **WHEN** the connection completes and bases are discovered
- **THEN** the system confirms success and reports how many bases were found

#### Scenario: Connection fails
- **WHEN** the connection attempt fails
- **THEN** the system shows a specific, human-readable reason mapped from the failure

### Requirement: Recover a broken connection
The system SHALL surface a broken or expiring connection prominently and make reconnection the primary action, and SHALL make clear that backups are paused until it is fixed.

#### Scenario: Reconnect required (pending_reauth)
- **WHEN** the connection is in `pending_reauth`
- **THEN** the screen shows an amber "Reconnect required" state, states that backups are paused, and offers a prominent Reconnect action

#### Scenario: Disconnected (invalid)
- **WHEN** the connection is `invalid`
- **THEN** the screen shows a red "Disconnected" state, states that backups will not run, and offers a prominent Reconnect action

#### Scenario: Refreshing tokens
- **WHEN** the connection is briefly `refreshing`
- **THEN** the screen shows a transient amber indicator and keeps backups working

### Requirement: Select which bases to back up
The system SHALL let the user choose which discovered bases a Space backs up, show enough context to judge each base's importance, and enforce the plan's base limit visibly.

#### Scenario: Bases listed with comparison cues
- **WHEN** the connection has discovered bases
- **THEN** each base row shows its name plus its table count and field count — the only per-base metrics Airtable's schema API exposes — so the user can compare scale; record counts and last-modified are not available from Airtable's API and are not shown

#### Scenario: Tier limit visible
- **WHEN** the plan caps bases per Space
- **THEN** the screen shows a prominent counter of selected vs allowed (e.g. "2 of 12 allowed")

#### Scenario: Selecting beyond the tier limit
- **WHEN** the user tries to include more bases than the plan allows
- **THEN** the system prevents saving and explains how many to deselect, and tier-blocked bases are visually distinct with an upgrade affordance

#### Scenario: No bases selected
- **WHEN** zero bases are selected
- **THEN** the screen warns that the Space is not protected and prompts the user to pick at least one base

#### Scenario: New bases discovered
- **WHEN** the engine discovers new Airtable bases the user has not seen
- **THEN** the screen shows a dismissible banner reporting how many were discovered, auto-added, and/or blocked by tier

#### Scenario: Many bases at scale
- **WHEN** the account has many bases (tens or hundreds)
- **THEN** the base list provides name search, sort (by name, tables, or fields), a "show selected only" filter, and paging with a configurable page size, so the user can find and curate bases at scale

#### Scenario: Select all up to the plan limit
- **WHEN** the user chooses "Select all"
- **THEN** the system selects bases only up to the plan's base limit and, when more bases exist than the limit allows, reports how many were selected and offers an upgrade

#### Scenario: Auto-add future bases
- **WHEN** every discovered base is selected (the user is backing up everything)
- **THEN** the system offers an "automatically back up new bases" toggle so future bases are included up to the plan limit; the toggle is hidden on a partial selection and therefore is not shown when the account has more bases than the plan allows

### Requirement: Choose a backup schedule
The system SHALL let the user choose how often backups run, gate the available frequencies by plan, and show when the next backup will occur.

#### Scenario: Pick a frequency
- **WHEN** the user selects a frequency available on their plan
- **THEN** the system saves it and updates the "next backup" time

#### Scenario: Frequency locked by plan
- **WHEN** a higher frequency is not available on the current plan
- **THEN** that option is shown as locked with an upgrade affordance rather than hidden

### Requirement: Choose backup destinations
The system SHALL let the user send backups to a static destination, a dynamic destination, or both in parallel, and SHALL require authenticating each destination and choosing where data lands.

#### Scenario: Static destination
- **WHEN** the user picks a static destination (Google Drive, Dropbox, Box, OneDrive, S3, or Baseout R2)
- **THEN** backups are written as files (CSV/JSON + attachment binaries) to that destination

#### Scenario: Dynamic destination
- **WHEN** the user picks a dynamic destination (Postgres / D1 / Neon / Supabase / BYODB)
- **THEN** backups are written as queryable rows into that database

#### Scenario: Both destinations in parallel
- **WHEN** the user configures both a static and a dynamic destination
- **THEN** the system runs both for the Space and the UI shows both are configured

#### Scenario: Destination needs authentication and a folder
- **WHEN** the user selects a destination that requires authorization (e.g. Google Drive)
- **THEN** the system prompts the user to authenticate that destination and choose a target folder before it is usable

#### Scenario: Managed vs bring-your-own
- **WHEN** the user is choosing storage
- **THEN** the UI clearly distinguishes a managed destination (zero setup) from a bring-your-own destination (the user's own cloud)

### Requirement: Choose what gets backed up
The system SHALL let the user opt into the layers captured per Space, always include schema, default data on, and treat attachments as a billed opt-in.

#### Scenario: Schema always included
- **WHEN** any backup runs
- **THEN** the schema layer is always captured

#### Scenario: Data on by default
- **WHEN** the user has not changed layer settings
- **THEN** the data layer (every row and field value) is included and can be opted out per Space

#### Scenario: Attachments opt-in
- **WHEN** the user enables the attachments layer
- **THEN** attachment files are captured and the UI notes attachments are billed separately on storage

### Requirement: Run the first backup and confirm it worked
The system SHALL run the first backup as the final setup step, prevent configuration and runs while the connection is broken, and confirm the outcome so the user trusts the setup. (On-demand re-runs are a Backups-page concern, not the Integrations overview.)

#### Scenario: Run the first backup
- **WHEN** the user finishes setup and chooses "Save & run first backup" with a healthy connection and at least one base selected
- **THEN** the first backup starts and its progress is tracked on the Backups page

#### Scenario: Configuration unavailable on a broken connection
- **WHEN** the connection is in `pending_reauth` or `invalid`
- **THEN** Configure and run are not offered, and Reconnect is the only action

#### Scenario: First backup running confirmation
- **WHEN** the first backup has been kicked off from setup
- **THEN** the overview confirms the Space is connected and the first backup is running, summarizing bases, schedule, and destination

### Requirement: Show protection status, with configuration on a dedicated route
The system SHALL present a calm status summary on the Integrations overview when a Space is protected, open full configuration on a dedicated Configure route (not inline, not a modal), and never show a "connected" status before a valid configuration exists.

#### Scenario: Protected and settled
- **WHEN** the Space is connected and protected
- **THEN** the overview shows a summary (status · what's protected · next run · last run) with a Configure button that opens the dedicated Configure route

#### Scenario: Connected but not configured
- **WHEN** the Space is connected but no bases are selected yet (an edge: e.g. config later cleared, or an empty Airtable account)
- **THEN** the overview prompts the user to finish setup, opening the Configure route in setup mode

#### Scenario: Returning user edits a setting
- **WHEN** a returning user opens Configure
- **THEN** the Configure route shows all sections in place to change and save, returning to the overview afterward
