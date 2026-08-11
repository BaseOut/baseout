# UI ↔ DB schema audit + schema-pull validation

## Why
At the Jul 6, 2026 Dan/Autumn sync, Dan acknowledged the Baseout UI may display items
that lack corresponding database fields — the design work (ui-only fork, promoted in
waves) has run ahead of the master-DB and per-Space schemas in places. Two next steps
were assigned: **audit the UI against the database structure** to find missing fields,
and **validate that schema data is pulling into the application correctly** (backups
functional, schema properly integrated), cross-checking the colleague's latest build
(ui.basal.dev / the `ui-only` remote) once it stabilizes.

Existing tooling doesn't cover this: `pnpm --filter @baseout/web db:check`
(`apps/web/scripts/check-migrations.mjs`) only verifies applied-migration sync against
`drizzle/meta/_journal.json` — it says nothing about whether a field the UI renders has
a real column behind it.

## What changes
- **Verify the current build (schema pull + backups).** Confirm the schema-read path
  end-to-end: engine broker `apps/server/src/pages/api/internal/spaces/schema-read.ts`
  → web proxy `apps/web/src/pages/api/spaces/[spaceId]/schema.ts` (auth + IDOR + tier
  gate via `resolveSchemaDocsLevel`) → `SchemaView` SSR. Confirm a backup run goes
  queued→running→succeeded and the captured schema versions land in the per-Space
  `bo_at_*` tables via `schema-sync`.
- **Systematic UI↔DB audit.** Enumerate every data field the UI displays or edits —
  including Dan's latest Schema round-2/3 surfaces synced from `ui-only` into
  `apps/design` — and compare against:
  - master DB: `apps/web/src/db/schema/core.ts` (25 tables, latest migration
    `0024_multi_destinations`),
  - per-Space schema tables: `packages/db-schema` (`bo_at_schema_versions/bases/
    tables/fields/views` + relationships/health/changelog),
  - the engine `schema-read` response shape.
  Output: a findings table (UI element → data source → DB column → status:
  exists / missing / type-mismatch / fixture-only) checked into this change as
  `audit-findings.md`.
- **Remediation.** Missing columns land as normal Drizzle migrations (0025+) owned by
  apps/web; orphaned UI either wires to real columns or is removed; engine payload gaps
  become follow-up `server-*`/`workflows-*` changes. Per Dan: the tables should be
  correct — expect field-level gaps, not table-level.

## Non-goals
- No end-user-facing features — target persona is the platform admin (Jul 6 decision).
- No promotion of the ui-only round-2/3 web layer into `apps/web` — that remains the
  separately-planned web-promotion work; this change only reads those surfaces to audit
  them.

## Impact
- `apps/web/drizzle/` — candidate migration(s) 0025+ for confirmed missing columns.
- `apps/web/src/db/schema/core.ts` + `packages/db-schema` — matching Drizzle schema edits.
- UI files whose fields turn out orphaned — wire or remove (scoped per finding).
- `openspec/changes/web-ui-db-audit/audit-findings.md` — the audit artifact.
- Read-only on `apps/server` (mirrored tables note their canonical migration source per
  CLAUDE.md §2); any engine-side gap files a separate `server-*` change.
