## Status

Engine/DB half of dual schema+data backup schedules. Extends `server-schedule-and-cancel`. Additive migration; reuses `frequency` as the data cadence. Pairs with `workflows-schema-only-backup` + `web-backup-schedule-and-scope`. DO suite is flaky locally (auto-memory) — cover logic in pure-function tests; run targeted DO suites only.

---

## 1. Schema + migration (foundation)

- [x] 1.1 [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts): `backup_configurations` += `scope` (default `'schema_and_data'`), `schema_frequency` (nullable), `schema_next_scheduled_at` (nullable); `backup_runs` += `kind` (default `'full'`).
- [x] 1.2 Mirror in [apps/server/src/db/schema/backup-configurations.ts](../../../apps/server/src/db/schema/backup-configurations.ts) + [backup-runs.ts](../../../apps/server/src/db/schema/backup-runs.ts) (kind `.default("full")` so SpaceDO inserts may omit it); `schema-mirrors.test.ts` pinned column lists updated (green).
- [x] 1.3 Migration `apps/web/drizzle/0022_backup_scope.sql` generated (additive ALTERs). **`db:migrate` deferred to the web slice** (CLAUDE §5.5 — apply before any UI reads the columns).

## 2. Pure dual-schedule logic (TDD)

- [x] 2.1 `apps/server/tests/integration/scheduling/dual-schedule.test.ts` (extended): `computeScheduleFires`/`dueKinds`/`nextAlarm` + `asScheduledFrequency` + `parseScheduleBody` (legacy + new shapes, rejects unknown/instant/empty).
- [x] 2.2 `apps/server/src/lib/scheduling/dual-schedule.ts` — pure helpers reusing `computeNextFire`. Green.

## 3. Run kind + badge helper (TDD)

- [x] 3.1 [apps/web/src/lib/backups/format.ts](../../../apps/web/src/lib/backups/format.ts): `kindLabel` / `kindBadgeClass` + `format.test.ts` (65/65).

## 4. SpaceDO dual-cadence dispatch

- [x] 4.1 `SpaceDO` stores both next-fires (`schedule_fires` key); `alarm()` uses `dueKinds`/`nextAlarm`, inserts a run per due kind (stamping `kind`), advances fired schedules, re-arms (or clears). Legacy fallback for DOs armed pre-dual. `space-do.test.ts` updated + dual-fire case (11/11).
- [x] 4.2 `set-frequency` route now scope-aware via shared `parseScheduleBody` (legacy `{frequency}` accepted); writes both `next_scheduled_at` + `schema_next_scheduled_at`; forwards normalized config to the DO. Route tests green.
- [x] 4.3 `processRunStart` forwards `run.kind` into `BackupBaseTaskPayload.kind` (`trigger-client` forwards the payload as-is). runs-start test + a schema-kind case green (21/21).
- [x] 4.4 Bootstrap needs **no change** — back-compat: it posts `{frequency}`, the route normalizes to `schema_and_data` + stores fires in the DO, re-arming existing Spaces. (Future scope changes flow through the web route.)

## 5. Verification

- [x] 5.1 `pnpm --filter @baseout/server typecheck` clean + `dual-schedule`/`space-do`/`runs-start`/`schema-mirrors`/`set-frequency-route` green; `pnpm --filter @baseout/web typecheck` + `format` green. No stray `console.*`.
- [ ] 5.2 Human smoke (with `web-backup-schedule-and-scope`): set a Space to schema daily / data monthly; confirm both `next_*` columns + a `schema` run inserted on the schema tick. (Apply migration 0022 first.)
