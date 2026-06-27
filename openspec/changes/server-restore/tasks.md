# Implementation tasks

## Phase A — Master DB schema

- [x] A.1 Generate `apps/web/drizzle/<N>_restore_runs.sql` via `pnpm --filter @baseout/web db:generate`.
- [x] A.2 Apply via `pnpm --filter @baseout/web db:migrate` against the dev DB.
- [x] A.3 Update `apps/web/src/db/schema/core.ts` — add `restoreRuns` table.
- [x] A.4 New `apps/server/src/db/schema/restore-runs.ts` mirroring the canonical migration. Header comment names the migration.
- [x] A.5 Add to engine schema barrel `apps/server/src/db/schema/index.ts`.

## Phase B — Start route + pure orchestration

- [x] B.1 TDD red: `apps/server/tests/integration/restores-start.test.ts`. Cases (mirror runs-start.test.ts): happy fan-out; row not queued (409); connection not active (422); storage destination not reachable (422); idempotency on repeat POST (409 if already started).
- [x] B.2 Implement `apps/server/src/lib/restores/start.ts` — `processRestoreStart(input, deps)`. Pure with DI.
- [x] B.3 TDD red: `apps/server/tests/integration/restores-start-route.test.ts`. 401 missing token, 400 invalid UUID, 405 non-POST, 200 happy.
- [x] B.4 Implement `apps/server/src/pages/api/internal/restores/start.ts`. Wire to real deps. Route registered in `apps/server/src/index.ts` with `RESTORES_START_RE`.
- [x] B.5 Extend `apps/server/src/lib/trigger-client.ts` with `enqueueRestoreBase(env, payload)` — type-only import from `@baseout/workflows`.

## Phase C — Progress + complete callbacks

- [x] C.1 TDD red: `apps/server/tests/integration/restores-progress.test.ts`. Cases mirror runs-progress.
- [x] C.2 Implement `apps/server/src/lib/restores/progress.ts` + the route handler.
- [x] C.3 TDD red: `apps/server/tests/integration/restores-complete.test.ts`. Per-base completion accumulation, terminal-row idempotency, mismatched-trigger_run_id rejection.
- [x] C.4 Implement `apps/server/src/lib/restores/complete.ts` + the route handler.

## Phase D — Cancel

- [x] D.1 TDD red: `apps/server/tests/integration/restores-cancel.test.ts`. Cases mirror runs-cancel: CAS transition, per-task cancel, 404, 409.
- [x] D.2 Implement `apps/server/src/lib/restores/cancel.ts` + the route handler.

## Phase E — Optional Community Restore Tooling bundle

> **DEFERRED (2026-06-26).** Optional scaffolding only. E.2 ("server reads CSVs +
> metadata.json and assembles the bundle") conflicts with the data-plane split
> (design.md "Storage-side reads": the Trigger.dev task is the storage reader, not
> the Worker), the bundle content is an explicit separate spec, and the consuming
> Pro+ apps/web UI does not exist. Build when that UI + the read-side decision land.

- [ ] E.1 Define the bundle JSON shape in design.md (pending separate scope decision). Holds the schema snapshot, sampled records per table, and per-table AI prompts. Pinned to a single `backup_runs` snapshot via `source_run_id`.
- [ ] E.2 Implement `apps/server/src/pages/api/internal/spaces/[id]/restore-bundle/[run_id].ts`. INTERNAL_TOKEN-gated. Reads from the storage destination (CSVs + metadata.json) and assembles the bundle.
- [ ] E.3 Vitest under `apps/server/tests/integration/restore-bundle-route.test.ts`.

## Phase F — Verification

- [x] F.1 `pnpm --filter @baseout/server typecheck` green (0 errors); restore tests 50/50 across all 6 restores-*.test.ts files + backup runs-* 45/45 (no regression). NOTE: ran the restore + neighbor test files by path — the full `vitest run` suite is prohibitively slow / appears to hang in this sandbox.
- [ ] F.2 Cross-check `workflows-restore` Phase 1 tasks reference the same payload + callback shapes. (Do when building `workflows-restore`: match `RestoreBaseTaskPayload` — incl. `baseName` + `sourceRunStartedAt` — and the progress/complete payloads.)
- [ ] F.3 Manual smoke: with a seeded `backup_runs` row pointing at on-disk CSVs, INSERT a `restore_runs` row, POST to `/api/internal/restores/:id/start`, confirm a Trigger.dev task spins up (workflows-side change must be implemented first).

## Phase G — Documentation

- [ ] G.1 Update `specreview/04-recommendations.md` Round 3 — mark restore as in-flight.
- [x] G.2 Added a "Restore lifecycle mirrors backup lifecycle file-for-file" section to `apps/server/CLAUDE.md` (mapping table + the `RestoreBaseTaskPayload` path-key note).
