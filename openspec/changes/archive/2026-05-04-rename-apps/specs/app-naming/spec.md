## ADDED Requirements

### Requirement: App directories use short, consistent names
App directories under `apps/` SHALL use short, single-word names that reflect the app's role without redundant suffixes.

#### Scenario: server app is at apps/server
- **WHEN** the monorepo workspace is enumerated
- **THEN** the app formerly at `apps/backup` SHALL exist at `apps/server`

#### Scenario: api app is at apps/api
- **WHEN** the monorepo workspace is enumerated
- **THEN** the app formerly at `apps/inbound-api` SHALL exist at `apps/api`

#### Scenario: sql app is at apps/sql
- **WHEN** the monorepo workspace is enumerated
- **THEN** the app formerly at `apps/sql-rest-api` SHALL exist at `apps/sql`

#### Scenario: package names match directory names
- **WHEN** each app's package.json is read
- **THEN** the `name` field SHALL match the directory name (`server`, `api`, `sql`)

#### Scenario: workspace resolves renamed packages
- **WHEN** `pnpm install` is run at the repo root
- **THEN** all three renamed packages SHALL resolve without errors
