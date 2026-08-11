## ADDED Requirements

### Requirement: Search is reachable from every admin page

The admin console SHALL render a search input in the persistent app chrome on every staff-gated page, submitting as a GET to `/search?q=<query>`, and the `/search` results page SHALL be gated by the same staff middleware as every other admin surface.

#### Scenario: Search box in the chrome

- **WHEN** a staff user views any admin page
- **THEN** the sidebar chrome contains a search input that submits its trimmed value to `/search?q=`

#### Scenario: Non-staff cannot search

- **WHEN** a request without a valid staff session hits `/search`
- **THEN** the existing middleware behavior applies unchanged (sign-in redirect for anonymous, 403 for signed-in non-staff) — no search executes

### Requirement: Query shape detection routes the lookup

The search SHALL detect the query's shape and run only the lookups that shape can match, using this precedence: (1) UUID shape → primary-key lookup across backup runs, restore runs, connections, spaces, and organizations; (2) `cus_`/`sub_` prefix → `organizations.stripe_customer_id` / `subscriptions.stripe_subscription_id` exact match; (3) `app` + alphanumeric Airtable base ID shape → `at_bases.at_base_id` exact match; (4) contains `@` → `users.email` exact then prefix match; (5) otherwise → case-insensitive substring match on organization name/slug, space name, and user name. All matching SHALL be case-insensitive on the identifier's canonical form and the input SHALL be trimmed before detection.

#### Scenario: UUID query

- **WHEN** the query is a UUID (with or without surrounding whitespace)
- **THEN** the search looks up that ID as a primary key across backup runs, restore runs, connections, spaces, and organizations, and runs no name-substring queries

#### Scenario: Stripe customer ID

- **WHEN** the query starts with `cus_`
- **THEN** the search matches it exactly against `organizations.stripe_customer_id` and returns the owning Organization

#### Scenario: Airtable base ID

- **WHEN** the query matches the Airtable base ID shape (`app` followed by alphanumerics)
- **THEN** the search matches it against `at_bases.at_base_id` and returns the base with its owning Space and Organization

#### Scenario: Email query

- **WHEN** the query contains `@`
- **THEN** the search matches `users.email` exactly and by prefix, case-insensitively

#### Scenario: Free-text name query

- **WHEN** the query is none of the above shapes (e.g. `acme`)
- **THEN** the search runs case-insensitive substring matches on organization name and slug, space name, and user name

### Requirement: Results are grouped and disambiguated

The `/search` page SHALL group results by entity type (Organizations, Users, Spaces, Bases, Connections, Backup runs, Restore runs), SHALL cap each group at a fixed per-type limit of 10 rows while indicating when a group was truncated, and each result row MUST show enough owning-entity context to disambiguate (an Organization row shows subscription tier and status; a User row shows its Organization memberships; a Space, base, connection, or run row shows its owning Organization) and MUST link to the entity's admin page.

#### Scenario: Grouped results

- **WHEN** a free-text query matches two organizations, one space, and three users
- **THEN** the results render as three labeled groups with those rows, each row linking to the matched entity's admin page

#### Scenario: Truncated group

- **WHEN** a query matches more than 10 users
- **THEN** the Users group shows 10 rows and a visible indication that more matches exist and the query should be narrowed

#### Scenario: No results

- **WHEN** a query matches nothing
- **THEN** the page states that nothing matched and lists the identifier shapes the search accepts

#### Scenario: Empty query

- **WHEN** `/search` is visited with an empty or whitespace-only `q`
- **THEN** the page executes no lookups and renders guidance describing the accepted identifier shapes

### Requirement: Single exact match redirects to the entity

WHEN a query's shape is an exact identifier (full UUID, exact email, exact Stripe ID, exact Airtable base ID) AND exactly one entity matches, the search SHALL redirect (302) straight to that entity's admin page instead of rendering a one-row results list. Free-text name queries MUST always render the results list, even for a single match.

#### Scenario: Backup run UUID jumps to the run

- **WHEN** the query is the UUID of exactly one backup run
- **THEN** the response is a redirect to `/backups/<id>`

#### Scenario: Exact email with one user

- **WHEN** the query equals exactly one user's email (case-insensitive)
- **THEN** the response is a redirect to that user's admin page

#### Scenario: Exact identifier with multiple matches

- **WHEN** an exact-shape query matches more than one entity (e.g. a UUID that exists as both a space ID and a connection ID)
- **THEN** the grouped results list renders — no redirect

### Requirement: Search is read-only and bounded to the master DB

The search SHALL execute only parameterized read-only SQL against the master database, MUST NOT select any `*_enc` column (the admin schema mirror continues to omit them), MUST NOT connect to any per-Space database, and MUST NOT introduce migrations or new indexes (trigram/full-text indexing is an explicitly deferred future option).

#### Scenario: Master DB only

- **WHEN** any search executes
- **THEN** every query runs against the master DB through the existing per-request Hyperdrive client, and no per-Space database locator is dereferenced

#### Scenario: No secrets in results

- **WHEN** a connection or storage destination appears in results
- **THEN** only non-encrypted columns are selected — tokens and DSNs are structurally absent from the mirror
