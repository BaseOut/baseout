## ADDED Requirements

### Requirement: Space detail page

The admin app SHALL serve a staff-gated, read-only `/spaces/[id]` page for any Space, aggregating from the master DB: the owning Organization (name, linked); Space status, type, platform, and created date; members with access (all `organization_members` of the owning Org, with member role, linked to their user pages); connections serving the Space (Org-scoped connections plus any Space-scoped connection, with health status); the backup configuration (frequency, scope, mode, storage type, next scheduled run) and retention policy when present; registered Airtable bases from `at_bases` (name, `at_base_id`, inclusion flag from `backup_configuration_bases`, last seen); recent backup runs (status, counts, duration, error, linked to `/backups/[id]`) and restore runs; the `space_databases` row (backend, status, schema version, sync timestamps, error); and storage destinations (type, account email, OAuth expiry, validation timestamps). Sections whose underlying rows are absent SHALL render an explicit empty state, not be omitted.

#### Scenario: Space with full configuration

- **WHEN** staff opens `/spaces/[id]` for an active Space with a backup configuration, bases, runs, and a provisioned database
- **THEN** all sections render with the owning Org linked, every base listed with its inclusion flag, and each run row linking to its `/backups/[id]` drill-in

#### Scenario: Space mid-setup

- **WHEN** staff opens a Space with `status='setup_incomplete'` and no backup configuration or runs
- **THEN** the page renders with explicit "no backup configuration" / "no runs yet" empty states rather than hiding the sections

#### Scenario: Unknown Space id

- **WHEN** staff opens `/spaces/[id]` with an id that matches no Space
- **THEN** the page returns 404 with a styled not-found message

### Requirement: User detail page

The admin app SHALL serve a staff-gated, read-only `/users/[id]` page for any user, showing: profile fields (name, email, email-verified, job title, created date) and the `users.role` staff flag; Organization memberships (Org linked, member role, invited/accepted dates); recent sessions as metadata only — ip address, user agent, created and expiry timestamps, never the session token; connections the user created (platform, status, linked); and `admin_audit_log` entries where the user is the actor (`actor_user_id`) or the target. The page SHALL NOT provide any mutation controls (no role changes, no session revocation) — those remain deferred to the `admin` umbrella change.

#### Scenario: Customer user with memberships

- **WHEN** staff opens `/users/[id]` for a customer belonging to two Organizations
- **THEN** both memberships render with linked Org names and member roles, and recent sessions show ip/user-agent/expiry with no token values anywhere in the response

#### Scenario: Staff actor history

- **WHEN** staff opens the page of a user with `role='super'` who has performed admin actions
- **THEN** an audit section lists that user's `admin_audit_log` intent/result entries with links to the affected targets

### Requirement: Organization detail page linking consistency

The existing `/organizations/[id]` page SHALL comply with the entity-linking convention: each member row links to `/users/[id]`, each Space row links to `/spaces/[id]`, each backup run row links to `/backups/[id]`, and connection references link to the connection surface. Its content scope is otherwise unchanged.

#### Scenario: Org detail is fully linked

- **WHEN** staff opens `/organizations/[id]` after this change
- **THEN** no member, Space, run, or connection is rendered as plain text or a bare UUID — each is a hyperlink to its entity page
