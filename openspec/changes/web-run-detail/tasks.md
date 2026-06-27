# web-run-detail — Tasks

## Task 1 — `getRunDetail` in backup-engine.ts (TDD)
- [ ] Write failing tests in `backup-engine.test.ts`:
  - correct GET path + headers
  - 200 happy path with non-empty bases[]
  - 200 with empty bases[] (legacy run)
  - `engine_unreachable` on fetch throw
  - unknown error code → `engine_error`
- [ ] Implement `getRunDetail(runId)` in `backup-engine.ts`:
  - Add `EngineRunDetailBase`, `EngineRunDetailTable`, `EngineRunDetailSuccess`, `EngineRunDetailError`, `EngineRunDetailResult` types
  - Add `getRunDetail` to `BackupEngineClient` interface
  - Implement via `schemaDocsRequest`-style inline fetch (GET, no body)

## Task 2 — Wire `run.astro`
- [ ] Import `createBackupEngine` / env in `run.astro` frontmatter
- [ ] After loading the DB row, call `engine.getRunDetail(row.id)` (best-effort — if engine is unavailable, fall through to `metricsPending=true`)
- [ ] Map engine `bases[]` → `BaseRun[]` per the snapshot gaps table in proposal.md
- [ ] Pass `bases` and `metricsPending={bases.length === 0}` to `BackupRunDetailView`

## Task 3 — `apps/web/src/pages/backups/run/base.astro` (production page)
- [ ] Create directory `apps/web/src/pages/backups/run/`
- [ ] Build `base.astro`:
  - Read `?run=<runId>&base=<atBaseId>` query params
  - Redirect to `/backups` on missing params or no space
  - Load run row from DB (same query as `run.astro`) — 404 redirect if not found
  - Call `engine.getRunDetail(runId)` → filter to `atBaseId`
  - If base not found in detail (legacy/empty), redirect to run page
  - Render `BackupRunBaseView` with real base data
  - No spaceId auth route needed (page is SSR-only, auth is via `Astro.locals.account`)

## Task 4 — Verify
- [ ] `pnpm --filter @baseout/web exec vitest run src/lib/backup-engine.test.ts` — green
- [ ] `pnpm --filter @baseout/web typecheck` — 0 errors
- [ ] `pnpm --filter @baseout/web test:unit` — full suite green
- [ ] `pnpm --filter @baseout/design typecheck` — 0 errors
