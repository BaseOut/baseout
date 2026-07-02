## Why

The backup-config UI offers a single cadence and an implicit "back up everything." With `server-backup-scope` the engine now supports a **scope** (Schema Only vs Schema + Data) and an independent **schema** schedule. The UI must let users choose what to back up and set the two cadences (e.g. schema daily, data monthly), show each schedule's next run, and distinguish run kinds in history. This imports the ui-only `backup-schedule-and-scope` spec.

## What Changes

- Add a **"What to back up"** scope selector (Schema Only / Schema + Data) to the backup-config step ([IntegrationsSetupWizard.astro](../../../apps/web/src/views/IntegrationsSetupWizard.astro) Step 3 "Options").
- Scope-aware cadence controls: Schema Only → one **Schema backup** cadence; Schema + Data → a **Data backup** cadence + a **Schema backup** cadence, with the inline "every data backup also captures schema; schema can run more frequently" note and a non-blocking hint when schema is set less frequently than data.
- Per-cadence **tier gating** via the existing `frequencies` capability (Monthly all · Weekly Launch+ · Daily/Instant Pro+), as the standard upgrade affordance; **Schema Only scope is never gated**.
- **Next-run** lines per active schedule ("Next data backup" / "Next schema backup") and a **Schema/Full** badge on backup history rows (from `backup_runs.kind`).
- Persist `{ scope, dataFrequency, schemaFrequency }` via the backup-config route → engine `set-schedule`.

## Capabilities

### New Capabilities
- `backup-schedule-and-scope`: the UI for choosing backup scope and the schema + data cadences, the per-schedule next-run display, and the run-kind badge in history.

### Modified Capabilities
<!-- Refines the wizard schedule step (space-setup-wizard) + backup history (web-backups-redesign). -->

## Impact

- [apps/web/src/views/IntegrationsSetupWizard.astro](../../../apps/web/src/views/IntegrationsSetupWizard.astro) — scope selector + scope-aware dual cadence + gating + the schema/data relationship note/hint.
- [apps/web/src/pages/api/spaces/[spaceId]/backup-config.ts](../../../apps/web/src/pages/api/spaces/[spaceId]/backup-config.ts) — accept + validate `{scope, dataFrequency, schemaFrequency}`, UPSERT the columns, post `set-schedule` to the engine.
- [apps/web/src/lib/backups/format.ts](../../../apps/web/src/lib/backups/format.ts) — `kindLabel`/`kindBadgeClass` (shared with `server-backup-scope`) + `formatNextScheduledAt` reuse for the schema line.
- The run-history view (`web-backups-redesign` surface) — add the Schema/Full badge; the Space home / backups header — add the second next-run line.
- **Precondition:** `server-backup-scope` migration applied (`scope`, `schema_frequency`, `schema_next_scheduled_at`, `backup_runs.kind`) — run `db:migrate` before smoking (CLAUDE §5.5).
- **Pairs with** `server-backup-scope` + `workflows-schema-only-backup`.
