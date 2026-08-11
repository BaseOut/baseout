## Phase 1 — Schema: `storage_destinations` table

Foundation. No tests; verified via journal sync + manual `psql \d storage_destinations`.

- [x] 1.1 Add `storageDestinations` table to [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts). Columns per [design.md §Phase 1](./design.md). CHECK constraint on `type` covers `'local_fs' | 'google_drive'`. UNIQUE on `space_id`. FKs to `spaces(id)` (CASCADE on delete) and `users(id)`. Index on `type`.
- [x] 1.2 Run `pnpm --filter @baseout/web db:generate`. Verify generated `apps/web/drizzle/0009_storage_destinations.sql` + `apps/web/drizzle/meta/0009_snapshot.json` + journal update.
- [ ] 1.3 Run `pnpm --filter @baseout/web db:migrate` against the dev DB. Verify table exists via `psql \d baseout.storage_destinations`.
- [ ] 1.4 Run `pnpm --filter @baseout/web db:check` — journal in sync.
- [x] 1.5 Create `apps/server/src/db/schema/storage-destinations.ts` mirroring the table. Header: `// Canonical source: apps/web/drizzle/0009_storage_destinations.sql`. Re-export from `apps/server/src/db/schema/index.ts`.
- [x] 1.6 `pnpm --filter @baseout/web typecheck && pnpm --filter @baseout/server typecheck` — green.
- [ ] 1.7 Human checkpoint: confirm migration applied cleanly; approve commit. Commit message: `feat(schema): add storage_destinations table for BYOS Drive`.

## Phase 2 — apps/web: Google Drive OAuth Connect

Depends on Phase 1. TDD red-then-green throughout.

### 2.1 — Config + env

- [x] 2.1.1 Create `apps/web/src/lib/google-drive/config.ts`. Exports `GOOGLE_DRIVE_AUTHORIZE_URL`, `GOOGLE_DRIVE_TOKEN_URL`, `GOOGLE_DRIVE_SCOPES`, `getClientCredentials(env)` reader.
- [x] 2.1.2 Add `GOOGLE_DRIVE_OAUTH_CLIENT_ID` + `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET` to [apps/web/.env.example](../../../apps/web/.env.example).

### 2.2 — OAuth helpers (PKCE + token exchange + refresh)

- [x] 2.2.1 TDD red: create `apps/web/src/lib/google-drive/oauth.test.ts`. Cases per [design.md §Testing strategy](./design.md).
- [x] 2.2.2 Implement `apps/web/src/lib/google-drive/oauth.ts`. Watch green.

### 2.3 — Cookie

- [x] 2.3.1 TDD red: create `apps/web/src/lib/google-drive/cookie.test.ts`.
- [x] 2.3.2 Implement `apps/web/src/lib/google-drive/cookie.ts`. Watch green.

### 2.4 — Drive client (folder lookup + create)

- [x] 2.4.1 TDD red: create `apps/web/src/lib/google-drive/client.test.ts`.
- [x] 2.4.2 Implement `apps/web/src/lib/google-drive/client.ts` (`about`, `ensureBaseoutFolder`). Watch green.

### 2.5 — Persist

- [x] 2.5.1 Create `apps/web/src/lib/google-drive/persist.ts`. UPSERT on `space_id`; preserve refresh-token across re-connects.

### 2.6 — authorize.ts route

- [x] 2.6.2 Implement `apps/web/src/pages/api/connections/storage/google-drive/authorize.ts`. (Route-level tests skipped per Airtable convention.)

### 2.7 — callback.ts route

- [x] 2.7.2 Implement `apps/web/src/pages/api/connections/storage/google-drive/callback.ts`. (Route-level tests skipped per Airtable convention.)

### 2.8 — disconnect.ts route

- [x] 2.8.2 Implement `apps/web/src/pages/api/connections/storage/google-drive/disconnect.ts`.

### 2.9 — Phase 2 verification

- [x] 2.9.1 `pnpm --filter @baseout/web typecheck && pnpm --filter @baseout/web test` — green (524 tests).
- [ ] 2.9.2 Human checkpoint: with Google Cloud Console OAuth client registered + env vars set in `.dev.vars`, manually hit `POST /api/connections/storage/google-drive/authorize`, complete consent, verify row + folder.
- [ ] 2.9.3 On approval: commit. Message: `feat(web): Google Drive OAuth Connect flow + storage_destinations persistence`.

