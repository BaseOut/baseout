## ADDED Requirements

### Requirement: "Complete Your Migration" screen

`web` SHALL render a "Complete Your Migration" screen on first login when `organizations.has_migrated=false`. The user SHALL NOT be able to access the dashboard until completion.

#### Scenario: Migrated user signs in

- **WHEN** a migrated On2Air user logs in for the first time
- **THEN** the migration screen is shown instead of the dashboard

### Requirement: Re-auth Airtable

The migration screen SHALL initiate a fresh Airtable OAuth flow that replaces the legacy `connections` row with a new encrypted-token row.

#### Scenario: Airtable re-auth

- **WHEN** the user completes Airtable OAuth in the migration flow
- **THEN** the legacy connection is replaced with the new tokens (encrypted under AES-256-GCM)

### Requirement: Re-auth storage destinations

For each storage destination the migrated user previously had configured, the migration screen SHALL prompt for re-auth (per-destination OAuth or IAM credential entry).

#### Scenario: Multiple destinations

- **WHEN** a migrated user had Google Drive and Dropbox configured
- **THEN** the migration screen prompts for re-auth on each, in sequence

### Requirement: Completion persistence

On successful completion of all re-auth steps, the migration screen SHALL set `organizations.has_migrated=true` and redirect to the dashboard. The Migration Welcome email SHALL fire (per the `web` repo email notifications spec).

#### Scenario: Completion redirect

- **WHEN** the user finishes the last re-auth step
- **THEN** `has_migrated=true` is persisted, the user is redirected to /dashboard, and Migration Welcome is queued for send
