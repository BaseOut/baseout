# Implementation tasks

## 1. Incremental-backup task

- [ ] 1.1 New `apps/workflows/trigger/tasks/incremental-backup.task.ts`. Pure module + wrapper.
- [ ] 1.2 Reuse the `_lib/airtable-client.ts` client; extend `listRecords` to support `filterByFormula` against `LAST_MODIFIED_TIME()` if not already present.
- [ ] 1.3 Write deltas under `/<orgSlug>/<spaceName>/<baseName>/incremental/<runId>/<tableName>.csv` using the storage writer (shared with `baseout-workflows-byos-destinations`).
- [ ] 1.4 POST cursor advancement to `/api/internal/airtable-webhooks/:id/cursor` after each successful table delta.
- [ ] 1.5 On gap signal, POST `/api/internal/airtable-webhooks/:id/fallback` and exit with a `fallback_to_full` result. The per-Space DO is the consumer; it enqueues a fresh `backup-base` run.

## 2. Tests

- [ ] 2.1 `apps/workflows/tests/incremental-backup-task.test.ts` — happy path (delta cursor advances), gap-fallback path, partial-failure path.

## 3. Verification

- [ ] 3.1 `pnpm --filter @baseout/workflows typecheck && test` — green.
