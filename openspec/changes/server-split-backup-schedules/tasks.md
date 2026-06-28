## 1. Master DB schema + migration

- [ ] 1.1 Add `schema_frequency`, `data_frequency` (nullable), `schema_next_scheduled_at`, `data_next_scheduled_at` to `backup_configurations` (Drizzle schema in apps/web). Add `kind` (`schema`|`data`) to `backup_runs`.
- [ ] 1.2 `pnpm --filter @baseout/web db:generate` → migration. Backfill: record-capturing Spaces → `data_frequency = frequency`, `schema_frequency = frequency`; schema-only Spaces → `data_frequency = NULL`, `schema_frequency = frequency`. Then drop legacy `frequency` / `next_scheduled_at` (two-phase expand→contract if needed).
- [ ] 1.3 Migration parity test: existing cadence + record behavior unchanged post-migration (red→green).

## 2. Per-Space DB

- [ ] 2.1 Add `kind` (`schema`|`data`) to `bo_at_base_runs` in `packages/db-schema/src/space/{pg,sqlite}.ts`; bump `SPACE_SCHEMA_VERSION`; regenerate per-Space migrations; keep pg/sqlite parity test green.

## 3. Scheduling (SpaceDO)

- [ ] 3.1 Keep `computeNextFire(frequency, now)` pure; add a pure `resolveDueKind({ schemaNext, dataNext }, now, toleranceMs)` → `'data' | 'schema' | null` (data subsumes coincident schema). TDD.
- [ ] 3.2 SpaceDO: arm the single alarm to `min(schemaNext, dataNext)`; on `alarm()` dispatch the resolved kind, write both `*_next_scheduled_at`, re-arm. Tests: schema-only ticks, data ticks, coincident → single data run.
- [ ] 3.3 Replace `POST /set-frequency` with `POST /set-schedules` (`{ schemaFrequency, dataFrequency }`); compute + persist both next-fires.
- [ ] 3.4 Update the bootstrap-alarms script to set both schedules per `backup_configurations` row (idempotent).

## 4. Config API (apps/web)

- [ ] 4.1 `PATCH /api/spaces/:id/backup-config` accepts `schemaFrequency` + `dataFrequency` (+ derived scope). Validate each frequency against tier independently; reject below-tier. On change, hand off to the engine `POST /set-schedules`.
- [ ] 4.2 Derive scope → set `space_databases.records_enabled` (data_frequency != NULL ⇒ true; NULL ⇒ false); reconcile on write. Schema-only must not require/provision record storage.
- [ ] 4.3 Config-load query returns both next-fire timestamps + scope for the UI.

## 5. Capture path (apps/server side; task side is the paired change)

- [ ] 5.1 Thread `kind` into the run-trigger + `backup-base` task payload when the SpaceDO dispatches a run.
- [ ] 5.2 The `backup-base` task's kind branch (schema-only vs schema-first-then-records) is specced + implemented in the paired **`workflows-split-backup-schedules`** change — coordinate the payload/callback `kind` contract across both.
- [ ] 5.3 Roll up `kind` from the completion callback to the master `backup_runs` row.

## 6. Validation, tiering, docs

- [ ] 6.1 Tier matrix applied per schedule (Monthly all / Weekly Launch+ / Daily Pro+ / Instant Pro+); Schema Only available broadly. Surface clear errors.
- [ ] 6.2 Note schema-vs-data retention as a follow-up for `server-retention-and-cleanup` (schema runs are cheap; data runs heavy) — do not change retention here.
- [ ] 6.3 Cross-reference + update banners on `server-schedule-and-cancel` (single→dual schedule) and `server-dynamic-mode` (scope drives records). Link the `ui-only` change `backup-schedule-and-scope`.

## 7. Verification

- [ ] 7.1 Demo: set schema=daily, data=monthly on a dev Space; confirm a schema-only run populates `bo_at_*` schema (no records) and a data run populates records + CSV; history shows `kind`.
- [ ] 7.2 Demo: Schema Only Space (`data_frequency = NULL`) never schedules/dispatches a data run and never provisions record storage.
</content>
