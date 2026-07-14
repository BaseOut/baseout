# server-mcp-interface-pages — Design

## Context

schema-sync (`/api/internal/spaces/:spaceId/schema-sync`) already: receives one base's captured schema from workflows, diffs against the per-Space working set (`schema-diff.ts`), writes `bo_at_schema_versions` + lifecycle + `bo_at_schema_updates`, all under `withSpaceSchema`. `bo_at_interfaces` exists (id, baseId, airtableEntityId, name, type, definition jsonb, status, submittedVia, firstSeenAt, lastSeenAt) and is fed today only by manual submission. The changelog design (`server-schema-changelog`) already reserves interface events (lifecycle → added/removed, `bo_at_schema_updates` with `entityType='interface'` → config). The MCP capture envelope (owner-verified sample in the workflows change's design) contains `interfaces[] → pages[] → tablesByTableId` plus `standaloneForms[]`.

## Goals / Non-Goals

**Goals:**
- One additive schema-sync field turns raw MCP captures into per-Space interface entities with correct lifecycle and diff events, atomically with the run's schema diff.
- Interface add/remove/rename/composition changes appear in the schema changelog with no changelog-side schema work.
- Manual submissions keep working and are never clobbered by MCP captures.

**Non-Goals:**
- Building dependency-graph edges from `tablesByTableId` (that's `server-schema-entity-graph`'s raw material; stored, not extracted).
- Any web UI change (existing Interfaces surfaces read the same table; a "source" badge is a flagged follow-up for web).
- Restore or write-back of interfaces.
- Interface content in static (file) backups — per-Space DB only for V1 (matches how automations/interfaces manual intake works).

## Decisions

1. **Entity model: three kinds, one table.** Rows in `bo_at_interfaces` with `type` distinguishing `'app'` (the `pbd…` Interface container), `'page'` (`pag…`, definition = full page payload; `definition.interfaceId` carries parentage), `'form'` (standalone forms, treated as pages with `pageType:'form'` until a real sample says otherwise). Alternative — a new `bo_at_interface_pages` table with a parent FK — rejected: the existing table's shape fits, per-Space migrations are expensive across the fleet, and parentage-by-definition matches this schema's plain-columns convention.
2. **Diff granularity.** Per entity (keyed `airtable_entity_id`, MCP-sourced rows only):
   - **added/removed** = lifecycle stamps (`first_seen_at`, `status='removed'` + `last_seen_at`), removal ONLY on a successful capture in the same run — an absent/skipped `interfacePages` field never removes anything (mirrors the "confident full capture" invariant from `schema-diff.ts`).
   - **renamed** = `bo_at_schema_updates (entity_type='interface', change_type='name')` before/after.
   - **composition** = `change_type='config'` with a computed before/after summary for: `pageType` change, `sourceTableId` change, and per-page field-usage delta (field ids added/removed to a page's `tablesByTableId`, plus `isEditable` flips). Raw definitions are large — the update row stores the *delta*, not two full payloads.
3. **Reconciliation with manual submissions: source-scoped rows.** MCP diffing considers only `submitted_via='mcp'` rows; manual rows (`submitted_via` = intake sources) are parallel. Where both exist for one `airtable_entity_id`, reads present the MCP row as existence/name/composition truth and attach the manual payload as the richer definition. Rationale: merging into one row would make each source's update path destructive to the other's data; two rows + read-time join is boring and safe. (Read-path presentation is the web follow-up.)
4. **Same transaction as schema diff.** Interface extraction/diff runs inside the existing `withSpaceSchema` schema-sync transaction, associated to the same `bo_at_base_runs` row — the changelog's run-resolved timestamps then Just Work. If interface processing throws, it is caught and reported per-section (schema sync must not fail because interface parsing did); the error lands in run progress.
5. **Raw capture retention.** The full envelope is stored once per run on the `'app'` rows' definitions (pages store their own payloads); no separate blob table. Payloads are KBs; per-run `bo_at_schema_versions`-style hash-dedup applies — identical capture hash short-circuits diffing entirely (the common case: interfaces rarely change).
6. **Tier flag plumbing.** The run-assembly path that already emits `records_enabled` adds `interfaces_enabled` from the Space's capability resolution (Growth+, consistent with `server-automations-interfaces-docs`'s PRD-over-Features resolution).

## Risks / Trade-offs

- [Airtable evolves the MCP payload] → engine validates per-entity minimally (id + name), passes unknown keys through into `definition`; composition diff only reads keys it knows; additive evolution is silent, destructive evolution degrades to add/remove noise — acceptable and observable.
- [Field-usage deltas could be noisy (every schema field rename echoes into page payloads)] → composition diff compares field *ids* only, not names/options; name changes surface once as field renames in the schema diff, not N times per page.
- [Two-row reconciliation confuses existing readers] → existing web reads don't filter by `submitted_via` today; verify the Interfaces tab dedupes by `airtable_entity_id` before landing (small web check, flagged in tasks — if it doesn't, gate MCP rows out of that read until the web follow-up).
- [Capture hash dedup hides `capturedAt` freshness] → `last_seen_at` is still stamped on every successful capture even when the hash short-circuits the diff.

## Migration Plan

Land this change first (accepts + persists the optional field; nothing sends it yet), verify on staging with a hand-POSTed fixture, then land `workflows-mcp-interface-pages`. Rollback: the field is optional; reverting the engine leaves inert rows.

## Open Questions

| # | Question | Default answer |
|---|---|---|
| S1 | Do standalone forms carry ids in the `pag…` namespace? | Treat `id` as opaque key; nothing assumes prefixes. |
| S2 | Should MCP-captured interfaces appear in static (file) backup output too? | V1: no (per-Space DB only); revisit with BYOS export format work. |
| S3 | Web presentation of dual-source rows | Follow-up change on web (`web-interfaces-source-badge`); until then reads must dedupe by `airtable_entity_id`. |
