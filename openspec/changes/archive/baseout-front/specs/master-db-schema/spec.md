## ADDED Requirements

### Requirement: Schema definition lives in front

The Drizzle schema for the master DB SHALL live in `baseout-web/src/db/schema/` and SHALL be the single source of truth for table definitions, types, and indexes.

#### Scenario: Back imports without redefining

- **WHEN** `baseout-backup-engine` or `baseout-background-services` imports table definitions
- **THEN** they import from `@baseout/db-schema` and never redefine tables locally

### Requirement: Naming conventions

Tables and columns SHALL be snake_case. Primary keys SHALL be UUIDs. Every table SHALL have `created_at` and `modified_at` timestamps. Encrypted column names SHALL end in `_enc`.

#### Scenario: Encrypted token column

- **WHEN** a column stores an encrypted OAuth token
- **THEN** the column name ends in `_enc` and the value is AES-256-GCM ciphertext

### Requirement: Migration workflow

Migrations SHALL be generated via `drizzle-kit generate` into committed SQL files and applied via `drizzle-kit migrate`. Production migrations SHALL require a manual approval step on `main` merge.

#### Scenario: PR migration

- **WHEN** a PR adds a new column
- **THEN** the PR includes the generated SQL migration file alongside the schema change

#### Scenario: Production apply

- **WHEN** a migration reaches `main`
- **THEN** the production apply requires a human-approved manual step before the SQL is run

### Requirement: `@baseout/db-schema` package publishing

Front SHALL publish the schema as an internal npm package `@baseout/db-schema` consumed by back at a pinned version.

#### Scenario: Version pinned by back

- **WHEN** back's `baseout-backup-engine` updates Drizzle types
- **THEN** the back repo pins a specific `@baseout/db-schema` version and re-publishes via PR / lockfile change

### Requirement: Connection management

The master DB connection string SHALL live in Cloudflare Secrets. Front SHALL connect via Drizzle for all reads/writes; back SHALL use its own Drizzle client and its own connection string from its Cloudflare Secrets.

#### Scenario: Front-only writes to user-scoped tables

- **WHEN** a write to `organizations`, `connections`, `spaces`, `bases`, `subscriptions`, `subscription_items`, `backup_configurations`, or `restore_runs` (insert) is needed
- **THEN** front executes the write directly via Drizzle and back never inserts into these tables
