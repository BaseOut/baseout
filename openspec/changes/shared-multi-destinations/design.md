# Design — shared-multi-destinations

## Model

- One `storage_destinations` row per **(Space, provider type)**; UNIQUE moves from `(space_id)` to `(space_id, type)`.
- **Primary** is not a flag on the row — it is the existing `backup_configurations.storage_type`. One source of truth, no two-flags-drift, and the swap API already exists (PATCH `/api/spaces/:spaceId/backup-config { storageType }` — `ALLOWED_STORAGE_TYPES` already permits all six values; only its stale "r2_managed-only MVP" comments are wrong).
- `r2_managed` remains row-less (managed R2 needs no per-Space creds). A primary of `r2_managed` therefore has no registry row; the UI simply shows no "Primary" badge on any row in that state.

## Engine creds resolution: explicit `?type=` with config-join fallback

`GET /api/internal/spaces/:spaceId/storage-destination` gains a validated `?type=` param; workflows passes `payload.storageType` (already snapshotted into `BackupBaseTaskPayload` at enqueue — `apps/server/src/lib/runs/start.ts`).

Why param over a live config join:

1. **Run consistency.** The route is re-hit mid-upload with `?refresh=1` on a 401, and the workflows refresh closure hard-fails if the returned `type` differs from the initial read. A live join would let a user swapping primary mid-run flip the answer between reads and kill the run. The param pins the run to the type it was enqueued with.
2. **Restore correctness.** Restores read from where the source backup wrote, not where the current primary points.
3. **Deploy skew.** Old workflows (no param) against new engine → config-join fallback picks the primary; new workflows against old engine → unknown query param ignored, `LIMIT 1` still correct while spaces have ≤1 row. Deploy order web → server → workflows keeps every intermediate state safe.

Fallback when `?type` absent: read the mirrored `backup_configurations.storage_type`; if config missing or `r2_managed`, keep the legacy `LIMIT 1` (legacy single-row spaces). Unknown `?type` → 400.

## Disconnect-primary rule

On disconnect of type T (delete row scoped `(space_id, T)` — the type scoping is itself the data-loss fix):

- `storage_type !== T` → config untouched.
- `storage_type === T` → repoint to the most-recently-connected remaining row (`ORDER BY connected_at DESC LIMIT 1`); none left → `local_fs` (today's behavior). `storage_type` must never dangle at a row-less BYOS type.

## Callback auto-promotion

After a successful OAuth callback for type T: if config `storage_type` is still `r2_managed` or `local_fs`, set it to T. Never steals primary from an explicitly chosen BYOS provider; closes the "connected Box but still backing up to r2_managed" gap for first connects.

## Swap-primary validation

PATCH backup-config: when `storageType` is row-backed (`google_drive|box|dropbox|onedrive|local_fs`), require a connected `storage_destinations` row for `(space, type)` → else 422 `destination_not_connected`. Injected as a `hasConnectedDestination` dep on `handlePatch` so `persist-policy.ts` stays the pure shape/tier validator.

## Web state shape

- `IntegrationsState.storageDestination: Summary | null` → `storageDestinations: Summary[]` (ordered `connected_at DESC`). Primary derived by consumers via `type === policy.storageType`.
- `DestinationSummary.id` changes meaning: was the spaceId (only ever 0-or-1 row), becomes the **provider type** — unique per Space under the new constraint, stable, URL-safe for `/destinations/detail?id=`. `DestinationSummary` gains `primary: boolean`.

## UI (least-intrusive deltas on approved designs)

- `/destinations` registry row: existing status `Badge` gets a sibling `Primary` badge on the primary row; connected non-primary rows get a ghost `Set primary` button (`setButtonLoading` → `saveBackupConfig` → reload).
- `/destinations/new` boxes: a `Badge variant="success" dot` "Connected" pill in the same flex row as the existing "Managed" pill — no layout change; boxes stay links.
- `/destinations/new?type=X` (connected X): primary action becomes **Set as primary** (reuses the existing `data-managed-connect` handler — `saveBackupConfig` IS the swap); the OAuth form demotes to a ghost **Reconnect**; already-primary shows a "Current primary" badge instead.
- Wizard Destination step: radios switch `value` to the provider type, `checked` from `primary`; `commit()` forwards the selected `storageType` through `configure-save.ts` — fixing that the wizard's dest radio was validation-only and never persisted.

No new components: `Badge`, `Button`, existing chip classes only (two-tier governance).