## Phase 3 — apps/server: internal storage-destination endpoint

### 3.1 — Refresh helper

- [x] 3.1.1 TDD red: `apps/server/tests/integration/refresh-drive.test.ts` (9 cases).
- [x] 3.1.2 Implement `apps/server/src/lib/storage/refresh-drive.ts` with discriminated `DriveRefreshOutcome` mirroring `airtable-refresh.ts`. Watch green.

### 3.2 — Engine crypto mirror

- [x] 3.2.1 `apps/server/src/lib/crypto.ts` already exports `encryptToken` / `decryptToken` mirroring web — re-used as-is.

### 3.3 — Internal route

- [x] 3.3.1 Routing-layer test: `apps/server/tests/integration/spaces-storage-destination-route.test.ts` (401/405/400 gates).
- [x] 3.3.2 Implement `apps/server/src/pages/api/internal/spaces/storage-destination.ts`. Wired in `src/index.ts` via `SPACES_STORAGE_DESTINATION_RE`.

### 3.4 — Env-var docs + Env interface

- [x] 3.4.1 Added `GOOGLE_DRIVE_OAUTH_CLIENT_ID` + `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET` to `apps/server/src/env.d.ts`.

### 3.5 — Phase 3 verification

- [x] 3.5.1 `pnpm --filter @baseout/server typecheck && pnpm --filter @baseout/server test` — green (222 tests).
- [ ] 3.5.2 Human smoke: `curl -H "x-internal-token: $INTERNAL_TOKEN" $ENGINE_URL/api/internal/spaces/$SPACE_ID/storage-destination`.
- [ ] 3.5.3 On approval: commit. Message: `feat(server): internal storage-destination endpoint with lazy token refresh`.

## Phase 4 — apps/workflows: GoogleDriveWriter + creds threading

### 4.1 — Factory widening

- [x] 4.1.1 TDD red: `apps/workflows/tests/storage-writers/factory.test.ts` (5 cases).
- [x] 4.1.2 Widen factory signature in `index.ts` — `resolveStorageWriter(storageType, creds?)`. Discriminated `StorageWriterCreds` union.

### 4.2 — GoogleDriveWriter

- [x] 4.2.1 TDD red: `apps/workflows/tests/storage-writers/google-drive.test.ts` (9 cases).
- [x] 4.2.2 Implement `apps/workflows/trigger/tasks/_lib/storage-writers/google-drive.ts`. Watch green.

### 4.3 — Creds threading in backup-base

- [x] 4.3.1 Extended `BackupBaseInput` with `spaceId: string`.
- [x] 4.3.2 Implemented `defaultFetchStorageCreds` helper.
- [x] 4.3.3 Wired the conditional creds fetch (only for `google_drive`).
- [x] 4.3.4 Existing backup-base tests updated to include `spaceId`.
- [x] 4.3.5 Added `spaceId` to `BackupBaseTaskPayload`.

### 4.4 — Enqueue thread (engine)

- [x] 4.4.1 Threaded `spaceId` into the Trigger.dev payload in `apps/server/src/lib/runs/start.ts`.
- [x] 4.4.2 Widened `unsupported_storage_type` accept-list to include `'local_fs'` + `'google_drive'`.
- [x] 4.4.3 Updated `runs-start.test.ts` to assert new payload shape.

### 4.5 — Phase 4 verification

- [x] 4.5.1 `pnpm --filter @baseout/workflows typecheck && pnpm --filter @baseout/workflows test` — green (61 tests).
- [x] 4.5.2 `pnpm --filter @baseout/server typecheck && pnpm --filter @baseout/server test` — green (222 tests).
- [ ] 4.5.3 Human smoke: deploy engine + workflows, trigger a backup with `storageType='google_drive'`, verify CSVs in Drive.
- [ ] 4.5.4 On approval: commit. Message: `feat(workflows): Google Drive StorageWriter + engine-fetched creds threading`.

## Phase 5 — apps/web: enable Drive in StoragePicker UI

### 5.1 — StoragePicker

- [x] 5.1.1 Updated `StoragePicker.astro` test expectations through existing IntegrationsView tests (524 web tests green).
- [x] 5.1.2 Flipped Drive option to `enabled: true`; removed "Coming soon" badge via the `enabled` flag; added a Connect form that POSTs to `/authorize` with `setButtonLoading`.

### 5.2 — PATCH validation

