> **Depends on**: [`baseout-r2-stance`](../baseout-r2-stance/proposal.md) — Per the decision recorded there, managed R2 is the default destination. Phase 0 below re-introduces the `BACKUPS_R2` binding that was removed in commit `8fc1f61`.

## Why

The `StoragePicker` UI in [apps/web/src/components/backups/StoragePicker.astro](../../../apps/web/src/components/backups/StoragePicker.astro) shows seven destination options — `r2_managed`, `google_drive`, `dropbox`, `box`, `onedrive`, `s3`, `frame_io` — but only `r2_managed` is selectable. Every other option is locked with a "Coming soon" label. The engine has no `StorageWriter` interface, no OAuth tokens for any non-Airtable provider, and no per-provider write path. The `backup-base.task.ts` currently writes via [`local-fs-write.ts`](../../../apps/server/trigger/tasks/_lib/local-fs-write.ts) (dev-only path after `8fc1f61` removed the R2 binding).

[PRD §7.2](../../../shared/Baseout_PRD.md) lists BYOS as a V1 Must-Have:

> | Storage Destination | All Tiers | Growth+ | Pro+ |
> | Google Drive (OAuth) | ✓ | | |
> | Dropbox (OAuth + proxy stream) | ✓ | | |
> | Box (OAuth + proxy stream) | ✓ | | |
> | OneDrive (OAuth) | ✓ | | |
> | Amazon S3 (IAM) | | ✓ | |
> | Frame.io (OAuth) | | ✓ | |
> | Custom / BYOS | | | ✓ |
> | Cloudflare R2 (Baseout-managed) | ✓ (default) | | |

And [PRD §2.8](../../../shared/Baseout_PRD.md) names the destinations that require proxy-streaming (Box, Dropbox) — meaning the engine streams from Airtable through Worker memory directly to the destination, never writing to R2 first.

The existing openspec change `baseout-backup/specs/storage-destinations/spec.md` already defines the `StorageWriter` interface contract (`init`, `writeFile`, `getDownloadUrl`, `delete`). This change is its implementation.

**Scope decision**: ship all six providers in one change. Splitting per-provider would create six near-identical OAuth proposal files. The phase structure lets the team ship Google Drive first (the most common) and add the others incrementally — but the architecture, the schema, and the `StorageWriter` interface are common across all of them, so they belong in one change.

## What Changes

### Phase 0 — Re-introduce managed R2 binding

Required first because commit `8fc1f61` removed it. Without this phase, Phase B's `r2-managed.ts` strategy has nothing to wrap, and the downstream `baseout-server-attachments` Phase B and `baseout-server-retention-and-cleanup` cleanup paths are blocked.

- Re-add `BACKUPS_R2` binding to [apps/server/wrangler.jsonc.example](../../../apps/server/wrangler.jsonc.example) and `apps/server/wrangler.test.jsonc`. The shape was last present at `git show 8fc1f61^:apps/server/wrangler.jsonc.example`.
- Re-add `BACKUPS_R2: R2Bucket` to the `Env` interface in [apps/server/src/env.d.ts](../../../apps/server/src/env.d.ts).
- Provision the production R2 bucket (`baseout-backups`) and capture the bucket name + access keys in Cloudflare Secrets per [CLAUDE.md §3.3](../../../CLAUDE.md).
- Recover the deleted `r2-proxy-write.ts` helper as a starting point for `r2-managed.ts` (`git show 8fc1f61^:apps/server/trigger/tasks/_lib/r2-proxy-write.ts`) — but rewrap it behind the `StorageWriter` interface defined in Phase B rather than re-introducing the standalone helper.
- The dev path stays at [`local-fs-write.ts`](../../../apps/server/trigger/tasks/_lib/local-fs-write.ts), selected by an env var (e.g. `STORAGE_DEV_MODE=local-fs`). The decision whether to switch dev to Miniflare-R2 is deferred to the Phase 0 implementer.

### Phase A — `storage_destinations` schema

- **New table `storage_destinations`** (per [PRD §17.4](../../../shared/Baseout_PRD.md)):
  - `id uuid PK`
  - `space_id uuid FK → spaces.id ON DELETE CASCADE, unique` (one destination per Space — switching destinations is an UPDATE)
  - `type text NOT NULL CHECK (type IN ('r2_managed','google_drive','dropbox','box','onedrive','s3','frame_io','custom'))`
  - `oauth_access_token_enc text` — AES-256-GCM ciphertext of the access token (NULL for `r2_managed` and `s3` IAM-keys path)
  - `oauth_refresh_token_enc text` — AES-256-GCM ciphertext of the refresh token
  - `oauth_expires_at timestamp with time zone` — when to refresh
  - `s3_access_key_id_enc text` — AES-256-GCM ciphertext (S3 path)
  - `s3_secret_access_key_enc text` — AES-256-GCM ciphertext (S3 path)
  - `s3_region text` (S3 path)
  - `s3_bucket text` (S3 path)
  - `s3_prefix text DEFAULT ''` (S3 path)
  - `provider_folder_id text` — destination-side folder/container identifier (Google Drive folder ID, Dropbox path prefix, Box folder ID, OneDrive driveItem ID, Frame.io project ID)
  - `connected_by_user_id uuid FK → users.id`
  - `connected_at timestamp with time zone DEFAULT now()`
  - `last_validated_at timestamp with time zone` — last time a write succeeded
