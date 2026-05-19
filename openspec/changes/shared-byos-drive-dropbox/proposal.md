## Why

Two existing changes scope all six BYOS providers as one mega-change each:

- [`server-byos-destinations`](../server-byos-destinations/proposal.md) — schema, OAuth Connect routes, `StorageWriter` interface, R2 baseline + per-provider strategies for Google Drive, Dropbox, Box, OneDrive, Amazon S3, Frame.io.
- [`workflows-byos-destinations`](../workflows-byos-destinations/proposal.md) — workflows-side `StorageWriter` implementations and `backup-base.task` wiring for the same six providers.

For MVP we need **only Google Drive + Dropbox** first — the two highest-customer-demand providers per [Features §4.4](../../../shared/Baseout_Features.md), both available on every tier. Both providers also share the same OAuth Connect shape and `provider_folder_id` semantics; landing them together validates the `StorageWriter` interface on two real call sites (which is also when the "extract abstraction" move is justified per [CLAUDE.md §3.2](../../../CLAUDE.md)).

Shipping fewer providers first reduces blast radius (a six-provider mega-change has six different review surfaces tangled together), shortens the time-to-first-customer-write, and avoids burning OAuth-app-registration cycles on providers we may want to defer indefinitely. Box, OneDrive, S3, and Frame.io move to per-provider follow-up changes that consume the interface this change locks in.

Phase 0 — re-introducing the `BACKUPS_R2` Worker binding removed in commit `8fc1f61` — already landed in commit `fbdc26e` against [`server-byos-destinations`](../server-byos-destinations/tasks.md) §0. This change adopts that work as `[x]` already done and continues from Phase A.

## What Changes

The work below is the **scope-narrowed slice** of `server-byos-destinations` + `workflows-byos-destinations` for the Drive + Dropbox MVP. Each phase mirrors a numbered phase in those umbrella changes; this change owns the actual checklist for what gets implemented now versus deferred.

- **Phase 0 — R2 binding restoration (done in commit `fbdc26e`).** `BACKUPS_R2` Worker binding restored to [apps/server/wrangler.jsonc.example](../../../apps/server/wrangler.jsonc.example) (top-level + `env.dev`) and [apps/server/wrangler.test.jsonc](../../../apps/server/wrangler.test.jsonc). `BACKUPS_R2: R2Bucket` + `STORAGE_DEV_MODE?: "local-fs" | "r2"` declared on the `Env` interface in [apps/server/src/env.d.ts](../../../apps/server/src/env.d.ts). Documented in [apps/server/CLAUDE.md](../../../apps/server/CLAUDE.md). No code path consumes the binding yet — Phase B brings the consumer.
- **Phase A — `storage_destinations` table.** Master DB migration adding the table with per-provider columns (`oauth_access_token_enc`, `oauth_refresh_token_enc`, `oauth_expires_at`, `oauth_scope`, `oauth_account_email`, `provider_folder_id`, `provider_account_id`, etc.). One row per Space (`space_id UNIQUE`). `type` CHECK constraint **scoped to MVP values only**: `'r2_managed' | 'google_drive' | 'dropbox'`. Box/OneDrive/S3/Frame.io values added by their respective follow-up changes — landing the constraint narrow keeps invariants enforceable.
- **Phase A.3 — `oauth_states` table.** Separate migration. CSRF protection for the OAuth Connect flow (`state`, `space_id`, `user_id`, `provider`, `created_at` with 10-minute expiry index).
- **Phase B — `StorageWriter` interface + R2 baseline.** New module `apps/server/src/lib/storage/storage-writer.ts` declares the interface (`init`, `writeFile`, `getDownloadUrl`, `delete`, optional `proxyStreamMode`). New `apps/server/src/lib/storage/strategies/r2-managed.ts` implements it against `env.BACKUPS_R2`. Factory `makeStorageWriter(dest, env, masterKey)` dispatches on `dest.type` — at this phase, dispatches for `r2_managed` only; Drive/Dropbox cases added in Phase C.
- **Phase C.1 — Google Drive.** OAuth Connect routes at `apps/web/src/pages/api/connections/storage/google-drive/{authorize,callback}.ts`. Scopes: `["profile", "https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive.appdata"]` (the narrow `drive.file` scope only — no global Drive read). New strategy `apps/server/src/lib/storage/strategies/google-drive.ts` implementing `StorageWriter` against Drive v3 (resumable upload `uploadType=resumable` for files >5 MB). On first connect, create a `Baseout-<spaceId>` folder via `files.create` and store the folder ID in `storage_destinations.provider_folder_id`. Add `google_drive` dispatch case to `makeStorageWriter`. Token-refresh-on-401 retry inside the strategy.
- **Phase C.3 — Dropbox.** OAuth Connect routes at `apps/web/src/pages/api/connections/storage/dropbox/{authorize,callback}.ts`. Scopes: `files.content.write files.content.read files.metadata.read account_info.read`. `token_access_type=offline` to get a refresh token. New strategy `apps/server/src/lib/storage/strategies/dropbox.ts` with `proxyStreamMode=true` per [PRD §2.8](../../../shared/Baseout_PRD.md). Always uses the upload-session flow (`/2/files/upload_session/start` → `append_v2` → `finish`) — even small CSVs use this path so the code stays single-branch and future-proof for large tables. Folder path is `/Apps/Baseout/<spaceId>/`, created lazily on first write (ignore 409 path/conflict/folder). Add `dropbox` dispatch case.
- **Phase D — Capability resolver + StoragePicker UI.** New `apps/web/src/lib/billing/capabilities.ts` exporting `resolveStorageDestinations(tier)` — Drive + Dropbox + R2 enabled for every MVP tier. Update [apps/web/src/components/backups/StoragePicker.astro](../../../apps/web/src/components/backups/StoragePicker.astro): replace `enabled: false` with `enabled: tier-allowed` for Google Drive + Dropbox cards. Add "Connect <provider>" button when no `storage_destinations` row exists; "Connected as <email> · Disconnect" when one does. PATCH validator on `/api/spaces/:id/backup-config` rejects `storageType` values outside `resolveStorageDestinations(tier).allowedTypes`. New `DELETE /api/spaces/:id/storage-destination` to disconnect (resets to `r2_managed`).
- **Phase E.1 — Engine internal route.** New `POST /api/internal/spaces/:id/storage-destination` on apps/server. INTERNAL_TOKEN-gated. Returns the resolved `StorageDestination` row plus decrypted credentials (for the workflows runner to instantiate a writer). Refreshes the OAuth token if it expires <5 min from now; persists the refreshed tokens back to `storage_destinations` before returning.
- **Workflows — writers + task wiring.** New `apps/workflows/trigger/tasks/_lib/storage-writers/{types.ts,google-drive.ts,dropbox.ts,index.ts}`. The workflows-side implementations are pure HTTP — they don't need the Worker binding. `R2-managed` writes from the workflows side route through the engine's proxy upload route (covered by the next phase of the umbrella workflows change). [apps/workflows/trigger/tasks/backup-base.task.ts](../../../apps/workflows/trigger/tasks/backup-base.task.ts) refactored to call `loadStorageDestination(spaceId)` (via the Phase E.1 engine route) → `makeStorageWriter(...)` → `writer.init()` → per-table write loop → `writer.cleanup()`.
- **End-to-end smoke.** Connect real dev Google account → run backup → CSV lands in `Baseout-<spaceId>` Drive folder. Then connect real dev Dropbox account → re-bind destination → run backup → CSV lands at `/Apps/Baseout/<spaceId>/`.

