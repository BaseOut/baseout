## ADDED Requirements

### Requirement: Customers directory

The admin app SHALL expose a read-only `/customers` page listing every Organization with: name and slug linked to `/organizations/[id]`, subscription status, tier badges (from `subscription_items`), space count, member count, an MRR estimate, migration flags (`has_migrated`, `dynamic_locked`), and last activity (the org's most recent `backup_runs.created_at` across its spaces, or "—" when none). The page SHALL support `?q=` substring search on name/slug and `?status=` filtering on subscription status, and SHALL cap results at a bounded limit (≤200) noted on-page when reached. The existing `/` tracker SHALL NOT be modified or removed by this change.

#### Scenario: Directory lists all organizations

- **WHEN** a staff user opens `/customers`
- **THEN** every Organization renders one row with linked name, subscription status, tier badges, space count, member count, MRR estimate, migration flags, and last-activity timestamp, and orgs with no subscription or no spaces still render without error

#### Scenario: Search narrows by name or slug

- **WHEN** the staff user loads `/customers?q=acme`
- **THEN** only organizations whose name or slug contains "acme" (case-insensitive) are listed

#### Scenario: Status filter

- **WHEN** the staff user loads `/customers?status=past_due`
- **THEN** only organizations whose subscription status is `past_due` are listed

### Requirement: Users directory

The admin app SHALL expose a read-only `/users` page listing every user with: email, display name, role (`customer` or `super`, badged), email-verified flag, org memberships (each org name linked to `/organizations/[id]`, with the membership role), last session activity (latest `sessions.updated_at`, or "never"), and created date. The page SHALL support `?q=` substring search on email/name and `?role=` filtering, and SHALL cap results at a bounded limit (≤200). Session data SHALL be read-only — the page SHALL NOT create, mutate, or delete sessions.

#### Scenario: Directory lists users with memberships

- **WHEN** a staff user opens `/users`
- **THEN** users render with email, name, role badge, verified flag, linked org memberships, last session activity, and created date, and a user with zero memberships or zero sessions still renders

#### Scenario: Role filter isolates staff

- **WHEN** the staff user loads `/users?role=super`
- **THEN** only users with `role='super'` are listed

#### Scenario: Search by email

- **WHEN** the staff user loads `/users?q=jane@`
- **THEN** only users whose email or name contains the query (case-insensitive) are listed

### Requirement: Spaces directory

The admin app SHALL expose a read-only `/spaces` page listing every Space with: name, owning Organization (linked to `/organizations/[id]`), space status, platform, backup-configuration summary (frequency, scope, mode, storage type — or "not configured"), last run outcome (latest `backup_runs` status + `created_at`, with `error_message` surfaced on failure), per-Space DB backend and status from `space_databases` (or "not provisioned"), and created date. Rows needing attention (last run `failed`, space status `error`, or `space_databases.status='error'`) SHALL sort before healthy rows. The page SHALL support `?q=` search on space/org name and `?status=` filtering on space status, with a bounded limit (≤200).

#### Scenario: Directory lists spaces with cross-entity context

- **WHEN** a staff user opens `/spaces`
- **THEN** every Space renders with linked org, status, platform, backup-config summary, last-run outcome, and DB backend/status, and a space with no configuration, no runs, or no `space_databases` row still renders

#### Scenario: Attention-first ordering

- **WHEN** the directory contains a space whose last run failed and a space whose last run succeeded
- **THEN** the failed-run space sorts before the healthy one within the result set

### Requirement: Cross-entity links with graceful targets

Every cell in the three directories that references another entity SHALL render as a link: organizations to `/organizations/[id]`; spaces to `/spaces/[id]` and users to `/users/[id]` once those detail routes exist (delivered by `admin-entity-linking`). Until a detail route exists, the cell SHALL link to the owning organization's drill-in instead of emitting a dead route. No raw UUID SHALL render without either a link or an adjacent human-readable name.

#### Scenario: Org links resolve today

- **WHEN** a staff user clicks an organization name in any directory
- **THEN** they land on the existing `/organizations/[id]` drill-in for that org

#### Scenario: No dead links before entity-linking lands

- **WHEN** `admin-entity-linking` has not been implemented and a staff user clicks a space name in `/spaces`
- **THEN** they navigate to the owning org's `/organizations/[id]` page, not a 404

### Requirement: Master-DB-only access constraint

The directory pages SHALL read only the master DB through the existing per-request Hyperdrive-backed client. They SHALL NOT connect to any per-Space database, SHALL NOT dereference `space_databases` locator columns (`d1_database_id`, `pg_locator` render as inert identifiers only), and SHALL NOT select any `*_enc` column — enforced structurally by the `apps/admin` schema mirror, which MUST NOT gain `*_enc` columns for this change. All queries SHALL be read-only; the pages SHALL issue no INSERT/UPDATE/DELETE.

#### Scenario: Locators render inert

- **WHEN** `/spaces` renders a space whose DB row has a `pg_locator`
- **THEN** the locator (if shown) is plain text with no connection attempt, no link, and no credential access

#### Scenario: Mirror stays free of encrypted columns

- **WHEN** the schema-mirror diff for this change is reviewed
- **THEN** no `*_enc` column appears in `apps/admin/src/db/schema/core.ts`
