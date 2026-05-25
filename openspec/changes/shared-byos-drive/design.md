## Overview

Six implementation phases, three apps. Phase 1 (schema) is the foundation everything else reads from. Phase 2 (web OAuth) gets a connected user into the master DB. Phase 3 (engine internal route) is the credential-decrypt bridge that lets Phase 4 (workflows writer) actually write to Drive without holding the master encryption key. Phase 5 enables the UI; Phase 6 archives the change.

The whole architecture is dictated by one constraint:

> `apps/workflows/` runs on Trigger.dev's Node runner. It must not import `cloudflare:workers`. It must not hold the master encryption key. ([CLAUDE.md §2](../../../CLAUDE.md), §6.)

That means credential decrypt cannot happen in workflows — it has to happen in `apps/server/` (the Cloudflare Worker). The engine is the only place that holds both the master key and the OAuth client secret. Workflows asks the engine for a fresh, decrypted access token per backup run, gets back a string usable for an hour, and pipes CSVs to Drive directly.

The OAuth flow itself is the Airtable pattern, ported. PKCE-S256 + encrypted HttpOnly cookie state — no separate `oauth_states` DB table, no cleanup cron. The cookie has natural 10-min expiry; if it expires the user just clicks Connect again.

## Phase 1 — Schema architecture

### The table

```sql
CREATE TABLE baseout.storage_destinations (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id                 uuid NOT NULL UNIQUE REFERENCES baseout.spaces(id) ON DELETE CASCADE,
  type                     text NOT NULL CHECK (type IN ('local_fs','google_drive')),
  -- OAuth token storage (Drive only; local_fs leaves these null)
  oauth_access_token_enc   text,
  oauth_refresh_token_enc  text,
  oauth_expires_at         timestamptz,
  oauth_scope              text,
  oauth_account_email      text,
  -- Provider-specific
  provider_folder_id       text,
  provider_account_id      text,
  -- Audit
  connected_by_user_id     uuid REFERENCES baseout.users(id),
  connected_at             timestamptz NOT NULL DEFAULT now(),
  last_validated_at        timestamptz
);
CREATE INDEX storage_destinations_type_idx ON baseout.storage_destinations(type);
```

**Why `space_id UNIQUE`**: one destination per Space. Re-connecting Drive on a Space that already has a row REPLACEs (UPSERT). Multi-destination per Space is a future capability; the unique constraint enforces the MVP invariant at the DB layer.

**Why `'local_fs'` is a valid type**: callers can write a `'local_fs'` row to "pin" a Space to local-fs explicitly (the implicit default also works — absence of a row means local-fs in the factory). Phase 5 only writes Drive rows; the local-fs value is reserved for future "let users explicitly disable BYOS" UX.

**Why no `s3_*` columns**: S3 needs IAM access-key columns (`s3_access_key_id_enc`, `s3_secret_access_key_enc`, `s3_region`, `s3_bucket`, `s3_prefix`) that the OAuth providers don't. Adding them now would carry weight for the next 6 months until S3 lands. The S3 follow-up change adds them with its own migration.

**Why no `oauth_states` table**: the Airtable flow already uses an encrypted-cookie handoff that doubles as CSRF state. Cookie has natural 10-min expiry, no cleanup, no orphans. A DB table would mean another migration + a cron sweep.

### Schema-mirror header (engine)

```ts
// apps/server/src/db/schema/storage-destinations.ts
// Canonical source: apps/web/drizzle/0009_storage_destinations.sql
// Engine reads this table to decrypt OAuth tokens for the workflows runner.
// Frontend owns writes (Connect flow); engine owns refresh-and-update on the
// internal route.
```

The engine's Drizzle schema mirrors the web's by hand. The header makes the dependency direction explicit per [CLAUDE.md §2](../../../CLAUDE.md). The next migration that touches `storage_destinations` is filed in `apps/web/drizzle/` and the engine mirror is updated in the same change.

## Phase 2 — Web OAuth architecture

### The flow

