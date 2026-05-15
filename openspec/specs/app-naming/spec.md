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

### Requirement: Hooks app uses final short name
The app formerly at `apps/webhooks` SHALL exist at `apps/hooks` with package name `@baseout/hooks`.

#### Scenario: hooks app is at apps/hooks
- **WHEN** the monorepo workspace is enumerated
- **THEN** the app SHALL exist at `apps/hooks` and NOT at `apps/webhooks`

#### Scenario: package name matches directory
- **WHEN** `apps/hooks/package.json` is read
- **THEN** the `name` field SHALL be `"@baseout/hooks"`

#### Scenario: workspace resolves renamed package
- **WHEN** `pnpm install` is run at the repo root
- **THEN** `@baseout/hooks` SHALL resolve without errors

### Requirement: Workflows app hosts Trigger.dev tasks
Trigger.dev v3 task definitions SHALL live in their own top-level app at `apps/workflows/` with package name `@baseout/workflows`, separate from the backup-engine Worker at `apps/server/`.

#### Scenario: workflows app is at apps/workflows
- **WHEN** the monorepo workspace is enumerated
- **THEN** an app SHALL exist at `apps/workflows` containing the Trigger.dev project (`trigger.config.ts`, `trigger/tasks/`, `tests/`)
- **AND** `apps/server/trigger/` and `apps/server/trigger.config.ts` SHALL NOT exist

#### Scenario: package name matches directory
- **WHEN** `apps/workflows/package.json` is read
- **THEN** the `name` field SHALL be `"@baseout/workflows"`

#### Scenario: server enqueues tasks via workspace dependency
- **WHEN** `apps/server/package.json` is read
- **THEN** it SHALL declare a `workspace:*` dependency on `@baseout/workflows` for type-only task references
- **AND** it SHALL retain `@trigger.dev/sdk` as a runtime dependency for `tasks.trigger()`
- **AND** it SHALL NOT depend on `papaparse` (the CSV serializer moved into workflows)

### Requirement: OpenSpec change family naming aligns with apps
In-flight OpenSpec changes SHALL be named after the app whose surface they primarily touch. The data-plane parent change SHALL be `baseout-server` (renamed from the historical `baseout-backup`); each in-flight follow-up SHALL be `baseout-server-<topic>`. Trigger.dev-task work SHALL live in `baseout-workflows-<topic>` siblings paired with their server-side counterpart.

#### Scenario: parent change name matches app directory
- **WHEN** `openspec/changes/` is enumerated
- **THEN** `openspec/changes/baseout-server/` SHALL exist (renamed from `baseout-backup`)
- **AND** `openspec/changes/baseout-workflows/` SHALL exist as a sibling parent for the Trigger.dev project boundary
- **AND** no folder under `openspec/changes/` SHALL start with `baseout-backup` (archived changes excluded)

#### Scenario: in-flight follow-ups follow the naming convention
- **WHEN** a new follow-up change is filed against the data plane
- **THEN** it SHALL be named `baseout-server-<topic>` if it primarily modifies the Cloudflare Worker
- **AND** it SHALL be named `baseout-workflows-<topic>` if it primarily adds or modifies a Trigger.dev task
- **AND** mixed changes SHALL be filed as a pair (one of each), cross-referencing via `proposal.md`

#### Scenario: openspec symlinks per app
- **WHEN** `apps/server/openspec` is read
- **THEN** it SHALL be a symlink pointing at `../../openspec/changes/baseout-server`
- **AND** `apps/workflows/openspec` SHALL be a symlink pointing at `../../openspec/changes/baseout-workflows`
