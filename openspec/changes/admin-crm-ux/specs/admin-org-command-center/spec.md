# admin-org-command-center

The `/organizations` CRM directory and the per-Organization command-center page.

## ADDED Requirements

### Requirement: Organizations directory at /organizations

The organization directory SHALL live at `/organizations` (the canonical entity name), and `/customers` SHALL redirect (301) to `/organizations` preserving the query string. The directory SHALL provide a search bar (`q` — matching organization name and slug, plus member email) and three first-class filters applied as SQL predicates: **status** (derived subscription-status rollup, including `none` for organizations with no subscription), **platform** (organizations holding a subscription or Space on the given Platform), and **subscription** (pricing tier). Filters SHALL be combinable and SHALL compose with search, sorting, and pagination per `admin-table-infra`.

#### Scenario: Filter by status, platform, and tier together

- **WHEN** a staff member selects status `trialing`, platform `airtable`, and tier `growth`
- **THEN** the directory lists only Organizations with a trialing Airtable-platform subscription on the Growth tier, and the pager total reflects that filtered count

#### Scenario: Organizations with no subscription are findable

- **WHEN** a staff member filters by status `none`
- **THEN** the directory lists only Organizations without any active, trialing, or past-due subscription

#### Scenario: Legacy route redirects

- **WHEN** a staff member opens `/customers?status=active`
- **THEN** they are redirected to `/organizations?status=active`

### Requirement: Organization command-center page

`/organizations/[id]` SHALL be the single per-Organization command center: a header with identity and billing summary (name, slug, subscription status and tier badges, MRR estimate, overage posture, migration flags, created date) followed by sections for everything the Organization owns — Subscriptions, Spaces, Members, Connections, Backup runs, Restore runs, Databases (per-Space DB provisioning), Storage destinations, Recent errors, and Audit entries — with an in-page section navigation. Each section SHALL show the most recent/relevant bounded subset and, where a global listing exists for the entity, a "view all" link to that listing pre-filtered to the Organization (`?org=<id>`). All content SHALL come from the master DB only, respecting the existing admin data boundary (metadata only, never `*_enc` columns, never per-Space record content).

#### Scenario: One page answers "what does this account have?"

- **WHEN** a staff member opens an Organization's command center
- **THEN** they see the billing header and every section listed above without navigating to another page, and each section's entries link to the corresponding entity detail pages

#### Scenario: Section overflow goes to the filtered listing

- **WHEN** an Organization has 300 backup runs and the staff member clicks the Backup runs section's "view all" link
- **THEN** they land on `/backups?org=<id>` showing all of that Organization's runs with full pagination

### Requirement: Every entity detail page links back to its Organization

Every admin detail page for an entity owned by an Organization (space, user membership context, connection, backup run, restore run, database, error) SHALL display the owning Organization's name as a link to that Organization's command center, so any drill-in is at most one click from the account view.

#### Scenario: Space to owning account

- **WHEN** a staff member viewing `/spaces/[id]` clicks the owning Organization link
- **THEN** they land on that Organization's command center

### Requirement: Back navigation preserves listing state

Listing rows SHALL link to detail pages carrying a `ret` parameter encoding the listing's current path and query string. Detail pages SHALL render a "back" link from `ret` only after validating it is a same-app relative path (starts with `/`, not `//`, no scheme or host); otherwise the back link SHALL fall back to the entity's default listing. The command center's back link SHALL return to `/organizations` with the visitor's previous filter/sort/page state when arriving from the directory.

#### Scenario: Round trip keeps filters

- **WHEN** a staff member on `/organizations?status=trialing&page=2` opens an Organization and clicks the back link
- **THEN** they return to `/organizations?status=trialing&page=2`

#### Scenario: Malicious ret is ignored

- **WHEN** a detail page is opened with `?ret=https://evil.example/phish`
- **THEN** the back link points at the entity's default listing, not the external URL