```
[ User on backup-config page, picks Drive (Phase 5 UI) ]
        │
        v  POST /api/connections/storage/google-drive/authorize
[authorize.ts]
        │  1. Middleware: session + account context (org+space+user).
        │  2. Generate PKCE pair (verifier + S256 challenge).
        │  3. Generate state (32-byte url-safe base64).
        │  4. Seal { verifier, state, spaceId, userId, returnTo } into the
        │     bo_oauth_google_drive cookie (HttpOnly, Secure, SameSite=Lax,
        │     Path=/api/connections/storage/google-drive, Max-Age=600).
        │  5. 302 to https://accounts.google.com/o/oauth2/v2/auth with
        │     client_id, redirect_uri, response_type=code,
        │     scope=https://www.googleapis.com/auth/drive.file,
        │     access_type=offline, prompt=consent,
        │     code_challenge=<challenge>, code_challenge_method=S256,
        │     state=<state>.
        │
        v  (user consents in Google)
        │
        v  GET /api/connections/storage/google-drive/callback?code=…&state=…
[callback.ts]
        │  1. Read + decrypt bo_oauth_google_drive cookie. 400 if missing.
        │  2. Validate state matches query. 400 on mismatch.
        │  3. Exchange code → tokens at https://oauth2.googleapis.com/token
        │     (basic-auth client creds, grant_type=authorization_code,
        │     code_verifier=<verifier>). 502 on Google error.
        │  4. Drive client: look up Baseout-<spaceId> in root by name;
        │     create if missing. Returns folder ID.
        │  5. Encrypt access + refresh tokens via crypto.ts.
        │  6. UPSERT storage_destinations row keyed on space_id, with
        │     type='google_drive', tokens, scope, account_email,
        │     provider_folder_id, connected_by_user_id, connected_at.
        │  7. Clear cookie (Max-Age=0).
        │  8. 302 to returnTo (defaults to /backups?connected=success).
        │
        v  POST /api/connections/storage/google-drive/disconnect (optional)
[disconnect.ts]
        │  1. Middleware: session + account.
        │  2. DELETE FROM storage_destinations WHERE space_id = $1.
        │  3. UPDATE backup_configurations SET storage_type = 'local_fs'
        │     WHERE space_id = $1.
        │  4. 200 ok.
```

### Why a 10-min cookie

The cookie carries `verifier` (PKCE), `state` (CSRF), `spaceId` (which Space the user is connecting), `userId` (audit), `returnTo` (post-OAuth redirect). 10 minutes is the realistic ceiling for a human completing the Google consent screen. Encrypted with the master key (AES-256-GCM auth-tag = tamper detection). HttpOnly + Secure + SameSite=Lax. Scoped to `/api/connections/storage/google-drive` so it doesn't leak to any other route.

### Why `access_type=offline` + `prompt=consent`

Google only returns a refresh token on the *first* consent. If a user has previously authorized this OAuth client (e.g. during development), Google silently skips refresh-token issuance unless `prompt=consent` forces a fresh consent screen. Without `access_type=offline`, no refresh token at all. Both flags are non-negotiable.

### Why `drive.file` scope

`drive.file` lets the app see and modify only files it creates. Sufficient for write (today). For future restore, we'll need to remember file IDs per-run (out of scope here). Alternative `drive` would give full Drive access — way more than we need, and a hard sell to security-conscious customers.

### Reused infrastructure (don't reinvent)

- **PKCE helpers**: [apps/web/src/lib/airtable/oauth.ts](../../../apps/web/src/lib/airtable/oauth.ts) — `generatePkcePair`, `generateState`, `buildAuthorizeUrl` (with `authorizeUrl` override param). Same module idiom, different endpoint URLs.
- **Encrypted-cookie helpers**: [apps/web/src/lib/airtable/cookie.ts](../../../apps/web/src/lib/airtable/cookie.ts) — `sealHandoffPayload`, `openHandoffPayload`, `buildSetCookie`, `buildClearCookie`, `readHandoffCookie`. Port the shape with a new cookie name + path.
- **AES-256-GCM**: [apps/web/src/lib/crypto.ts](../../../apps/web/src/lib/crypto.ts) — `encryptToken`, `decryptToken`. Unchanged.

## Phase 3 — Engine internal-route architecture

### Sequence

```
[apps/workflows backup-base task starts]
        │
        v  GET /api/internal/spaces/:spaceId/storage-destination
        │  Header: x-internal-token: $INTERNAL_TOKEN
[apps/server route]
        │  1. Validate x-internal-token. 401 if missing/wrong.
        │  2. SELECT * FROM storage_destinations WHERE space_id = $1.
        │     404 if missing.
        │  3. If type === 'local_fs': return { type: 'local_fs' } (no tokens).
        │  4. If type === 'google_drive':
        │       a. Decrypt access + refresh tokens.
        │       b. If oauth_expires_at - now < 5 min OR ?refresh=1:
        │            i.   Call refreshDriveAccessToken({ refreshToken, … }).
        │            ii.  Re-encrypt new access token. Compute new expiresAt.
        │            iii. UPDATE storage_destinations SET
        │                   oauth_access_token_enc = …,
        │                   oauth_expires_at       = …,
        │                   last_validated_at      = now()
        │                 WHERE space_id = $1.
        │       c. Return {
        │            type: 'google_drive',
        │            accessToken: <decrypted, possibly refreshed>,
        │            expiresAt: <ISO>,
        │            providerFolderId: <Drive folder ID>
        │          }.
        │  5. NEVER return the refresh token. Workflows doesn't need it; it
        │     re-hits this endpoint with ?refresh=1 on 401.
```

