# Implementation tasks

## Phase A — Master DB schema

- [ ] A.1 Generate `apps/web/drizzle/<N>_restore_runs.sql` via `pnpm --filter @baseout/web db:generate`.
- [ ] A.2 Apply via `pnpm --filter @baseout/web db:migrate` against the dev DB.
- [ ] A.3 Update `apps/web/src/db/schema/core.ts` — add `restoreRuns` table.
- [ ] A.4 New `apps/server/src/db/schema/restore-runs.ts` mirroring the canonical migration. Header comment names the migration.
- [ ] A.5 Add to engine schema barrel `apps/server/src/db/schema/index.ts`.

## Phase B — Start route + pure orchestration

- [ ] B.1 TDD red: `apps/server/tests/integration/restores-start.test.ts`. Cases (mirror runs-start.test.ts): happy fan-out; row not queued (409); connection not active (422); storage destination not reachable (422); idempotency on repeat POST (409 if already started).
- [ ] B.2 Implement `apps/server/src/lib/restores/start.ts` — `processRestoreStart(input, deps)`. Pure with DI.
- [ ] B.3 TDD red: `apps/server/tests/integration/restores-start-route.test.ts`. 401 missing token, 400 invalid UUID, 405 non-POST, 200 happy.
- [ ] B.4 Implement `apps/server/src/pages/api/internal/restores/start.ts`. Wire to real deps. Route registered in `apps/server/src/index.ts` with `RESTORES_START_RE`.
- [ ] B.5 Extend `apps/server/src/lib/trigger-client.ts` with `enqueueRestoreBase(env, payload)` — type-only import from `@baseout/workflows`.

## Phase C — Progress + complete callbacks

- [ ] C.1 TDD red: `apps/server/tests/integration/restores-progress.test.ts`. Cases mirror runs-progress.
- [ ] C.2 Implement `apps/server/src/lib/restores/progress.ts` + the route handler.
- [ ] C.3 TDD red: `apps/server/tests/integration/restores-complete.test.ts`. Per-base completion accumulation, terminal-row idempotency, mismatched-trigger_run_id rejection.
- [ ] C.4 Implement `apps/server/src/lib/restores/complete.ts` + the route handler.

## Phase D — Cancel

- [ ] D.1 TDD red: `apps/server/tests/integration/restores-cancel.test.ts`. Cases mirror runs-cancel: CAS transition, per-task cancel, 404, 409.
- [ ] D.2 Implement `apps/server/src/lib/restores/cancel.ts` + the route handler.

## Phase E — Optional Community Restore Tooling bundle

- [ ] E.1 Define the bundle JSON shape in design.md (pending separate scope decision). Holds the schema snapshot, sampled records per table, and per-table AI prompts. Pinned to a single `backup_runs` snapshot via `source_run_id`.
- [ ] E.2 Implement `apps/server/src/pages/api/internal/spaces/[id]/restore-bundle/[run_id].ts`. INTERNAL_TOKEN-gated. Reads from the storage destination (CSVs + metadata.json) and assembles the bundle.
- [ ] E.3 Vitest under `apps/server/tests/integration/restore-bundle-route.test.ts`.

## Phase F — Verification

- [ ] F.1 `pnpm --filter @baseout/server typecheck && test` — green.
- [ ] F.2 Cross-check `workflows-restore` Phase 1 tasks reference the same payload + callback shapes.
- [ ] F.3 Manual smoke: with a seeded `backup_runs` row pointing at on-disk CSVs, INSERT a `restore_runs` row, POST to `/api/internal/restores/:id/start`, confirm a Trigger.dev task spins up (workflows-side change must be implemented first).

## Phase G — Documentation

- [ ] G.1 Update `specreview/04-recommendations.md` Round 3 — mark restore as in-flight.
- [ ] G.2 Update `apps/server/CLAUDE.md` (or root) with a note that restore lifecycle mirrors backup lifecycle file-for-file (`restores/start.ts` ↔ `runs/start.ts`, etc.) so reviewers can navigate by analogy.
