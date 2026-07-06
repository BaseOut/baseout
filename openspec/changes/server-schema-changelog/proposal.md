# server-schema-changelog — Per-Space schema changelog feed

## Why

The Schema page needs a **Changelog** tab ([`web-schema-changelog`](../web-schema-changelog/)) — a time-ordered feed of "what changed in my Airtable structure": fields renamed, tables added, a field type change that may have broken data, an automation turned off. The engine already **captures** every ingredient of that feed but never **exposes** it as a feed:

- `bo_at_schema_updates` persists MODIFICATION events per run — `entityType` (`base|table|field|view|automation|interface`), `changeType` (`name|description|type|options|primary_field|config|status`), `beforeValue`/`afterValue`, and `breaksData` (set on field type changes — the ⚠️ signal). Written by `diffSchema` (`schema-diff.ts`) on every `/schema-sync`.
- Lifecycle columns (`status`, `firstSeenRun`, `lastSeenRun`) on `bo_at_bases`/`tables`/`fields`/`views` give **added** (`firstSeenRun`) and **removed** (`status='removed'`) events — add/remove are lifecycle, not `schema_updates`, per the diff model.
- `bo_at_base_runs` carries each run's `startedAt`/`completedAt` — the timestamp every event is dated by (via `firstSeenRun`/`lastSeenRun`/`schema_updates.runId` → `bo_at_base_runs.id`).
- Automations/interfaces (`bo_at_automations`/`bo_at_interfaces`, from [`server-automations-interfaces-docs`](../server-automations-interfaces-docs/)) carry `status` + `firstSeenAt`/`lastSeenAt` — the source of "Automation turned off · Active → Inactive"-style app-layer events.

So the changelog is a **read-time aggregation** of already-persisted diff data — no new capture pass, no Trigger.dev task, no re-diffing Airtable. This change adds a pure aggregator that unions lifecycle events + `schema_updates` + automation/interface status/config changes into a typed, base ▸ entity–grouped, date-ordered feed, and exposes it on a new `INTERNAL_TOKEN`-gated route consumed by the web proxy `/api/spaces/[spaceId]/changelog`.

Pairs with [`web-schema-changelog`](../web-schema-changelog/) (the Changelog tab).

## What Changes

- **Read-time changelog assembly (in the Worker, no Trigger.dev task).** A pure `buildChangelog` module unions three event sources for a Space into one `ChangelogEvent[]`:
  - **Lifecycle → added / removed** — an entity whose `firstSeenRun` matches a run yields an `added` event; `status='removed'` (stamped at `lastSeenRun`) yields a `removed` event. Base/table/field/view.
  - **`bo_at_schema_updates` → renamed / retyped / config-change** — `changeType='name'`→`renamed`, `'type'`→`retyped` (carries `breaksData`→`warning`), `'options'|'description'|'primary_field'`→`config`. Each carries `beforeValue`→`before`, `afterValue`→`after`.
  - **Automation / interface status + config → config-change** — `status` transitions (e.g. active→removed rendered "Automation turned off · Active → Inactive") and `schema_updates` rows with `entityType in (automation, interface)` become app-layer `config` events tagged with `entityKind`.
  - Each event resolves its **run date** from `bo_at_base_runs` and its **location** (base ▸ table ▸ field, or base ▸ [automation|interface] name) from the current/historical entity rows, and pre-renders the human-readable `summary` string engine-side (the web only styles it).
- **`entity_type` widened acceptance in the emitter, not the schema** — `bo_at_schema_updates.entity_type` already documents `automation|interface`; this change adds the emit path that writes automation/interface status/config updates into it (best-effort, alongside the schema-sync automation/interface reconcile). No column change.
- **New internal route** `GET /api/internal/spaces/:spaceId/changelog?baseId=&since=&kinds=&includeRemoved=` — returns `{ ok, events }` for the Space (optionally scoped to a base, a `since` cutoff, a set of event kinds, and whether to include `removed` events). Token-gated by middleware (path begins `/api/internal/`), IDOR- and readiness-guarded exactly like `relationships-overview` (`resolveSpaceDb` → `managed_pg` check → `ensureSpaceSchemaCurrent` → `withSpaceSchema`).
- **No new persisted table.** The feed is derived from `bo_at_schema_updates` + lifecycle columns + `bo_at_base_runs` on read; nothing is materialized. (If a future high-volume Space needs a materialized feed, that is a deferred follow-up, not this change.)
- **`since` cursor is run-time-based** (`bo_at_base_runs.started_at`), so the Pro+ Instant-Backup incremental runs feed the changelog as they land — no design change, just more frequent events.
- A short [`design.md`](./design.md) documents the diff/event model: event kinds, the three source→event mappings, grouping by base ▸ entity, date resolution, and the warning (breaks-data) flag.

