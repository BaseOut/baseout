## Why

`server-restore` + `workflows-restore` shipped the restore data plane (lifecycle, start/progress/complete/cancel routes, the Trigger.dev task). The apps/web side is still a `PlaceholderView` stub at `/restore`, and the redesigned `RestoreView` renders harness fixtures. This change is the apps/web leg: a real restore entry point, a `POST /api/spaces/:spaceId/restore` route that INSERTs a `restore_runs` row and starts it via the engine, and `RestoreView` fed from real per-Space schema + backup-run data.

## What Changes

- **New route** `POST /api/spaces/[spaceId]/restore` — session + Space-membership gated (middleware + `Astro.locals.account`). Validates the body (`sourceRunId`, `scope`, `scopeTarget {baseId, tableId?}`), resolves the Space's Airtable `connectionId`, INSERTs a `restore_runs` row (`status='queued'`, `triggered_by='user_manual'`), calls `engine.startRestore(restoreId)`, returns `{ restoreId }`. Mirrors the `POST /api/spaces/:id/backup-runs` shape (inner pure `handlePost(input, deps)` + outer DB/auth wiring).
- **New engine-client method** `engine.startRestore(restoreId)` in `apps/web/src/lib/backup-engine.ts` — POSTs `/api/internal/restores/:id/start` over the `BACKUP_ENGINE` service binding. Mirrors `startRun`. Error codes: `restore_not_found`, `restore_already_started`, `source_run_not_restorable`.
- **Wire `RestoreView` with real data** in `apps/web/src/pages/restore.astro` — replace the `PlaceholderView` stub: load the source run's bases/tables from the per-Space schema (the `[spaceId]/schema` broker / per-Space DB), `existingBases` from `atBases`, and the outcome from the completed `restore_runs` row on `?done=<restoreId>`. Submit POSTs the new route.
- **Restore entry points** — add a "Restore" action on `BackupRunDetailView` (and the per-base view) for succeeded runs, linking to `/restore?run=<runId>`.

## Out of Scope / Gated

- **Real Airtable writes** — restore initiates the full lifecycle, but the workflows task's `ensureRestoreTarget` is a deferred stub (no Airtable write scopes + no meta-API base creation yet, per `workflows-restore`). A started restore currently terminates `failed` with `restore_target_creation_not_implemented`. This change wires the control plane; the run completing successfully waits on the write-scope + base-creation follow-up.
- Attachment re-upload, conflict/overwrite modes, point-in-time scope — all deferred (see `workflows-restore`).

## Cross-app contract

```
browser → apps/web POST /api/spaces/:spaceId/restore
            (session + membership; INSERT restore_runs queued)
            → engine.startRestore(restoreId)  [BACKUP_ENGINE binding]
              → apps/server POST /api/internal/restores/:id/start  → workflows restore-base task
```
