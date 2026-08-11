# Implementation tasks

## 1. Finalization step

- [ ] 1.1 Update `apps/workflows/trigger/tasks/backup-base.task.ts` (or split out `finalize-base-docs.task.ts` if cleaner). After the per-table loop completes successfully, call Airtable Metadata API endpoints for automations, interfaces, extensions, scoped to the current Base.
- [ ] 1.2 Compose the docs blob shape declared in `server-automations-interfaces-docs` design.md.
- [ ] 1.3 POST the blob to `/api/internal/runs/:runId/docs` (or whichever endpoint the server-side sibling declares). Fire-and-forget transport-error posture, consistent with the rest of the engine-callback contract.

## 2. Tests

- [ ] 2.1 `apps/workflows/tests/backup-base-task-docs.test.ts` (new) — happy-path fetch + POST; Airtable Metadata 5xx surfaces as a partial-success result (run still succeeds, docs blob absent).

## 3. Verification

- [ ] 3.1 `pnpm --filter @baseout/workflows typecheck && test` — green.
