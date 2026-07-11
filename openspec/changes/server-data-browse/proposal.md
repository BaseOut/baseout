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
- **Data-chat context (flagged conflict).** Schema chat's context assembly is deliberately **metadata-only** ("only metadata leaves the Space" — `server-schema-chat`). Data chat is *about record data*, which that stance forbids. This change specs the context contract but **gates it behind an explicit per-Space opt-in** and records the decision options in `design.md` — do not implement the chat context without resolving that question.
- **Web wiring is out of scope here**: `apps/web` proxy routes, capability gating, and the ported UI land via a `web-data-page` follow-up when the ui-only change ports (same pairing as `server-schema-chat` ↔ `web-chat-tab`).

## Capabilities

### New Capabilities
- `data-browse`: engine query layer over backed-up record data — paginated/filtered record reads, per-record history, linked-record expansion + formula/lookup provenance, Space-wide changelog, cross-entity search, and CSV/JSON export.

### Modified Capabilities
- `schema-chat`: context assembly gains an **opt-in** record-data scope (decision gated; see design).

## Impact

- `apps/server/src/lib/per-space/` — `record-read.ts` (pure query builders: filters → SQL, keyset cursor encode/decode), `record-history.ts` (pure diff reconstruction), `record-provenance.ts` (pure: field-options interpretation for formula refs + lookup/rollup traversal, link-set query builder), `record-search.ts`, `record-export.ts` (streaming writers).
- Routes: `data-records.ts`, `data-record.ts`, `data-record-history.ts`, `data-record-links.ts`, `data-record-provenance.ts`, `data-changelog.ts`, `data-search.ts`, `data-export.ts` + `index.ts` wiring.
- `packages/db-schema/src/space/{pg,sqlite}.ts` — search index (+ any missing keyset index); `SPACE_SCHEMA_VERSION` bump; squashed migrations + `pg-ddl.ts` regenerated. Existing Spaces follow the standard per-Space upgrade path.
- **Security:** internal routes only; filters compile through parameterized builders (never string-concatenated SQL); export jobs are Space-scoped; record data in AI context is opt-in and off by default.
- **Tests first** (per §3.4): pure modules (filter compiler, cursor codec, history reconstruction, CSV/JSON writers) + route integration against a real per-Space Postgres.
- **Pairs with**: ui-only [`data-page`](../../../../ui-only/openspec/changes/data-page/) (UI), `web-data-page` follow-up (proxy + gating), and — only if the chat decision lands — a `workflows-data-chat` follow-up.
