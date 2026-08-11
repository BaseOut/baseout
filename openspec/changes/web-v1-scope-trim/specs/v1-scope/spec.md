## ADDED Requirements

### Requirement: V1 launch surface is backup, restore, and schema
The V1 product navigation SHALL expose only the launch capabilities decided on
2026-07-06: backup, restore, and schema (plus account-scope Sources/Destinations and
Settings). The Reports tab SHALL NOT appear in navigation, and its route SHALL redirect
to Home rather than 404.

#### Scenario: The sidebar carries no Reports tab
- **WHEN** a user reads the Space group in the sidebar
- **THEN** it lists Home, Backups, Restore, and Schema — no Reports entry

#### Scenario: A stale Reports link
- **WHEN** a user navigates to `/reports`
- **THEN** they are redirected to the Space Home (`/`)

### Requirement: SQL database access is deferred beyond V1
The system SHALL NOT expose customer-facing SQL database access (Direct SQL connection
strings or SQL query surfaces) in V1. Work on SQL surfaces SHALL NOT start until the
PRD is revised to re-scope them (Dan's action item, Jul 6 sync); the "potentially a
REST API" question is resolved by that revision, not by this change.

#### Scenario: No SQL surface reaches customers in V1
- **WHEN** a customer on any tier uses the V1 product
- **THEN** no UI, route, or setting offers a SQL connection string or SQL query access, and `apps/sql` remains an unreleased placeholder
