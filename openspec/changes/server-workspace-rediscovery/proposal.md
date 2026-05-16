## Why

When a customer connects an Airtable workspace via OAuth, [apps/web/src/pages/api/airtable/callback.ts](../../../apps/web/src/pages/api/airtable/callback.ts) lists the workspace's bases and writes one `at_bases` row per discovered base. **That listing only fires once.** Any base the customer creates afterwards is invisible to Baseout — it isn't in `at_bases`, can't be selected in the Integrations dashboard, and won't be backed up even if the customer thinks they enabled auto-add.

This is the most common "missing data" support ticket pattern surfaced in [shared/Baseout_Backlog_MVP.md](../../../shared/Baseout_Backlog_MVP.md): "I added a new base to my workspace but Baseout isn't backing it up." Today the only remediation is to disconnect and reconnect the Airtable connection — destructive, since it nukes existing config rows.

Rediscovery is the layer that closes this gap. The engine periodically (`SpaceDO` alarm — Phase 3 deferred) and on-demand (manual rescan route — Phase 2, this change) re-lists workspace bases, upserts new ones, applies the tier `basesPerSpace` cap, and auto-adds when the per-config `auto_add_future_bases` toggle is on. Discovered bases surface in `apps/web` via an inline banner driven by `space_events`.

The schema scaffolding shipped in commit `3eeedfb` (Phase 1 of this change). This proposal documents the full three-phase shape so the in-flight Phase 2 work has a written home and Phase 3 has a known boundary.

## What Changes

### Phase 1 — Schema (DONE — commit `3eeedfb`)

Already shipped. No further work in this change. Documenting for completeness:

- **Canonical migration** [apps/web/drizzle/0008_workspace_rediscovery.sql](../../../apps/web/drizzle/0008_workspace_rediscovery.sql):
  - `at_bases.discovered_via text NOT NULL DEFAULT 'oauth_callback'` — values `'oauth_callback' | 'rediscovery_scheduled' | 'rediscovery_manual'`.
  - `at_bases.first_seen_at timestamptz NOT NULL DEFAULT now()`.
  - `at_bases.last_seen_at timestamptz NOT NULL DEFAULT now()` — bumped on every rediscovery upsert.
  - `backup_configurations.auto_add_future_bases boolean NOT NULL DEFAULT false`.
  - `backup_configuration_bases.is_auto_discovered boolean NOT NULL DEFAULT false` — set true when rediscovery auto-includes a base.
  - New table `baseout.space_events` — minimal per-Space notification surface: `id`, `space_id`, `kind`, `payload jsonb`, `created_at`, `dismissed_at`. Partial index `(space_id) WHERE dismissed_at IS NULL`.
- **Engine mirrors** (per [CLAUDE.md §5.3](../../../CLAUDE.md)):
  - [apps/server/src/db/schema/at-bases.ts](../../../apps/server/src/db/schema/at-bases.ts) — `discoveredVia`, `firstSeenAt`, `lastSeenAt`.
  - [apps/server/src/db/schema/backup-configurations.ts](../../../apps/server/src/db/schema/backup-configurations.ts) — `autoAddFutureBases`.
  - [apps/server/src/db/schema/backup-configuration-bases.ts](../../../apps/server/src/db/schema/backup-configuration-bases.ts) — `isAutoDiscovered`.
  - New [apps/server/src/db/schema/space-events.ts](../../../apps/server/src/db/schema/space-events.ts) — mirror (engine omits `dismissedAt` because it never reads dismiss state; `apps/web` is the dismiss writer).
  - New [apps/server/src/db/schema/subscriptions.ts](../../../apps/server/src/db/schema/subscriptions.ts) + extended `subscription-items.ts` — engine reads tier for `basesPerSpace` cap during rediscovery.

### Phase 2 — Manual rescan path (THIS CHANGE)

- **Pure orchestrator** [apps/server/src/lib/rediscovery/run.ts](../../../apps/server/src/lib/rediscovery/run.ts):
  - `runWorkspaceRediscovery(input, deps): Promise<{ discovered, autoAdded, blockedByTier }>`.
  - Lists Airtable bases → upserts ALL listed rows (so `last_seen_at` bumps on known bases too) → filters fresh by set-difference against `at_bases` → applies the auto-add toggle + tier cap → conditionally INSERTs `backup_configuration_bases` rows → INSERTs one `space_events` row with the discovered / autoAdded / blockedByTier breakdown.
  - Every side-effect is a deps function (DB writers, Airtable client, clock, logger) so the orchestrator is testable without Postgres / Airtable.
- **Production dep wiring** [apps/server/src/lib/rediscovery/run-deps.ts](../../../apps/server/src/lib/rediscovery/run-deps.ts):
  - `buildRediscoveryDeps({ db, spaceId, triggeredBy, encryptionKey })` resolves the per-Space context (`configId`, `organizationId`), looks up the Org's active Airtable connection, decrypts the OAuth token, constructs the Airtable client.
  - Returns a discriminated union: `{ ok: true, context, deps }` or `{ ok: false, error }` with three 4xx-shaped errors (`space_not_found`, `config_not_found`, `connection_not_found`).
