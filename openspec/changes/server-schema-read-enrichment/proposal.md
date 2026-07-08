# Enrich the schema-read broker payload (options config, annotations, removedAt)

## Why
The schema-read broker (`GET /api/internal/spaces/:spaceId/schema`) emits only
`name / type / isPrimary / description / status` per field — while the Schema UI
(round-2/3 design, promoted via `web-schema-round3-shell`) renders link/formula/lookup
configuration, select choices, AI/user descriptions, and deleted-since dates. All of
that is **already captured** in the per-Space DB (`bo_at_fields.options` jsonb, the
`ai_description`/`description_override` annotation columns, and the
`first_unseen_run` lifecycle pointer) — the read path just never surfaces it.

This is audit remediation **A** (`web-ui-db-audit/audit-findings.md` §2) and clears the
declared blocker in `web-schema-visualize` ("Data mode blocked until the engine adds
`linkedTableId` to the schema payload"). It also enables EntityPanel back-references
(the reverse graph is derived by inverting the forward config — "the engine must emit
them" per the design canon).

## What changes
Additive only — every existing payload field keeps its name and shape.

- New pure module `apps/server/src/lib/per-space/schema-enrich.ts`:
  `extractFieldConfig(type, options)` maps Airtable option shapes to a flat config
  (`linkedTableId`, `allowsMultiple`, `inverseFieldId`, `formula`,
  `referencedFieldIds`, `lookupViaFieldId`, `lookupTargetFieldId`, `choices`),
  mirroring the option-key handling already proven in
  `lib/per-space/relationships.ts` (`linkedTableId`, `recordLinkFieldId`,
  `fieldIdInLinkedTable`, `referencedFieldIds`). Defensive on null/malformed options.
- `readAllEntities` (`lib/per-space/space-db-pg.ts`): select the annotation columns
  (`ai_description`, `description_override`) for bases/tables/fields, the field
  `options` (run through `extractFieldConfig`), and a `removedAt` ISO per entity
  (`first_unseen_run` → `bo_at_base_runs.completed_at` left join, all four entity
  kinds).
- `apps/web/src/lib/backup-engine.ts`: extend `SchemaEntityBase/Table/Field/View`
  types additively to match.

## Non-goals
- No migrations, no write-path changes, no new routes.
- Per-table health rollup and health trend history (audit §2/§4) — separate follow-up;
  they read health tables, not the schema working set.

## Impact
- `apps/server/src/lib/per-space/schema-enrich.ts` (new, pure) + test.
- `apps/server/src/lib/per-space/space-db-pg.ts` — `readAllEntities` only.
- `apps/web/src/lib/backup-engine.ts` — additive type extension.
- Unblocks: `web-schema-visualize` Data mode, `web-schema-round3-shell` back-refs.
