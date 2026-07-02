# per-space-upgrade

In-place, additive, idempotent upgrade of an existing Space's per-Space schema to
the current version.

## ADDED Requirements

### Requirement: Idempotent additive upgrade
The engine SHALL bring an existing managed_pg Space to the current per-Space schema
version by re-running the bundled DDL in `IF NOT EXISTS` form (creating missing
tables/indexes, skipping existing) and recording the new
`space_databases.schema_version`. This is valid only for additive changes.

#### Scenario: Existing Space gains new tables
- **WHEN** a Space recorded at an older version is accessed
- **THEN** the missing tables are created and its schema_version is updated to current

#### Scenario: Already-current Space is untouched
- **WHEN** a Space already at the current version is accessed
- **THEN** no DDL runs (a single version comparison) and the version is unchanged

### Requirement: Lazy on access + on backup
The new-feature read entry points (Health / Relationships / Chat) SHALL ensure the
schema is current before reading per-Space tables, and `schema-sync` SHALL ensure
it best-effort on each backup (never failing the sync on upgrade error).

#### Scenario: Opening a tab on a stale Space self-heals
- **WHEN** a user opens the Relationships/Health/Chat tab on an older Space
- **THEN** the schema is upgraded first and the read succeeds

#### Scenario: Upgrade error does not fail a backup
- **WHEN** the lazy upgrade throws during schema-sync
- **THEN** the schema sync still completes (the upgrade is retried next sync)

### Requirement: Explicit migrate route
The engine SHALL expose an `INTERNAL_TOKEN`-gated `POST /migrate-schema` that runs
the same upgrade for a Space (idempotent), for ops/backfill use.

#### Scenario: Force-upgrade via the route
- **WHEN** `POST /migrate-schema` is called for an active managed_pg Space
- **THEN** it returns whether an upgrade ran (`{ upgraded, from, to }`)
