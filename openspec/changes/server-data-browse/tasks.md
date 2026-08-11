# Tasks

## 1. Pure query layer (tests first)

- [x] 1.1 `record-read.ts`: filter compiler (typed descriptors → parameterized SQL; AND semantics; EXISTS-per-filter; filter cap) + keyset cursor codec (encode/decode, sort + recordId tiebreak). Unit tests: every operator per field type, cursor round-trip, cast guards.
- [x] 1.2 `record-history.ts`: backwards replay of `bo_at_record_updates` + current `record_field_data` → per-run before/after entries; created/deleted markers from first_seen/first_unseen; "as of run R" view. Unit tests: created→updated→cleared→deleted sequences.
- [x] 1.3 `record-provenance.ts` (pure): formula provenance from `options.referencedFieldIds` (+ `null`-with-reason fallback when absent — never parse expression text), lookup/rollup traversal (`recordLinkFieldId` → source records → `fieldIdInLinkedTable` value, aggregation kind), linked-set query builder (id-list bounding predicate + primary-field search + keyset paging over the id list), dangling ids → `{missing: true}`. Unit tests: formula w/ 3 refs, lookup across a link, rollup aggregation, 10k-id link cell pages, deleted linked record surfaces as missing.
- [x] 1.4 `record-search.ts`: cross-Space value search (grouped, per-group caps, scan budget → `partial: true`) + field-name search. `record-export.ts`: streaming CSV (single table) + JSON (nested scope) writers. Unit tests incl. CSV escaping + attachment-cell reference form.

## 2. Schema / indexes

- [~] 2.1 `bo_at_export_jobs` table (pg+sqlite), `SPACE_SCHEMA_VERSION` 12→13, squash-regenerated migration (`0000_minor_morbius.sql`) + `pg-ddl.ts`, parity green, idempotent upgrade auto-covers it. **`pg_trgm` GIN index DEFERRED** pending managed-provider extension confirmation — `record-search` ships the bounded-ILIKE + scan-budget + `partial` fallback the design specifies as the circuit-breaker.

## 3. Routes (integration tests against real per-Space Postgres)

- [x] 3.1 `GET /data/tables/:tableId/records` — page/filters/sort/projection/approx-total. Max page size 200. **Sort restricted to record columns (record_id/created_time/modified_time) per design §Pagination fallback; field-value sort 400s as a documented follow-up.** Route + `record-read-io.ts` + rendered-SQL tests.
- [x] 3.2 `GET /data/records/:recordId` (+ attachments) + `GET /data/records/:recordId/history` (wraps `buildRecordHistory`; `?asOfRun=` → `recordStateAsOf`; run seq derived via `assignRunSeq` since base_runs has no seq column). Routes + `record-detail-io.ts`/`record-history-io.ts` + tests.
- [x] 3.2b `GET /data/records/:recordId/links/:fieldId` (searchable, keyset-paged linked-set expansion) + `GET /data/records/:recordId/provenance/:fieldId` (formula inputs / lookup–rollup sources; one level per call, no server-side recursion). Routes + `record-provenance-io.ts` + tests.
- [x] 3.3 `GET /data/changelog` — per-run rollups + paginated row lists, base/table/field/change-type/run-range filters. Route + `record-changelog-io.ts` + tests.
- [x] 3.4 `GET /data/search` — grouped results, caps, `partial` flag (bounded-ILIKE + scan budget 2000/per-table cap 50). Route + `record-search-io.ts` + tests.
- [~] 3.5 `POST /data/export` **(sync streamed ≤ 5k rows via ReadableStream — DONE)** + `GET /data/export/:jobId` **(job-status read — DONE)**; above threshold inserts a `bo_at_export_jobs` row (202, queued). **The async writer task body is the deferred `workflows-data-export` follow-up (not enqueued yet).** Route + `record-export-io.ts` + tests.
- [ ] 3.5b Static-snapshot ingest: `POST /data/static-review` (consent-token verified) → stream CSVs from the Storage Destination → parse/coerce via snapshot schema JSON into the per-Space `review` schema → pollable status (async via workflows task for large snapshots); TTL purge + `DELETE` purge, both audit-logged; record-read/search/export machinery served schema-qualified; `missing_table` link fallback. Unit tests: CSV parse/coercion report, TTL math; integration: ingest → browse → purge leaves nothing.
- [x] 3.6 `index.ts` wiring (all 8 handlers: records/record/history/links/provenance/changelog/search/export+job — regexes $-anchored, method checks inside handlers); INTERNAL_TOKEN gate covered by existing middleware tests; slow-query logging on record routes via `data-telemetry.ts` (`logIfSlow`, ≥500ms threshold, structured JSON). Project typecheck clean; 112 route/IO unit tests green.

## 4. Data-chat context (decision resolved: allowed, policy-gated)

- [ ] 4.1 After `shared-ai-controls` enforcement lands: data-scope context assembler (scoped/filtered rows, capped e.g. 200 × visible fields; policy `all` required at route guard + re-asserted in the assembler) + file `workflows-data-chat` for the model call. Unit tests: cap honored, policy `schema_only`/`off` throws in the assembler.
- [x] 4.2 `web-data-page` follow-up filed when the ui-only `data-page` UI ports (proxy routes, capability gating, nav). Filed 2026-07-13: [`web-data-page`](../web-data-page/).

## 5. Verification

- [ ] 5.1 `npm run typecheck` + build green; integration suite green against Docker Postgres; smoke: seed 1M-row synthetic table → first page < 500ms, filtered page uses index (EXPLAIN), history replay correct on a mutated record, a 10k-id link cell expands paged + searchable, formula/lookup provenance resolves, export of 100k rows streams without buffering.
