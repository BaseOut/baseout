# Tasks — byos-google-drive

End-to-end Google Drive as the first BYOS cloud storage destination. Five vertical-slice phases, each independently testable and revertable. Every phase ends with a verification block; every phase that touches shared scaffolding ends with an Airtable smoke check.

**Branch:** `autumn/byos-drive-clean` (already created off `main`).

**Hard constraints (re-read before every commit):**
- Zero edits to `apps/web/src/lib/airtable/**` or `apps/web/src/pages/api/connections/airtable/**`.
- Edits to `apps/web/src/lib/integrations.ts` and `apps/web/src/stores/connections.ts` are **additive only** (new optional fields, no removed/renamed/re-typed fields).
- No "shared OAuth utils" between Airtable and Drive. Mirror by copy.
- Do NOT pull from `autumn/backup-fix-local`. Reference its commits only via `git show`.

---

## Phase A — Schema (web canonical + engine mirror)

- [ ] A.1 Write [apps/web/drizzle/0009_storage_destinations.sql](../../../apps/web/drizzle/) matching [Master_DB_Schema §322](../../../shared/Master_DB_Schema.md) — table only, no seed data. `destination_type CHECK ('google_drive')` for now. `status CHECK ('active', 'invalid', 'pending_auth')`. `UNIQUE (space_id)`. FK to `spaces` ON DELETE CASCADE.
- [ ] A.2 Write [apps/web/drizzle/0010_oauth_states.sql](../../../apps/web/drizzle/) — `state PK`, `space_id FK CASCADE`, `code_verifier_enc text NOT NULL`, `created_at timestamptz DEFAULT now()`, index on `created_at`.
- [ ] A.3 Run `pnpm --filter @baseout/web db:generate` to regenerate drizzle meta + snapshots + journal; commit alongside the two SQL files.
- [ ] A.4 Run `pnpm --filter @baseout/web db:migrate` against the local Postgres (per [memory feedback-schema-migrate-before-ship](../../../../.claude/projects/-Users-autumnshakespeare-baseout/memory/feedback_schema_migrate_before_ship.md)).
- [ ] A.5 Add the table definitions to [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/) (or split into `storage-destinations.ts` if `core.ts` is getting unwieldy — additive-only edit either way).
- [ ] A.6 Write [apps/server/src/db/schema/storage-destinations.ts](../../../apps/server/src/db/schema/) — engine mirror with header comment `// Canonical source: apps/web/drizzle/0009_storage_destinations.sql`. Register in [apps/server/src/db/schema/index.ts](../../../apps/server/src/db/schema/).
- [ ] A.7 Add `GOOGLE_DRIVE_OAUTH_CLIENT_ID` and `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET` to [apps/web/.env.example](../../../apps/web/.env.example) with comments documenting the registered redirect URIs.

**Verification — Phase A:**
- [ ] `pnpm --filter @baseout/web typecheck` — 0 errors.
- [ ] `pnpm --filter @baseout/web db:check` — schema-in-sync.
- [ ] `pnpm --filter @baseout/server typecheck` — 0 errors.
- [ ] `psql -d baseout -c "\d storage_destinations"` — table present with all columns.
- [ ] `psql -d baseout -c "\d oauth_states"` — table present.

**Airtable smoke — Phase A:**
- [ ] N/A — Phase A is schema-only and touches no Airtable surface.

---

## Phase B — Storage interface (engine)

- [ ] B.1 Write [apps/server/src/lib/storage/storage-writer.ts](../../../apps/server/src/lib/storage/) — `StorageWriter` interface with methods `init(): Promise<void>`, `writeFile(stream: ReadableStream, path: string): Promise<void>`, `getDownloadUrl(path: string): Promise<string>`, `delete(path: string): Promise<void>`, `deletePrefix(prefix: string): Promise<void>`. Also export `StorageWriterError` (discriminated union for `invalid_path | auth_failed | network | not_found | unknown`).
- [ ] B.2 Add `resolveStorageWriter(type: StorageType, creds?: StorageCredentials): StorageWriter` factory. Drive support comes in Phase E; this change makes the factory dispatch type only (no Drive strategy yet). Falls back to throwing `unsupported_storage_type` for any non-`local_fs` value until Phase E lands the Drive case.
- [ ] B.3 Write [apps/server/tests/integration/storage/storage-writer.test.ts](../../../apps/server/tests/integration/) — covers the factory's `local_fs` dispatch and the `unsupported_storage_type` failure for `google_drive` at this phase.

