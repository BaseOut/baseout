# Implementation tasks

> **Shipped in commit `36ca62b` ("feat(web): wire the restore UI + route (web-restore)"); boxes
> ticked retroactively 2026-06-27.** Verified green: `restore.test.ts` + `backup-engine.test.ts`
> = 84/84 pass; web typecheck exit 0. The control plane is complete; a started restore terminates
> `failed` with `restore_target_creation_not_implemented` — the actual Airtable write is a principled
> deferral (needs write-scope OAuth + Meta API base creation; MVP connection is read-only). 5.2 (manual
> smoke) remains a human checkpoint.

Pre-req: `server-restore` shipped (the `/api/internal/restores/:id/start` route + `restore_runs` schema). Real restore completion is GATED on Airtable write scopes + meta-API base creation (`workflows-restore` follow-up) — this change wires the control plane; a started restore currently ends `failed` with a clear message.

## 1. Engine client method

- [x] 1.1 TDD red: extend `apps/web/src/lib/backup-engine.test.ts` — `startRestore` happy 200, `restore_not_found`, `restore_already_started`, `source_run_not_restorable`, `engine_unreachable`.
- [x] 1.2 Implement `startRestore(restoreId)` in `apps/web/src/lib/backup-engine.ts`, mirroring `startRun` (POST `/api/internal/restores/:id/start` via the `BACKUP_ENGINE` binding). Add the new error codes to the engine-status mapper if one is shared.

## 2. Restore route

- [x] 2.1 TDD red: `apps/web/src/pages/api/spaces/[spaceId]/restore.test.ts` — 401 unauth, 403 IDOR (space not in org), 400 invalid body (missing sourceRunId/scope/scopeTarget), 404 source run not found, 405 non-POST, 200 happy (INSERTs restore_runs queued + calls engine.startRestore).
- [x] 2.2 Implement `apps/web/src/pages/api/spaces/[spaceId]/restore.ts` — inner pure `handlePost(input, deps)` + outer auth/DB wiring. Resolve the Space's Airtable connection; INSERT `restore_runs` (queued, triggered_by='user_manual', scope, scope_target, source_run_id, connection_id, space_id); call `engine.startRestore`; on engine failure roll back the queued row (mirror the backup-run POST failure path).

## 3. Wire RestoreView with real data

- [x] 3.1 Replace `apps/web/src/pages/restore.astro`'s `PlaceholderView` with the wired `RestoreView`. Load: the source run (`?run=<runId>`) + its bases/tables from the per-Space schema; `existingBases` from `atBases`; the outcome from the completed `restore_runs` row on `?done=<restoreId>`. Redirect to `/restore` when there's no Space/run.
- [x] 3.2 Submit wires the form → `POST /api/spaces/:spaceId/restore` with `setButtonLoading`; on success route to `/restore?done=<restoreId>` (or show the run status).

## 4. Entry points

- [x] 4.1 Add a "Restore" action on `BackupRunDetailView` (succeeded/trial_succeeded runs) linking to `/restore?run=<runId>`. Optionally the per-base view too.

## 5. Verification

- [x] 5.1 `restore.test.ts` + `backup-engine.test.ts` 84/84 pass; web typecheck exit 0 (raw-markup audit not re-run this session).
- [ ] 5.2 Manual smoke (control plane): open a succeeded run → Restore → pick base/tables → submit → a `restore_runs` row appears `queued`→`running`, a Trigger.dev task spins up, and (until writes land) terminates `failed` with `restore_target_creation_not_implemented`.