### Pre-implementation gate

The OAuth client secrets the user pasted in chat (Google `GOCSPX-...`, Box, Dropbox) are public. Rotate them in each provider's console before Phase C secrets land. Register redirect URIs `https://localhost:4321/api/connections/storage/google-drive/callback` and `.../dropbox/callback` (the Astro default port; the user's prior Google registration of `:4331/oauth/callback/google` does not fit this route shape). New env-var names: `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` / `DROPBOX_OAUTH_CLIENT_ID` / `DROPBOX_OAUTH_CLIENT_SECRET`. Storage in `apps/web/.dev.vars` (local) and Cloudflare Secrets (deployed) per [CLAUDE.md §3.3](../../../CLAUDE.md). Never commit to `wrangler.jsonc`.

## Supersedes

This change supersedes the following slices of the umbrella changes for the MVP scope. The umbrella tasks.md files remain authoritative for the deferred providers' follow-up changes.

- [`server-byos-destinations`](../server-byos-destinations/tasks.md): §0 (done), §A, §A.3, §B (R2 baseline only), §C.1 (Google Drive), §C.3 (Dropbox), §D (capability resolver + UI, narrowed to Drive/Dropbox), §E.1.
- [`workflows-byos-destinations`](../workflows-byos-destinations/tasks.md): §1.1, §1.2 (Drive + Dropbox implementations only), §1.3, §2, §3 (test files for Drive + Dropbox only).

Phases not listed above (C.2 S3, C.4 Box, C.5 OneDrive, C.6 Frame.io, F retention integration, G doc updates, H final verification's per-provider smoke) remain on the umbrella tasks.md and roll into their respective per-provider follow-up changes.

## Out of Scope

| Deferred to | Item |
|---|---|
| `server-byos-box` + `workflows-byos-box` (future) | Box OAuth Connect + chunked upload + `provider_folder_id` (numeric Box folder ID) + `proxyStreamMode=true` strategy |
| `server-byos-onedrive` + `workflows-byos-onedrive` (future) | Microsoft Graph OAuth + driveItem-ID folder + upload-session for large files |
| `server-byos-s3` + `workflows-byos-s3` (future) | IAM-keys form + AWS Signature v4 + multipart upload (Growth+ tier-gated) |
| `server-byos-frame-io` + `workflows-byos-frame-io` (future) | Frame.io v2 API + project-scoped uploads (Growth+ tier-gated) |
| `server-custom-byos` (existing OUT-1) | Pro+ self-hosted destination with HMAC service-token auth |
| `server-byos-folder-picker` (existing OUT-2) | Rich GUI folder picker (MVP auto-creates one folder per Space) |
| `server-storage-failover` (existing OUT-3) | Auto-failover to managed R2 on extended provider downtime |
| `server-byos-cleanup` (existing OUT-4) | Optional Baseout-side retention enforcement for BYOS destinations |
| `server-restore-from-byos` (existing OUT-5) | Restore engine support for BYOS source |
| Extension to `server-cron-oauth-refresh` (existing OUT-6) | Proactive cron refresh of `storage_destinations.oauth_*` tokens. MVP uses lazy refresh in `StorageWriter.init()` + the Phase E.1 engine route. |
| Per-Org default destinations | MVP binds per-Space only. Per-Org defaults are a future enhancement. |
| Per-Base override of destination | MVP binds per-Space; individual bases inherit. |
| Streaming CSV row-by-row | The current `pageToCsv` buffers a full table in memory before write. Drive's resumable upload accepts the buffered CSV via a single resumable session; Dropbox's upload-session chunks the buffer into 8 MB pieces. A true row-by-row stream is a separate refactor. |
