## ADDED Requirements

### Requirement: One change folder per server feature

Each major feature within `apps/server` SHALL live in its own `openspec/changes/baseout-server-<feature>/` folder, rather than being grouped into a single umbrella change. Cross-cutting changes that span multiple apps (e.g. `airtable-client`) SHALL omit the `baseout-server-` prefix.

#### Scenario: New server feature gets its own change

- **WHEN** a new feature is added to `apps/server`
- **THEN** its proposal/design/tasks live in `openspec/changes/baseout-server-<feature>/`
- **AND** the folder name uses kebab-case
- **AND** multiple agents can work different features concurrently in their own worktrees

#### Scenario: Cross-cutting change skips the server prefix

- **WHEN** a change touches both `apps/web` and `apps/server` (or `packages/shared`)
- **THEN** the change folder name does NOT begin with `baseout-server-` (example: `airtable-client`, `web-client-isolation`)

### Requirement: Bootstrap set of 16 per-feature changes

The bootstrap of the server-decomposition SHALL produce 16 active change folders under `openspec/changes/`: the cross-cutting `airtable-client` plus 15 `baseout-server-*` stubs covering: engine-core, durable-objects, six storage destinations (R2, Google Drive, Dropbox, Box, OneDrive, S3, Frame.io), restore-core, two cron jobs (webhook-renewal, oauth-refresh), websocket-progress, dynamic-backup, and schema-diff.

#### Scenario: Active changes after bootstrap

- **WHEN** `openspec list` is run after this change is applied
- **THEN** the 16 per-feature server changes appear in the active list
- **AND** the previous umbrella `baseout-backup` no longer appears in the active list

### Requirement: Umbrella change archived after decomposition

The original umbrella `openspec/changes/baseout-backup/` SHALL be moved to `openspec/changes/archive/baseout-backup/` once decomposition completes, preserving its history without keeping it active. The original `proposal.md`, `design.md`, `tasks.md`, `README.md`, and `specs/` content SHALL be preserved unchanged so agents fleshing out the per-feature stubs can reference the umbrella.

#### Scenario: openspec list excludes the umbrella

- **WHEN** `openspec list` is invoked after archival
- **THEN** `baseout-backup` does NOT appear in the active changes list
- **AND** its files are accessible at `openspec/changes/archive/baseout-backup/` for historical reference

#### Scenario: Umbrella content unchanged

- **WHEN** an agent searching for the original engine specification runs `ls openspec/changes/archive/baseout-backup/`
- **THEN** `proposal.md`, `design.md`, `tasks.md`, `README.md`, and `specs/` are still present
- **AND** the file contents are byte-identical to pre-archival state

### Requirement: Rotating symlink for apps/server/openspec

`apps/server/openspec` SHALL resolve to whichever in-flight server change folder a given agent is currently working on, without requiring git changes. The target SHALL be selected per-checkout via `apps/server/.openspec-target` (single-line file containing the change-folder name) and SHALL fall back to a default constant `SERVER_OPENSPEC_DEFAULT_TARGET` defined in `scripts/fix-symlinks.js` when the marker file is absent.

#### Scenario: Default target on a fresh checkout

- **WHEN** no `apps/server/.openspec-target` file exists
- **THEN** `pnpm fix:symlinks` points `apps/server/openspec` at `../../openspec/changes/${SERVER_OPENSPEC_DEFAULT_TARGET}`
- **AND** the day-1 default is `airtable-client`

#### Scenario: Per-developer rotation via marker file

- **WHEN** a developer writes `baseout-server-engine-core` into `apps/server/.openspec-target` and runs `node scripts/fix-symlinks.js`
- **THEN** `apps/server/openspec` resolves to `../../openspec/changes/baseout-server-engine-core`
- **AND** the marker file is gitignored so each worktree can target a different in-flight change without conflict

#### Scenario: Stale symlinks self-heal

- **WHEN** the previously-targeted change folder has been moved or renamed and the existing symlink is dangling
- **THEN** `node scripts/fix-symlinks.js` detects the dangling symlink via `lstatSync` (not `existsSync`), removes it, and recreates it pointing at the resolved target
