## 1. Payload + branch

- [ ] 1.1 Add `kind: 'schema' | 'data'` to the `backup-base` payload type in `backup-base.task.ts` (default `data` when absent). Thread it into the pure `backup-base.ts`.
- [ ] 1.2 `backup-base.ts`: branch on `kind` at the top of the orchestration.

## 2. Shared schema-capture step

- [ ] 2.1 Extract the schema-capture logic into a reusable function (fetch schema → diff vs current → upsert `bo_at_bases/tables/fields/views` + lifecycle → `bo_at_schema_updates` → hash-deduped `bo_at_schema_versions`). Keep it pure/testable.
- [ ] 2.2 `data` flow calls the schema step first, then the existing records path.

## 3. Schema-only flow

- [ ] 3.1 `kind = 'schema'`: run the schema step only — no record fetch, no dynamic-DB record upserts, no per-run data CSV. Set `bo_at_base_runs.kind = 'schema'`.

## 4. Data flow

- [ ] 4.1 `kind = 'data'`: schema step → records (CSV to destination + dynamic-DB upserts) → per-run CSV snapshot. Set `bo_at_base_runs.kind = 'data'`.

## 5. Callbacks + concurrency

- [ ] 5.1 Include `kind` in progress + completion callbacks; schema-run progress reports tables/fields (not record counts).
- [ ] 5.2 Confirm schema upserts are idempotent (ID-keyed + hash-dedup) so overlapping schema/data runs converge to a no-op; rely on the ConnectionDO lock for Airtable serialization — no exclusivity assumption.

## 6. Tests

- [ ] 6.1 Pure-module tests per kind: `schema` writes schema only (no records/CSV); `data` writes schema first then records + CSV.
- [ ] 6.2 Concurrency test: a `schema` run overlapping a `data` run for the same base — second schema write dedupes to a no-op, neither fails.
- [ ] 6.3 Back-compat test: payload without `kind` runs the full `data` flow.

## 7. Cross-reference

- [ ] 7.1 Cross-link with baseout `server-split-backup-schedules` (engine dispatches `kind`; this task executes it). Note the dependency on `system-per-space-db` `bo_at_base_runs.kind` + hash-deduped versions.
</content>