**Verification — Phase B:**
- [ ] `pnpm --filter @baseout/server typecheck` — 0 errors.
- [ ] `pnpm --filter @baseout/server test storage-writer` — green.

**Airtable smoke — Phase B:**
- [ ] N/A — engine-only scaffolding.

---

## Phase C — Web OAuth Connect flow

### C.1 — Google Drive lib (new module, no shared code with Airtable)

- [ ] C.1.1 Write [apps/web/src/lib/google-drive/config.ts](../../../apps/web/src/lib/google-drive/) — exports `getGoogleDriveConfig(env)` returning `{ clientId, clientSecret, redirectUri, scopes, authorizeUrl, tokenUrl, userinfoUrl, driveApiUrl }`. Scopes: `['profile', 'https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.appdata']`. Auth/token/userinfo URLs are constants. **Do not** import from `apps/web/src/lib/airtable/`.
- [ ] C.1.2 Write [apps/web/src/lib/google-drive/oauth.ts](../../../apps/web/src/lib/google-drive/) — `generatePkce()`, `buildAuthorizeUrl(...)`, `exchangeCodeForTokens(...)`, `refreshAccessToken(...)`. PKCE S256.
- [ ] C.1.3 Write [apps/web/src/lib/google-drive/oauth.test.ts](../../../apps/web/src/lib/google-drive/) — covers PKCE generation, authorize URL shape (asserts all required query params + scopes), token exchange against MSW-mocked endpoint, refresh-token-omitted edge case.
- [ ] C.1.4 Write [apps/web/src/lib/google-drive/cookie.ts](../../../apps/web/src/lib/google-drive/) — `sealHandoffCookie(payload, env)`, `openHandoffCookie(cookie, env)`. AES-256-GCM via [apps/web/src/lib/crypto.ts](../../../apps/web/src/lib/crypto.ts). **Copy the pattern from [apps/web/src/lib/airtable/cookie.ts](../../../apps/web/src/lib/airtable/cookie.ts) by reading + retyping — do not import from it.**
- [ ] C.1.5 Write [apps/web/src/lib/google-drive/cookie.test.ts](../../../apps/web/src/lib/google-drive/) — round-trip + tamper-detection.
- [ ] C.1.6 Write [apps/web/src/lib/google-drive/client.ts](../../../apps/web/src/lib/google-drive/) — `getUserinfo(accessToken)`, `createFolder(accessToken, name, parentId)`, `findFolderByName(accessToken, name, parentId)`.
- [ ] C.1.7 Write [apps/web/src/lib/google-drive/client.test.ts](../../../apps/web/src/lib/google-drive/) — covers each method against MSW-mocked Drive API.
- [ ] C.1.8 Write [apps/web/src/lib/google-drive/persist.ts](../../../apps/web/src/lib/google-drive/) — `upsertStorageDestination({ spaceId, type, tokens, config, env, db })`. Encrypts tokens before insert. **Preserves existing `refresh_token_enc` when the callback response has no `refresh_token`** (Google's re-consent quirk). Also `getStorageDestination(db, spaceId)` and `deleteStorageDestination(db, spaceId)`.
- [ ] C.1.9 Write [apps/web/src/lib/google-drive/persist.test.ts](../../../apps/web/src/lib/google-drive/) — covers upsert, refresh-token preservation, delete.

### C.2 — Routes

- [ ] C.2.1 Write [apps/web/src/pages/api/connections/storage/google-drive/authorize.ts](../../../apps/web/src/pages/api/connections/storage/google-drive/) — `POST` handler. Requires session. Generates PKCE state, seals cookie, also inserts an `oauth_states` row (defense-in-depth fallback), responds with a 303 redirect to Google's authorize URL.
- [ ] C.2.2 Write [apps/web/src/pages/oauth/callback/google.ts](../../../apps/web/src/pages/oauth/callback/) — `GET` handler. Reads sealed cookie or falls back to `oauth_states`. Validates state. Exchanges code. Fetches userinfo. Creates Drive folder. Upserts `storage_destinations`. Redirects to `/integrations?connected=google_drive` (or `?error=<reason>` on failure).
- [ ] C.2.3 Write [apps/web/src/pages/api/connections/storage/google-drive/disconnect.ts](../../../apps/web/src/pages/api/connections/storage/google-drive/) — `POST` handler. Deletes the row. (Does NOT delete the Drive folder.)
- [ ] C.2.4 Write tests for each route in `<filename>.test.ts` — covers happy path, missing/expired state, Google `?error=access_denied`, token-exchange failure, folder-create failure.

### C.3 — UI: StoragePicker

- [ ] C.3.1 Edit [apps/web/src/components/backups/StoragePicker.astro](../../../apps/web/src/components/backups/) — add a Google Drive option. When no row exists, show "Connect Google Drive" button posting to `/api/connections/storage/google-drive/authorize`. When row exists and `status='active'`, show "Connected as <email>" + folder name + Disconnect button. When `status='pending_auth'`, show "Re-connect Google Drive".
- [ ] C.3.2 All buttons use `setButtonLoading` from [apps/web/src/lib/ui.ts](../../../apps/web/src/lib/ui.ts) (per CLAUDE.md §4.5).

### C.4 — IntegrationsState + store (additive only)

- [ ] C.4.1 Edit [apps/web/src/lib/integrations.ts](../../../apps/web/src/lib/) — extend `IntegrationsState` with optional `googleDriveConnected?: boolean` + `googleDriveAccountEmail?: string | null` + `googleDriveFolderName?: string | null`. `getIntegrationsState(...)` reads the `storage_destinations` row and populates them. **Do not modify any existing field.**
- [ ] C.4.2 Edit [apps/web/src/stores/connections.ts](../../../apps/web/src/stores/) — surface the new fields. **Do not touch any existing atom.**
- [ ] C.4.3 Write/extend [apps/web/src/lib/integrations.test.ts](../../../apps/web/src/lib/) — covers Drive-row → state, no-Drive-row → state, Drive in `pending_auth` → state.

**Verification — Phase C:**
- [ ] `pnpm --filter @baseout/web typecheck` — 0 errors.
- [ ] `pnpm --filter @baseout/web build` — clean.
- [ ] `pnpm --filter @baseout/web test` — all new tests green; full suite green.
- [ ] No `console.*` or `debugger` in the diff (CLAUDE.md §3.5): `git diff --cached | grep -E '^\+.*console\.' && exit 1 || true`.
- [ ] grep the diff for path containing `airtable` — every match is `e2e-pending-airtable-bases` or `Baseout_Features.md`; **zero matches under `apps/web/src/lib/airtable/` or `apps/web/src/pages/api/connections/airtable/`**.

**Airtable smoke — Phase C** (mandatory; this phase touches `stores/connections.ts` and `integrations.ts`):
- [ ] Run dev server and pgsql locally: `pnpm --filter @baseout/web dev`.
- [ ] `/integrations` loads; existing Airtable Connections (if any in dev DB) listed unchanged.
- [ ] Click Connect Airtable → grant → Connection persists, listed on `/integrations` afterward.
- [ ] If a Connection exists with an expired token, trigger Airtable token refresh (or wait until next backup attempt) and confirm it still works.
- [ ] If ANY of the above fails, the phase is **not done**. Root-cause before continuing.

### C.5 — Operator smoke (Connect happy path)

- [ ] C.5.1 Apply migrations + run `pnpm --filter @baseout/web dev`. Confirm `apps/web/.dev.vars` has `GOOGLE_DRIVE_OAUTH_CLIENT_ID` and `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET` populated.
- [ ] C.5.2 Navigate to `/integrations` → click Connect Google Drive → grant on Google consent screen.
- [ ] C.5.3 Confirm browser lands on `/integrations?connected=google_drive`.
- [ ] C.5.4 `psql -d baseout -c "SELECT space_id, destination_type, status, config_json FROM storage_destinations"` — one row, `status='active'`, `config_json.folder_id` and `config_json.account_email` populated.
- [ ] C.5.5 Open `https://drive.google.com` in browser → confirm `Baseout-<spaceId>/` folder exists at My Drive root.

**End of Phase C — STOP and report to user for human-tested approval before continuing to Phase D** (per [memory feedback-no-prs-human-test-then-local-commit](../../../../.claude/projects/-Users-autumnshakespeare-baseout/memory/feedback_no_prs_human_test_then_local_commit.md)). On approval, commit Phase C locally. No PR, no push.

---

## Phase D — Engine credential route

- [ ] D.1 Write [apps/server/src/lib/storage/refresh-drive.ts](../../../apps/server/src/lib/storage/) — exports `refreshDriveToken({ refreshToken, env })` returning `Promise<DriveRefreshOutcome>` discriminated union (`success | pending_reauth | transient | invalid`).
- [ ] D.2 Write [apps/server/tests/unit/refresh-drive.test.ts](../../../apps/server/tests/) — covers each outcome (200 success, 400 `invalid_grant`, 500 transient, malformed response).
- [ ] D.3 Write [apps/server/src/pages/api/internal/spaces/[spaceId]/storage-destination.ts](../../../apps/server/src/pages/api/internal/spaces/) — `GET` handler. `x-internal-token` gate. Looks up the destination row. If `expires_at - 5min < now` OR `?refresh=1`: refresh, persist new tokens, return refreshed values. Else return current. **Never** return refresh token.
- [ ] D.4 Write [apps/server/tests/integration/storage-destination-route.test.ts](../../../apps/server/tests/integration/) — covers `INTERNAL_TOKEN` gate (401 missing/wrong), 404 no destination, 200 fresh-token path, 200 refresh path, 409 pending_reauth, 503 transient, 502 invalid.

**Verification — Phase D:**
- [ ] `pnpm --filter @baseout/server typecheck` — 0 errors.
- [ ] `pnpm --filter @baseout/server test` — full suite green.

**Airtable smoke — Phase D:**
- [ ] N/A — engine route is INTERNAL_TOKEN-gated and has no Airtable touch points.

**End of Phase D — STOP and report to user for approval. On approval, commit locally.**

---

## Phase E — Workflows writer

- [ ] E.1 Write [apps/workflows/trigger/tasks/\_lib/storage-writers/google-drive.ts](../../../apps/workflows/trigger/tasks/_lib/storage-writers/) — implements `StorageWriter`. Resumable upload, sub-folder cache, proactive 5-min refresh + reactive once-only 401 retry, path-traversal guard, idempotent `deletePrefix`.
- [ ] E.2 Write [apps/workflows/tests/storage-writers/google-drive.test.ts](../../../apps/workflows/tests/) — covers resumable upload (POST + PUT), traversal-rejected, 401-retry-once, deletePrefix idempotent.
- [ ] E.3 Write [apps/workflows/trigger/tasks/\_lib/storage-writers/index.ts](../../../apps/workflows/trigger/tasks/_lib/storage-writers/) — `resolveStorageWriter(type, creds?)` factory. Drive branch added.
- [ ] E.4 Edit [apps/workflows/trigger/tasks/backup-base.task.ts](../../../apps/workflows/trigger/tasks/) — when `payload.storageType === 'google_drive'`, fetch creds from engine internal route; instantiate `GoogleDriveWriter` with the creds + a `refresh()` closure that re-hits the route with `?refresh=1`. Pass the writer to the rest of the run.
- [ ] E.5 Update [apps/workflows/tests/backup-base-task.test.ts](../../../apps/workflows/tests/) and [apps/workflows/tests/backup-base-task-cancel.test.ts](../../../apps/workflows/tests/) — extend fixtures with `storageType: 'google_drive'`; mock engine credential route.
- [ ] E.6 Edit [apps/web/src/lib/backup-config/persist-policy.ts](../../../apps/web/src/lib/backup-config/) — widen accept-list to `{'local_fs', 'google_drive'}`.
- [ ] E.7 Extend [apps/web/src/lib/backup-config/persist-policy.test.ts](../../../apps/web/src/lib/backup-config/) — covers Drive accepted, unknown rejected.
- [ ] E.8 Edit [apps/server/src/lib/storage/storage-writer.ts](../../../apps/server/src/lib/storage/) — factory's Drive branch (mirror of workflows factory; both factories exist because the engine doesn't run backups, but the type is shared).
- [ ] E.9 If `apps/server/src/lib/runs/start.ts` needs to thread `storageType` into the Trigger.dev payload, update it additively. Confirm the run-enqueue contract from [baseout-web-run-now-contract](../baseout-web-run-now-contract/) is satisfied.

