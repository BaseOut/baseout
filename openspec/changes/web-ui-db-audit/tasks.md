# Tasks — UI ↔ DB schema audit + schema-pull validation

## A. Verify the current build (schema pull + backups)
- [ ] Schema pull: open `/schema` on a Space with a completed backup; confirm the SSR
      entity tree renders from the engine broker (no fixture data) and the tier gate
      (`resolveSchemaDocsLevel`) behaves per tier
- [ ] Backups: run a backup end-to-end (queued→running→succeeded) and confirm
      `schema-sync` wrote a new row set to the per-Space `bo_at_*` tables
- [ ] Cross-check the colleague's latest build (ui.basal.dev / `ui-only` remote) once
      Dan confirms it is stable — note any surface that differs from what we audit

## B. Systematic UI↔DB audit
- [x] Sync Dan's latest Schema surfaces from `ui-only@d97c777` into `apps/design`
      (round-2/3 web layer localized under the design harness — see the sync commit)
- [x] Enumerate fields displayed/edited across the Schema surfaces (SchemaView props,
      panel components, `schema-lab.ts` / `panel-lab-scenarios.ts` fixture shapes) and
      the other design views (backups, restore, destinations, integrations)
- [x] Compare against `apps/web/src/db/schema/core.ts`, `packages/db-schema` `bo_at_*`
      tables, and the `schema-read` payload; classify each as
      exists / missing / type-mismatch / fixture-only
- [x] Write `audit-findings.md` in this change: findings table + proposed remediation
      list (candidate migration columns vs UI-side fixes vs engine payload gaps)
      — done 2026-07-07; see `audit-findings.md` §A–§E for the remediation split

## C. Remediation (scoped after findings review with Dan)
- [ ] Author Drizzle migration(s) 0025+ for confirmed missing columns; keep
      `apps/web/src/db/schema/*` and `packages/db-schema` in lockstep; `db:check` green
- [ ] Wire or remove orphaned UI fields (per-finding decision)
- [ ] File follow-up `server-*` / `workflows-*` changes for engine payload gaps
- [ ] Regression: any bug found in the schema-pull path gets a failing test before the
      fix (CLAUDE.md §3.4)
