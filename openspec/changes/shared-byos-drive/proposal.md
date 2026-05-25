## Why

Google Drive is the first cloud BYOS storage destination promised by V1 ([PRD §7.2](../../../shared/Baseout_PRD.md), [Features §4.4](../../../shared/Baseout_Features.md) — all-tier). Drive was implemented once (commit `5a90d07`, May 22) on a development branch that was set aside in favor of `autumn/backup-fix-local`; HEAD (`d58c52e`) has moved 12 commits forward on a different branch and the BYOS code is no longer reachable. The local-fs writer landed in `shared-backup-run-delete` Phase A specifically to leave the `StorageWriter` interface ready for the first cloud provider, and the StoragePicker still advertises Drive as "Coming soon."

With R2 deliberately parked per `system-r2-park`, Drive is the **first non-local-fs destination customers can use**. Until it lands, every customer-visible "BYOS" option is a UX lie. This change re-lands Drive as the first concrete `StorageWriter` behind the existing factory, with the OAuth Connect surface, encrypted token persistence, and engine-side credential decrypt that make per-tenant cloud writes possible.

**Scope discipline (user-confirmed before drafting):**
1. **Google Drive only.** Dropbox/Box/OneDrive/S3/Frame.io are per-provider follow-ups (`shared-byos-dropbox`, `shared-byos-box`, etc.) that each add one class behind the same interface.
2. **R2 stays parked.** Skip the umbrella `server-byos-destinations` Phase 0 R2 re-introduction. Local-fs remains the dev-only fallback default; Drive is the first cloud destination.
3. **Local-fs unchanged.** The existing `LocalFsWriter` keeps working for dev iteration and as the safety net when a Drive connection is missing or revoked.

The shape parallels the existing Airtable OAuth Connect flow ([apps/web/src/lib/airtable/oauth.ts](../../../apps/web/src/lib/airtable/oauth.ts), [apps/web/src/lib/airtable/cookie.ts](../../../apps/web/src/lib/airtable/cookie.ts)) — PKCE-S256 + encrypted HttpOnly cookie state — with one architectural addition: the workflows task is Node-only and cannot import the master encryption key directly, so the engine exposes one new `INTERNAL_TOKEN`-gated route that decrypts and lazy-refreshes tokens on each backup run.

## What Changes

### Phase 1 — Schema: `storage_destinations` table

- **New canonical migration** `apps/web/drizzle/0009_storage_destinations.sql` (next migration slot — current HEAD is at `0008_workspace_rediscovery.sql`).
- **New table** `baseout.storage_destinations`:
  - `id uuid PK`
  - `space_id uuid UNIQUE FK → spaces(id)` — one destination per Space; re-connecting replaces the row
  - `type text CHECK (type IN ('local_fs','google_drive'))` — widened additively when subsequent providers land
  - `oauth_access_token_enc text`, `oauth_refresh_token_enc text`, `oauth_expires_at timestamptz`, `oauth_scope text`, `oauth_account_email text`
  - `provider_folder_id text` — Drive folder ID for `Baseout-<spaceId>` (cached after first creation)
  - `provider_account_id text` — Drive user-id for audit
  - `connected_by_user_id uuid FK → users(id)`, `connected_at timestamptz`, `last_validated_at timestamptz`
- **No `s3_*` columns** (S3 is out of scope here; the column is added when the S3 change lands).
- **No `oauth_states` table** — the encrypted-cookie pattern from `airtable/cookie.ts` already covers CSRF state without a separate DB table or cleanup cron.
- **Schema export** in [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts) — adds the `storageDestinations` table definition + type export.
- **Engine mirror** in `apps/server/src/db/schema/storage-destinations.ts` with `// Canonical source: apps/web/drizzle/0009_storage_destinations.sql` header per the [CLAUDE.md §2](../../../CLAUDE.md) backend rule. Re-exported from `apps/server/src/db/schema/index.ts`.

### Phase 2 — apps/web: OAuth Connect flow