### Why the engine handles refresh, not workflows

- Workflows is Node, has no master encryption key. It cannot decrypt the persisted refresh token even if we gave it.
- Putting the OAuth client secret on the workflows runner widens its blast radius unnecessarily. Trigger.dev env vars are an additional surface; we'd rather keep the secret on the engine where it's already paired with `INTERNAL_TOKEN`.
- A refresh on a near-expired token writes back to the master DB. The engine has the postgres-js connection; workflows would need its own DB connection (it has none today).

### Why a single GET endpoint, not two (read + refresh)

The 5-min-near-expiry check fires automatically on every read. Workflows calls one URL at task start, gets a token good for the rest of the run. A separate "refresh now" endpoint duplicates the auth + DB-read scaffolding for no real benefit — the `?refresh=1` query param covers the rare mid-upload 401-retry case.

### refreshDriveAccessToken (pure helper)

```ts
// apps/server/src/lib/storage/refresh-drive.ts
export interface RefreshDriveParams {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  tokenUrl?: string;          // override for tests
  fetchImpl?: typeof fetch;   // override for tests
}
export interface RefreshDriveResult {
  accessToken: string;
  expiresAt: Date;            // now + expires_in
  scope?: string;
}
export async function refreshDriveAccessToken(p: RefreshDriveParams): Promise<RefreshDriveResult>;
```

POSTs `https://oauth2.googleapis.com/token` with `grant_type=refresh_token`, `refresh_token=…`, `client_id=…`, `client_secret=…` (form-encoded, no basic auth — Google accepts both, form is simpler). Throws on non-200 with a descriptive message. Pure, msw-testable.

### Engine mirror crypto.ts

The engine needs to decrypt rows the web encrypted. The master key (`BASEOUT_ENCRYPTION_KEY`) is the same on both sides per existing Airtable flow. `apps/server/src/lib/crypto.ts` exists already (or is added if missing — mirror of [apps/web/src/lib/crypto.ts](../../../apps/web/src/lib/crypto.ts)). The Web Crypto API is available in workerd.

## Phase 4 — Workflows architecture

### Factory signature widening

```ts
// apps/workflows/trigger/tasks/_lib/storage-writers/index.ts
export interface DriveWriterCreds {
  accessToken: string;
  expiresAt: Date;
  providerFolderId: string;
  refresh: () => Promise<{ accessToken: string; expiresAt: Date }>;
}
export type StorageWriterCreds = DriveWriterCreds;   // union as providers add

export function resolveStorageWriter(
  storageType: string,
  creds?: StorageWriterCreds,
): StorageWriter {
  if (storageType === 'google_drive' && creds) {
    return createGoogleDriveWriter(creds);
  }
  return new LocalFsWriter();
}
```

Defensive fallback: missing creds or unknown type → local-fs. Means dev iteration never breaks if creds-fetching fails; a bug is logged via the engine call but the backup still produces files (just to the wrong destination). Acceptable for MVP — the alternative is a hard fail that's worse for iteration.

### GoogleDriveWriter shape

