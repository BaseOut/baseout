## Why

The engine path documented in [`baseout-server-workspace-rediscovery`](../baseout-server-workspace-rediscovery/proposal.md) is invisible to the user without a frontend. The user-facing problem ("I added a base to my Airtable workspace and Baseout didn't notice") needs:

1. A way to **trigger** a rescan on demand (a button on the Integrations view).
2. A way to **see** what was discovered (an inline banner driven by unread `space_events` rows).
3. A way to **dismiss** the banner after reading.
4. A toggle that **persists** the auto-add preference per backup configuration.

The engine produces the data; this change is the UI surface that exposes it. The web routes also enforce the **authentication + IDOR** boundary — the engine relies on `INTERNAL_TOKEN`, but customers must hit a route that verifies their session and that the Space belongs to their Org before the engine call fires.

## What Changes

### Phase 1 — Rescan button + engine proxy

- **New route** [apps/web/src/pages/api/spaces/[spaceId]/rescan-bases.ts](../../../apps/web/src/pages/api/spaces/[spaceId]/rescan-bases.ts):
  - `POST` only (other verbs return 405).
  - Auth via `locals.account`; 401 on missing.
  - UUID validation on `params.spaceId`; 400 on malformed.
  - IDOR check: fetch the Space row, verify `space.organizationId === account.organization.id`; 403 on mismatch.
  - Proxies via the `BACKUP_ENGINE` service binding (with `INTERNAL_TOKEN` header) to `POST /api/internal/spaces/:spaceId/rescan-bases`.
  - Maps engine error codes to HTTP statuses: `space_not_found`/`config_not_found` → 404, `connection_not_found` → 409, `airtable_error`/`engine_unreachable` → 502, `unauthorized` → 401, `invalid_request` → 400, anything else → 500.
  - On success, returns 200 with `{ ok, discovered, autoAdded, blockedByTier }`.
- **Engine client** [apps/web/src/lib/backup-engine.ts](../../../apps/web/src/lib/backup-engine.ts) — adds `rescanBases(spaceId)` to the existing `BackupEngineClient`. Returns a discriminated union `EngineRescanBasesResult` matching the engine's response shape.
- **Tests** [apps/web/src/pages/api/spaces/[spaceId]/rescan-bases.test.ts](../../../apps/web/src/pages/api/spaces/[spaceId]/rescan-bases.test.ts) — covers auth + IDOR + engine error mapping. Uses the `vi.mock('cloudflare:workers')` pattern per [apps/web/.claude/CLAUDE.md §5.6](../../../apps/web/.claude/CLAUDE.md).

### Phase 2 — Banner state hydration

- Edit [apps/web/src/lib/integrations.ts](../../../apps/web/src/lib/integrations.ts):
  - `getIntegrationsState()` queries up to 10 unread `space_events` for the current Space (`dismissed_at IS NULL`, ordered by `created_at DESC`).
  - Filters to `kind = 'bases_discovered'` (future kinds are additive).
  - Maps payload `{ discovered, autoAdded, blockedByTier, tierCap }` into a typed `SpaceEventSummary` for the banner component.
  - Adds `autoAddFutureBases: boolean` to the returned `IntegrationsState`.
- Edit [apps/web/src/stores/connections.ts](../../../apps/web/src/stores/connections.ts):
  - New `SpaceEventSummary` type. Fields: `id`, `kind` (`'bases_discovered'`), `createdAt` (ISO string), `payload: { discovered, autoAdded, blockedByTier, tierCap }`.
  - Add to the `IntegrationsState` union.

### Phase 3 — Banner UI + dismiss endpoint

- Edit [apps/web/src/views/IntegrationsView.astro](../../../apps/web/src/views/IntegrationsView.astro):
  - Render an inline banner near the bases list when an unread `bases_discovered` event exists.
  - Banner text: "{discovered.length} new bases discovered. {autoAdded.length} auto-added. {blockedByTier.length} blocked by your tier (cap: {tierCap})." Hide subclauses with zero counts.
  - "Rescan bases" button next to the banner — triggers `POST /api/spaces/:id/rescan-bases` via the existing `setButtonLoading` pattern per [apps/web/.claude/CLAUDE.md §12](../../../apps/web/.claude/CLAUDE.md).
  - "Dismiss" button — calls the new dismiss endpoint and hides the banner.