- **New** `apps/web/src/lib/google-drive/config.ts` — endpoint URLs (`https://accounts.google.com/o/oauth2/v2/auth`, `https://oauth2.googleapis.com/token`), scope `https://www.googleapis.com/auth/drive.file` (least privilege — app only sees files it creates), env-var reads (`GOOGLE_DRIVE_OAUTH_CLIENT_ID`, `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET`).
- **New** `apps/web/src/lib/google-drive/oauth.ts` — `buildAuthorizeUrl`, `exchangeCodeForTokens`, `refreshAccessToken`. Mirror the Airtable shape, with three Google-specific authorize-URL parameters that are non-negotiable for refresh-token issuance:
  - `access_type=offline`
  - `prompt=consent`
  - `code_challenge_method=S256` (already PKCE per the shared pattern)
- **New** `apps/web/src/lib/google-drive/cookie.ts` — port of [apps/web/src/lib/airtable/cookie.ts](../../../apps/web/src/lib/airtable/cookie.ts). Cookie name `bo_oauth_google_drive`, path `/api/connections/storage/google-drive`, AES-256-GCM via the existing [apps/web/src/lib/crypto.ts](../../../apps/web/src/lib/crypto.ts).
- **New** `apps/web/src/lib/google-drive/client.ts` — Drive v3 helper that looks up `Baseout-<spaceId>` under the user's root by name; creates if missing. Returns the folder ID for persistence. Avoids duplicate-folder creation on re-connect.
- **New** `apps/web/src/lib/google-drive/persist.ts` — UPSERT into `storage_destinations` keyed on `space_id`.
- **New routes** under `apps/web/src/pages/api/connections/storage/google-drive/`:
  - `authorize.ts` (POST) — middleware-checks session, generates PKCE + state, seals cookie, 302 to Google.
  - `callback.ts` (GET) — reads cookie, validates state, exchanges code for tokens, encrypts and UPSERTs the row, creates+caches the Drive folder, clears cookie, redirects to `returnTo`.
  - `disconnect.ts` (DELETE / POST) — removes the row; flips `backup_configurations.storageType` back to `'local_fs'`.
- **Env-var docs** — add `GOOGLE_DRIVE_OAUTH_CLIENT_ID` + `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET` to [apps/web/.env.example](../../../apps/web/.env.example) and `apps/web/wrangler.jsonc.example`.

### Phase 3 — apps/server: internal storage-destination endpoint

- **New pure helper** `apps/server/src/lib/storage/refresh-drive.ts` — `refreshDriveAccessToken({refreshToken, clientId, clientSecret, tokenUrl?})` POSTs `oauth2.googleapis.com/token` with `grant_type=refresh_token` and returns `{accessToken, expiresAt}`. Pure, msw-mockable.
- **New engine route** `apps/server/src/pages/api/internal/spaces/[spaceId]/storage-destination.ts` (GET):
  - INTERNAL_TOKEN gate (header `x-internal-token`).
  - Reads the row, decrypts `oauth_access_token_enc` + `oauth_refresh_token_enc` via the engine's `crypto.ts` (mirror of [apps/web/src/lib/crypto.ts](../../../apps/web/src/lib/crypto.ts)).
  - If `oauthExpiresAt - now < 5 min` OR `?refresh=1` query param: calls `refreshDriveAccessToken`, re-encrypts the new access token + updates `oauthExpiresAt`, writes back.
  - Returns `{type, accessToken, expiresAt, providerFolderId}` (no refresh token in the response — workflows never holds it).
  - 404 if no row exists; 410-ish (200 with `type: 'local_fs'` and no token fields) if the row is `'local_fs'`.
- **Env-var docs** — add `GOOGLE_DRIVE_OAUTH_CLIENT_ID` + `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET` to `apps/server/wrangler.jsonc.example` and `apps/server/.dev.vars.example`. Engine MUST hold the secret because workflows is not allowed to know it.

### Phase 4 — apps/workflows: `GoogleDriveWriter` + creds threading

- **New** `apps/workflows/trigger/tasks/_lib/storage-writers/google-drive.ts` — `createGoogleDriveWriter(creds): StorageWriter`. Implements:
  - `writeCsv(relativeKey, csv)` — Drive v3 resumable upload (`/upload/drive/v3/files?uploadType=resumable`), one CSV per call. Uses the `Baseout-<spaceId>` parent ID from `creds.providerFolderId`; creates sub-folders for `<runId>/<baseId>/` on first write per path segment. Returns `{path, size}` matching the local-fs writer's contract.
  - `deletePrefix(relativePrefix)` — Drive `files.list` (q=`'<folderId>' in parents and trashed=false`) + per-result `files.delete`, recursive. **MVP behavior:** no-op + `{deletedCount: 0}` if the path is missing — Drive retention is customer-managed per PRD §6.6, and `shared-backup-run-delete`'s engine flow tolerates the empty case.
  - 401 mid-upload triggers `creds.refresh()` (closure provided by the task wrapper that re-hits the engine internal route with `?refresh=1`) and a single retry.
  - Path-traversal guard (`..` in `relativeKey`/`relativePrefix` throws `invalid_path`), matching the local-fs writer.
