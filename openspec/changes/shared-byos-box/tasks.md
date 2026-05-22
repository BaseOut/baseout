# Implementation tasks

Cross-app slice. Phase ordering is load-bearing: G → A → B → C → D → E (no-op) → W → H. The cross-cutting design is inherited from [`shared-byos-drive-dropbox`](../shared-byos-drive-dropbox/design.md); only Box-specific work appears below.

## Pre-implementation gate

Must complete before any Phase C task starts. Owner: boss (Box Developer Console actions). Capture status here as items get unblocked.

- [ ] G.1 Register redirect URIs in Box Developer Console → App → Configuration → OAuth 2.0 Redirect URIs (exact-match strings):
  - `http://localhost:4321/api/connections/storage/box/callback`
  - `https://staging.baseout.app/api/connections/storage/box/callback` *(confirm staging host)*
  - `https://app.baseout.app/api/connections/storage/box/callback` *(confirm production host)*
- [ ] G.2 Confirm Application Scope `root_readwrite` is enabled on the app (App → Configuration → Application Scopes).
- [ ] G.3 Confirm app type is "Standard OAuth 2.0 (User Authentication)" — not "Server Authentication (JWT)" or "Custom App".
- [ ] G.4 Confirm the Client ID + Client Secret already in hand are for the production app environment. If sandbox-only, walk App → Authorization → Review and Submit to get Box Admin approval before smoke.
- [ ] G.5 Confirm the test Box account has >10 GB of storage available (free dev accounts cap at 10 GB enterprise-wide; multi-GB Airtable attachments exhaust the cap fast). Bump quota or use a paid Box account if needed.
- [ ] G.6 Capture rotated secrets (if rotated post-handoff) in `apps/web/.dev.vars` (local) and Cloudflare Secrets (deployed) per [CLAUDE.md §3.3](../../../CLAUDE.md). Never commit to `wrangler.jsonc`.

## Phase A — Schema widening

### A.1 — Master DB migrations (web side, canonical)

- [x] A.1.1 + A.1.2 Generated as a single combined migration [apps/web/drizzle/0013_shared_byos_box_widen_checks.sql](../../../apps/web/drizzle/0013_shared_byos_box_widen_checks.sql) — drizzle-kit collapsed both CHECK ALTERs into one file (cleaner than two). Contains the four `ALTER TABLE` statements (drop + add for both `storage_destinations.type` and `oauth_states.provider`).
- [x] A.1.3 Widen Drizzle enums in [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts): `storageDestinations.type` adds `'box'`, `oauthStates.provider` adds `'box'`. Header comment dropped `box` from the "future providers" list.
- [x] A.1.4 Applied via `pnpm --filter @baseout/web db:migrate` — two harmless `42P06` / `42P07` NOTICEs (drizzle bookkeeping schema/table already existed); ALTER TABLEs succeeded.
- [x] A.1.5 `pnpm --filter @baseout/web db:check` — exit 0 silent (in-sync).

### A.2 — Engine mirror (server side)

- [x] A.2.1 Update the inline-comment-listed union in [apps/server/src/db/schema/storage-destinations.ts](../../../apps/server/src/db/schema/storage-destinations.ts) to include `'box'`. (Mirror file uses plain `text("type")`; the values list is documentation only — the CHECK lives in the canonical migration.)
- [x] A.2.2 Extend `StorageDestinationType` in [apps/server/src/lib/storage/storage-writer.ts](../../../apps/server/src/lib/storage/storage-writer.ts) to add `'box'`. Add a placeholder `case 'box':` branch to `makeStorageWriter` that throws "lands in Phase C.s of shared-byos-box" — matches the placeholder shape already used for `google_drive` / `dropbox`. Phase C.s replaces the throw with real instantiation.
- [x] A.2.3 `pnpm --filter @baseout/server typecheck` green.

## Phase B — Capability resolver widening (web side)