- The schema follows the `_enc` suffix convention from CLAUDE.md §3.3.

### Phase B — `StorageWriter` interface

- **New file** `apps/server/src/lib/storage/storage-writer.ts`:

  ```ts
  export interface StorageWriter {
    init(): Promise<void>                                  // ensure folder/bucket exists, refresh tokens if needed
    writeFile(stream: ReadableStream, path: string): Promise<{ destinationKey: string }>
    getDownloadUrl(path: string): Promise<string>          // for the restore engine — short-lived signed URL
    delete(path: string): Promise<void>                    // for the retention engine
    proxyStreamMode?: boolean                              // true for Box/Dropbox (engine MUST pipe through memory)
  }
  ```

- Implementations under `apps/server/src/lib/storage/strategies/`:
  - `r2-managed.ts` — wraps the existing `env.BACKUPS_R2.put` path. Tier-gating: all.
  - `google-drive.ts` — OAuth2 + Drive v3 API. Tier-gating: all.
  - `dropbox.ts` — OAuth2 + Dropbox API + chunked upload. `proxyStreamMode=true`. Tier-gating: all.
  - `box.ts` — OAuth2 + Box API + chunked upload. `proxyStreamMode=true`. Tier-gating: all.
  - `onedrive.ts` — OAuth2 + Microsoft Graph API. Tier-gating: all.
  - `s3.ts` — IAM access-key auth + S3 PutObject (or multipart for large files). Tier-gating: Growth+.
  - `frame-io.ts` — OAuth2 + Frame.io API. Tier-gating: Growth+.

- **Strategy selection** in `backup-base.task.ts`:

  ```ts
  const dest = await loadStorageDestination(spaceId, db)
  const writer = makeStorageWriter(dest, env, masterKey)
  await writer.init()
  await writer.writeFile(stream, path)
  ```

### Phase C — OAuth connect flows

- **One frontend route per OAuth provider** under `apps/web/src/pages/api/connections/storage/`:
  - `google-drive/authorize.ts` — initiates the OAuth flow, sets a state cookie, returns a redirect URL.
  - `google-drive/callback.ts` — receives the callback, exchanges code → tokens, encrypts + persists in `storage_destinations`.
  - Same shape for `dropbox`, `box`, `onedrive`, `frame-io`.
- **S3 IAM-keys path** uses a form, not OAuth: `apps/web/src/pages/api/connections/storage/s3/configure.ts` accepts `{ accessKeyId, secretAccessKey, region, bucket, prefix }`, validates with a `HeadBucket` probe, encrypts, persists.
- **Wizard step integration**: the existing onboarding wizard step that picks a Space's storage destination now opens the connect flow inline. After OAuth completion, the picker shows the connected account name (e.g. "alice@example.com — Drive").
- **OAuth-token refresh**: tokens expire (Google: 1hr; Dropbox: long-lived; Box: 1hr; OneDrive: 1hr; Frame.io: varies). The `baseout-server-cron-oauth-refresh` change (already in flight per `openspec/changes/`) already runs a refresh cron for Airtable; extend it to handle storage tokens with the same pattern. Or: lazy-refresh inside `StorageWriter.init()` on token expiry. Decision in design.md.

### Phase D — Tier-gating + capability resolver

- Extend `apps/web/src/lib/billing/capabilities.ts` with `resolveStorageDestinations(tier) → { allowedTypes: StorageDestinationType[] }`. Pin per [Features §4.4](../../../shared/Baseout_Features.md) + [§6.6](../../../shared/Baseout_Features.md).
- **PATCH route validation**: existing `PATCH /api/spaces/:id/backup-config` rejects `storageType` values not in `resolveStorageDestinations(tier).allowedTypes`.
- **UI**: `StoragePicker.astro` enables tier-allowed destinations, locks the rest with a "Requires Growth" / "Requires Pro" / etc tooltip.

### Phase E — Proxy streaming for Box / Dropbox

- The engine's record-page and attachment-download paths already operate on `ReadableStream` (per `baseout-backup-attachments`). For `proxyStreamMode` writers, the engine SHALL NOT first stage the bytes in R2 — it pipes Airtable's response stream directly through `writer.writeFile`.
- Implementation: the `backup-base.task.ts` branch checks `writer.proxyStreamMode`; if true, skips the R2 staging step that managed-R2 takes. The CSV-buffering path (for static-mode record CSV) buffers in memory and writes a single CSV to the destination per base.

### Phase F — Retention & restore interop