- **Widen factory** in [apps/workflows/trigger/tasks/_lib/storage-writers/index.ts](../../../apps/workflows/trigger/tasks/_lib/storage-writers/index.ts) — `resolveStorageWriter(storageType: string, creds?: StorageWriterCreds): StorageWriter`. Dispatch:
  - `storageType === 'google_drive' && creds`: `createGoogleDriveWriter(creds)`.
  - Otherwise: `new LocalFsWriter()` (defensive default — preserves dev iteration when creds are missing).
- **Update** [apps/workflows/trigger/tasks/backup-base.ts](../../../apps/workflows/trigger/tasks/backup-base.ts) — extend `BackupBaseInput` with `spaceId: string`. Before `resolveStorageWriter(...)`, when `storageType === 'google_drive'`, fetch creds from `${process.env.BACKUP_ENGINE_URL}/api/internal/spaces/${spaceId}/storage-destination` with `x-internal-token`. Build the `refreshClient` closure that re-fetches with `?refresh=1` on 401.
- **Update** `apps/workflows/trigger/tasks/backup-base.task.ts` — add `spaceId` to `BackupBaseTaskPayload`. Do NOT carry tokens in the payload — Trigger.dev logs payloads in run history.
- **Update** [apps/server/src/lib/runs/start.ts](../../../apps/server/src/lib/runs/start.ts) — thread `spaceId` into the Trigger.dev task payload.

### Phase 5 — apps/web: enable Drive in the UI

- **Update** [apps/web/src/components/backups/StoragePicker.astro](../../../apps/web/src/components/backups/StoragePicker.astro) — flip the Drive option to `enabled: true`, drop the "Coming soon" badge. When a user picks Drive but no `storage_destinations` row exists for the Space, render a `Connect` button that POSTs to `/api/connections/storage/google-drive/authorize`. After successful OAuth return (`?connected=success`), the radio stays selected and the existing save flow persists `storageType='google_drive'`. Loading state via `setButtonLoading` from [apps/web/src/lib/ui.ts](../../../apps/web/src/lib/ui.ts) per [apps/web CLAUDE.md §4.5](../../../apps/web/.claude/CLAUDE.md).
- **Update** the backup-config PATCH route — allow `'google_drive'` as a valid `storageType` (defense-in-depth on the API surface in addition to the DB CHECK).
- **Optional** disconnect affordance on the same picker that POSTs to `/disconnect`.

### Phase 6 — Docs + spec close-out

- Tick `shared/Baseout_Backlog_MVP.md` — Drive row.
- Cross-reference `shared-byos-drive` from `openspec/changes/server-byos-destinations/README.md` as the first slice; mark Drive portion of that umbrella as superseded.
- Archive this change via `opsx:archive`.

## Out of Scope

| Deferred to | Item |
|---|---|
| `shared-byos-dropbox` (future) | Dropbox provider. Boss has creds; redirect URI registration pending per user memory. |
| `shared-byos-box` / `shared-byos-onedrive` (future) | Box + OneDrive. Creds parked post-MVP. |
| Future Growth+ scope | S3 + Frame.io. Tier-gated Growth+; needs the tier-resolver hookup. |
| `server-byos-destinations` umbrella | The other six providers from the umbrella's Phase C (this change covers Phase C.1 — Google Drive — and a strict subset of A/B/E that Drive needs). |
| Future | StoragePicker folder picker GUI (browse Drive directories before saving). MVP creates `Baseout-<spaceId>` at the root. |
| Future | Restore-from-Drive. Restore engine reads from local-fs today; cross-cutting work belongs in `workflows-restore`. |
| Future | Proactive token-refresh cron. Lazy refresh on backup-start covers MVP; extend `server-cron-oauth-refresh` when needed. |
| Future | Multi-Drive accounts per Space. MVP is one destination per Space (the `space_id UNIQUE` constraint). |
| Future | OAuth-state expiry sweep. The encrypted-cookie pattern has natural 10-min expiry; no orphan rows to clean. |

