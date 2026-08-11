## Context

`server-schedule-and-cancel` (Phase B) gave each Space a single alarm-driven schedule: `backup_configurations.frequency` → `computeNextFire(frequency, now)` → `SpaceDO` sets one alarm → `alarm()` inserts a `backup_runs` row (`triggered_by='scheduled'`) and enqueues per-base tasks. We now need **two** cadences per Space (data + schema) and a per-run **kind**, without a second Durable Object (a DO has one alarm).

## Goals / Non-Goals

**Goals**
- Model scope (Schema Only / Schema + Data) + an optional, independent schema cadence in `backup_configurations`.
- Multiplex two cadences onto the one `SpaceDO` alarm; stamp each run with `kind`.
- Keep the change additive and back-compatible (existing single-cadence Spaces keep working).
- Extract the dual-cadence decision logic as pure, unit-tested functions.

**Non-Goals**
- Per-base / per-table schedules (Space-level only).
- The `instant` cadence for either schedule (webhook-driven; out of scope, same as today).
- The task's schema-only capture behavior (paired `workflows-schema-only-backup`) and the UI (`web-backup-schedule-and-scope`).

## Decisions

1. **Reuse `frequency` as the DATA cadence; add `schema_frequency`.** Minimal blast radius (CLAUDE §3.2): existing code that reads `frequency` keeps working as the data/full schedule. New columns: `scope`, `schema_frequency` (nullable), `schema_next_scheduled_at` (nullable, engine-owned mirror of `next_scheduled_at`).
   - `scope='schema_only'` → only the schema schedule runs (uses `schema_frequency`); no data runs. `frequency` is ignored.
   - `scope='schema_and_data'` → the data schedule runs on `frequency` (kind `full`, captures schema+data); if `schema_frequency` is set, an additional schema schedule runs on it (kind `schema`). If `schema_frequency` is null, schema only refreshes with each full run.
2. **`backup_runs.kind` (`full` | `schema`), default `full`.** Manual runs and data-scheduled runs are `full`; schema-scheduled runs are `schema`. Drives the UI badge and the task's capture path. Plain text + app-level constraint (matches `status`).
3. **Two next-fires, one alarm.** `SpaceDO` stores `dataNextFire` + `schemaNextFire` in DO storage. `alarm()` computes `now`, fires every schedule whose stored next-fire `<= now` (could be both at a shared boundary), inserts a run per fired kind, recomputes the fired schedule(s)' next-fire from `now`, and sets the alarm to the nearer remaining next-fire. The decision logic is pure:
   - `computeScheduleFires({scope, dataFrequency, schemaFrequency}, now)` → `{dataNextFire, schemaNextFire}` (null where a schedule is inactive or `instant`).
   - `dueKinds({dataNextFire, schemaNextFire}, now)` → `('full'|'schema')[]`.
   - `nextAlarm({dataNextFire, schemaNextFire})` → the min non-null, or null.
4. **`set-frequency` → `set-schedule`.** The engine route accepts `{scope, dataFrequency, schemaFrequency}`, computes both fires, writes `next_scheduled_at` + `schema_next_scheduled_at`, and seeds the DO. Back-compat: a lone `{frequency}` body is treated as `{scope:'schema_and_data', dataFrequency:frequency}`.
5. **`kind` flows to the task.** `processRunStart` stamps `backup_runs.kind`; `enqueueBackupBase` adds `kind` to `BackupBaseTaskPayload`. The paired workflows change reads it.

## Risks / Trade-offs

- **[Risk] Two-schedule alarm logic is subtle (shared boundaries, re-arm).** → Isolated in pure functions with table-driven tests (both due, one due, neither, re-arm picks the nearer). The DO is a thin caller.
- **[Risk] DO test suite is flaky/hangs locally** (auto-memory `reference_server_full_suite_do_test_hang`). → Keep the DO change minimal; cover the logic in the pure-function tests; run targeted suites, not the full DO suite.
- **[Trade-off] Reusing `frequency` for "data" is slightly implicit.** → Documented in the column comment; avoids a wide rename across SpaceDO/route/bootstrap/wizard.
- **[Migration] additive only** — safe to apply ahead of the readers; existing rows default to `scope='schema_and_data'`, `kind='full'`, preserving today's behavior exactly.

## Cross-app contract (keep in sync)

- `set-schedule` body: `{ scope, dataFrequency?, schemaFrequency? }` (legacy `{frequency}` accepted).
- `BackupBaseTaskPayload` gains `kind: 'full' | 'schema'`.
- `backup_runs.kind` is the source of truth the web badge reads.