**Verification — Phase E:**
- [ ] `pnpm --filter @baseout/web typecheck` && `pnpm --filter @baseout/server typecheck` && `pnpm --filter @baseout/workflows typecheck` — all green.
- [ ] `pnpm --filter @baseout/web build` — clean.
- [ ] `pnpm --filter @baseout/web test` && `pnpm --filter @baseout/server test` && `pnpm --filter @baseout/workflows test` — all green.
- [ ] No `console.*` or `debugger` in the diff.

**Airtable smoke — Phase E** (mandatory; this phase touches `persist-policy.ts` which is shared with Airtable):
- [ ] Run dev: `pnpm --filter @baseout/web dev` + `pnpm --filter @baseout/workflows trigger:dev` + the engine if needed.
- [ ] `/integrations` loads; Airtable Connections still listed.
- [ ] Connect a fresh Airtable Connection (or trigger refresh on an existing one) — succeeds end-to-end.
- [ ] Trigger a backup configured for `local_fs` — completes; files land in `apps/server/.backups/` per [memory project-backups-mvp-plan](../../../../.claude/projects/-Users-autumnshakespeare-baseout/memory/project_backups_mvp_plan.md).
- [ ] If ANY of the above fails, the phase is **not done**. Root-cause before continuing.

### E.10 — Drive end-to-end smoke (operator)

