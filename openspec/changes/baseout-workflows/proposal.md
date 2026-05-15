## Why

The original `baseout-backup` data-plane change conflated two deployment targets: the Cloudflare Worker (`apps/server/`) and the Trigger.dev v3 task runner (Node, no time limits). Co-locating both under one openspec change made it hard to reason about which work units live where, which secrets each side owns, and which runtime constraints apply. As the data plane has grown new long-running workloads (per-base backup, cleanup cron, trial-email cron, attachment download, BYOS writers, dynamic DB provisioning, incremental backup, credit-balance alerts, schedule-and-cancel fan-out), the boundary between Worker-side orchestration and Trigger.dev-side task execution has become load-bearing. This change extracts that boundary into its own openspec change, scoped to `apps/workflows/`, so future Trigger.dev work can be reviewed and archived against a stable contract instead of being spread across the server proposal.

## What Changes

- Establish `apps/workflows/` as a standalone workspace package (`@baseout/workflows`) hosting the Trigger.dev v3 task project — task definitions, pure orchestration helpers, project config, tests. The Cloudflare Worker (`apps/server/`) imports task types from this package via `import type` only, so the Worker bundle stays SDK-only.
- Move the existing Trigger.dev task files (`_ping`, `backup-base.task`, `backup-base`, and the `_lib/` helpers — Airtable client, CSV stream, field normalizer, local-FS writer, path layout) out of `apps/server/trigger/` into `apps/workflows/trigger/`.
- Lock the cross-app contract between server and workflows:
  - Server enqueues via `tasks.trigger<typeof X>("X-id", payload)` using the `@trigger.dev/sdk`. Token (`TRIGGER_SECRET_KEY`) read from Worker env.
  - Workflows reads `BACKUP_ENGINE_URL`, `INTERNAL_TOKEN`, and provider-specific keys from `process.env` (Trigger.dev cloud env-vars UI per environment).
  - Workflows posts run progress + completion back to `/api/internal/runs/:runId/{progress,complete}` on the Worker; transport errors are fire-and-forget, with the DO lock alarm + reconciliation as safety nets.
- Document the Node-only runtime constraint: workflows code MUST NOT import `cloudflare:workers` or assume workerd globals. Tests run on plain Vitest (`environment: "node"`), not `@cloudflare/vitest-pool-workers`.
- Spawn sibling `baseout-workflows-<topic>` changes for each in-flight `baseout-server-<topic>` change that adds a Trigger.dev task. The server-side change keeps the orchestration + DO + Worker bits; the workflows-side change owns the task definition + helpers + tests.

## Capabilities

### New Capabilities

- `trigger-task-runner`: The Trigger.dev v3 task project boundary — runtime constraints (Node, `process.env` config, no workerd), task-vs-pure-orchestration separation, type-only re-export pattern for Worker consumers, engine-callback contract for progress + completion, and the test harness (plain Vitest, no `@cloudflare/vitest-pool-workers`).

### Modified Capabilities

None of the data-plane spec capabilities (`backup-engine`, `restore-engine`, `storage-destinations`, `airtable-webhook-coalescing`, `background-services`) are moved out of the server proposal. Those capabilities describe *what* happens during a backup or restore; *where* the bytes execute (Worker vs Trigger.dev runner) is the implementation detail this change formalizes. Future workflows-side changes can extend the spec set as needed.

## Impact

- **New workspace package**: `apps/workflows/` (`@baseout/workflows`). Independent `package.json`, `tsconfig.json`, `vitest.config.ts`, `trigger.config.ts`. Reuses `@baseout/db-schema` and `@baseout/shared` only.
- **Server package changes**: drops `papaparse`, `@types/papaparse`, and `@trigger.dev/build` from `apps/server/package.json`. Adds `@baseout/workflows: workspace:*` for type-only task references. Retains `@trigger.dev/sdk` as the enqueue path.
- **Deploy targets**: `apps/server` deploys to Cloudflare Workers (`wrangler deploy`); `apps/workflows` deploys to Trigger.dev (`trigger deploy`). Two separate accounts/projects per environment.
- **Secrets**: `TRIGGER_SECRET_KEY` + `TRIGGER_PROJECT_REF` continue to live on the Worker (it enqueues). `INTERNAL_TOKEN`, `BACKUP_ENGINE_URL`, and provider keys (Airtable, BYOS) live in the Trigger.dev env-vars UI per environment.
- **Tests**: workflows tests are plain Vitest Node-environment tests. The Worker's `@cloudflare/vitest-pool-workers` setup is unaffected.
- **OpenSpec symlinks**: `apps/workflows/openspec` symlinks to `openspec/changes/baseout-workflows/`. `apps/server/openspec` continues to symlink to `openspec/changes/baseout-server/` (renamed from `baseout-backup`).
- **Cross-change family rename**: `baseout-backup` and every `baseout-backup-*` in-flight change is renamed to `baseout-server[-…]` to match the app directory. Trigger.dev-touching changes get a `baseout-workflows-<topic>` sibling that owns the task-side bullets.

## Out of Scope

- Splitting parent spec capabilities (`backup-engine`, etc.) into workflows-only and server-only halves. Those specs describe externally-visible behavior; the runtime boundary is captured in `trigger-task-runner` instead.
- Restructuring the Trigger.dev project layout itself (e.g. moving `_lib/` helpers into a separate package). The current layout is acceptable.
- Adding new task types beyond what's already proposed in the sibling `baseout-workflows-<topic>` changes.