## Capabilities

### New Capabilities

- `schema-changelog`: the engine-assembled per-Space schema changelog — a read-time union of lifecycle added/removed events, `bo_at_schema_updates` renamed/retyped/config events (with before→after + breaks-data warning), and automation/interface status/config events; each event dated by its run, located as base ▸ entity with a pre-rendered summary; exposed on `/api/internal/spaces/:spaceId/changelog` with `baseId`/`since`/`kinds`/`includeRemoved` filters, `INTERNAL_TOKEN`-gated, readiness- and IDOR-guarded.

### Modified Capabilities

<!-- Adds a read-only internal route + a pure aggregator + a best-effort automation/interface schema_updates emit path. Reads data already persisted by schema-sync (schema-diff) + automations-interfaces-docs. No new DB table, no migration, no capability-key change. -->

## Impact

- `apps/server/src/lib/per-space/changelog.ts` — pure `buildChangelog` (unions lifecycle + `schema_updates` + automation/interface status into `ChangelogEvent[]`, resolves dates + locations, renders summaries). Unit-tested in isolation.
- `apps/server/src/lib/per-space/changelog-io.ts` — the read I/O (loads lifecycle rows, `schema_updates`, `bo_at_base_runs`, automations/interfaces via `withSpaceSchema`, feeds `buildChangelog`, applies `baseId`/`since`/`kinds`/`includeRemoved` filters).
- `apps/server/src/pages/api/internal/spaces/changelog.ts` — internal route handler, mirroring [`relationships-overview.ts`](../../../apps/server/src/pages/api/internal/spaces/relationships-overview.ts) (guards + `withSpaceSchema` read).
- `apps/server/src/index.ts` — register `CHANGELOG_RE` + dispatch to the handler (alongside `spacesRelationshipsOverviewHandler`).
- `apps/server/src/lib/per-space/schema-sync.ts` — best-effort emit of automation/interface status/config `schema_updates` rows during the existing automation/interface reconcile (advisory; never fails the sync). No change to base/table/field/view diffing (already emits `schema_updates` + lifecycle).
- **Reads (no new capture):** `bo_at_schema_updates`, the lifecycle columns on `bo_at_bases`/`tables`/`fields`/`views`, `bo_at_base_runs` (dates), `bo_at_automations`/`bo_at_interfaces` (status/config) — all already populated by `schema-diff.ts` + [`server-automations-interfaces-docs`](../server-automations-interfaces-docs/).
- **Pairs with** [`web-schema-changelog`](../web-schema-changelog/) (the Changelog tab that proxies + renders this feed).
- **Depends on** the existing schema-capture diff (`schema-diff.ts` → `bo_at_schema_updates` + lifecycle) and [`server-automations-interfaces-docs`](../server-automations-interfaces-docs/) (automation/interface capture with status).
- **Security:** new internal route only; `INTERNAL_TOKEN`-gated; parameterized Drizzle reads; no new external surface; read-only (the automation/interface `schema_updates` emit is an additive advisory write in the existing sync path).
- **Deferred follow-ups:**
  - **Materialized feed** — if a high-volume Space's read-time union gets heavy, persist a `bo_at_changelog` projection (append-only) written during schema-sync and read directly. Out of scope; the read-time path is correct + sufficient at expected volumes.
  - **AI plain-language summaries** — the feed carries the engine's mechanical `summary`; an optional AI `aiSummary` per event (the detail-panel field the web reserves) is deferred to the Schema-chat/insights track.
  - **Health-issue linkage** — a breaks-data (⚠️) event and the Health tab grade the same problem; cross-linking an event to its Health issue is deferred.
  - **Snapshot A↔B comparator** — the changelog is a running feed, not a two-point diff UI; the comparator is explicitly out of scope (possible V2).
  - No DB/migration/capability-key change.
