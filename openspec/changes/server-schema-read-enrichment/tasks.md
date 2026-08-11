# Tasks — schema-read enrichment

## 1. Pure extractor (TDD)
- [x] 1.1 RED: `tests/integration/per-space/schema-enrich.test.ts` — extractFieldConfig
      cases: multipleRecordLinks (linkedTableId / allowsMultiple from
      prefersSingleRecordLink / inverseLinkFieldId), singleSelect + multipleSelects
      (choices names), formula (formula + referencedFieldIds), rollup + lookup
      (recordLinkFieldId / fieldIdInLinkedTable), count (via only), plain types +
      null/malformed options → all-null config
- [x] 1.2 GREEN: `src/lib/per-space/schema-enrich.ts`

## 2. Read path
- [x] 2.1 `readAllEntities`: annotation columns + options→config + removedAt joins
      (first_unseen_run → bo_at_base_runs.completed_at) for bases/tables/fields/views
- [x] 2.2 Route unchanged (`schema-read.ts` spreads the enriched result); typecheck green

## 3. Web client types
- [x] 3.1 Extend `SchemaEntityBase/Table/Field/View` in `apps/web/src/lib/backup-engine.ts`
      (additive); web typecheck green

## 4. Verification
- [x] 4.1 `pnpm --filter @baseout/server exec vitest run tests/integration/per-space/schema-enrich.test.ts`
      + targeted route suite; server + web typecheck; consumed by `web-schema-round3-shell` smoke
