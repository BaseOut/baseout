## ADDED Requirements

### Requirement: Workflows app hosts the Trigger.dev v3 task project
Trigger.dev v3 task definitions, the `trigger.config.ts` project config, the pure orchestration modules they wrap, the `_lib/` helpers they call, and their tests SHALL live in `apps/workflows/` with package name `@baseout/workflows`. No Trigger.dev task source SHALL live in `apps/server/`.

#### Scenario: Trigger.dev project boundary
- **WHEN** the monorepo is enumerated
- **THEN** `apps/workflows/trigger.config.ts` SHALL exist with `runtime: "node"` and `dirs: ["./trigger"]`
- **AND** `apps/workflows/trigger/tasks/` SHALL contain at least one task definition discoverable by the Trigger.dev CLI
- **AND** `apps/server/trigger/` and `apps/server/trigger.config.ts` SHALL NOT exist

#### Scenario: workspace package metadata
- **WHEN** `apps/workflows/package.json` is read
- **THEN** the `name` field SHALL be `"@baseout/workflows"`
- **AND** runtime `dependencies` SHALL include `@trigger.dev/sdk`
- **AND** `devDependencies` SHALL include `@trigger.dev/build` and `vitest`

### Requirement: Pure orchestration is separated from the task wrapper
Every Trigger.dev task in `apps/workflows/` SHALL be implemented as two files: a pure async function module that takes injected deps, and a thin wrapper that adapts the JSON payload, reads `process.env`, instantiates real deps, and calls the pure module. Tests SHALL target the pure module — not the wrapper.

#### Scenario: pure-module-plus-wrapper layout
- **WHEN** a new long-running workload is added to `apps/workflows/`
- **THEN** it SHALL be implemented as `trigger/tasks/<name>.ts` (pure module) + `trigger/tasks/<name>.task.ts` (Trigger.dev wrapper)
- **AND** the wrapper SHALL be the only file in the pair that imports from `@trigger.dev/sdk`
- **AND** the wrapper SHALL wrap the pure-module call in try/catch so unexpected throws still produce a structured result reportable to the engine

#### Scenario: tests exercise the pure module
- **WHEN** a task body is unit-tested
- **THEN** the test SHALL import the pure module (e.g. `runBackupBase` from `trigger/tasks/backup-base`)
- **AND** SHALL NOT import the wrapper or `@trigger.dev/sdk`
- **AND** SHALL inject `fetch`, `sleep`, client, and writer test seams via the `deps` object

### Requirement: Workflows code is Node-only
Workflows code SHALL run on Trigger.dev's Node runner and SHALL NOT depend on workerd globals or imports.

#### Scenario: no cloudflare imports
- **WHEN** any file under `apps/workflows/` is analyzed
- **THEN** it SHALL NOT contain `import … from "cloudflare:workers"`
- **AND** it SHALL NOT reference `caches.default`, `DurableObject`, or other workerd-only globals

#### Scenario: process.env is the config source
- **WHEN** a task wrapper reads runtime configuration
- **THEN** it SHALL read from `process.env` (e.g. `BACKUP_ENGINE_URL`, `INTERNAL_TOKEN`, provider keys)
- **AND** SHALL fail fast with a descriptive error if a required variable is missing
- **AND** SHALL NOT read from Cloudflare Worker `env` bindings (those don't exist in the Trigger.dev runner)

### Requirement: Type-only re-exports keep the Worker bundle SDK-only
The workflows app SHALL re-export task references as `export type` from `trigger/tasks/index.ts` so the Cloudflare Worker can declare typed payloads via `tasks.trigger<typeof X>(…)` without bundling the task body or its transitive dependencies (`papaparse`, Airtable client, fs helpers).

#### Scenario: server imports types only
- **WHEN** `apps/server/src/lib/trigger-client.ts` references a workflows task
- **THEN** the import SHALL use `import type { … } from "@baseout/workflows"`
- **AND** the Worker bundle SHALL NOT include `papaparse`, `node:fs/promises`, or other Node-only transitive dependencies from workflows

#### Scenario: barrel exports
- **WHEN** `apps/workflows/trigger/tasks/index.ts` is read
- **THEN** it SHALL re-export each task reference and each shared payload type as `export type`
- **AND** every new workflows task SHALL add a corresponding `export type` line to `index.ts`

### Requirement: Engine callback contract
Tasks SHALL post back to the Cloudflare Worker at well-known internal endpoints to report progress and completion. Posts SHALL be fire-and-forget; transport errors SHALL be swallowed and SHALL NOT cause the task to fail. The receiving endpoints SHALL be idempotent.

#### Scenario: progress event after each table CSV lands
- **WHEN** a backup-base task successfully writes one table's CSV
- **THEN** the task SHALL POST `/api/internal/runs/:runId/progress` with `{ triggerRunId, atBaseId, recordsAppended, tableCompleted: true }`
- **AND** the POST SHALL include the `x-internal-token` header equal to `process.env.INTERNAL_TOKEN`
- **AND** any thrown error from the POST SHALL be caught and swallowed

#### Scenario: completion event at run end
- **WHEN** a task body completes (success, trial-truncated, trial-complete, or failed)
- **THEN** the wrapper SHALL POST `/api/internal/runs/:runId/complete` with `{ triggerRunId, atBaseId, status, tablesProcessed, recordsProcessed, attachmentsProcessed, errorMessage? }`
- **AND** a duplicate completion against a terminal run row SHALL no-op on the engine side
- **AND** transport errors SHALL be caught and swallowed; the ConnectionDO lock alarm SHALL release the held lock if the post is lost

### Requirement: Workflows tests use plain Vitest Node environment
Workflows tests SHALL run under plain Vitest with `environment: "node"`. They SHALL NOT use `@cloudflare/vitest-pool-workers`.

#### Scenario: vitest config
- **WHEN** `apps/workflows/vitest.config.ts` is read
- **THEN** it SHALL set `test.environment` to `"node"`
- **AND** SHALL NOT import `@cloudflare/vitest-pool-workers`
- **AND** SHALL collect tests from `tests/**/*.test.ts`

#### Scenario: external API mocking at the boundary
- **WHEN** a workflows test exercises a task that calls Airtable or the engine
- **THEN** the test SHALL mock `fetch` (or inject a client stub) at the boundary via the `deps` object
- **AND** SHALL NOT depend on a running Trigger.dev cloud or live external API

### Requirement: Sibling change pairing for Trigger.dev work
Every in-flight openspec change that adds or modifies a Trigger.dev task SHALL exist as a `workflows-<topic>` change paired with the corresponding `server-<topic>` change. The workflows-side change SHALL own the task definition, helpers, and tests; the server-side change SHALL own the enqueue path, master-DB writes, DO state, and callback handlers.

#### Scenario: paired changes
- **WHEN** an in-flight openspec change includes file paths under `apps/workflows/trigger/`
- **THEN** a sibling change with name `workflows-<topic>` SHALL exist
- **AND** the sibling SHALL cross-reference the `server-<topic>` change in its `proposal.md`
- **AND** the server-side change SHALL list only Worker-side work; task-side bullets SHALL appear in the workflows-side `tasks.md`
