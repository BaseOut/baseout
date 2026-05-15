## Overview

Seven phases. The load-bearing chain is A (schema) → B (interface) → C (one provider's connect flow + strategy, end-to-end). Each subsequent provider after the first is a parallel + smaller workstream — same shape, different SDK. Recommended order:

1. Google Drive (highest customer demand, well-documented SDK)
2. S3 (no OAuth, simpler — IAM-keys form)
3. Dropbox (proxy streaming, sets the pattern for Box)
4. Box
5. OneDrive
6. Frame.io (Growth+, lowest priority)

Architectural call: **one strategy class per provider, behind a common `StorageWriter` interface.** No conditional logic in the per-base task — strategy selection happens at run start, the task only knows about the interface. This makes adding a 7th provider a matter of dropping a new file under `strategies/`.

## Phase A — `storage_destinations` schema

```sql
CREATE TABLE baseout.storage_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL UNIQUE REFERENCES baseout.spaces(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('r2_managed','google_drive','dropbox','box','onedrive','s3','frame_io','custom')),

  -- OAuth providers (Google, Dropbox, Box, OneDrive, Frame.io)
  oauth_access_token_enc text,
  oauth_refresh_token_enc text,
  oauth_expires_at timestamp with time zone,
  oauth_scope text,
  oauth_account_email text,        -- e.g. "alice@example.com" — display only

  -- S3
  s3_access_key_id_enc text,
  s3_secret_access_key_enc text,
  s3_region text,
  s3_bucket text,
  s3_prefix text DEFAULT '',

  -- Provider-specific destination identifier
  provider_folder_id text,         -- Google Drive folder ID, Dropbox path, Box folder ID, OneDrive driveItem, Frame.io project ID
  provider_account_id text,        -- For multi-account providers

  connected_by_user_id uuid REFERENCES baseout.users(id) ON DELETE SET NULL,
  connected_at timestamp with time zone DEFAULT now(),
  last_validated_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  modified_at timestamp with time zone DEFAULT now()
);

CREATE INDEX storage_destinations_space_id_idx ON baseout.storage_destinations (space_id);
```

The `_enc` columns hold AES-256-GCM ciphertext per CLAUDE.md §3.3. The plaintext is `{ accessToken, refreshToken, etc }` JSON-serialized then encrypted.

For `r2_managed`, the row exists with `type='r2_managed'` and all secret columns NULL — the engine just routes to managed R2.

## Phase B — `StorageWriter` interface

```ts
// apps/server/src/lib/storage/storage-writer.ts

export interface StorageWriter {
  /**
   * Initializes the writer: refreshes tokens if needed, ensures the destination
   * folder/bucket exists, validates connectivity. Idempotent.
   */
  init(): Promise<void>

  /**
   * Streams bytes from `stream` to the destination at logical path `path`.
   * Returns the destination-specific key for later reference (e.g. Drive file ID,
   * S3 object key, Dropbox path).
   */
  writeFile(stream: ReadableStream, path: string, mimeType?: string): Promise<{ destinationKey: string; sizeBytes: number }>

  /**
   * Returns a short-lived signed URL for `path`. Used by the future restore
   * engine to fetch the snapshot.
   */
  getDownloadUrl(path: string): Promise<string>

  /**
   * Removes the file at `path` from the destination. Used by the retention
   * engine for managed-R2 only — BYOS deletes are out of scope per
   * `baseout-backup-retention-and-cleanup` (BYOS cleanup is customer's responsibility).
   */
  delete(path: string): Promise<void>

  /**
   * When `true`, the engine MUST pipe Airtable's response stream directly through
   * `writeFile` without staging in managed R2 first. Box and Dropbox.
   */
  proxyStreamMode?: boolean
}

export function makeStorageWriter(
  dest: StorageDestinationRow,
  env: Env,
  masterKey: Uint8Array,
): StorageWriter
```

The `makeStorageWriter` factory dispatches on `dest.type`:

```ts
switch (dest.type) {
  case 'r2_managed':   return new R2ManagedWriter(env.BACKUPS_R2)
  case 'google_drive': return new GoogleDriveWriter(decrypt(dest.oauth_access_token_enc, masterKey), dest.provider_folder_id)
  case 'dropbox':      return new DropboxWriter(decrypt(...), dest.provider_folder_id)
  // ...
}
```

## Phase C — Per-provider strategies

Each strategy lives in `apps/server/src/lib/storage/strategies/<provider>.ts` and exports a single class implementing `StorageWriter`. Brief notes per provider:

### Google Drive

- Drive v3 API: `https://www.googleapis.com/upload/drive/v3/files`.
- Resumable upload for files > 5 MB (`uploadType=resumable`).
- Token refresh via `https://oauth2.googleapis.com/token` with the refresh token.
- `provider_folder_id` is the Drive folder ID where snapshots land; create `Baseout-<spaceId>` on first init if absent.
- `getDownloadUrl`: `https://www.googleapis.com/drive/v3/files/<id>?alt=media` — needs Authorization header, not a public URL. Restore-time concern.

### Dropbox

- Files API: `https://content.dropboxapi.com/2/files/upload` (small) or `/upload_session` flow (large).
- `proxyStreamMode=true` per [PRD §2.8](../../../shared/Baseout_PRD.md).
- Long-lived refresh tokens; refresh via `https://api.dropboxapi.com/oauth2/token`.
- `provider_folder_id` is a path string (e.g. `/Baseout/spaces/<spaceId>`).

### Box

- Files API: `https://upload.box.com/api/2.0/files/content` (small) or chunked-upload (large).
- `proxyStreamMode=true`.
- OAuth2 with 1hr token; refresh via `/oauth2/token`.
- `provider_folder_id` is a Box folder numeric ID.

### OneDrive

- Microsoft Graph API: `https://graph.microsoft.com/v1.0/me/drive/items/<folderId>/children/<filename>/content` (small) or upload-session for large.
- OAuth2 with 1hr token + refresh.
- `provider_folder_id` is a driveItem ID.

### S3

- No OAuth — pure IAM credentials.
- Authentication: AWS Signature v4.
- `PutObject` for small files; `CreateMultipartUpload` + parts for files > 5 GB.
- `s3_region`, `s3_bucket`, `s3_prefix` come from the user-supplied config form.
- `init()`: `HeadBucket` to validate the credentials work; create the `s3_prefix` "folder" (S3 has no real folders — first object write implicitly creates it).
- `getDownloadUrl`: presigned URL via Signature v4.

### Frame.io

- API: `https://api.frame.io/v2/assets`.
- OAuth2 + project-scoped uploads.
- `provider_folder_id` is a Frame.io folder asset ID.

### Streaming pattern (all OAuth providers)

```ts
async writeFile(stream: ReadableStream, path: string, mimeType?: string) {
  await this.refreshTokenIfNearExpiry()
  const session = await this.startResumableUpload(path, mimeType)
  let offset = 0
  for await (const chunk of stream) {
    await this.uploadChunk(session, chunk, offset)
    offset += chunk.byteLength
  }
  return await this.finalizeUpload(session)
}
```

Token-refresh-on-init plus refresh-on-401 in the chunk loop handles expiring-mid-write.

## Phase D — Capability resolver

```ts
type StorageDestinationType = 'r2_managed' | 'google_drive' | 'dropbox' | 'box' | 'onedrive' | 's3' | 'frame_io' | 'custom'

resolveStorageDestinations(tier: TierName): { allowedTypes: StorageDestinationType[] }

// Trial/Starter/Launch: ['r2_managed', 'google_drive', 'dropbox', 'box', 'onedrive']
// Growth/Pro/Business/Enterprise: same + ['s3', 'frame_io']
// Pro+: same + ['custom']  (custom out of scope for this change)
```

## Phase E — OAuth state + CSRF

Each OAuth flow:

1. `GET /api/connections/storage/<provider>/authorize?spaceId=<uuid>`:
   - Generates a `state` token: `crypto.getRandomValues(16)` → hex.
   - Stores `{ state, spaceId, userId, createdAt }` in an `oauth_states` table (or a signed cookie).
   - Redirects to the provider's authorization URL with `state=<token>`.
2. Provider redirects back: `GET /api/connections/storage/<provider>/callback?code=<>&state=<>`:
   - Loads the state row, verifies non-expired (< 10 min) and matches the user.
   - Exchanges `code` for tokens via the provider's `/token` endpoint.
   - Encrypts tokens + UPSERTs `storage_destinations`.
   - Redirects to the wizard with `?connected=success`.

The `oauth_states` table (or signed cookie) prevents CSRF + replay.

## Phase F — Engine integration

In `backup-base.task.ts`, replace the direct `env.BACKUPS_R2.put` call:

```ts
const dest = await loadStorageDestination(ctx.spaceId, deps.db)
const writer = makeStorageWriter(dest, deps.env, deps.masterKey)
await writer.init()

if (writer.proxyStreamMode) {
  // Box / Dropbox: pipe Airtable stream directly through writeFile, no R2 stage.
  await writer.writeFile(airtableStream, `${ctx.runId}/${baseId}/records.csv`, 'text/csv')
} else {
  // Default: buffer the CSV in memory (already does this for CSV serialization),
  // then writeFile.
  const csvStream = await buildCsvStream(rows)
  await writer.writeFile(csvStream, `${ctx.runId}/${baseId}/records.csv`, 'text/csv')
}
```

Attachment streaming (per `baseout-backup-attachments`) routes through the same `writer.writeFile` call — the attachment-downloader passes Airtable's response stream directly.

## Wire shapes

| Direction | Path | Verb | Change |
|---|---|---|---|
| apps/web → apps/web | `/api/connections/storage/<provider>/authorize` | GET | new (5 OAuth + 1 S3-config = 6 new routes) |
| apps/web → apps/web | `/api/connections/storage/<provider>/callback` | GET | new (5 OAuth callbacks) |
| apps/web → apps/web | `/api/connections/storage/s3/configure` | POST | new |
| apps/web → apps/web | `/api/spaces/:id/backup-config` PATCH | additive: `storageType` allowed range expands |
| apps/web → apps/web | `/api/spaces/:id/storage-destination` | DELETE | new — disconnect (reverts to managed R2) |

## Testing strategy

| Layer | Coverage |
|---|---|
| Pure | `makeStorageWriter` dispatch — every type → correct strategy class. |
| Pure | `resolveStorageDestinations(tier)` — all seven tiers. |
| Per-strategy unit | Each `<provider>.ts` writer — mock the provider HTTP API; assert correct `init`, `writeFile`, `getDownloadUrl`, `delete` calls. |
| OAuth flow | `<provider>/authorize.test.ts` — state cookie set + redirect URL correct. `<provider>/callback.test.ts` — state match + token-exchange success + encrypted persistence. |
| Integration | `backup-base.task.byos.test.ts` — seeded `storage_destinations` row for each provider; assert the per-base task calls the right strategy. |
| Smoke | Per provider, a manual smoke test with real OAuth credentials on a dev account. |
| Playwright | Wizard: connect Google Drive (mocked OAuth); pick Drive as destination; trigger a backup; verify a file lands in the mocked Drive endpoint. |

## Master DB migration

`apps/web/drizzle/0011_storage_destinations.sql` per design.md §Phase A. Engine mirror in `apps/server/src/db/schema/storage-destinations.ts`.

## Operational concerns

- **OAuth client provisioning**: each provider requires registering a Baseout app in the provider's developer console. Out-of-band setup per provider; results in `<PROVIDER>_OAUTH_CLIENT_ID` + `<PROVIDER>_OAUTH_CLIENT_SECRET` env vars. Document in `apps/web/.env.example`.
- **Token refresh**: piggyback on the existing `baseout-server-cron-oauth-refresh` change. Add `storage_destinations` to the refresh loop with the same pattern as `connections`. Or lazy-refresh in `StorageWriter.init`. Decision: lazy-refresh for MVP (simpler, no cron change needed); cron-refresh as a follow-up if tokens-expire-mid-run becomes a real problem.
- **Rate limits**: hidden behind Cloudflare Workers from each customer's perspective. Per-provider rate limits don't apply across customers (Box's 10/sec/user is fine since each customer's connection is their own user). Internal serialization (per the ConnectionDO pattern) is overkill for storage writes.
- **Provider downtime**: a 5xx from the provider fails the per-base task. Trigger.dev retries 3× per the existing config. After exhausting retries, the run is marked failed; the user re-runs manually.
- **Cost**: each new strategy adds bundle size. The Workers limit is 1 MB compressed; six strategy classes + their SDK calls (mostly fetch + JSON, no full SDKs) should fit easily.

## What this design deliberately doesn't change

- The per-base task envelope (Trigger.dev v3, `maxDuration: 600`, ConnectionDO lock).
- The CSV format. Whether the CSV lands in R2 or Google Drive doesn't change the bytes.
- Restore. Out of scope; will consume `getDownloadUrl` when it lands.
- The retention engine. Will consume `writer.delete(path)` for managed R2; BYOS destinations are customer-managed for retention per Features §6.6.
- The encryption-key shape. Same AES-256-GCM helper from `@baseout/shared`.
