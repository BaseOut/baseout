## Why

`shared-byos-drive-dropbox` shipped Google Drive + Dropbox as the MVP BYOS providers. Box was deferred to a per-provider follow-up — explicitly named in [`shared-byos-drive-dropbox/proposal.md` §Out of Scope](../shared-byos-drive-dropbox/proposal.md) (line 46) and `tasks.md §OUT-1` (line 158).

Box OAuth client credentials landed today (2026-05-20). The remaining external work (redirect-URI registration, sandbox→production promotion) is in flight and gated only on a single boss-side checklist (see `## External setup required` below). Filing this change now lets the work start while those console steps complete.

Scope: Box only. OneDrive stays parked — the Client Secret is still missing on the boss's side, so bundling them in one change would block on the slower provider. Each subsequent provider (OneDrive, S3, Frame.io) gets its own `shared-byos-*` change that consumes the interface `shared-byos-drive-dropbox` already locked in.

This change adds **one provider** on top of an already-shipped contract. Almost every design decision is inherited verbatim from `shared-byos-drive-dropbox`; the file [`design.md`](./design.md) records only what differs (Box's wider OAuth scope, 20 MB chunked-upload threshold, single-use refresh-token rotation, rate-limit ceilings).

## What Changes

Phase ordering is load-bearing: A → B → C → D → E → workflows → H. Each phase mirrors the equivalent phase from `shared-byos-drive-dropbox`, narrowed to Box-only additions.

- **Phase A — Schema widening.** Two migrations against the master DB:
  - `apps/web/drizzle/0012_storage_destinations_add_box.sql` — `ALTER TABLE baseout.storage_destinations DROP CONSTRAINT storage_destinations_type_check; ADD CONSTRAINT ... CHECK (type IN ('r2_managed','google_drive','dropbox','box'));`
  - `apps/web/drizzle/0013_oauth_states_add_box.sql` — same ALTER pattern on the `provider` CHECK to add `'box'`.
  - Widen the Drizzle `storageDestinations.type` + `oauthStates.provider` enums in [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts). Mirror the new union value in [apps/server/src/db/schema/storage-destinations.ts](../../../apps/server/src/db/schema/storage-destinations.ts).
- **Phase B — Capability resolver update.** Extend `resolveStorageDestinations(tier)` in [apps/web/src/lib/billing/capabilities.ts](../../../apps/web/src/lib/billing/capabilities.ts) to include `'box'` for every MVP tier (matches Drive + Dropbox per [Features §4.4](../../../shared/Baseout_Features.md)). Extend the unit tests added in `shared-byos-drive-dropbox` Phase D.1.
- **Phase C — Web OAuth Connect.** New env vars in `apps/web/.dev.vars.example`: `BOX_OAUTH_CLIENT_ID`, `BOX_OAUTH_CLIENT_SECRET`. New modules `apps/web/src/lib/box/{config,oauth,client,persist}.ts` consuming the provider-agnostic `apps/web/src/lib/oauth/` helpers extracted in `shared-byos-drive-dropbox` Phase C.3.0. New routes `apps/web/src/pages/api/connections/storage/box/{authorize,callback}.ts`. OAuth scope: `root_readwrite` (Box has no narrow-folder scope equivalent to Drive's `drive.file`; see [design.md "Box OAuth scope"](./design.md)). On first connect, create `Baseout-<spaceId>` folder via `POST /folders` and store the numeric folder ID in `storage_destinations.provider_folder_id`. Callback redirects to `/integrations?connected=box`.
- **Phase C.s — Server-side strategy.** New `apps/server/src/lib/storage/strategies/box.ts` implementing `StorageWriter` with `proxyStreamMode = true` per [PRD §2.8](../../../shared/Baseout_PRD.md). Add `case 'box':` branch to `makeStorageWriter` in [apps/server/src/lib/storage/storage-writer.ts](../../../apps/server/src/lib/storage/storage-writer.ts) (extend the `StorageDestinationType` union at line 17).
- **Phase D — StoragePicker UI.** Update [apps/web/src/components/backups/StoragePicker.astro](../../../apps/web/src/components/backups/StoragePicker.astro): change the Box card from `enabled: false` to `enabled: tier-allowed`. Add Connect / Connected-as-`<oauth_account_email>` · Disconnect states matching the Drive + Dropbox cards. PATCH validator on `/api/spaces/:id/backup-config` already gates on `allowedTypes`; no route change needed once `resolveStorageDestinations` widens. Playwright AI verification per [web-ai-verify](../web-ai-verify/proposal.md) covers the new card.
- **Phase E — Engine internal route.** Already implemented by `shared-byos-drive-dropbox` Phase E.1. Box adds one branch inside the token-refresh helper used by `POST /api/internal/spaces/:id/storage-destination` to call `https://api.box.com/oauth2/token` with `grant_type=refresh_token`, and to **persist the new refresh token** alongside the new access token (Box rotates refresh tokens on every use — see [design.md "Refresh-token rotation"](./design.md)).
- **Workflows — writer + task wiring.**
  - New `apps/workflows/trigger/tasks/_lib/storage-writers/box.ts` — pure HTTP, raw fetch, hand-rolled chunked upload. Files <20 MB use the simple `POST upload.box.com/api/2.0/files/content` multipart endpoint (attributes-before-file ordering); files ≥20 MB use the three-step upload-session flow (`POST /files/upload_sessions` → parallel `PUT /upload_sessions/:id/parts` capped to 4 concurrent → `POST /files/upload_sessions/:id/commit`).
  - Add `case 'box':` branch to the workflows-side `makeStorageWriter` factory in [apps/workflows/trigger/tasks/_lib/storage-writers/index.ts](../../../apps/workflows/trigger/tasks/_lib/storage-writers/index.ts).
  - No change to `backup-base.task.ts` itself — the dispatch site already calls `makeStorageWriter(destination)`.
- **End-to-end smoke.** Connect a real dev Box account on `/integrations` → bind a Space to Box → run a backup of a small Airtable base → CSV lands in the auto-created `Baseout-<spaceId>` Box folder, row count matches.

### External setup required

These steps unblock Phase C and the smoke at the end. Owned by the boss (Box Developer Console actions, not code):

- [ ] **Register redirect URIs** in the Box Developer Console → App → Configuration → OAuth 2.0 Redirect URIs. Box requires exact-match strings.
  - Local dev: `http://localhost:4321/api/connections/storage/box/callback`
  - Staging: `https://staging.baseout.app/api/connections/storage/box/callback` *(confirm staging host)*
  - Production: `https://app.baseout.app/api/connections/storage/box/callback` *(confirm production host)*
- [ ] **Confirm OAuth scope `root_readwrite` is enabled** in App → Configuration → Application Scopes. Without it Connect succeeds but folder-create + uploads return 401.
- [ ] **Confirm the app type is "Standard OAuth 2.0 (User Authentication)"**, not "Server Authentication (JWT)" or "Custom App". The JWT flow bypasses the user-OAuth path this change builds.
- [ ] **Sandbox → production authorization.** Confirm whether the Client ID / Secret already in hand are scoped to the production app environment. If sandbox-only, walk App → Authorization tab → Review and Submit and obtain Box Admin approval before real-customer backups.
- [ ] **Storage quota for the test Box account.** A free Box developer account caps the enterprise at 10 GB. Multi-GB Airtable attachments will exhaust it. Either request a temporary quota bump or point smoke testing at a paid Box account.

`shared-byos-drive-dropbox` Phase C is gated on its own pre-implementation gate (G.1 secret rotation, G.2/G.3 redirect-URI registration); the equivalent gate here is the bulleted list above.

## Supersedes

This change closes out the per-provider follow-up slot reserved in [`shared-byos-drive-dropbox/tasks.md §OUT-1`](../shared-byos-drive-dropbox/tasks.md) ("`server-byos-box` + `workflows-byos-box`"). Filed as one `shared-*` change instead of two per-app changes to match the precedent set by `shared-byos-drive-dropbox` — Box's web OAuth + server route + workflows writer must land together to be useful, so reverting requires edits in ≥2 `apps/*` directories per the [CLAUDE.md §3.6 prefix rule](../../../CLAUDE.md).

The umbrella changes ([`server-byos-destinations`](../server-byos-destinations/proposal.md) §C.4 and [`workflows-byos-destinations`](../workflows-byos-destinations/proposal.md) §1.2 Box-only items) remain authoritative for their broader scope but their Box-specific checkboxes get ticked when this change archives.

## Out of Scope

| Deferred to | Item |
|---|---|
| `shared-byos-onedrive` (future) | Microsoft Graph OAuth + driveItem-ID folder + upload-session for large files. Blocked on boss providing OneDrive Client Secret (per memory). |
| `shared-byos-s3` (future) | IAM-keys form + AWS Signature v4 + multipart upload (Growth+ tier-gated). |
| `shared-byos-frame-io` (future) | Frame.io v2 API + project-scoped uploads (Growth+ tier-gated). |
| `server-byos-r2-proxy-upload` (existing OUT-5) | Engine-side proxy upload route so R2 backups can run from the Node Trigger.dev runner. Not needed for Box (pure HTTP). |
| Extension to `server-cron-oauth-refresh` (existing OUT-6) | Proactive cron refresh of `storage_destinations.oauth_*` tokens 15 minutes before expiry. Box still relies on lazy + on-401 refresh per [design.md](./design.md). |
| `server-byos-folder-picker` (existing OUT-7) | Rich GUI folder picker. Box still auto-creates one folder per Space. |
| `server-restore-from-byos` (existing OUT-9) | Restore reads from Box. This change only writes. |
| Streaming-CSV refactor (existing OUT-10) | Row-by-row CSV streaming. Box's chunked upload accepts the buffered CSV the same way Dropbox's upload-session does. |
| Box App Center listing / public marketplace | This is a private OAuth app per enterprise; no Box Integrations gallery submission. |
| Box Skills, metadata templates, watermarking | Box-specific surface beyond simple file storage. Not relevant to backups. |
