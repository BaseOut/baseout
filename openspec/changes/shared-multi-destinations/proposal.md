# shared-multi-destinations

## Why

A Space can only hold ONE connected storage destination today: `storage_destinations.space_id` is `UNIQUE`, every provider's OAuth callback upserts on that key, and the engine resolves creds by `space_id LIMIT 1`. Connecting Box after Google Drive silently **replaces** the Drive row (tokens and all), the provider boxes in the approved destination UI give no signal about what is already connected, and there is no way to choose which connected destination backups write to. The approved designs stay as-is; the ask is a light-touch affordance: show "Connected" on connected provider boxes and let the user select one to swap the **primary** destination.

This also closes a documented latent gap: OAuth callbacks never set `backup_configurations.storage_type`, so a user could connect Box and still back up to `r2_managed` (2026-06-09 incident, noted in `apps/workflows/trigger/tasks/backup-base.ts`).

Distinct from [`shared-destinations`](../shared-destinations/proposal.md) (account-level reusable destinations — still a pending engineering handoff): this change stays **per-Space** and lifts the one-row limit to one row per (Space, provider type). It is a stepping stone the account-level model can later build on.

## What Changes

- **Schema**: `storage_destinations` UNIQUE moves from `(space_id)` to `(space_id, type)` — a Space keeps one row per provider type. **Primary = `backup_configurations.storage_type`** (existing column; no new flag).
- **Web persistence**: all five persist helpers upsert on the composite key; all delete helpers and disconnect routes scope by `(space_id, type)` (today "Disconnect Box" would delete whichever row exists — data-loss fix). Disconnecting the primary repoints `storage_type` to the most-recently-connected remaining destination (falls back to `local_fs` if none). OAuth callbacks auto-promote the freshly connected provider to primary ONLY when `storage_type` is still `r2_managed`/`local_fs`.
- **Engine**: `GET /api/internal/spaces/:spaceId/storage-destination` accepts `?type=` (validated); when absent it filters by the mirrored `backup_configurations.storage_type` (legacy `LIMIT 1` fallback). Restore-start resolves the destination row by `(space_id, config.storage_type)`.
- **Workflows**: the backup-base creds fetch passes `?type=<payload.storageType>` (already in the payload) so a mid-run primary swap can't flip creds between the initial read and a `?refresh=1` re-read.
- **Web UI (minimal deltas on approved designs)**: `storageDestination` (singular) becomes `storageDestinations[]` with a derived `primary` flag; `/destinations` rows gain a "Primary" badge + ghost "Set primary" button; `/destinations/new` provider boxes gain a "Connected" badge, and a connected provider's detail screen offers "Set as primary" (reusing the existing `saveBackupConfig` → PATCH backup-config path) with OAuth demoted to "Reconnect"; the wizard's Destination radios submit the selected `storageType` on save. PATCH backup-config validates that a row-backed `storageType` actually has a connected row (422 `destination_not_connected`).

## Capabilities

### New Capabilities
- `multi-destinations`: multiple connected storage destinations per Space (one per provider type), a primary destination selected via `backup_configurations.storage_type`, connected/primary indicators in the destination UI, and swap-primary with server-side validation.

### Modified Capabilities
<!-- Extends byos-google-drive / server-byos-destinations (persist + disconnect + engine creds route become type-scoped). The shared-destinations account-level model remains a separate follow-up. -->

## Impact

- **Migration**: `apps/web/drizzle/00XX_multi_destinations.sql` — drop `storage_destinations_space_id_unique`, add UNIQUE`(space_id, type)`. Existing data (≤1 row/Space) trivially satisfies it. Canonical in [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts); mirror comment updated in [apps/server/src/db/schema/storage-destinations.ts](../../../apps/server/src/db/schema/storage-destinations.ts).
- apps/web: `lib/{google-drive,box,dropbox,onedrive,local-fs}/persist.ts`, `pages/api/connections/storage/*/{callback,disconnect}.ts`, `lib/integrations.ts`, `lib/registry-mappers.ts`, `stores/{connections,destinations}.ts`, `pages/api/spaces/[spaceId]/backup-config.ts`, `lib/backups/{save-config,configure-save}.ts`, `views/{DestinationsView,DestinationAddView,IntegrationsSetupWizard}.astro`, `pages/destinations/*.astro`, `pages/{index,backups}.astro`.
- apps/server: `pages/api/internal/spaces/storage-destination.ts`, `lib/restores/{start,start-deps}.ts`.
- apps/workflows: `trigger/tasks/backup-base.ts` (+ task wrapper wiring).
- **Deploy order**: web (with migration) → server → workflows. The engine's config-join fallback makes skew safe in both directions.
- **Security**: no new surface — the engine route stays `INTERNAL_TOKEN`-gated (`?type` is validated against the known enum); PATCH backup-config keeps middleware auth + gains stricter validation; no changes to OAuth redirect URIs (checked against `shared/internal/oauth-setup.md` §3 — callbacks only gain a guarded config write).
- **Known limitation carried forward**: restore and run-deletion resolve storage by the *current* primary; a swap between backup and restore points at the wrong store. Pre-existing (today a re-connect destroys the old row outright). Follow-up filed in tasks: stamp `storage_type` onto `backup_runs`.