```ts
// apps/workflows/trigger/tasks/_lib/storage-writers/google-drive.ts
export function createGoogleDriveWriter(creds: DriveWriterCreds): StorageWriter {
  let accessToken = creds.accessToken;
  let expiresAt = creds.expiresAt;
  const rootFolderId = creds.providerFolderId;

  async function authedFetch(input: string | URL, init: RequestInit): Promise<Response> {
    // Proactive refresh if within 5 min of expiry
    if (expiresAt.getTime() - Date.now() < 5 * 60_000) {
      const refreshed = await creds.refresh();
      accessToken = refreshed.accessToken;
      expiresAt = refreshed.expiresAt;
    }
    const res = await fetch(input, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (res.status === 401) {
      // Reactive refresh on unexpected 401, retry once
      const refreshed = await creds.refresh();
      accessToken = refreshed.accessToken;
      expiresAt = refreshed.expiresAt;
      return fetch(input, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          Authorization: `Bearer ${accessToken}`,
        },
      });
    }
    return res;
  }

  return {
    async writeCsv(relativeKey, csv) {
      if (relativeKey.includes('..')) throw new Error('invalid_path');
      // Resolve sub-folders along the path (cached per-writer-instance),
      // then resumable upload of the CSV bytes.
      // Returns { path: `drive://<folderId>/<name>`, size: csv.byteLength }.
    },
    async deletePrefix(relativePrefix) {
      if (relativePrefix.includes('..')) throw new Error('invalid_path');
      // files.list under the prefix, files.delete each. Returns
      // { deletedCount: <number of files removed> }.
    },
  };
}
```

**Folder structure**: `<rootFolderId>/<runId>/<baseId>/<table>.csv`. Sub-folders created on first use, cached in an in-memory map per writer-instance so the same run doesn't re-`files.list` the same path repeatedly.

**Upload mode**: resumable (`?uploadType=resumable`), even for small CSVs. Single code path. Matches the prior `5a90d07` design.

**Path returned**: `drive://<folderId>/<filename>` — purely informational; not used by the engine for read-back. The engine's `backup_runs` table doesn't need a download URL today (restore is out of scope).

### Creds threading in backup-base.ts

```ts
// apps/workflows/trigger/tasks/backup-base.ts (excerpt)
async function fetchStorageCreds(spaceId: string): Promise<StorageWriterCreds | null> {
  const baseUrl = process.env.BACKUP_ENGINE_URL!;
  const token = process.env.INTERNAL_TOKEN!;
  const url = `${baseUrl}/api/internal/spaces/${spaceId}/storage-destination`;
  async function read(refresh = false): Promise<DriveCredsResponse> {
    const r = await fetch(refresh ? `${url}?refresh=1` : url, {
      headers: { 'x-internal-token': token },
    });
    if (!r.ok) throw new Error(`engine creds fetch failed: ${r.status}`);
    return r.json();
  }
  const initial = await read();
  if (initial.type !== 'google_drive') return null;
  return {
    accessToken: initial.accessToken,
    expiresAt: new Date(initial.expiresAt),
    providerFolderId: initial.providerFolderId,
    refresh: async () => {
      const refreshed = await read(true);
      return {
        accessToken: refreshed.accessToken,
        expiresAt: new Date(refreshed.expiresAt),
      };
    },
  };
}

// Inside runBackupBase:
const creds = input.storageType === 'google_drive'
  ? await fetchStorageCreds(input.spaceId)
  : undefined;
const writer = resolveStorageWriter(input.storageType, creds ?? undefined);
```

### Why tokens are NOT in the Trigger.dev payload

Trigger.dev logs payloads in run history (viewable in the dashboard). Putting tokens there leaks credentials to anyone with Trigger.dev access. The `spaceId` payload + per-task engine fetch is one extra HTTP call (~50ms) per backup — cheap insurance.

## Phase 5 — UI architecture

### StoragePicker connect-and-save

```
[user selects Drive radio]
        │
        v  Is there a storage_destinations row for this Space?
        │
   yes──┤                                    no──┐
        v                                        v
   Save flow proceeds                       [Connect button rendered]
   (existing PATCH to                            │
    backup_configurations)                       v  click
                                            POST /authorize → Google
                                                 │
                                                 v
                                            Callback persists row,
                                            redirects to ?connected=success
                                                 │
                                                 v
                                            Picker re-renders, Drive
                                            radio stays selected,
                                            Connect button gone
```

The picker reads "is there a row" via the existing Space-context loader (or a new prop passed from the parent page). The Connect button's `setButtonLoading` covers the redirect latency. After return, the parent page (`/backups` or wherever it lives) re-fetches the destination row and re-renders.

### PATCH validation

Wherever `backup_configurations.storage_type` is validated server-side, add `'google_drive'` to the accept list. The DB CHECK already enforces it at the lowest layer; the PATCH validation is defense-in-depth + better error messages.

### Disconnect affordance (optional)

A small `Disconnect Drive` link/button next to the picker. POSTs to `/disconnect`, which DELETEs the row + flips `storage_type` to `'local_fs'`. Optional for MVP — the user can also just pick `local_fs` in the picker, which has the same effect via the existing save flow.

## Testing strategy

