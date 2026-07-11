# server-data-browse — Design

## Pagination: keyset, opaque cursor

- Cursor = base64 of `{ sortField, sortValue, recordId }` (recordId tiebreaks duplicate sort values). Default sort `record_id` (PK order — cheapest); user sorts ride `(table_id, <sort key>, record_id)`.
- Sorting by a **field value** (not a records column) requires joining `bo_at_record_field_data` on `(table_id, field_id)` and ordering by `value` — acceptable with the `byTableField` index for the filtered path; unsorted million-row scans stay on the PK path. If value-sort proves slow on huge tables, restrict sort to indexed record columns (createdTime/modifiedTime) first and note the limitation to the UI.
- **Total counts are approximate** above a threshold: exact `count(*)` up to N (e.g. 50k) else `reltuples`-based estimate, flagged `approximate: true`. The UI already renders "~".

## Filter compiler

A pure module maps typed filter descriptors → parameterized SQL fragments:

- `text`: contains (ILIKE), equals, empty/not-empty · `number`/`date`: =, ranges (values live JSON-encoded in `record_field_data.value` — comparisons cast via expression, e.g. `(value::numeric)`; invalid casts are filtered by a type guard on the field's type from `bo_at_fields`) · `select`: is / any-of · `checkbox`: is · `linked`: contains record id.
- Filters AND together; each filter is an EXISTS (or join) against `record_field_data` for that `(table_id, field_id)`. Cap filter count (e.g. 10) to bound plan complexity.
- Empty/not-empty leans on the sparse-until-first-value invariant: "no row = never populated", `value IS NULL` = cleared.

## History reconstruction (pure)

For one record: rows from `bo_at_record_updates` (each = a superseded old value at `run_id`) sorted by run order, plus the current value from `record_field_data`, replay **backwards** to produce per-run `{field, before, after}` entries; `records.first_seen_run` → "created" marker, `first_unseen_run` → "deleted". "View as of run R" = current values minus all updates after R — same replay, stopped early. Pure function over the three row sets; unit-test with created/updated/cleared/deleted sequences.

## Provenance & link expansion (pure interpretation of `bo_at_fields.options`)

All the metadata needed is already captured — this is interpretation, not new capture:

- **Formula**: `options.referencedFieldIds` (Airtable Meta API ships it; verify presence in captured options — if a legacy capture lacks it, fall back to `null` provenance with a `reason`, never guess by parsing the expression text). Response = the expression + one entry per referenced field `{fieldId, name, type, value-for-this-record}` (values via the same `record_field_data` reads as record detail). **No recursive resolution server-side** — the UI expands one level at a time with follow-up calls, which keeps each response bounded and avoids cycle handling (A referencing B referencing A terminates because each hop is a separate user action).
- **Linked record**: the cell value is the id list (JSON in `record_field_data.value`). Expansion = hydrate those ids against the linked table (`options.linkedTableId`): primary-field display value + a few preview fields. **Search within the set** = the id list as a bounding predicate + an ILIKE on the linked table's primary field; **keyset pagination** over the id list order. Cells can hold thousands of ids — the id list itself pages (slice server-side by cursor), so a 10k-link cell never hydrates in one response.
- **Lookup / rollup**: `options.recordLinkFieldId` names the link field to traverse and `options.fieldIdInLinkedTable` the field being read; rollups add the aggregation function. Response = the link-field metadata + per-source-record `{recordId, display, lookedUpValue}` (paginated with the same machinery when the link set is large), + `{aggregation}` for rollups.
- Dangling ids (linked record deleted since the backup, or filtered by `status='deleted'`) return as `{recordId, missing: true}` rows — the UI states it rather than silently dropping, since "the linked record is gone" is exactly the insight a backup tool should surface.

## Changelog

Per-run rollup: created = records with `first_seen_run = run`, deleted = `first_unseen_run = run`, updated = distinct records in `record_updates where run_id = run`. Row lists paginate with the same keyset machinery. Field-level filter narrows on `record_updates.field_id`.

## Search

- **Target state:** trigram GIN index on `record_field_data.value` (`pg_trgm`) → one ILIKE query across the Space, grouped `base → table` with per-group caps (e.g. 20 rows, `hasMore`). Field-**name** matches query `bo_at_fields.name` (tiny table, no index needed).
- **If the index is deferred** (bloat concern on huge Spaces): bounded sequential ILIKE per table with a Space-level row-scan budget and `partial: true` in the response — the UI states "showing first matches". Ship the index; keep the budget as a circuit breaker either way.
- `pg_trgm` must be available on per-Space DBs — provisioning enables the extension (verify on the managed provider; sqlite dev parity uses LIKE without the index).

## Export

- **Sync path** (≤ ~10k rows): stream CSV/JSON straight from the paginated reader (Worker streams; never buffer the set — PRD §7.2 discipline).
- **Async path**: an export job row (per-Space `bo_at_export_jobs` — id, scope JSON, format, status, output location, error) processed via a workflows task writing to the Space's storage destination (or managed R2), engine notified on completion. CSV = single table only (heterogeneous rows don't fit CSV); JSON = `{base → table → rows}` for multi-entity scopes.
- Attachment **cells** export as backup-file references (path/URL in the backup destination), never re-downloaded bytes.

## The data-chat conflict (decision required — do not implement silently)

`server-schema-chat` established: context is metadata-only, record data NEVER goes to the AI. Data chat breaks that by definition. Options:

1. **Opt-in raw-slice context** — per-Space setting ("Allow AI to read record data"); context = the scoped/filtered rows (capped, e.g. 200 rows × visible fields). Simple, honest, but record data leaves the Space when enabled.
2. **Tool-mediated queries** — the workflows task gets a query tool against the per-Space DB (read-only, Space-scoped); the model sees only query *results* it asks for. Better minimization, bigger build.
3. **Aggregates-only** — context limited to counts/distributions the engine computes. Weakest chat, no raw rows leave.

**Recommendation: 1 now (explicit opt-in, off by default, logged), 2 as the V2 path.** Whichever lands, the sovereign-AI claim in marketing/docs must be scoped accordingly (claims hygiene — GTM §6.5). This change ships the routes WITHOUT chat context; the opt-in + context lands only after sign-off, as `workflows-data-chat`.

## Perf guardrails

Route-level: max page size 200; filter cap; search scan budget; export sync/async threshold; all reads through the per-request Postgres client with `ctx.waitUntil` teardown (§5.1). Slow-query logging on the record routes from day one — this is the first surface where customers hit their own data at scale.
