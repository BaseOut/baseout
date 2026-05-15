# @baseout/workflows

Trigger.dev v3 task project. Tasks run on Trigger.dev's Node runner — NOT inside a Cloudflare Worker. Enqueued from `apps/server` (the Worker) via the `@trigger.dev/sdk` `tasks.trigger()` call. See root `CLAUDE.md` for the broader split.

## Local dev

```bash
pnpm install
pnpm --filter @baseout/workflows dev
```

`pnpm dev` runs `trigger dev`, which connects to Trigger.dev's cloud and registers the local tasks for inbound enqueue requests. Set `TRIGGER_SECRET_KEY` + `TRIGGER_PROJECT_REF` in this directory's `.env` (or inherit from a parent).

## Tests

```bash
pnpm --filter @baseout/workflows test
pnpm --filter @baseout/workflows typecheck
```

Tests use plain Vitest (Node environment). External APIs (Airtable, R2/local FS, engine HTTP) are mocked at the boundary.

## Layout

```
trigger/
  tasks/
    _ping.ts            Smoke task — proves the Worker → Trigger.dev wire
    backup-base.task.ts Trigger.dev wrapper around runBackupBase
    backup-base.ts      Pure orchestration (testable without SDK)
    _lib/
      airtable-client.ts    Airtable Metadata + Records API client
      csv-stream.ts         Page → CSV transformer
      field-normalizer.ts   Airtable field value → CSV cell normaliser
      local-fs-write.ts     Local-disk CSV writer (R2 replacement)
      r2-path.ts            Backup-tree path layout (legacy name)
trigger.config.ts       Trigger.dev project config
tests/                  Plain Vitest tests
```

## Cross-app contract with apps/server

The Worker enqueues via `tasks.trigger<typeof X>("X-id", payload)`. Type definitions for the task functions are exported from this package so the Worker gets payload typing without bundling the task body. After a task completes, the task POSTs `/api/internal/runs/:runId/{progress,complete}` back to the engine — body shape stable across the boundary.

## Runtime

Node only. The tasks read configuration from `process.env`:

- `BACKUP_ENGINE_URL` — the apps/server hostname (e.g. `https://baseout-server.openside.workers.dev`)
- `INTERNAL_TOKEN` — service-token; byte-equal to apps/server's value
- `AIRTABLE_*`, R2 / BYOS provider secrets — set in Trigger.dev's environment variables UI per env

## Why this is its own app

Trigger.dev tasks deploy on Trigger.dev's runner, with their own bundle, retry semantics, and runtime constraints (Node, no workerd globals). Co-locating them in `apps/server` made the Cloudflare Worker source tree confusing (which files run in workerd, which in Node). Extracting them mirrors the deployment topology: one workspace package per deploy target.