| Layer | Coverage |
|---|---|
| Schema | None (pure migration). `db:check` post-Phase-1 verifies journal sync. |
| OAuth lib (web) | `apps/web/src/lib/google-drive/oauth.test.ts` — `buildAuthorizeUrl` includes `access_type=offline`, `prompt=consent`, `code_challenge_method=S256`; `exchangeCodeForTokens` happy + 4xx + 5xx via msw; `refreshAccessToken` (also in this module but used by the engine's mirror — verify the request body shape). |
| Cookie lib (web) | `apps/web/src/lib/google-drive/cookie.test.ts` — round-trip seal/open + tamper-tag rejection. Mirror Airtable's existing cookie test. |
| Drive client (web) | `apps/web/src/lib/google-drive/client.test.ts` — folder lookup-by-name returns existing ID; folder creation fires `files.create` and returns new ID; lookup-misses then creates. msw boundary. |
| OAuth callback (web) | `apps/web/src/pages/api/connections/storage/google-drive/callback.test.ts` — missing cookie → 400; state mismatch → 400; happy path writes encrypted row + creates folder + clears cookie + 302s to returnTo. Real DB (test schema), msw-mocked Google. |
| Refresh helper (engine) | `apps/server/src/lib/storage/refresh-drive.test.ts` — request body shape (grant_type, refresh_token, client_id, client_secret); 200 response → `{accessToken, expiresAt}` shape; 4xx → descriptive Error. msw boundary. |
| Internal route (engine) | `apps/server/src/pages/api/internal/spaces/[spaceId]/storage-destination.test.ts` — missing token → 401; missing row → 404; `local_fs` row → 200 with no token fields; fresh `google_drive` row → 200 with decrypted access token (no refresh); near-expiry → refresh + persist + 200; `?refresh=1` → forces refresh; refresh failure → 502. |
| GoogleDriveWriter (workflows) | `apps/workflows/tests/storage-writers/google-drive.test.ts` — happy `writeCsv` (resumable upload session start + PUT bytes); 401 mid-upload → `creds.refresh` called + retry once; proactive refresh on init when near expiry; sub-folder creation cached across calls in the same writer; path-traversal `..` rejection. msw boundary. |
| backup-base (workflows) | Extend existing `apps/workflows/trigger/tasks/backup-base.test.ts` — `storageType='google_drive'` branch: mock engine internal endpoint via msw, assert writer is constructed with decrypted creds; the `local_fs` path is unaffected. |
| StoragePicker (web) | `apps/web/src/components/backups/StoragePicker.test.ts` (or extend existing) — Drive radio renders enabled (no "Coming soon"); Connect button renders only when no row exists for the Space; Connect button targets the right URL. |
| Backup-config PATCH (web) | `'google_drive'` accepted; storage-type values not in the union → 400. |
| E2E | Manual end-to-end smoke per Phase 5 verification. Playwright is overkill for the OAuth dance (real Google flow); manual smoke + msw-backed unit/integration tests cover the rest. |

## Operational concerns

- **Token expiry vs run duration**: a typical Drive access token is 60-min TTL. A backup run is typically minutes, occasionally up to ~30 min for large bases. The proactive 5-min-before-expiry refresh handles the common case; the reactive 401-retry handles edge cases (token revoked mid-run, clock skew).
- **Folder ID drift**: if the user moves or deletes the `Baseout-<spaceId>` folder in Drive, subsequent writes fail (404 from Drive). MVP behavior: error propagates, run fails, audit log shows the Drive 404. User reconnects (which re-runs the folder lookup-then-create). Out of scope: auto-recreation on Drive 404.
- **Quota**: Drive imposes 1,000 requests/100s per user. A single backup writes ~N files (one per table) + sub-folder creations. Well within quota for MVP base sizes.
- **Multi-tenant blast radius**: each tenant has their own OAuth refresh token. A leaked or revoked refresh token affects that one Space's destination only. The `client_id`+`client_secret` are app-level; rotating them invalidates every connection (acceptable rollback if needed).
- **Disconnect cleanup**: disconnecting deletes the master-DB row but NOT the Drive folder. Customer-owned data stays in customer Drive. (Inverse of the local-fs case where Disconnect doesn't remove `.backups/`.)

## What this design deliberately doesn't change

- `LocalFsWriter`. Unchanged. Used as the default + fallback.
- The `StorageWriter` interface signature. Widening the factory accepts an optional second arg; the interface itself is untouched.
- `backup_configurations.storageType` schema. Already accepts `'google_drive'`.
- The engine's `/api/internal/runs/{progress,complete}` callbacks. Storage-agnostic; remain so.
- The Trigger.dev wire format beyond adding `spaceId` to the backup-base payload.
- Magic-link / `better-auth` / session middleware. The new web routes use the same middleware as every other authenticated route.
- StoragePicker layout / theming / position. Only the Drive option's enabled state and the new Connect button.