- [x] 5.2.1 Widened `ALLOWED_STORAGE_TYPES` in `persist-policy.ts` to `{ r2_managed, local_fs, google_drive }`.
- [x] 5.2.2 Added `google_drive` + `local_fs` test cases to `persist-policy.test.ts`.

### 5.3 — Phase 5 verification

- [x] 5.3.1 `pnpm --filter @baseout/web typecheck && pnpm --filter @baseout/web test:unit` — green (524 tests).
- [ ] 5.3.2 `pnpm --filter @baseout/web db:check` — journal still in sync.
- [ ] 5.3.3 Human end-to-end smoke:
  - Engine deployed (BACKUP_ENGINE service binding has `"remote": true`).
  - `pnpm --filter @baseout/workflows trigger:deploy`.
  - `pnpm --filter @baseout/web dev`.
  - Sign in, navigate to backup config, pick Drive, complete OAuth, save.
  - Trigger a backup of a small base.
  - Verify CSVs in `Baseout-<spaceId>/<runId>/<baseId>/<table>.csv` in Drive.
  - Disconnect Drive — row removed, storage_type flipped to `'local_fs'`.
- [ ] 5.3.4 On approval: commit. Message: `feat(web): enable Google Drive in StoragePicker + Connect-and-save flow`.

## Phase 6 — Documentation + spec close-out

- [ ] 6.1 Update [shared/Baseout_Backlog_MVP.md](../../../shared/Baseout_Backlog_MVP.md) — tick the Drive row under storage destinations.
- [ ] 6.2 Cross-reference `shared-byos-drive` from `openspec/changes/server-byos-destinations/` — note the Drive portion is now superseded.
- [ ] 6.3 `pnpm --filter @baseout/web typecheck && pnpm --filter @baseout/web build` — green.
- [ ] 6.4 `pnpm --filter @baseout/workflows test && pnpm --filter @baseout/server test && pnpm --filter @baseout/web test` — green.
- [ ] 6.5 Archive via `opsx:archive shared-byos-drive` (moves change folder → `openspec/specs/shared-byos-drive/`).
- [ ] 6.6 On approval: commit. Message: `docs(openspec): archive shared-byos-drive`.

## Preconditions (human, not code-side tasks)

- [ ] PRE-1 Register Baseout app in Google Cloud Console:
  - Authorized redirect URI prod: `https://console.baseout.dev/api/connections/storage/google-drive/callback`
  - Authorized redirect URI dev: `https://baseout.local:4331/api/connections/storage/google-drive/callback`
  - Authorized redirect URI baseout-dev: `https://baseout-dev.openside.workers.dev/api/connections/storage/google-drive/callback`
  - Scopes: `https://www.googleapis.com/auth/drive.file`
  - (See [shared/internal/oauth-setup.md §4.1](../../../shared/internal/oauth-setup.md) for the full URI list per env.)
- [ ] PRE-2 Capture `GOOGLE_DRIVE_OAUTH_CLIENT_ID` + `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET` and set on:
  - `apps/web/.dev.vars` locally; Cloudflare Secrets in staging/prod.
  - `apps/server/.dev.vars` locally; Cloudflare Secrets in staging/prod.
- [ ] PRE-3 Confirm `BASEOUT_ENCRYPTION_KEY` matches between web and server. (Already in place per existing Airtable flow.)
- [ ] PRE-4 Confirm `BACKUP_ENGINE_URL` + `INTERNAL_TOKEN` are set in the Trigger.dev dashboard for the development environment.

## Out of this change (follow-ups, file separately)

- [ ] OUT-1 `shared-byos-dropbox` — Dropbox provider. Boss has creds; redirect URI registration pending per memory.
- [ ] OUT-2 `shared-byos-box` / `shared-byos-onedrive` — Box + OneDrive providers, parked post-MVP per memory.
- [ ] OUT-3 `shared-byos-s3` (Growth+) — IAM-keys based, requires the `s3_*` schema columns + the tier-gating resolver.
- [ ] OUT-4 `shared-byos-frame-io` (Growth+) — Frame.io OAuth.
- [ ] OUT-5 `web-byos-folder-picker` — browse Drive directories before saving. MVP is `Baseout-<spaceId>` at root.
- [ ] OUT-6 `workflows-restore-from-drive` — restore engine reads from local-fs today; Drive-read path is a sibling.
- [ ] OUT-7 `server-cron-drive-token-proactive-refresh` — proactive refresh cron (currently lazy on backup start).