## Capabilities

### New capabilities

- `storage-destination-google-drive` — per-Space Drive Connect flow, encrypted token persistence, lazy refresh on backup start, resumable upload of CSV output, optional folder cleanup. Spans `apps/web/` (OAuth + UI), `apps/server/` (internal credential endpoint), `apps/workflows/` (writer implementation).
- `storage-destination-record` — the master-DB `storage_destinations` row shape. First user is Drive; same row shape extends to Dropbox/Box/OneDrive when those providers land.

### Modified capabilities

- `storage-writer` — factory signature widens to accept optional creds (`resolveStorageWriter(storageType, creds?)`). Existing local-fs path is unaffected (no creds, no dispatch change).
- `backup-engine` — `runs/start` enqueues task payloads with `spaceId`. No other engine-side change.
- `backup-history-ui` — StoragePicker enables Drive selection. No history-widget changes.

## Impact

- **Master DB**: one new table, one migration (`0009_storage_destinations.sql`). Idempotent forward-only — no destructive operations.
- **apps/web**: ~10 new files (lib + 3 API routes + UI tweak), 3 modified files (schema/core.ts, StoragePicker, backup-config PATCH).
- **apps/server**: 2 new files (refresh helper + internal route), 1 modified file (runs/start.ts to thread spaceId). Engine bundle gains the master-DB decrypt path for storage destinations (already in place for Airtable; same `crypto.ts` shape).
- **apps/workflows**: 1 new file (google-drive writer), 3 modified files (factory, backup-base.ts, backup-base.task.ts). Node-only — no `cloudflare:workers` import.
- **Cross-app contract** (new wire shapes):
  - browser → apps/web: `POST /api/connections/storage/google-drive/authorize` → 302 to Google.
  - Google → apps/web: `GET /callback?code=...&state=...` → 302 to `returnTo`.
  - workflows → apps/server: `GET /api/internal/spaces/:spaceId/storage-destination[?refresh=1]` → `{type, accessToken, expiresAt, providerFolderId}` | 404.
  - apps/web → apps/server (engine, existing): `runs/start` payload gains `spaceId`.
  - apps/server → apps/workflows (existing Trigger.dev): `backup-base` task payload gains `spaceId`.
- **Security**:
  - New OAuth client secret (`GOOGLE_DRIVE_OAUTH_CLIENT_SECRET`) must be a Cloudflare Secret in prod, in `.dev.vars` locally. Lives on both web (initial code exchange) and server (refresh). Workflows MUST NOT hold it.
  - Tokens encrypted at rest via existing AES-256-GCM helper. Cookie state encrypted with the same key.
  - Scope `drive.file` (least privilege — app sees only files it creates).
  - Path-traversal guard on `writeCsv` / `deletePrefix` inputs.
  - INTERNAL_TOKEN gate on the new engine route (defense-in-depth alongside the service-binding network isolation).
- **Observability**: structured logs — `storage_destination_connected` (callback success, `spaceId`, `providerFolderId`), `storage_destination_disconnected`, `storage_destination_token_refreshed` (engine, on every refresh).
- **Cost**: one extra HTTP call per backup run (engine → workflows fetches creds at task start). Drive resumable upload is the same byte volume as local-fs write; rate limits handled per-call.

## Reversibility

- **Code revert** is clean: drop the new files, restore the factory signature, revert StoragePicker. The interface (`StorageWriter`) is unchanged; the local-fs path is the unaffected backstop.
- **Data revert**: `DROP TABLE storage_destinations;` (or `IF EXISTS`-safe migration `0010_drop_storage_destinations.sql`). Any orphaned `backup_configurations.storageType='google_drive'` rows get flipped back to `'local_fs'` as part of the revert. Existing CSVs in customer Drive accounts are NOT recovered automatically — that's customer-owned data.
- **OAuth app revert**: revoking the Google OAuth client in Cloud Console invalidates all outstanding refresh tokens; users would see "Disconnected" on next backup attempt. Acceptable rollback posture given the small connected user base at MVP.
