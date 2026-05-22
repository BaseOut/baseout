# Implementation tasks

Cross-app slice. Each phase that touches both `apps/web` (canonical schema) and `apps/server` (mirror) calls out the side. Phase ordering is load-bearing: 0 → A → A.3 → B → C.1 → C.3 → D → E.1 → workflows → H.

Pre-implementation gate (must complete before any Phase C task starts):

- [ ] G.1 User rotates the publicly-exposed OAuth client secrets pasted in chat (Google `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`, Box `Cyvjph7Y...`, Dropbox `10qqd68hdtyn27y`) in each provider's developer console. Capture rotated secrets in `apps/web/.dev.vars` (local) and Cloudflare Secrets (deployed) per [CLAUDE.md §3.3](../../../CLAUDE.md). Do not proceed past §C.1 until done.
- [ ] G.2 User re-registers Google OAuth redirect URI to `https://localhost:4321/api/connections/storage/google-drive/callback` in Google Cloud Console (the prior `:4331/oauth/callback/google` registration does not fit our route shape and port). Confirm the apps/web local dev URL is indeed `:4321`; if it's a custom port, capture both that port and the alternative.
- [ ] G.3 User registers Dropbox OAuth redirect URI `https://localhost:4321/api/connections/storage/dropbox/callback` in the Dropbox app console.

## Phase 0 — R2 binding restoration (DONE in commit `fbdc26e`)