- [ ] E.10.1 Backup-config UI: switch the Space's storage destination to Drive (`storage_type='google_drive'`).
- [ ] E.10.2 Trigger a backup run from `/backups`.
- [ ] E.10.3 Watch Trigger.dev dashboard: task picks up, calls engine credential route, instantiates Drive writer.
- [ ] E.10.4 Open Google Drive in browser → confirm CSV files appear under `Baseout-<spaceId>/runs/<runId>/`.
- [ ] E.10.5 `psql -d baseout -c "SELECT id, status, ended_at, storage_destination_id FROM backup_runs ORDER BY started_at DESC LIMIT 1"` — `status='completed'`.
- [ ] E.10.6 Force a token-refresh path: `UPDATE storage_destinations SET token_expires_at = now() WHERE space_id = '<test>';` then trigger another backup. Confirm refresh path executes (logs show 1 refresh call) and run completes.
- [ ] E.10.7 Re-Connect Drive without revoking first: confirm `refresh_token_enc` is preserved (the persist.ts test covers this; smoke confirms in real Drive).

**End of Phase E — STOP and report to user for approval. On approval, commit locally. NO PRs, NO push.**

---

## Out of scope

- **Folder picker UI** — user picking a Drive folder other than `Baseout-<spaceId>`. Future change.
- **Drive watch / push notifications** — for live mirror. V2.
- **Multi-destination per Space** — `UNIQUE (space_id)` stays for V1. Future change relaxes it.
- **Tier gating** — Drive is "All tiers" per Features §6.6. No `enforceCapability` call needed.
- **Other BYOS providers** — Dropbox, Box, OneDrive, S3, Frame.io each ship as their own change after this one lands.
- **R2 managed storage** — paused; out of this change.
- **Cron purge for `oauth_states`** — defer; sealed cookie is primary, table is rarely written.

## Reverse refs (lat.md)

After this change archives, add a `// @lat: [[byos-google-drive#section-id]]` reverse-ref at the top of each load-bearing new file per [CLAUDE.md §3.7](../../../CLAUDE.md), and update the appropriate `apps/<app>/lat.md/` sections.
