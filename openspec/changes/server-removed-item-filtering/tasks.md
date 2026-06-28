## 1. Removal-marking (apps/workflows, schema step)

- [ ] 1.1 In the `backup-base` schema step, after a confident full enumeration, flip previously-`active` bases/tables/fields not seen this run to `status = 'removed'` + `first_unseen_run`; retain the rows. (Reuses `system-per-space-db` columns + the confident-enumeration / `unknown` rule — no migration.)
- [ ] 1.2 Test: a removed field flips to `removed` with `first_unseen_run`; a partial run leaves `unknown`, never `removed`.

## 2. Read API (apps/server)

- [ ] 2.1 Schema read endpoints default to active-only (return `active` + `unknown`, exclude `removed`); accept `include_removed=true` to also return `removed` entities flagged with status + removal run/date.
- [ ] 2.2 Tests: default excludes removed; `include_removed` includes them flagged; `unknown` always returned.

## 3. Cross-refs + verification

- [ ] 3.1 Cross-reference `system-per-space-db` (lifecycle columns + removal rule). Link the ui-only change `deleted-items-filter`.
- [ ] 3.2 Demo: remove a field in Airtable → re-capture → it's `removed` (hidden by default in reads); `include_removed` returns it flagged with the date it went missing.
</content>
