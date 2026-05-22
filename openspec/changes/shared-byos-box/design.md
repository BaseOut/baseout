## Overview

`shared-byos-drive-dropbox` locked in the cross-cutting design — `StorageWriter` interface, factory dispatch, sealed-cookie + `oauth_states` handoff, lazy-plus-on-401 token refresh, auto-folder-per-Space. This file records only what Box does **differently**. When this design and `shared-byos-drive-dropbox/design.md` disagree, this design wins for Box-specific work.

The design space here is narrow on purpose: Box is the third provider to slot into a now-stable interface. If a non-Box change appears below, that's a smell — either the interface is wrong (re-litigate in the umbrella) or this change is scope-creeping.

## Box OAuth scope: `root_readwrite`

Drive uses the narrow `drive.file` scope (only files this app creates or opens). Dropbox uses four granular scopes. Box has **no equivalent narrow scope** for OAuth 2.0 user-authentication apps: the closest available is `root_readwrite`, which grants read + write across the user's entire Box account.

Trade-off accepted because:

1. Baseout writes only to the auto-created `Baseout-<spaceId>` folder. The runtime contract never touches files outside it.
2. Box's per-app Application Scopes setting (configured in the Developer Console, not in the OAuth request) is the actual enforcement boundary. Even though our requested scope is wide, the app's configured scope set can be narrowed by the Box admin reviewing the app.
3. A more granular scope path (Box's "App Folder" pattern via service-account JWT) requires a different app type and bypasses the user-OAuth flow. That's a future migration if access-scope concerns surface, not an MVP blocker.

Document this in `apps/web/src/lib/box/config.ts` with an inline `// Why root_readwrite:` comment so the next reader doesn't try to narrow it without context.

## Chunked upload threshold = 20 MB

Drive's resumable upload kicks in at 5 MB. Dropbox's upload-session is used for all writes (single code path, 8 MB chunks). Box's chunked endpoint **rejects** files smaller than 20 MB — the API returns an error if you try to start an upload session below that threshold.

So Box's writer has a branching upload path:

- **`writeFile` for size < 20 MB** — single `POST upload.box.com/api/2.0/files/content` multipart request.
  - **Sharp edge:** the `attributes` JSON part **must** come before the `file` part in the multipart body. Reverse order returns HTTP 400 with a misleading error message. Document this in the writer with a unit test that asserts part ordering.
- **`writeFile` for size ≥ 20 MB** — three-step session:
  1. `POST /files/upload_sessions` with `folder_id`, `file_name`, `file_size` → returns `id` (session ID) + `part_size` (server-chosen, e.g. 8 MB).
  2. For each part: `PUT /files/upload_sessions/:id/parts` with `Content-Range` + `Digest: sha=<base64-sha1>` headers + the part body. Parts can run in parallel; cap concurrency to 4 (Box's enterprise rate limit is 240 file-upload calls/min/user, so ~4 concurrent stays well under).
  3. `POST /files/upload_sessions/:id/commit` with the list of `{part_id, offset, size, sha1}` from each part response + `Digest: sha=<base64-sha1-of-whole-file>`. Box verifies and finalizes.

Implementation choice: **raw `fetch`, no `box-node-sdk`**. Matches the pattern Drive and Dropbox use in `shared-byos-drive-dropbox`; no new npm dep in `apps/workflows`; easier msw mocking; smaller surface to audit. The SDK's auto-chunking convenience isn't worth the divergence.

In `apps/workflows/trigger/tasks/_lib/storage-writers/box.ts` the two paths live behind a single `writeFile(stream, path, mimeType?)` method that buffers the CSV (CSVs are already buffered today by `pageToCsv` — see `shared-byos-drive-dropbox/proposal.md` Out of Scope item on streaming) and dispatches on `buffer.byteLength`.

## Refresh-token rotation is single-use

Drive and Dropbox refresh tokens are long-lived: the same refresh token can be used to mint many access tokens before it expires or is revoked. Box **rotates the refresh token on every refresh call** — each successful `grant_type=refresh_token` exchange returns *both* a new access token and a new refresh token, and the old refresh token becomes immediately invalid.

This changes the persistence contract in two places:

1. **The token-refresh helper inside the writer** (lazy refresh on `init()` and on-401 retry) must, on every successful refresh, persist the new refresh token back to `storage_destinations.oauth_refresh_token_enc`. For Drive/Dropbox the existing helper only updates `oauth_access_token_enc` + `oauth_expires_at`.
2. **The engine internal route** `POST /api/internal/spaces/:id/storage-destination` (already built in `shared-byos-drive-dropbox` Phase E.1) also performs the refresh under transactional lock; it too must write back the new refresh token for Box destinations.

Add a unit test in `apps/server/tests/integration/storage/box.test.ts` asserting: after a refresh, the `storage_destinations` row has a **different** encrypted refresh-token value, and a subsequent refresh attempt with the *original* refresh token returns 401. (The integration test mocks both calls via msw.)

If Box's rotation contract gets violated (we forget to persist the new refresh token), the symptom is delayed — backups work for ~60 days, then the refresh-token TTL elapses and *every* Box destination silently goes 401. Worth a structured-log warning in the refresh helper when we persist a new refresh token for any provider that rotates them.

## `proxyStreamMode = true`

[PRD §2.8](../../../shared/Baseout_PRD.md) names Box as a `proxyStreamMode` provider, same as Dropbox. The runtime semantics: the writer can't accept an opaque pull-stream from R2/source directly — it must buffer each part in memory before issuing the upload PUT. For chunked uploads the buffer is one part at a time, not the whole file. The single `proxyStreamMode = true` flag exists so the caller (currently `backup-base.task.ts`) can choose between push-stream and pull-stream sources; Box gets the buffered path. No code change beyond setting the flag.

## Rate limiting + retries

Box's published limits:

- **General API**: ~1,000 requests/minute per user (~16/sec).
- **File upload**: 240 file-upload calls/minute per user (~4/sec).
- **Search**: 6/sec per user, 12/sec per enterprise (not relevant to backups).

Backup workload (one CSV per Airtable table, dozens of tables per base) easily stays under the general 1,000/min limit. The 240 upload-calls/min limit is the real ceiling — it's why chunked-upload concurrency is capped at 4 (each part counts as an upload call).

On HTTP 429 the writer must respect the `Retry-After` header (Box returns it in seconds). On 5xx the writer retries with exponential backoff capped at three attempts. Both behaviors mirror the Dropbox writer's existing retry policy; lift the helper into a shared `apps/workflows/trigger/tasks/_lib/storage-writers/_retry.ts` if Box is the second call site that needs it, matching the YAGNI rule from [CLAUDE.md §3.2](../../../CLAUDE.md) (don't extract before the second site exists; extract on the second).

## Folder creation + ID semantics

`shared-byos-drive-dropbox` design records "auto-create `Baseout-<spaceId>` folder on first connect, store ID in `storage_destinations.provider_folder_id`". Box's twist: folder IDs are **numeric** (returned as strings from the API, e.g. `"123456789012"`), where Drive's are alphanumeric and Dropbox doesn't have an ID at all (uses a path).

The `provider_folder_id` column is already `text`, so the numeric ID fits without schema work. The Box client in `apps/web/src/lib/box/client.ts` should:

- Call `POST /folders` with `{ name: "Baseout-<spaceId>", parent: { id: "0" } }` (Box's root folder ID is the literal string `"0"`).
- If the folder name already exists at the same level, Box returns HTTP 409 with an `item_name_in_use` error containing the existing folder's ID in the response body. Catch that, extract the existing ID, persist it as if we'd just created it.
- Never assume the folder is empty — a customer's Box account may have a pre-existing `Baseout-<spaceId>` from a previous (deleted) Space binding. The runtime contract is "we write CSVs into this folder", not "this folder is exclusively ours".

## Sandbox vs production app authorization

Box separates "sandbox" and "production" app environments. A Client ID/Secret pair can be active in one or both. If smoke testing connects against a sandbox-only app while a customer connects against the production app, the OAuth flow will work for both but the Client ID/Secret on the engine side will only match one.

MVP commits to a **single production app**, with the local dev environment using the same Client ID/Secret as production (gated on the local `:4321` redirect URI being registered alongside the production redirect URI in the same Box app). This matches how `shared-byos-drive-dropbox` handled the Drive + Dropbox apps — one app per provider per Baseout deployment.

If the boss has only sandbox credentials at the moment, the boss-ask in [`proposal.md`](./proposal.md) covers the sandbox→production promotion. Phase C cannot finish (smoke can't run against real Box) until this is resolved.

## Testing strategy (Box-shaped)

Same five layers as `shared-byos-drive-dropbox`, with Box-specific coverage:

| Layer | What this change exercises |
|---|---|
| Pure | `makeStorageWriter` dispatch — `'box'` maps to `BoxStorageWriter`; `'box'` is now in the type union. |
| Pure | `resolveStorageDestinations(tier)` — every tier returns `'box'` alongside `'r2_managed'`, `'google_drive'`, `'dropbox'`. |
| Per-strategy unit (msw) | `box.ts` writer — simple upload happy path; simple upload with attributes-after-file reversal returns 400 (regression guard for the documented sharp edge); chunked upload happy path with 3 parts; chunked upload with one part 429'd + retried respecting `Retry-After`; refresh-token rotation persists the new refresh token; 401-then-refresh-then-retry succeeds; 409 `item_name_in_use` on folder create extracts the existing ID. |
| OAuth flow unit | `box-authorize.test.ts` + `box-callback.test.ts` — state cookie + redirect URL correct on authorize; state match + token-exchange success + encrypted persistence on callback; state mismatch surfaces a clear error. |
| Integration | `backup-base.task.byos.test.ts` extended with a seeded `'box'` `storage_destinations` row; asserts the per-base task instantiates `BoxStorageWriter`. |
| Smoke (manual) | Real Box dev account → `/integrations` connect → bind Space to Box → run backup of a small Airtable base → CSV lands in `Baseout-<spaceId>` Box folder, row count matches. Gated on the boss-ask checklist in [proposal.md](./proposal.md). |

Playwright AI verification per [web-ai-verify](../web-ai-verify/proposal.md) covers the StoragePicker rendering for the new Box card.

## What this design deliberately doesn't change

- `StorageWriter` interface shape — adding a fourth implementation doesn't justify reshaping it.
- The cross-provider `oauth_states` table or its CSRF semantics — Box reuses both.
- Encryption-key shape, AES-256-GCM helper, sealed-cookie pattern, retry-on-401 policy — all inherited.
- The engine's `POST /api/internal/spaces/:id/storage-destination` route shape — Box is a new `case` inside the existing token-refresh helper, not a new route.
- The workflows-side `backup-base.task.ts` dispatch site — already calls `makeStorageWriter(destination)` and lifecycle-manages it. No change.
- CSV format, per-base task envelope, ConnectionDO lock, restore path, retention.