- The retention engine (`baseout-backup-cleanup-engine`) calls `writer.delete(path)` per expired snapshot. Each strategy implements the delete semantics for its provider (file delete for OAuth providers, S3 `DeleteObject`).
- The future restore engine (not in scope) will call `writer.getDownloadUrl(path)` to fetch the snapshot for restore.

### Phase G — Doc sync

- Update [openspec/changes/baseout-server/specs/storage-destinations/spec.md](../baseout-server/specs/storage-destinations/spec.md) — link this change as the implementation.
- Update [shared/Baseout_Backlog_MVP.md](../../../shared/Baseout_Backlog_MVP.md) — tick the BYOS rows.
- Update [openspec/changes/baseout-server-schedule-and-cancel/proposal.md](../baseout-server-schedule-and-cancel/proposal.md) — link as resolved follow-up.

## Out of Scope

| Deferred to | Item |
|---|---|
| Future change `baseout-backup-custom-byos` | Custom/BYOS Pro+ destination per Features §6.6 — for self-hosted storage with a customer-provided endpoint. Different auth model (HMAC service token); separate concern. |
| Future change `baseout-backup-storage-failover` | Auto-failover to managed R2 when a BYOS provider is unreachable for > N minutes. Today: failure marks the run failed; next retry. |
| Future change `baseout-backup-byos-folder-picker` | Rich GUI folder picker for OAuth destinations (browse the connected account's directory tree). First-pass MVP creates a `Baseout-<spaceId>` folder at the root. |
| Future change `baseout-backup-byos-cleanup` | Retention cleanup of BYOS destinations. Today: BYOS retention is the customer's responsibility; managed-R2 retention is automated (see `baseout-backup-retention-and-cleanup`). |
| Future change `baseout-backup-restore-from-byos` | Restore-from-snapshot for BYOS destinations. Depends on restore engine. |
| Bundled with `baseout-backup-attachments` | Proxy streaming pattern for attachments. The Stream→writer plumbing in this change reuses the attachment downloader's `ReadableStream` shape. |
| Bundled with `baseout-server-cron-oauth-refresh` | Token-refresh cron for OAuth providers. Extends the existing refresh path to cover storage tokens. |

## Capabilities

### New capabilities

- `backup-storage-writer-interface` — common interface implemented by every destination strategy. Owned by `apps/server`.
- `backup-storage-destination-persistence` — `storage_destinations` table + encrypted secret persistence + OAuth callback handling. Owned by `apps/web`.
- `backup-storage-oauth-connect` — OAuth authorize/callback handlers per provider. Owned by `apps/web`.

### Modified capabilities

- `backup-engine` — strategy selection at run start; `proxyStreamMode` branching.
- `backup-config-policy` — `storageType` validation against tier.
- `capability-resolution` — `resolveStorageDestinations(tier)`.
- `backups-history-ui` — show which destination each run wrote to.

## Impact

- **Master DB**: one additive migration. New `storage_destinations` table with five encrypted-secret columns. Indexed on `space_id`.
- **Secrets**: every encrypted column uses the existing AES-256-GCM helper from `@baseout/shared`. The master encryption key MUST be shared between apps/web (encrypts on connect) and apps/server (decrypts in `StorageWriter.init`).
- **External rate limits**: Google Drive (1000 req/100s/user), Dropbox (1000 req/min per file-write endpoint), Box (10 req/sec/user), OneDrive (10000 req/10min/user), Frame.io (varies). The per-Connection lock pattern (already used by Airtable in ConnectionDO) can be reused for storage; out of scope for first pass unless rate limits show up in operational testing.
- **OAuth client secrets**: 5 new secrets in Cloudflare Secrets (or env): `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `DROPBOX_OAUTH_CLIENT_ID`, `DROPBOX_OAUTH_CLIENT_SECRET`, etc. Provisioning per [CLAUDE.md §3.3 Secrets](../../CLAUDE.md).
- **Cost**: outbound bandwidth from Worker → OAuth provider is per Cloudflare's Workers egress pricing. At MVP scale: trivial.
- **Security**: every secret AES-256-GCM at rest. No secret material ever logged. OAuth state cookie HMAC-signed against CSRF. The `connected_by_user_id` is the user who initiated the connection; rotation requires a re-connect by an admin.
- **Cross-app contract**:
  - apps/web → engine: existing `/runs/start` payload unchanged; engine reads `storage_destinations` directly via mirrored schema.
  - new internal: none. Strategy selection is engine-local.

## Reversibility

- **Phase A** (schema): additive. Reverting leaves the table empty.
- **Phase B** (interface): pure code addition.
- **Phase C** (OAuth flows): can be feature-flagged per provider. Disconnecting a Space's BYOS destination falls back to managed R2.
- **Phase D** (capability gating): roll-forward; reverting removes the lock.
- **Phase E** (proxy streaming): the `proxyStreamMode` branch is opt-in; removing it falls back to R2-stage-then-write (works but slow for those providers).

The only forward-only data is the customer-side written files. If we revert after a customer has BYOS-written snapshots, those snapshots remain in the customer's storage — that's fine because they own it. Baseout's master DB metadata stays consistent.