- [x] 0.1 Re-add `BACKUPS_R2` binding to [apps/server/wrangler.jsonc.example](../../../apps/server/wrangler.jsonc.example) (top-level + `env.dev`) with `bucket_name: "baseout-backups-dev"`. Re-add to [apps/server/wrangler.test.jsonc](../../../apps/server/wrangler.test.jsonc) for the Miniflare test profile.
- [x] 0.2 Re-add `BACKUPS_R2: R2Bucket` to the `Env` interface in [apps/server/src/env.d.ts](../../../apps/server/src/env.d.ts). Declare `STORAGE_DEV_MODE?: "local-fs" | "r2"` (default `"local-fs"`; no read sites yet).
- [x] 0.3 Document the `STORAGE_DEV_MODE` selector + proxy pattern in [apps/server/CLAUDE.md](../../../apps/server/CLAUDE.md).
- [x] 0.4 Smoke: `pnpm --filter @baseout/server typecheck` green; `wrangler dev` boots and registers `env.BACKUPS_R2 (baseout-backups-dev) R2 Bucket local`; `/api/health` returns 200.
- [ ] 0.5 Provision production R2 bucket `baseout-backups-dev` in the Cloudflare dashboard and stash credentials in Cloudflare Secrets per [CLAUDE.md §3.3](../../../CLAUDE.md). User-side console action; not required for the MVP smoke (Drive + Dropbox don't hit this binding).

## Phase A — `storage_destinations` schema

### A.1 — Master DB migration (web side, canonical)

- [x] A.1.1 Generate `apps/web/drizzle/0010_storage_destinations.sql` per [design.md "Narrow the type CHECK constraint to MVP values"](./design.md). Columns: `id uuid PK`, `space_id uuid UNIQUE NOT NULL REFERENCES spaces(id) ON DELETE CASCADE`, `type text NOT NULL CHECK (type IN ('r2_managed','google_drive','dropbox'))`, `oauth_access_token_enc text`, `oauth_refresh_token_enc text`, `oauth_expires_at timestamptz`, `oauth_scope text`, `oauth_account_email text`, `provider_folder_id text`, `provider_account_id text`, `connected_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL`, `connected_at timestamptz DEFAULT now()`, `last_validated_at timestamptz`, `created_at timestamptz DEFAULT now()`, `modified_at timestamptz DEFAULT now()`. Index on `space_id`.
- [x] A.1.2 Add `storageDestinations` table to [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts) matching the migration. Export from the schema barrel.
- [x] A.1.3 Apply via `pnpm --filter @baseout/web db:migrate`. Verify with `psql … -c "\d baseout.storage_destinations"`.
- [x] A.1.4 Run `pnpm --filter @baseout/web db:check` — no schema drift.

### A.2 — Engine mirror (server side)

- [x] A.2.1 New file `apps/server/src/db/schema/storage-destinations.ts`. Header comment names the canonical migration: `// Canonical source: apps/web/drizzle/0010_storage_destinations.sql`. Mirror the columns exactly. Export from the schema barrel.
- [x] A.2.2 Smoke: `pnpm --filter @baseout/server typecheck` green; `pnpm --filter @baseout/server test` green.

### A.3 — `oauth_states` table (CSRF + handoff fallback)

- [x] A.3.1 Generate `apps/web/drizzle/0011_oauth_states.sql`. Columns: `id uuid PK`, `state text UNIQUE NOT NULL`, `space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE`, `user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `provider text NOT NULL CHECK (provider IN ('google_drive','dropbox'))`, `created_at timestamptz DEFAULT now()`. Index `oauth_states_created_at_idx` on `created_at` for the 10-minute expiry purge.
- [x] A.3.2 Add `oauthStates` table to `apps/web/src/db/schema/core.ts`. Export.
- [x] A.3.3 Apply migration. Verify with `psql`.

## Phase B — `StorageWriter` interface + R2 baseline (server side)

### B.1 — Interface

- [x] B.1.1 TDD red: `apps/server/tests/unit/storage/storage-writer.test.ts` (or co-located) asserting the contract — `init`, `writeFile(stream, path, mimeType?) → { destinationKey, sizeBytes }`, `getDownloadUrl(path) → string`, `delete(path) → void`, optional `proxyStreamMode: boolean`.
- [x] B.1.2 New file `apps/server/src/lib/storage/storage-writer.ts` declaring the `StorageWriter` interface and a `makeStorageWriter(dest, env, masterKey)` factory. At this phase the factory only knows `case 'r2_managed':`; Drive + Dropbox cases land in Phase C.

### B.2 — R2 managed strategy

- [x] B.2.1 TDD red: `apps/server/tests/integration/storage/r2-managed.test.ts` exercising the writer via Miniflare R2 (vitest-pool-workers). Cover `init` (no-op), `writeFile` (streams a small buffer, asserts the bucket has the key with the right contentType), `getDownloadUrl` (signed URL points at the right key + expires within ~5 min), `delete` (removes the object).
- [x] B.2.2 New file `apps/server/src/lib/storage/strategies/r2-managed.ts` per [server-byos-destinations/design.md §Phase 0](../server-byos-destinations/design.md). Constructor takes `R2Bucket`; uses `bucket.put` / `bucket.createSignedUrl` / `bucket.delete`. _MVP note: `bucket.createSignedUrl` doesn't exist on the R2 binding (workers-types v2023-07-01); `getDownloadUrl` returns a stub URL with `key` + `expires` to satisfy the StorageWriter contract. The real signed URL lands when the engine's R2 download-proxy route does (OUT-5 / OUT-9). Restore is out of MVP scope._
- [x] B.2.3 Tests green.

## Phase C.1 — Google Drive

**Pre-req: G.1 + G.2 done.**

### C.1.1 — Web OAuth Connect

- [ ] C.1.1.1 New env vars in `apps/web/.dev.vars.example` (documented but unset): `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`. User sets local values in their gitignored `.dev.vars`.
- [ ] C.1.1.2 TDD red: `apps/web/tests/unit/oauth/google-drive-authorize.test.ts`. Asserts the authorize handler (a) generates state + PKCE pair, (b) seals handoff cookie + persists oauth_states row, (c) redirects to `https://accounts.google.com/o/oauth2/v2/auth?...` with correct scopes, state, code_challenge.
- [ ] C.1.1.3 TDD red: `apps/web/tests/unit/oauth/google-drive-callback.test.ts`. Cases: state mismatch (cookie + DB both), code-exchange success → encrypted persistence, code-exchange failure (provider returns 400) → friendly redirect.
- [ ] C.1.1.4 New file `apps/web/src/lib/google-drive/config.ts`. Reads client ID/secret from `env`, exports `getClientCredentials`, scopes constant `["profile", "https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive.appdata"]`, `buildRedirectUri` helper.
- [ ] C.1.1.5 New file `apps/web/src/lib/google-drive/oauth.ts`. PKCE + state generation, `buildAuthorizeUrl()`, `exchangeCodeForTokens(code, verifier)`, `refreshAccessToken(refreshToken)`.
- [ ] C.1.1.6 New file `apps/web/src/lib/google-drive/client.ts`. Wrappers around Drive v3 — `aboutGet` (returns user email for display), `filesCreate(metadata, mediaBody?)` (used to create the per-Space folder).
- [ ] C.1.1.7 New file `apps/web/src/lib/google-drive/persist.ts`. Encrypts access + refresh tokens, UPSERTs `storage_destinations` row with `type='google_drive'`, `oauth_account_email`, `provider_folder_id` (newly-created folder ID).
- [ ] C.1.1.8 New routes: `apps/web/src/pages/api/connections/storage/google-drive/authorize.ts` (handler delegates to lib/google-drive/oauth.ts + lib/airtable/cookie.ts) and `.../callback.ts` (handler delegates to lib/google-drive/oauth.ts + lib/google-drive/client.ts + lib/google-drive/persist.ts). On callback success, redirect to `/integrations?connected=google-drive`.
- [ ] C.1.1.9 Tests green.

### C.1.2 — Server-side strategy

- [ ] C.1.2.1 TDD red: `apps/server/tests/integration/storage/google-drive.test.ts`. Mock Drive API via msw. Cover `init` (token refresh if expired), `writeFile` (resumable upload start → chunk → finalize; assert correct headers + final `fileId`), `writeFile` retry on 401 (refresh once, retry), `delete`.
- [ ] C.1.2.2 New file `apps/server/src/lib/storage/strategies/google-drive.ts`. Implements `StorageWriter`. Constructor: `{ accessToken, refreshToken, expiresAt, rootFolderId, refreshClient }`.
- [ ] C.1.2.3 Add `case 'google_drive':` branch to `makeStorageWriter`.

## Phase C.3 — Dropbox

**Pre-req: G.1 + G.3 done; C.1 green (it locks in the lib/oauth/ extraction pattern).**

### C.3.0 — Extract shared lib/oauth/ helpers

- [x] C.3.0.1 Extracted PKCE + sealed-cookie + token-exchange helpers from `apps/web/src/lib/airtable/{oauth.ts,cookie.ts}` into `apps/web/src/lib/oauth/{pkce.ts,cookie.ts,exchange.ts}`. Provider-agnostic shape — `CookieConfig` parameterises name/path, `ClientAuthMode` toggles Basic-header vs request-body client-auth, `extraParams` carries provider-specific authorize-URL knobs (Google's `access_type=offline` etc.).
- [x] C.3.0.2 Refactored Airtable + Google Drive `oauth.ts` + `cookie.ts` to thin shims that bind provider-specific config and delegate. Public API of each shim is identical so consumer files in `pages/api/connections/airtable/` and `pages/api/connections/storage/google-drive/` did not change. 6 test files / 59 tests across both providers stay green.
- [x] C.3.0.3 Two existing call sites (Airtable + Drive) + the imminent Dropbox third site justify this extraction per [CLAUDE.md §3.2](../../../CLAUDE.md) — extracted now so Dropbox's `lib/dropbox/` shim is a 3rd thin shim instead of a 3rd copy of the core logic.

### C.3.1 — Web OAuth Connect

- [x] C.3.1.1 New env vars in `apps/web/.dev.vars.example`: `DROPBOX_OAUTH_CLIENT_ID`, `DROPBOX_OAUTH_CLIENT_SECRET` — both documented with required app type (Full Dropbox) + required scopes + registered redirect URI shape.
- [x] C.3.1.2 + C.3.1.5 Wrote `apps/web/src/lib/dropbox/{cookie,oauth,client}.test.ts` covering: cookie seal/open + tamper + scoped path; PKCE generators + authorize URL shape with `token_access_type=offline`; token exchange/refresh with request-body client-auth; `users/get_current_account` quirk (no Content-Type header); `files/create_folder_v2` 409-path-conflict-folder / 409-path-conflict swallowing vs other 409s re-thrown. 3 files / 25 tests green.
- [x] C.3.1.3 New `apps/web/src/lib/dropbox/{config,cookie,oauth,client,persist}.ts`. `oauth.ts` + `cookie.ts` are thin shims over the shared `lib/oauth/*` modules (extracted in C.3.0). `client.ts` wraps `users/get_current_account` (returns `{accountId, email, displayName}`) + `ensureBaseoutFolder(spaceId)` (idempotent — swallows 409 path/conflict/folder so repeat connects don't fail). `persist.ts` mirrors the Drive equivalent: AES-256-GCM-encrypts tokens, UPSERTs `storage_destinations` with `type='dropbox'` + `provider_folder_id=/Apps/Baseout/<spaceId>` + `provider_account_id=<dropbox account_id>`.
- [x] C.3.1.4 New routes `apps/web/src/pages/api/connections/storage/dropbox/{authorize,callback}.ts`. Callback redirects to `/integrations?connected=dropbox` on success, `/integrations?error=<code>&detail=<slug>` on failure (state mismatch, token exchange failure, API call failure, persist failure). Same error-handling shape as the Drive callback.

### C.3.2 — Workflows-side strategy

Per design.md, BYOS writers live in apps/workflows (Node Trigger.dev runner, pure HTTP), NOT apps/server (which only has the Worker-side R2 binding). C.3.2's "apps/server/src/lib/storage/strategies/dropbox.ts" path in the original tasks.md was an error — the strategy belongs in workflows alongside the Drive writer landed in Step 2.

- [x] C.3.2.1 Wrote `apps/workflows/tests/storage-writers/dropbox.test.ts` — 14 tests covering small-body single-chunk path (start `close:true` + finish), large-body multi-chunk path (start `close:false` + N×append_v2 + finish with correct cursor offsets), 401 refresh-retry, 401 twice → typed auth_failed, 429 with `Retry-After` parsed to `retryAfterMs`, 5xx → transient, missing session_id / file id → unknown, init() proactive refresh, factory dispatch + missing-field validation, `proxyStreamMode === true` assertion.
- [x] C.3.2.2 New file `apps/workflows/trigger/tasks/_lib/storage-writers/dropbox.ts`. Implements `StorageWriter` with `proxyStreamMode = true`. Always uses upload-session (single code path, 8 MB chunks; close-on-start optimization shaves a round-trip for sub-chunk bodies). Same refresh-on-401 + 5xx-classify pattern as the Drive writer.
- [x] C.3.2.3 Added `case 'dropbox':` branch to `makeStorageWriter` factory in `apps/workflows/.../storage-writers/index.ts`. Rejects destinations missing `accessToken` or `providerFolderId` (which holds the `/Apps/Baseout/<spaceId>` path).

## Phase D — Capability resolver + StoragePicker UI (web side)

### D.1 — `resolveStorageDestinations`

- [ ] D.1.1 TDD red: `apps/web/tests/unit/billing/capabilities.test.ts`. For every MVP tier (Trial, Starter, Launch, Growth, Pro, Business, Enterprise), `resolveStorageDestinations(tier).allowedTypes` includes at least `'r2_managed'`, `'google_drive'`, `'dropbox'`.
- [ ] D.1.2 New `apps/web/src/lib/billing/capabilities.ts` exporting `resolveStorageDestinations(tier: TierName) → { allowedTypes: StorageDestinationType[] }`. Stripe `platform` + `tier` metadata per [Features §5.5](../../../shared/Baseout_Features.md). For MVP all tiers allow the same three types — future per-provider changes refine.

### D.2 — PATCH validation

- [ ] D.2.1 Extend `apps/web/src/pages/api/spaces/[spaceId]/backup-config.ts` so the `storageType` field is rejected unless it appears in `resolveStorageDestinations(tier).allowedTypes`.
- [ ] D.2.2 TDD red: extend the existing PATCH test file with reject cases for lower-tier `'s3'` / `'box'` / `'frame_io'` (which are out of `allowedTypes` for every MVP tier since they're not in the constraint at all).

### D.3 — StoragePicker UI

- [ ] D.3.1 Update [apps/web/src/components/backups/StoragePicker.astro](../../../apps/web/src/components/backups/StoragePicker.astro) — change Google Drive + Dropbox card `enabled: false` to `enabled: tier-allowed`. Replace "Coming soon" helper text with provider-specific connect prompts.
- [ ] D.3.2 Each Drive/Dropbox card: if no `storage_destinations` row, render a "Connect Google Drive" / "Connect Dropbox" button (anchor to `/api/connections/storage/<provider>/authorize?spaceId=<uuid>`). If a row exists, render `Connected as <oauth_account_email> · Disconnect`.
- [ ] D.3.3 Per [apps/web/.claude/CLAUDE.md §3.5 AI Verification](../../../apps/web/.claude/CLAUDE.md) — drive the rendered StoragePicker through Playwright MCP; assert all three options render correctly for a Launch-tier seeded org; assert clicking Connect for Drive redirects to Google.

### D.4 — Disconnect route

- [ ] D.4.1 TDD red: `apps/web/tests/unit/spaces/storage-destination-disconnect.test.ts`. DELETE `/api/spaces/:id/storage-destination` removes the row, returns 204; subsequent `backup-config.storageType` selection resets to `r2_managed`.
- [ ] D.4.2 New route `apps/web/src/pages/api/spaces/[spaceId]/storage-destination.ts` with DELETE handler.

## Phase E.1 — Engine internal route (server side)

- [ ] E.1.1 TDD red: `apps/server/tests/integration/spaces/storage-destination-route.test.ts`. Cases: unauthenticated → 401; valid INTERNAL_TOKEN + space with no destination → 200 with `{ type: 'r2_managed' }` (fall-back); valid + Drive destination with non-expired token → 200 with decrypted `accessToken`; valid + Drive destination with token expiring <5 min → token refresh happens server-side + the response carries the new token + the `storage_destinations` row is updated atomically.
- [ ] E.1.2 New route `apps/server/src/pages/api/internal/spaces/[spaceId]/storage-destination.ts`. POST verb (matches umbrella naming). INTERNAL_TOKEN-gated. Reads `storage_destinations` row by `space_id`; if absent, returns the synthetic `r2_managed` default. Decrypts `oauth_access_token_enc` / `oauth_refresh_token_enc` via the shared encryption key. If `oauth_expires_at < now + 5min`, refreshes via the provider's refresh endpoint, re-encrypts + persists, returns the new token. Returns `{ type, providerFolderId, providerAccountId?, accessToken?, refreshToken?, oauthExpiresAt? }`.

## Workflows — writers + task wiring

### W.1 — Workflows-side `StorageWriter` types + factory

- [x] W.1.1 New `apps/workflows/trigger/tasks/_lib/storage-writers/types.ts` declares `StorageWriter`, `StorageDestination`, `StorageDestinationType`, `RefreshClient`, `RefreshedCredentials`, `WriteResult`, `StorageWriteError`. Mirrors apps/server interface shape but takes `body: Uint8Array | string` instead of `ReadableStream` (CSVs are buffered today per design.md). Documented divergence at the top of the file.
- [x] W.1.2 New `apps/workflows/trigger/tasks/_lib/storage-writers/google-drive.ts` — `createGoogleDriveWriter()` implements the resumable-upload flow (POST session start → PUT body), proactive token refresh on init when <5 min from expiry, on-401-then-refresh-then-retry once on writeFile, typed `StorageWriteError` with kind=auth_failed/rate_limited/transient/bad_request/not_found/unknown + retry-after parsing.
- [ ] W.1.3 New `apps/workflows/trigger/tasks/_lib/storage-writers/dropbox.ts` — pure-HTTP, upload-session flow, `proxyStreamMode = true`. (Step 3 of the rolling Drive-foundations plan.)
- [x] W.1.4 New `apps/workflows/trigger/tasks/_lib/storage-writers/index.ts` exporting `makeStorageWriter(destination, { refreshClient, fetchImpl? })` factory. `google_drive` case lands; `dropbox`/`box`/`r2_managed` cases throw with messages pointing at the change that delivers them. 16 unit tests in `apps/workflows/tests/storage-writers/google-drive.test.ts` cover Drive writer + factory dispatch (full suite: 53/53 green, typecheck clean).

### W.2 — `backup-base.task.ts` wiring

- [ ] W.2.1 TDD red: extend `apps/workflows/tests/backup-base-task.test.ts` — inject a fake `StorageWriter` via the existing `writeCsv` seam (or a new `storageWriter` dep); assert lifecycle `init → writeFile per table → cleanup`. Per-destination tests under `apps/workflows/tests/storage-writers/{google-drive,dropbox}.test.ts`.
- [ ] W.2.2 Refactor `apps/workflows/trigger/tasks/backup-base.task.ts`. After loading run context, call the engine's `POST /api/internal/spaces/:id/storage-destination` to fetch the destination + access token. Pass into `makeStorageWriter(destination)`. Call `writer.init()` before the per-table loop; call `writer.writeFile(...)` per table; call `writer.cleanup()` in `finally`. The existing `writeCsv` seam (`local-fs-write.ts`) becomes the `r2_managed` proxy fallback for MVP smoke convenience (matches `STORAGE_DEV_MODE = 'local-fs'`).
- [ ] W.2.3 Tests green.

## Phase H — End-to-end smoke + close-out

- [ ] H.1 `pnpm --filter @baseout/server typecheck && pnpm --filter @baseout/server test` green.
- [ ] H.2 `pnpm --filter @baseout/web typecheck && pnpm --filter @baseout/web test:unit` green. Playwright AI verification pass (per `web-ai-verify` §3.5) on the updated `/integrations` page covers Drive + Dropbox connect cards.
- [ ] H.3 `pnpm --filter @baseout/workflows typecheck && pnpm --filter @baseout/workflows test` green.
- [ ] H.4 Human checkpoint smoke — Google Drive:
  - User connects a real dev Google account on `/integrations` (consent screen → callback → green status).
  - User binds the Space's destination to Google Drive (pick on StoragePicker).
  - User triggers a backup of a small Airtable base.
  - User verifies: `backup_runs` row succeeds; a CSV file lands in the auto-created `Baseout-<spaceId>` Drive folder; row count matches the Airtable base.
- [ ] H.5 Human checkpoint smoke — Dropbox: same flow as H.4 but Dropbox. CSV lands at `/Apps/Baseout/<spaceId>/<table>.csv`.
- [ ] H.6 Human checkpoint — destination switch: rebind from Drive to Dropbox mid-stream; confirm next backup writes to Dropbox; old Drive backup folder untouched.
- [ ] H.7 On approval: stage by name, commit locally, no PR, no push (per the project's no-PR human-test loop).
- [ ] H.8 Archive this change via `/opsx:archive shared-byos-drive-dropbox`. Update the umbrella `server-byos-destinations/tasks.md` + `workflows-byos-destinations/tasks.md` to tick the boxes for the slice landed here, with a one-line reference to commit `fbdc26e` and the close-out commits from this change. The remaining boxes (C.2, C.4, C.5, C.6, F, etc.) stay open for per-provider follow-ups.

## Out of this change (follow-ups, file separately)

- [ ] OUT-1 `server-byos-box` + `workflows-byos-box` — Box OAuth + chunked upload + `provider_folder_id` numeric Box folder ID + proxy-streaming strategy.
- [ ] OUT-2 `server-byos-onedrive` + `workflows-byos-onedrive` — Microsoft Graph OAuth + driveItem-ID folder + upload-session.
- [ ] OUT-3 `server-byos-s3` + `workflows-byos-s3` — IAM-keys form + AWS Signature v4 + multipart (Growth+ tier-gated).
- [ ] OUT-4 `server-byos-frame-io` + `workflows-byos-frame-io` — Frame.io v2 API (Growth+ tier-gated).
- [ ] OUT-5 `server-byos-r2-proxy-upload` — the engine-side proxy upload route + workflows-side wrapper so R2 backups can run from the Node Trigger.dev runner. Not strictly required for Drive + Dropbox MVP but blocks default-R2 production use.
- [ ] OUT-6 Extension to [`server-cron-oauth-refresh`](../server-cron-oauth-refresh/proposal.md) — proactive refresh of `storage_destinations.oauth_*` tokens 15 minutes before expiry.
- [ ] OUT-7 `server-byos-folder-picker` — rich GUI folder picker.
- [ ] OUT-8 `server-byos-cleanup` — optional Baseout-side retention enforcement for BYOS.
- [ ] OUT-9 `server-restore-from-byos` — restore engine support for BYOS as a source.
- [ ] OUT-10 Streaming-CSV refactor — `pageToCsv` row-by-row so very large tables don't hold the full CSV in workflows-runner memory.
