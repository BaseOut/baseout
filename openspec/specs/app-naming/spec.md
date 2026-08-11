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

### Requirement: OpenSpec change family naming follows three prefixes
In-flight OpenSpec changes SHALL use one of three prefixes:

1. **`<app>-<topic>`** — single-app code change. The `<app>` segment SHALL match a directory under `apps/` (`web`, `server`, `workflows`, `admin`, `api`, `sql`, `hooks`). The parent / umbrella change for an app SHALL be the bare `<app>` (no topic suffix).
2. **`shared-<topic>`** — code change that touches two or more apps as a unit (the change MUST land across multiple `apps/*` source trees to function).
3. **`system-<topic>`** — structural / repo-shape / tooling change (workspace package, openspec convention, root scripts, CI, architectural-decision-records). Touches `packages/`, `scripts/`, `openspec/`, root config, or no runtime code at all.

No active change folder under `openspec/changes/` SHALL begin with `baseout-` (the historical prefix was retired 2026-05; archived changes are exempt).

#### Scenario: app-prefixed change
- **WHEN** an in-flight change modifies code in exactly one `apps/*` directory
- **THEN** the change SHALL be named `<app>-<topic>` where `<app>` is that directory's name
- **AND** the parent / umbrella change for the app SHALL be the bare `<app>`

#### Scenario: shared-prefixed change
- **WHEN** an in-flight change modifies source files in two or more `apps/*` directories as a single unit
- **THEN** the change SHALL be named `shared-<topic>`
- **AND** documentation cross-references that merely mention another app SHALL NOT trigger the `shared-` prefix — the test is whether reverting the change requires touching files in multiple apps

#### Scenario: system-prefixed change
- **WHEN** an in-flight change modifies the repository's structure, tooling, workspace packages under `packages/`, root scripts, CI config, openspec conventions, or records an architectural decision without runtime-code impact
- **THEN** the change SHALL be named `system-<topic>`

#### Scenario: paired sibling changes
- **WHEN** server-side work has a Trigger.dev-task counterpart
- **THEN** the work SHALL be filed as a pair (`server-<topic>` + `workflows-<topic>`), each touching one app
- **AND** the two SHALL cross-reference each other in `proposal.md`
- **AND** the pair SHALL NOT be filed as a single `shared-<topic>` (each sibling is genuinely single-app)

#### Scenario: discovery via root npm script
- **WHEN** a developer wants to see all changes for a prefix
- **THEN** running `pnpm openspec:changes <prefix>` SHALL list the parent change first followed by every `<prefix>-<topic>` follow-up, with task progress for each
- **AND** `<prefix>` SHALL accept `web` / `server` / `workflows` / `admin` / `api` / `sql` / `hooks` / `shared` / `system`