- **New endpoint** [apps/web/src/pages/api/spaces/[spaceId]/space-events/[eventId]/dismiss.ts](../../../apps/web/src/pages/api/spaces/[spaceId]/space-events/[eventId]/dismiss.ts):
  - `POST` only.
  - Auth + IDOR (resolve Space → Org → match against session).
  - Verifies the event belongs to the Space (404 on mismatch — prevents an evil user from dismissing another Org's events).
  - `UPDATE space_events SET dismissed_at = now() WHERE id = $1 AND dismissed_at IS NULL`.
  - Returns 200 on success or already-dismissed (idempotent).
- **Tests** [apps/web/src/pages/api/spaces/[spaceId]/space-events/[eventId]/dismiss.test.ts](../../../apps/web/src/pages/api/spaces/[spaceId]/space-events/[eventId]/dismiss.test.ts) — auth, IDOR, event-belongs-to-space, idempotency.

### Phase 4 — Auto-add toggle persistence

- Edit [apps/web/src/lib/backup-config/persist-policy.ts](../../../apps/web/src/lib/backup-config/persist-policy.ts):
  - Add `autoAddFutureBases?: boolean` to the `PATCH` body schema.
  - Validate it as a boolean.
  - Accept the empty body as valid only if at least one of `frequency | storageType | autoAddFutureBases` is present.
  - Pass through to the existing `upsertConfig` writer.
- Edit [apps/web/src/lib/backup-config/persist-policy.test.ts](../../../apps/web/src/lib/backup-config/persist-policy.test.ts) — new branches: bool-only body, bool with frequency, bool with storageType, type mismatch (number), empty body.
- Edit [apps/web/src/views/IntegrationsView.astro](../../../apps/web/src/views/IntegrationsView.astro):
  - Toggle control near the bases list bound to the `autoAddFutureBases` state.
  - On change, fire `PATCH /api/spaces/:id/backup-config` with `{ autoAddFutureBases: <new value> }` and update the nanostore on success.

## Out of Scope

| Deferred to | Item |
|---|---|
| [`baseout-server-workspace-rediscovery`](../baseout-server-workspace-rediscovery/proposal.md) Phase 3 | Alarm-driven scheduled rediscovery banner refresh — the SSR-on-load read already covers it; explicit "poll for new events" deferred. |
| Future change | Rich event types beyond `bases_discovered` (e.g. `connection_disconnected`, `tier_changed`). Schema is generic via the `kind` text column; UI is bases-only for V1. |
| Future change | Multi-event banner stack — today the UI shows the most recent unread event only. |
| Future change | Email/Slack notification of `bases_discovered` events. |

## Capabilities

### New capabilities

- `workspace-rediscovery-ui` — `apps/web` surfaces (banner, rescan button, dismiss endpoint, auto-add toggle).
- `space-events-dismiss` — generic dismiss endpoint for the `space_events` table. Today only used by the bases banner; reusable for future event kinds.

### Modified capabilities

- `integrations-state` — `getIntegrationsState()` adds unread events + auto-add toggle.
- `backup-config-policy` — accepts `autoAddFutureBases` in PATCH body.

## Impact

- **Master DB**: no migrations from this change. Schema landed under [`baseout-server-workspace-rediscovery`](../baseout-server-workspace-rediscovery/proposal.md) Phase 1 (commit `3eeedfb`).
- **Wire**: one new `apps/web` route (`POST /api/spaces/:spaceId/rescan-bases`) proxies via the existing `BACKUP_ENGINE` service binding. One new public dismiss endpoint.
- **Auth**: every new route enforces session + Org-match before proceeding. No bypass.
- **CSRF**: the rescan and dismiss POSTs are state-mutating; per [apps/web/.claude/CLAUDE.md §2](../../../apps/web/.claude/CLAUDE.md), use `better-auth`'s CSRF helpers. The fetch from the IntegrationsView includes the CSRF token.
- **Performance**: the banner read is a single indexed SELECT on `space_events` with `LIMIT 10`. The partial index `(space_id) WHERE dismissed_at IS NULL` keeps the cost flat as old events accumulate.
- **Reversibility**: pure UI + route additions. Reverting removes the new files and the diffs to `integrations.ts` / `persist-policy.ts` / `IntegrationsView.astro` / `stores/connections.ts`. No data migration needed.

## Cross-app contract

| `apps/web` | → | `apps/server` |
|---|---|---|
| `POST /api/spaces/:id/rescan-bases` (auth + IDOR) | service binding | `POST /api/internal/spaces/:id/rescan-bases` (`INTERNAL_TOKEN`-gated) |
| Reads `space_events` directly (canonical writer = engine on rediscovery, web on dismiss) | — | Writes `space_events` rows with `kind = 'bases_discovered'` during rediscovery |
| Reads `backup_configurations.auto_add_future_bases` (canonical writer) | — | Reads only |
