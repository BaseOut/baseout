## ADDED Requirements

### Requirement: First-time provisioning by tier

When a Space first runs a Dynamic backup (or upgrades to a tier requiring a new DB tier), the engine SHALL provision a client DB matching the Space's tier — D1 (Trial, Starter, Launch, Growth), Shared PG with schema-level isolation `org_{orgId}` (Pro), Dedicated PG instance on Neon / Supabase / DigitalOcean (Business), or BYODB connectivity validation (Enterprise) — and persist the resulting reference in `space_databases`.

#### Scenario: First Dynamic backup on a Pro Space

- **WHEN** a Pro Space runs its first Dynamic backup with no existing client DB
- **THEN** the engine creates a `org_{orgId}` schema on the shared PG instance, records `space_databases.pg_schema_name`, and proceeds with the backup

#### Scenario: BYODB invalid connection rejected

- **WHEN** an Enterprise customer provides a connection string that fails connectivity validation
- **THEN** `space_databases.provisioning_status='error'` is set and the Space cannot run Dynamic backups until the customer resubmits

### Requirement: Provisioning status lifecycle

`space_databases.provisioning_status` SHALL transition through `pending → provisioning → active → migrating → error` and SHALL never skip the `provisioning` state for new DBs.

#### Scenario: Lifecycle entry and exit

- **WHEN** provisioning succeeds
- **THEN** the row transitions `pending → provisioning → active` in order, with each transition timestamped

### Requirement: Tier migration

When a Space upgrades from a lower DB tier to a higher one, the engine SHALL block scheduled backups (`backup_configurations.is_active=false`), provision the new DB, stream schema → records → change log to the new DB, verify counts and key constraints, atomically switch `space_databases` to the new tier, re-enable backups, and decommission the old DB after a configurable grace period (default 7 days). On failure, the engine SHALL roll back, keep the old DB active, and alert engineering on-call.

#### Scenario: Growth → Pro migration

- **WHEN** a Space upgrades from Growth (D1 full) to Pro (Shared PG)
- **THEN** the engine blocks backups, provisions the PG schema, streams data, switches `space_databases`, re-enables backups, and decommissions the D1 database 7 days later

#### Scenario: Migration failure rollback

- **WHEN** schema-stream verification finds a constraint mismatch mid-migration
- **THEN** the engine keeps the old DB active, leaves `space_databases` unchanged, sets `provisioning_status='error'`, and pages engineering on-call

### Requirement: BYODB write-only access

For Enterprise BYODB Spaces, the engine SHALL write only to the customer-provided connection string, SHALL NOT manage backups or retention of the customer DB, and SHALL run periodic connectivity checks.

#### Scenario: BYODB outage detection

- **WHEN** three consecutive periodic connectivity checks fail
- **THEN** the engine pauses scheduled backups for the Space, fires the on-call alert, retries every 5 minutes for 24 hours, and escalates to CSM if still failing