- **Capability resolver** [apps/server/src/lib/capabilities/](../../../apps/server/src/lib/capabilities/) — mirrors the canonical `apps/web/src/lib/capabilities/` resolver. Reads `subscription_items.tier` for the Org's active Airtable subscription; falls back to starter cap on missing or non-(active|trialing) subscriptions.
- **Manual rescan route** [apps/server/src/pages/api/internal/spaces/rescan-bases.ts](../../../apps/server/src/pages/api/internal/spaces/rescan-bases.ts):
  - `POST /api/internal/spaces/:spaceId/rescan-bases` — `INTERNAL_TOKEN`-gated (middleware), UUID validation, dispatches to `runWorkspaceRediscovery`.
  - Error mapping: `space_not_found` → 404, `config_not_found` → 404, `connection_not_found` → 409, `AirtableError` → 502 (with upstream status), method ≠ POST → 405, non-UUID spaceId → 400.
- **Router wiring** [apps/server/src/index.ts](../../../apps/server/src/index.ts) — `SPACES_RESCAN_BASES_RE` already added.
- **Tests** (in-flight; finalize before commit):
  - [apps/server/tests/integration/rediscovery-run.test.ts](../../../apps/server/tests/integration/rediscovery-run.test.ts) — pure-fn coverage of all six branches: no-fresh, toggle-off, toggle-on-within-cap, toggle-on-over-cap, null-cap (enterprise), Airtable-error.
  - [apps/server/tests/integration/spaces-rescan-bases-route.test.ts](../../../apps/server/tests/integration/spaces-rescan-bases-route.test.ts) — route-shape coverage: 401 without token, 405 for non-POST, 400 for non-UUID, the four resolved-error paths, the happy path.

### Phase 3 — Scheduled rescan via SpaceDO alarm (DEFERRED)

Out of scope for this change. Lands after [`server-schedule-and-cancel`](../server-schedule-and-cancel/proposal.md) archives — that change owns the SpaceDO alarm scheduler. Phase 3 will:

- Trigger `runWorkspaceRediscovery` from inside `SpaceDO.alarm()` with `triggeredBy: 'alarm'`.
- Decide the cadence: per-Space (every 24h?) vs per-tier (Business+ runs every 6h, Starter every 7d?). To be settled in Phase 3's own design doc.
- Use the same pure orchestrator — no new policy decisions belong here; if the manual path is correct, the alarm path is correct.

## Out of Scope

| Deferred to | Item |
|---|---|
| Phase 3 of this change | `SpaceDO.alarm()` integration for scheduled rediscovery. |
| Paired [`web-workspace-rediscovery`](../web-workspace-rediscovery/proposal.md) | Frontend Rescan button, banner UI, `space_events` dismiss endpoint, auto-add toggle in Integrations view. |
| [`server-instant-webhook`](../server-instant-webhook/proposal.md) | Webhook-driven real-time drift detection inside already-selected bases (not a rediscovery concern). |
| [`server-dynamic-mode`](../server-dynamic-mode/proposal.md) | Schema-diff inside individual bases (handled by the per-run backup task today). |
| Future change | Rediscovery cadence per tier; auto-pruning of bases removed from the workspace (today we only bump `last_seen_at`; we don't tombstone). |

## Capabilities

### New capabilities

- `backup-workspace-rediscovery` — single-writer orchestrator owned by `apps/server`. Both alarm and manual paths route through it.

### Modified capabilities

- `backup-config-policy` (`apps/web`) — adds `autoAddFutureBases` to the PATCH-config body. Validation in [apps/web/src/lib/backup-config/persist-policy.ts](../../../apps/web/src/lib/backup-config/persist-policy.ts).
- `integrations-state` (`apps/web`) — `getIntegrationsState()` now hydrates `autoAddFutureBases` + unread `space_events` for the banner.

## Impact

- **Master DB**: no migrations from this change — all schema landed in commit `3eeedfb` under the canonical `apps/web/drizzle/0008_workspace_rediscovery.sql`. Engine reads only.
- **External API**: one Airtable Meta API call per rescan (`GET /v0/meta/bases`). Rate-limited per-Org under the per-Connection `ConnectionDO` budget (not added here; the call is a single GET and the budget impact is minimal).
- **Concurrency**: `runWorkspaceRediscovery` is idempotent on `at_bases.(space_id, at_base_id)` and `backup_configuration_bases.(backup_configuration_id, at_base_id)` unique indices. Two concurrent calls for the same Space converge correctly (last writer wins on `last_seen_at`; either INSERT may race the other but the ON CONFLICT clause handles it).
- **Cross-app contract**: `apps/web` proxies `POST /api/spaces/:id/rescan-bases` via the `BACKUP_ENGINE` service binding to `POST /api/internal/spaces/:id/rescan-bases`. Response shape `{ ok, discovered, autoAdded, blockedByTier }` matches the orchestrator return value.
- **Security**: route is `INTERNAL_TOKEN`-gated by the existing middleware. No new secrets. No PII written to logs (rediscovery logs base IDs only, which are not customer data).
- **Reversibility**: rediscovery is additive. Disabling it leaves existing rows intact; re-enabling resumes upserts. The schema is wider than the engine reads — disabling consumers leaves `space_events` rows orphaned but harmless (no FK churn).

## Reversibility

- Phase 1 (schema) is already shipped and additive.
- Phase 2 is one pure module + one dep wiring file + one route handler + tests. Reverting removes the route entry from `apps/server/src/index.ts` and the four files under `src/lib/rediscovery/` and `src/lib/capabilities/`. No data migration needed.
- Phase 3 (deferred) is the only piece with cross-cutting concurrency concerns (SpaceDO alarm path). That's why it's deferred.
