## ADDED Requirements

### Requirement: Master-DB-only data access

The admin app SHALL connect only to the master database, via its Hyperdrive binding. It SHALL NOT hold per-Space database clients, D1 bindings, per-Space Postgres connections, or BYODB connections, and SHALL NOT dereference `space_databases` locators (`d1_database_id`, `pg_locator`) to open connections — locators are displayed as inert identifier strings for correlating with infrastructure dashboards only. This applies to every current and future admin surface until a separate, explicitly approved phase-two change defines staff access to per-Space data.

#### Scenario: Locators are display-only

- **WHEN** staff views `/databases` or a Space detail page showing a `space_databases` row
- **THEN** the D1 id / PG locator render as plain text with no connect/query/browse affordance

#### Scenario: New surface proposes per-Space reads

- **WHEN** a proposed admin change would read from a per-Space database
- **THEN** it conflicts with this requirement and must be re-scoped or explicitly supersede this spec via the phase-two change

### Requirement: Encrypted-column exclusion is absolute

The admin schema mirror (`apps/admin/src/db/schema/core.ts`) SHALL never include `*_enc` columns (OAuth access/refresh tokens, BYODB connection strings) or session token values. Because excluded columns cannot be selected, no admin query, page, or API response can expose them. Mirror additions SHALL be reviewed against this rule, and a guard test SHALL fail if any mirrored column name ends in `_enc`.

#### Scenario: Mirror addition with an encrypted column

- **WHEN** a schema-mirror edit introduces a column whose name ends in `_enc`
- **THEN** the guard test fails and the change cannot land

### Requirement: Metadata-only drill-down depth

Admin drill-downs SHALL bottom out at operational metadata: run, base, and table names, counts, statuses, timestamps, and error messages. Record-level customer content — field values, cell data, attachments, or any `bo_at_*` per-Space table content — SHALL NOT be queried, displayed, or proxied by any admin surface. Base/table names and record counts in `backup_run_bases` / `backup_run_tables` are in scope; anything deeper is not.

#### Scenario: Deepest run drill-in

- **WHEN** staff opens `/backups/[id]` for a completed run
- **THEN** the page shows per-base and per-table names, counts, statuses, and errors, and offers no path to view records, field values, or attachment content
