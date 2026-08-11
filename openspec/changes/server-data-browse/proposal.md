## Why

The ui-only [`data-page`](../../../../ui-only/openspec/changes/data-page/) change adds a **Data** page — browse backed-up records, per-record history, a Space-wide data changelog, cross-base search, exports, and data chat. The per-Space store already **captures** everything it needs (`bo_at_records`, `bo_at_record_field_data` current values, `bo_at_record_updates` superseded-value log by run, `bo_at_attachments`) — but the engine has **no read surface over record data**: no paginated record queries, no filters, no history reconstruction, no search, no record exports. This change adds that query layer. Tables can hold millions of rows, so pagination and index strategy are the core of the design, not an afterthought.

## What Changes

- **Engine read routes** (all `INTERNAL_TOKEN`-gated, per-Space):
  - `GET /data/tables/:tableId/records` — **keyset-paginated** record page (opaque cursor; never offset), typed field filters (text/number/date/select/checkbox/linked operators), sort, column projection, approximate total.
  - `GET /data/records/:recordId` — full field values (JSON-decoded per field type) + attachment metadata.
  - `GET /data/records/:recordId/history` — the record's timeline: created/deleted markers from `first_seen_run`/`first_unseen_run`, per-field **before → after** diffs reconstructed from `bo_at_record_updates` (old value) + `bo_at_record_field_data` (current value), each entry stamped with its run.
  - `GET /data/records/:recordId/links/:fieldId` — **linked-record expansion**: the records a link cell points to, keyset-paginated and **searchable within the linked set** (link fields can hold thousands of ids), each row carrying primary-field display + preview values.
  - `GET /data/records/:recordId/provenance/:fieldId` — **cell provenance** from `bo_at_fields.options`: formula cells → the referenced fields (`referencedFieldIds`) with this record's current values + the expression; lookup/rollup cells → the traversed link field (`recordLinkFieldId`), source table, source record(s), and the looked-up field's (`fieldIdInLinkedTable`) value per source record (+ aggregation kind for rollups).
  - `GET /data/changelog` — per-run created/updated/deleted rollups + row lists for the Space, filterable by base/table/field/change-type/run-range.
  - `GET /data/search` — cross-base/table search over field **values** and field **names**, results grouped base → table with counts, bounded per-group.
  - `POST /data/export` + `GET /data/export/:jobId` — CSV (single-table scope) / JSON (any scope) respecting filters; small scopes return synchronously (streamed), large scopes run as an async job.
- **Indexing for the above** (per-Space schema version bump): keyset-support index on records `(table_id, record_id)` (exists via `byTable` + PK; verify), changelog range support on `bo_at_record_updates` (`byRun` exists), and a **trigram GIN index on `bo_at_record_field_data.value`** for search — the one genuinely new index; see design for the fallback if it's deferred.
- **Data-chat context (decision resolved 2026-07-11: allowed).** Record-data chat context is **in scope**, governed by the AI-usage policy from [`shared-ai-controls`](../shared-ai-controls/) — data-scoped context requires effective policy `all` (Org ceiling + per-Space restriction; `schema_only` restores the old metadata-only posture; `off` disables AI entirely). Context = the scoped/filtered rows, capped (e.g. 200 rows × visible fields), assembled only after the policy re-assert. Build order: `shared-ai-controls` enforcement lands first; the context assembler + `workflows-data-chat` follow.
- **Static-snapshot ingest (for static-only Spaces).** Dynamic Spaces query the per-Space store directly; static-only Spaces have files, not a database. On explicit, per-snapshot user consent (UI-side dialog — ui-only `data-page`), `POST /data/static-review` reads that backup snapshot's CSVs from the Space's Storage Destination and loads them into a **temporary review schema** in the per-Space DB (`review_*` tables or a dedicated schema): parse → type-coerce via the snapshot's captured schema JSON → serve through the SAME record-read/search/export machinery, minus history/changelog (no cross-run data exists). Review copies carry a TTL (e.g. 72h idle) and a purge endpoint; ingest status is pollable (large snapshots parse async). **Privacy note:** static/BYOS customers chose "never stored on Baseout servers" — ingest is the consented, temporary, logged exception, and the purge is real deletion.
- **Web wiring is out of scope here**: `apps/web` proxy routes, capability gating, and the ported UI land via a `web-data-page` follow-up when the ui-only change ports (same pairing as `server-schema-chat` ↔ `web-chat-tab`).

## Capabilities

### New Capabilities
- `data-browse`: engine query layer over backed-up record data — paginated/filtered record reads, per-record history, linked-record expansion + formula/lookup provenance, Space-wide changelog, cross-entity search, CSV/JSON export, and consent-gated static-snapshot ingest into a temporary review store.

### Modified Capabilities
- `schema-chat`: context assembly gains a record-data scope, allowed only at AI-usage policy `all` (`shared-ai-controls`).

## Impact

- `apps/server/src/lib/per-space/` — `record-read.ts` (pure query builders: filters → SQL, keyset cursor encode/decode), `record-history.ts` (pure diff reconstruction), `record-provenance.ts` (pure: field-options interpretation for formula refs + lookup/rollup traversal, link-set query builder), `record-search.ts`, `record-export.ts` (streaming writers).
- Routes: `data-records.ts`, `data-record.ts`, `data-record-history.ts`, `data-record-links.ts`, `data-record-provenance.ts`, `data-changelog.ts`, `data-search.ts`, `data-export.ts` + `index.ts` wiring.
- `packages/db-schema/src/space/{pg,sqlite}.ts` — search index (+ any missing keyset index); `SPACE_SCHEMA_VERSION` bump; squashed migrations + `pg-ddl.ts` regenerated. Existing Spaces follow the standard per-Space upgrade path.
- **Security:** internal routes only; filters compile through parameterized builders (never string-concatenated SQL); export jobs are Space-scoped; record data reaches AI context only at effective policy `all`, re-asserted at assembly time (`shared-ai-controls`).
- **Tests first** (per §3.4): pure modules (filter compiler, cursor codec, history reconstruction, CSV/JSON writers) + route integration against a real per-Space Postgres.
- **Pairs with**: ui-only [`data-page`](../../../../ui-only/openspec/changes/data-page/) (UI), [`shared-ai-controls`](../shared-ai-controls/) (policy gate — lands first), `web-data-page` follow-up (proxy + gating), and a `workflows-data-chat` follow-up (the model call).
