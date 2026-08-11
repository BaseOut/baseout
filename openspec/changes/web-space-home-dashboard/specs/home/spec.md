## ADDED Requirements

### Requirement: The Space's Home is its dashboard and control surface
The system SHALL present a Space at `/` as its Home: a single page that shows the
Space's backup health at a glance AND houses the backup pipeline (Source → bases →
Destination) as a status section. This Home replaces the separate Overview page; the
pipeline is the Space's primary object, shown here rather than on a dedicated page.

#### Scenario: A configured, healthy Space
- **WHEN** the user opens the Home of a Space whose backup is set up and whose Source and Destination are connected
- **THEN** the page shows a green status header ("Everything's backed up") with the last and next run, KPI figures, the pipeline as a connected (green-check) status section, and recent backup history

#### Scenario: A Space that is not set up yet
- **WHEN** the user opens the Home of a Space that has no backup configured
- **THEN** the page shows the setup diagram (Source → this Space → Destination) with a single "Set up backup" action, instead of the dashboard

#### Scenario: A connection is broken
- **WHEN** the Space's Source or Destination has lost access
- **THEN** the status header turns amber and reads "Backups paused", names the broken object, offers a Reconnect action, and the pipeline connectors turn amber

#### Scenario: The first backup is running, just after setup
- **WHEN** the user finishes first-time setup and lands back on Home while the first backup is still running
- **THEN** the status header reads "First backup running", a confirmation banner says the Space is protected and links to the Backups page, the history shows an in-progress placeholder, and success-only counts read "—" until the run finishes

#### Scenario: An edit was just saved
- **WHEN** the user saves a change to an already-running Space's backup
- **THEN** Home shows a "Backup configuration saved" confirmation banner and notes that changes apply on the next scheduled run

### Requirement: The standalone Overview page is removed
The system SHALL NOT present a separate per-Space Overview page. The former Overview
route SHALL redirect to Home so existing links do not break, and the navigation SHALL
list Home only (no "Overview" item).

#### Scenario: An old Overview link
- **WHEN** the user navigates to the former Overview URL (`/integrations`)
- **THEN** they are redirected to the Space Home (`/`)

#### Scenario: The sidebar lists Home, not Overview
- **WHEN** the user reads the Space group in the sidebar
- **THEN** it shows a single "Home" entry and no "Overview" entry

### Requirement: Deep configuration is delegated to a focused flow
Because Home leads with status, the system SHALL keep heavy configuration (choosing the
source, selecting bases, the destination, options, schedule) in a focused setup/edit flow
reached from Home, rather than inlining the full form on the dashboard.

#### Scenario: Configure from Home
- **WHEN** the user wants to change what the Space backs up
- **THEN** a "Configure" affordance on the Home pipeline opens the focused setup/edit flow, and saving returns the user to Home

### Requirement: Connection diagnostics live in account scope
Because Sources and Destinations are account-level and reusable, the system SHALL keep
their connection-level diagnostics (reconnect, invalid credentials, refreshing, no bases,
plan cap) on the account Sources / Destinations pages and within the setup flow. Home
SHALL reflect only the Space-level consequence of a broken connection (the paused state),
not the per-connection diagnostic detail.

#### Scenario: A broken connection's detail
- **WHEN** the user wants to fix a broken Source or Destination from Home
- **THEN** the Reconnect action takes them to that object's account page (or the in-flow reconnect), where the connection-level diagnostic and fix live
