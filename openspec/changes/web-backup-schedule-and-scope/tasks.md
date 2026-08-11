## Status

Web half of dual schema+data schedules. Imports ui-only `backup-schedule-and-scope`. Depends on `server-backup-scope` (migration + `set-schedule` + `backup_runs.kind`). Reuses the `frequencies` capability for per-cadence gating.

---

## 1. Backup-config route (TDD) — DONE

- [x] 1.1 `persist-policy.test.ts` + `backup-config.test.ts` extended: validate/tier-gate `scope` + `schemaFrequency` (null clears), UPSERT the columns, and hand off the FULL post-upsert schedule to the engine on any schedule-field change.
- [x] 1.2 Implemented: `persist-policy.ts` (scope + schemaFrequency validation + tier-gate), route `buildUpsert` writes the columns, `fetchScheduleForSpace` read-back, `backup-engine.setSpaceFrequency` is scope-aware (`SpaceScheduleInput`, returns `{dataNextFire, schemaNextFire}`). 120 web tests green; migration `0022` applied (`db:check` clean).

## 2. Wizard scope + dual cadence (UI) — DONE

- [x] 2.1 `IntegrationsSetupWizard.astro` Step 4 (Options): the **Data** depth checkbox is the scope selector (`data-scope-data`: on ⇒ `schema_and_data`, off ⇒ `schema_only`). Two cadence pickers — "Data backups" (`wz-frequency`/`data-frequency`) shown only when Data is on, and "Schema backups" (`wz-schema-frequency`/`data-schema-frequency`) always shown — each tier-gated via `availableFrequencies` (Upgrade link on locked rows). Redundancy hint under the data picker (hidden in schema-only). Persists `{scope, frequency, schemaFrequency}` through `saveConfigureForm` → `saveBackupConfig` → the route. `syncScope()` toggles the data block on load + change.
- [x] 2.2 Next-run lines: "Next data backup" (`data-next-data`, `nextScheduledAt`) + "Next schema backup" (`data-next-schema`, `schemaNextScheduledAt`), both via `formatNextScheduledAt`; the data line lives inside the data block so Schema-only shows only the schema line. Policy hydration extended (`BackupPolicy` += scope/schemaFrequency/schemaNextScheduledAt; `integrations.ts` selects + maps them). Review step shows `Data <freq> · Schema <freq>` or `Schema only · <freq>`.

## 3. History badge (UI) — DONE

- [x] 3.1 Schema/Full badge (`kindLabel`/`kindBadgeClass`) added to the run rows in BOTH render paths — SSR (`BackupsListView.astro`) and the live-poll re-render (`list-row.ts` `backupRowHtml`) so it can't drift on poll ([[reference_backup_live_status_polling]]). `backup_runs.kind` threaded through `BackupRunSummary` + `BackupRunRowLike` + the run-list route SELECT + `rowToSummary`. Tests updated (factories + exact-shape assertions) + a new `backupRowHtml` kind-badge case.

## 4. Verification

- [x] 4.1 (persistence) `db:migrate` applied + `db:check` clean; web `typecheck` 0 errors; `persist-policy`/`backup-config`/`backup-engine` green.
- [x] 4.2 (UI) web `typecheck` 0 errors + `build` green + full unit suite 914 green (new `save-config` scope/schemaFrequency body cases, `configure-save` scope-only save case, `list-row` kind-badge case). No stray `console.*`.
- [ ] 4.3 Human smoke: configure Schema Only and Schema+Data (schema daily / data monthly); both next-run lines render; history shows Schema/Full badges; Daily gated below Pro. (Engine runs `--remote`.)
