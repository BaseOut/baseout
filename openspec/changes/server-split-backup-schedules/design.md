## Context

Backups today run on one `backup_configurations.frequency` (monthly/weekly/daily/instant; `server-schedule-and-cancel`) driven by a single SpaceDO alarm (`computeNextFire`). Each run captures schema, and — when the Space captures records (`mode`/`space_databases.records_enabled`; `server-dynamic-mode`) — the records too, in the same run. Schema lives in the per-Space DB (`bo_at_bases/tables/fields/schema_versions/schema_updates`); records in `bo_at_records/record_field_data`; each per-base run is tracked in `bo_at_base_runs` (`system-per-space-db`). Schema capture is cheap and fast; record capture is the expensive part (time, storage, credits, and the per-run CSV snapshot).

The product wants the Schema page to be usable on its own and to stay fresh independently of full data backups — i.e. **schema and data should be schedulable separately**.

Stakeholders: `server` (SpaceDO scheduler + capture), `workflows` (the `backup-base` task), `web` (config API + master schema), and the `ui-only` UI change.

## Goals / Non-Goals

**Goals**
- Two independent schedules per Space — a **schema** cadence and a **data** cadence — each monthly/weekly/daily (instant per tier).
- A Space can be **Schema Only** (schema schedule, no data) or **Schema + Data** (data schedule, optionally with a more-frequent schema schedule).
- A `data` run always captures schema first; data is never stored without a current schema snapshot.
- Distinguish run kinds (`schema` / `data`) in run state and history.
- Keep the single-alarm SpaceDO model; multiplex two schedules onto it.

**Non-Goals**
- Per-base or per-table schedules (Space-level only).
- Changing what schema/records *contain* (that's `system-per-space-db`).
- Instant (webhook) backups for the schema schedule specifically (instant remains a data-side trigger; deferred).
- Separate retention policies for schema vs data runs (noted; owned by `server-retention-and-cleanup` follow-up).

## Decisions

1. **`backup_configurations` carries two schedules.** Add `schema_frequency` (`monthly|weekly|daily|instant`) and `data_frequency` (`monthly|weekly|daily|instant|NULL`); `data_frequency = NULL` ⇒ **Schema Only**. Add `schema_next_scheduled_at` and `data_next_scheduled_at`. The legacy single `frequency` / `next_scheduled_at` are migrated and dropped. **BREAKING** schema change.

2. **Migration of existing rows.** If the Space currently captures records (records_enabled / a non-`d1_schema_only` tier): `data_frequency = frequency`, `schema_frequency = frequency` (schema was captured on every run). If it's schema-only today (`d1_schema_only` / `records_enabled = false`): `data_frequency = NULL`, `schema_frequency = frequency`. No behavior change at migration time — the same cadence keeps running.

3. **Run kind.** Add `kind` (`schema` | `data`) to master `backup_runs` and per-Space `bo_at_base_runs`. The engine branches capture on it: a `schema` run writes only the schema tables / `schema_versions` / `schema_updates`; a `data` run additionally captures records and writes the full per-run CSV snapshot. A `data` run captures schema **first** (reusing the existing schema path), so it always produces a schema snapshot too.

4. **SpaceDO multiplexes two schedules on its one alarm.** `computeNextFire` runs per schedule; the DO sets its single alarm to `min(schemaNext, dataNext)`. On `alarm()` it determines which schedule(s) are due (within a small tolerance window): if the **data** schedule is due it runs a `data` run (which subsumes a coincident `schema` run — no double capture); else it runs a `schema` run. It then writes both `*_next_scheduled_at` columns and re-arms the alarm to the new earliest fire. `POST /set-frequency` becomes `POST /set-schedules` taking both frequencies.

5. **Scope is the source of truth for "stores records."** `data_frequency != NULL` ⇒ records are captured (provisioning sets `space_databases.records_enabled = true`); `data_frequency = NULL` ⇒ Schema Only (`records_enabled = false`, no record CSV, no record tables populated). `mode` (static/dynamic — files vs DB) stays orthogonal and only applies to Schema + Data.

6. **Restore granularity is unchanged and data-run-based.** Only `data` runs write the per-run CSV snapshot, so point-in-time data restore selects from `data` runs. Schema Only Spaces have schema history but no data to restore. Consistent with `system-per-space-db`'s "restore from per-run CSV snapshots."

7. **Independent schedules; coincident fires subsumed.** Schedules don't reset each other (a daily schema schedule keeps firing daily regardless of the monthly data run); only fires landing in the same tolerance window are merged into one `data` run. Configs where schema is *less* frequent than data are allowed but redundant (data already captures schema) — the UI steers users away from that.

8. **Tiering.** Schema Only is available broadly (lets a customer use the Schema page with no/low data commitment). A *separate or higher-frequency* schema schedule and higher data cadences gate by tier, reusing the existing frequency tier table (Monthly all, Weekly Launch+, Daily Pro+, Instant Pro+) applied independently to each schedule. `PATCH backup-config` validates each frequency against tier.

## Risks / Trade-offs

- **[Risk] Single-alarm multiplexing drift** — if both schedules fire close together, the tolerance window must merge them into one `data` run, not run schema then data. → Define the window explicitly; a `data` run always satisfies a coincident `schema` due-time; unit-test the due-resolution.
- **[Risk] Migration ambiguity** — mapping one legacy `frequency` onto two columns must not silently change cadence or start capturing/skipping records. → Migration keys off current records-enabled state (Decision 2); add a data migration test asserting parity.
- **[Trade-off] Redundant schema runs** — schema-less-frequent-than-data configs do nothing useful. → Allowed but discouraged in UI; engine treats them as harmless.
- **[Trade-off] More moving parts in the DO** — two next-fire computations + due resolution vs one. → Pure, unit-tested `computeNextFire` + a pure due-resolver keep it testable.
- **[Risk] `records_enabled` drift** — scope (data_frequency) and `space_databases.records_enabled` could disagree. → Scope is the source of truth; provisioning + config writes set `records_enabled` from it; a check reconciles.

## Supersedes / reconciles

- **`server-schedule-and-cancel`**: the single `frequency` / `next_scheduled_at` / `POST /set-frequency` model is replaced by two schedules / two next-fire columns / `POST /set-schedules`. Cancel semantics are unchanged (a cancel targets a specific run regardless of kind).
- **`server-dynamic-mode`**: "stores records" is now driven by backup **scope** (presence of a data schedule) rather than only `mode`; `mode` remains the files-vs-DB axis for Schema + Data.
- **`system-per-space-db`**: `bo_at_base_runs` gains `kind`; schema-only runs exercise only the schema-capture half of the writer.
</content>