- [ ] B.1 TDD red: extend `apps/web/tests/unit/billing/capabilities.test.ts` — every MVP tier (Trial, Starter, Launch, Growth, Pro, Business, Enterprise) now includes `'box'` in `allowedTypes`.
- [ ] B.2 Update [apps/web/src/lib/billing/capabilities.ts](../../../apps/web/src/lib/billing/capabilities.ts) `resolveStorageDestinations(tier)` to add `'box'` to every tier's `allowedTypes`. Matches Drive + Dropbox tier-gating per [Features §4.4](../../../shared/Baseout_Features.md).
- [ ] B.3 Tests green.

## Phase C — Web OAuth Connect (web side)

**Pre-req: G.1–G.6 complete.**

### C.1 — Config + env vars

- [ ] C.1.1 Add `BOX_OAUTH_CLIENT_ID=` + `BOX_OAUTH_CLIENT_SECRET=` (empty, documented) to `apps/web/.dev.vars.example`. User sets local values in their gitignored `.dev.vars`.
- [ ] C.1.2 New file `apps/web/src/lib/box/config.ts`. Reads client ID/secret from `env`; exports `getClientCredentials`, `scopes` constant `["root_readwrite"]` with inline `// Why root_readwrite:` comment pointing at [design.md "Box OAuth scope"](./design.md), `buildRedirectUri` helper, and the Box endpoint constants:
  - `AUTHORIZE_URL = "https://account.box.com/api/oauth2/authorize"`
  - `TOKEN_URL = "https://api.box.com/oauth2/token"`
  - `API_BASE = "https://api.box.com/2.0"`
  - `UPLOAD_BASE = "https://upload.box.com/api/2.0"`

### C.2 — OAuth + client modules

- [ ] C.2.1 TDD red: `apps/web/tests/unit/oauth/box-authorize.test.ts` — asserts the authorize handler (a) generates state + PKCE pair via shared `lib/oauth/pkce`, (b) seals handoff cookie via shared `lib/oauth/cookie` + persists `oauth_states` row with `provider='box'`, (c) redirects to `https://account.box.com/api/oauth2/authorize?...` with `response_type=code`, `client_id`, `redirect_uri`, `state`, `code_challenge`, `code_challenge_method=S256`.
- [ ] C.2.2 TDD red: `apps/web/tests/unit/oauth/box-callback.test.ts` — cases: state mismatch (cookie + DB both) returns 400 with friendly redirect; code-exchange success → encrypted persistence (`oauth_access_token_enc`, `oauth_refresh_token_enc`, `oauth_expires_at`, `oauth_account_email`, `provider_folder_id`); folder-create returns 409 `item_name_in_use` → extracts the existing folder ID from the error body and persists it; code-exchange failure (provider returns 400) → friendly redirect.
- [ ] C.2.3 New file `apps/web/src/lib/box/oauth.ts`. Consumes shared `apps/web/src/lib/oauth/{pkce,cookie,exchange}` helpers. Exports `buildAuthorizeUrl({ state, codeChallenge, spaceId })`, `exchangeCodeForTokens(code, verifier)`, `refreshAccessToken(refreshToken)` — the refresh helper returns *both* the new access token AND the new refresh token (Box rotates them; see [design.md "Refresh-token rotation"](./design.md)).
- [ ] C.2.4 New file `apps/web/src/lib/box/client.ts`. Wrappers around the Box API:
  - `usersMe(accessToken)` → returns `{ id, name, login (email) }` for display.
  - `foldersCreate(accessToken, { name, parentId })` → returns `{ id }`. On HTTP 409 with `item_name_in_use`, extract the existing folder ID from the response body's `context_info.conflicts[0].id` and return that (no-throw). Other 4xx/5xx bubble.
- [ ] C.2.5 New file `apps/web/src/lib/box/persist.ts`. Encrypts access + refresh tokens via the shared encryption helper. UPSERTs `storage_destinations` row with `type='box'`, `oauth_account_email`, `provider_account_id` (the Box user id), `provider_folder_id` (the newly-created or pre-existing folder ID).
- [ ] C.2.6 New routes `apps/web/src/pages/api/connections/storage/box/authorize.ts` and `.../callback.ts`. Delegate to the modules above. Authorize handler reads `spaceId` from query, gates on authenticated user + Space membership, seals state, redirects. Callback handler validates state (cookie primary, `oauth_states` row defense-in-depth), exchanges code, fetches user info, creates/finds the per-Space folder, persists, redirects to `/integrations?connected=box`. On any failure, redirects to `/integrations?error=box&reason=<short>`.
- [ ] C.2.7 Tests green.

### C.s — Server-side strategy

- [ ] C.s.1 TDD red: `apps/server/tests/integration/storage/box.test.ts`. Mock Box API via msw. Cover:
  - `init` (token refresh if `oauth_expires_at < now + 5min`; assert the new refresh token gets persisted).
  - `writeFile` simple upload (size <20 MB) — assert multipart body has `attributes` part **before** `file` part (regression guard for the documented Box quirk).
  - `writeFile` chunked upload (size ≥20 MB) — three-step session, parts uploaded with `Content-Range` + `Digest: sha=<base64-sha1>` headers, commit body includes `parts[]` with `{part_id, offset, size, sha1}`.
  - Chunked upload with one part returning 429 + `Retry-After: 2` → backoff respected → retry succeeds.
  - 401 on a write → refresh-and-retry once → success on retry; failure on second 401 surfaces a typed error.
  - 5xx on a write → exponential backoff capped at 3 attempts.
  - `getDownloadUrl` returns a stub URL (restore is out of MVP scope — match the Dropbox writer's stub behavior).
  - `delete(path)` issues `DELETE /files/:id` (after a `GET /folders/:id/items` to resolve path → file ID, since Box has no path-based delete).
- [ ] C.s.2 New file `apps/server/src/lib/storage/strategies/box.ts`. Implements `StorageWriter` with `proxyStreamMode = true`. Constructor takes `{ accessToken, refreshToken, expiresAt, rootFolderId, providerAccountId, refreshClient }`. Internal helper `_uploadSimple` for files <20 MB; `_uploadChunked` for files ≥20 MB; `_refreshIfExpiring` for the lazy + on-401 refresh that persists rotated refresh tokens.
- [ ] C.s.3 Add `case 'box':` branch to `makeStorageWriter` in [apps/server/src/lib/storage/storage-writer.ts](../../../apps/server/src/lib/storage/storage-writer.ts) (factory at line 81).
- [ ] C.s.4 Tests green.

## Phase D — StoragePicker UI (web side)

- [ ] D.1 Update [apps/web/src/components/backups/StoragePicker.astro](../../../apps/web/src/components/backups/StoragePicker.astro). Change the Box card from `enabled: false` to `enabled: tier-allowed`. Replace "Coming soon" copy with Connect prompts matching the Drive + Dropbox cards.
- [ ] D.2 Each Box card state:
  - No `storage_destinations` row → render "Connect Box" button (anchor to `/api/connections/storage/box/authorize?spaceId=<uuid>`).
  - Row exists → render `Connected as <oauth_account_email> · Disconnect`. The existing `DELETE /api/spaces/:id/storage-destination` route (added by `shared-byos-drive-dropbox` Phase D.4) handles disconnect without modification.
- [ ] D.3 Drive the rendered StoragePicker through Playwright MCP per [web-ai-verify](../web-ai-verify/proposal.md). Assert: Box card renders enabled for a Launch-tier seeded org; clicking Connect for Box redirects to `account.box.com/api/oauth2/authorize?...`; mocked callback completes and the card updates to the Connected state.

## Phase E — Engine internal route (server side)

The route itself was built by `shared-byos-drive-dropbox` Phase E.1. Box adds:

- [ ] E.1 Inside the token-refresh helper consumed by `POST /api/internal/spaces/:id/storage-destination`, add a `case 'box':` branch that calls `POST https://api.box.com/oauth2/token` with `grant_type=refresh_token` and **persists both the new access token AND the new refresh token** to `storage_destinations` under transactional lock. The Drive/Dropbox branches only persist the new access token; the new shared interface must accept an optional `newRefreshToken` field that providers populate when they rotate.
- [ ] E.2 Extend the existing route test (`apps/server/tests/integration/spaces/storage-destination-route.test.ts`) with two Box cases: (a) non-expired Box destination returns the stored tokens unchanged; (b) Box destination with `oauth_expires_at < now + 5min` triggers refresh, the response carries the new access token, the `storage_destinations` row has a different encrypted refresh token afterwards, and a second call with the *original* refresh token (via msw seam) returns 401.
- [ ] E.3 Tests green.

## Workflows — writer + task wiring

### W.1 — Workflows-side Box writer

- [ ] W.1.1 TDD red: `apps/workflows/tests/storage-writers/box.test.ts`. Mirrors the per-strategy unit suite from Phase C.s but against the workflows-side writer (pure HTTP, no Worker binding). Same coverage: simple-vs-chunked dispatch on size, attributes-before-file ordering for simple uploads, three-step session correctness, 429 + `Retry-After` honor, 401-refresh-retry, refresh-token rotation persistence (via the engine's internal route — the writer calls back to the engine to persist the rotated token rather than holding a DB connection itself).
- [ ] W.1.2 New file `apps/workflows/trigger/tasks/_lib/storage-writers/box.ts`. Pure-HTTP implementation. Mirrors `apps/server/src/lib/storage/strategies/box.ts` but uses the workflows-side `StorageWriter` interface from `_lib/storage-writers/types.ts`. Shares the retry helper — if Box is the second call site needing retry-on-429-with-Retry-After, lift it into `_lib/storage-writers/_retry.ts` per [CLAUDE.md §3.2](../../../CLAUDE.md) "extract on the second call site"; otherwise inline.
- [ ] W.1.3 Add `case 'box':` branch to `makeStorageWriter` in [apps/workflows/trigger/tasks/_lib/storage-writers/index.ts](../../../apps/workflows/trigger/tasks/_lib/storage-writers/index.ts).
- [ ] W.1.4 Tests green.

### W.2 — `backup-base.task.ts` extension

No change to the task body — the existing `makeStorageWriter(destination)` dispatch already handles a new `case`. Verify with:

- [ ] W.2.1 Extend `apps/workflows/tests/backup-base-task.test.ts` with a seeded `'box'` `storage_destinations` row (via the engine internal-route mock). Assert the task instantiates `BoxStorageWriter` and the `init → writeFile per table → cleanup` lifecycle fires.

## Phase H — End-to-end smoke + close-out

- [ ] H.1 `pnpm --filter @baseout/server typecheck && pnpm --filter @baseout/server test` green.
- [ ] H.2 `pnpm --filter @baseout/web typecheck && pnpm --filter @baseout/web test:unit` green. Playwright AI verification pass on `/integrations` covers the new Box connect card.
- [ ] H.3 `pnpm --filter @baseout/workflows typecheck && pnpm --filter @baseout/workflows test` green.
- [ ] H.4 Human checkpoint — local-engine prerequisites:
  - `pnpm --filter @baseout/web db:check` passes (Phase A.1.5 migration is applied locally) — per the [migrate-before-ship feedback memory](../../../../.claude/projects/-Users-autumnshakespeare-baseout/memory/feedback_schema_migrate_before_ship.md).
  - Trigger.dev local worker is running per the [Trigger env-setup memory](../../../../.claude/projects/-Users-autumnshakespeare-baseout/memory/project_trigger_dev_env_setup.md): `pnpm --filter @baseout/workflows trigger:dev`. Confirm dashboard env vars `BACKUP_ENGINE_URL` + `INTERNAL_TOKEN` are set in the Trigger.dev `development` environment.
  - For engine smoke, `apps/web` runs locally with `--remote` to bind to the deployed engine per the [remote-mode memory](../../../../.claude/projects/-Users-autumnshakespeare-baseout/memory/project_apps_web_remote_mode.md); deploy the engine before driving through web local.
- [ ] H.5 Human checkpoint smoke — Box:
  - User connects a real dev Box account on `/integrations` → consent screen → callback → green status; `storage_destinations` row has `type='box'`, populated `oauth_account_email`, `provider_folder_id`, `provider_account_id`.
  - User binds the Space's destination to Box (StoragePicker pick).
  - User triggers a backup of a small Airtable base (< 20 MB total CSV; exercises the simple-upload path).
  - User verifies: `backup_runs` row succeeds; CSVs land in the auto-created `Baseout-<spaceId>` Box folder; row count matches the Airtable base.
- [ ] H.6 Human checkpoint smoke — chunked-upload path:
  - User triggers a backup of an Airtable base with one table >20 MB CSV (exercises the three-step upload-session path).
  - User verifies: the large CSV lands intact (`sha1` checksum matches between local CSV write and Box's `file_version.sha1`); part count visible in the writer's structured log.
- [ ] H.7 Human checkpoint smoke — token refresh:
  - Set the Box destination's `oauth_expires_at` to `now() - interval '1 minute'` via `psql`.
  - Re-run a backup. Verify the engine's internal route refreshes the token, the `storage_destinations` row has a different encrypted refresh token after the run, and the backup succeeds. (Box rotates refresh tokens per [design.md](./design.md).)
- [ ] H.8 Human checkpoint — destination switch:
  - With Drive + Dropbox already connected from `shared-byos-drive-dropbox`, switch the Space binding Drive → Box → Dropbox → Box. Confirm each backup writes to the currently-bound destination and no stale writes occur to the previous one.
- [ ] H.9 On approval: stage by name, commit locally, no PR, no push (per the [no-PRs / human-tested local-commit loop memory](../../../../.claude/projects/-Users-autumnshakespeare-baseout/memory/feedback_no_prs_human_test_then_local_commit.md)).
- [ ] H.10 Archive this change via `/opsx:archive shared-byos-box`. Tick OUT-1 in [`shared-byos-drive-dropbox/tasks.md`](../shared-byos-drive-dropbox/tasks.md) with a reference to the close-out commit(s). Tick the Box-specific items in the umbrella `server-byos-destinations/tasks.md` + `workflows-byos-destinations/tasks.md` (§C.4 and §1.2 Box).

## Out of this change (follow-ups, file separately)

- [ ] OUT-1 `shared-byos-onedrive` — Microsoft Graph OAuth + driveItem-ID folder + upload-session for large files. Blocked on the OneDrive Client Secret per the [byos-box-onedrive-parked memory](../../../../.claude/projects/-Users-autumnshakespeare-baseout/memory/project_byos_box_onedrive_parked.md).
- [ ] OUT-2 `shared-byos-s3` — IAM-keys form + AWS Signature v4 + multipart (Growth+ tier-gated).
- [ ] OUT-3 `shared-byos-frame-io` — Frame.io v2 API + project-scoped uploads (Growth+ tier-gated).
- [ ] OUT-4 Restore reads from Box — consumed by `server-restore-from-byos`.
- [ ] OUT-5 Cron-based proactive refresh of Box tokens — extension to `server-cron-oauth-refresh`.
- [ ] OUT-6 Rich GUI folder picker for Box — consumed by `server-byos-folder-picker`. MVP auto-creates one folder per Space.
- [ ] OUT-7 Box-side retention enforcement — consumed by `server-byos-cleanup`.
- [ ] OUT-8 Streaming-CSV refactor (cross-provider) — already named in `shared-byos-drive-dropbox` OUT-10.
