## Phase A — Schema

### A.1 — Migration

- [ ] A.1.1 Generate `apps/web/drizzle/0011_storage_destinations.sql` per design.md §Phase A.
- [ ] A.1.2 Apply via `pnpm --filter @baseout/web db:migrate`. Verify with `psql ... -c "\d baseout.storage_destinations"`.
- [ ] A.1.3 Update [apps/web/src/db/schema/core.ts](../../../apps/web/src/db/schema/core.ts) — add `storageDestinations` table.

### A.2 — Engine mirror

- [ ] A.2.1 New file `apps/server/src/db/schema/storage-destinations.ts`. Header comment naming the canonical migration.

### A.3 — `oauth_states` for CSRF

- [ ] A.3.1 Migration `0012_oauth_states.sql` — `id`, `state`, `space_id`, `user_id`, `provider`, `created_at` (with expiry index on `created_at`).

## Phase B — `StorageWriter` interface + R2 baseline

### B.1 — Interface

- [ ] B.1.1 New file `apps/server/src/lib/storage/storage-writer.ts` — interface + `makeStorageWriter` factory per design.md §Phase B.
- [ ] B.1.2 TDD red: `make-storage-writer.test.ts` — every `type` value dispatches to the correct class; unknown `type` throws.

### B.2 — R2 managed strategy (no behavior change, refactor only)

- [ ] B.2.1 New file `apps/server/src/lib/storage/strategies/r2-managed.ts` — wraps existing `env.BACKUPS_R2.put`/`get`/`delete`. Implements the full interface.
- [ ] B.2.2 TDD: `r2-managed.test.ts` — writeFile streams to R2 bucket via Miniflare; getDownloadUrl + delete also covered.
- [ ] B.2.3 Workflows-side refactor of `backup-base.task.ts` to use `makeStorageWriter` is owned by [`baseout-workflows-byos-destinations`](../baseout-workflows-byos-destinations/tasks.md). Server side guarantees `makeStorageWriter` API stability.

## Phase C — Per-provider strategies

Ship in this order: Google Drive → S3 → Dropbox → Box → OneDrive → Frame.io. Each provider is one sub-phase; OAuth flow + strategy class + tests together.

### C.1 — Google Drive

- [ ] C.1.1 Register Baseout app in Google Cloud Console. Capture client ID + secret. Add to Cloudflare Secrets per CLAUDE.md §3.3.
- [ ] C.1.2 New route `apps/web/src/pages/api/connections/storage/google-drive/authorize.ts`. State token persisted in `oauth_states`. Redirect URL built per Google's OAuth2 spec.
- [ ] C.1.3 New route `apps/web/src/pages/api/connections/storage/google-drive/callback.ts`. Validates state, exchanges code → tokens via `https://oauth2.googleapis.com/token`, encrypts tokens with master key, UPSERTs `storage_destinations`.
- [ ] C.1.4 New strategy `apps/server/src/lib/storage/strategies/google-drive.ts`. Implements full interface. Token-refresh-on-401 retry.
- [ ] C.1.5 Tests: authorize/callback route tests + strategy unit tests (mock the Google API).
- [ ] C.1.6 Manual smoke: connect a real dev Google account, run a backup, verify a CSV lands in the Baseout-<spaceId> folder.

### C.2 — Amazon S3

- [ ] C.2.1 New route `apps/web/src/pages/api/connections/storage/s3/configure.ts`. Accepts `{ accessKeyId, secretAccessKey, region, bucket, prefix }`. Validates with `HeadBucket` via AWS SDK or signed-fetch. Encrypts + persists.
- [ ] C.2.2 New strategy `apps/server/src/lib/storage/strategies/s3.ts`. AWS Signature v4. PutObject + multipart upload.
- [ ] C.2.3 Tests: configure-route + strategy unit tests (mock S3 API).
- [ ] C.2.4 Manual smoke against a real dev S3 bucket.

### C.3 — Dropbox

- [ ] C.3.1 Register app in Dropbox developer portal. Secrets to Cloudflare.
- [ ] C.3.2 authorize.ts + callback.ts.
- [ ] C.3.3 Strategy: `proxyStreamMode=true`. Use `/2/files/upload_session/start` for files > 150 MB.
- [ ] C.3.4 Tests: OAuth flow + strategy + proxy-mode integration.
- [ ] C.3.5 Manual smoke.

### C.4 — Box

- [ ] C.4.1 Register app. Secrets to Cloudflare.
- [ ] C.4.2 authorize.ts + callback.ts.
- [ ] C.4.3 Strategy: `proxyStreamMode=true`. Chunked upload via `/files/content` + `/files/upload_sessions` for large files.
- [ ] C.4.4 Tests + manual smoke.

### C.5 — OneDrive

- [ ] C.5.1 Register app in Azure Portal. Secrets.
- [ ] C.5.2 authorize.ts + callback.ts.
- [ ] C.5.3 Strategy: Microsoft Graph upload-session for large files.
- [ ] C.5.4 Tests + manual smoke.

### C.6 — Frame.io

- [ ] C.6.1 Register app. Secrets.
- [ ] C.6.2 authorize.ts + callback.ts.
- [ ] C.6.3 Strategy: Frame.io v2 API.
- [ ] C.6.4 Tests + manual smoke.

## Phase D — Capability resolver + UI

### D.1 — `resolveStorageDestinations`

- [ ] D.1.1 TDD red: extend `apps/web/src/lib/billing/capabilities.test.ts` — all seven tiers, allowed destinations per [Features §4.4](../../../shared/Baseout_Features.md).
- [ ] D.1.2 Implement in `apps/web/src/lib/billing/capabilities.ts`.

### D.2 — PATCH validation

- [ ] D.2.1 Update `apps/web/src/pages/api/spaces/[spaceId]/backup-config.ts` to validate `storageType` against `resolveStorageDestinations(tier).allowedTypes`.
- [ ] D.2.2 Extend the PATCH test file with the lower-tier reject cases.

### D.3 — StoragePicker UI

- [ ] D.3.1 Update [apps/web/src/components/backups/StoragePicker.astro](../../../apps/web/src/components/backups/StoragePicker.astro) — enable tier-allowed destinations; lock the rest with tier-tooltip.
- [ ] D.3.2 Each non-`r2_managed` option shows a "Connect <provider>" button if not yet connected.
- [ ] D.3.3 After successful connect, the picker shows the connected account name + a "Disconnect" link.

### D.4 — Disconnect route

- [ ] D.4.1 `DELETE /api/spaces/:id/storage-destination`. Removes the row; resets to `r2_managed` default.

## Phase E — Engine integration

### E.1 — Strategy selection (moved to workflows sibling)

Workflows-side wiring lives in [`baseout-workflows-byos-destinations`](../baseout-workflows-byos-destinations/tasks.md). Server side owns the `loadStorageDestination(spaceId)` engine-callback (route + DB query); workflows side calls it.

- [ ] E.1.1 New `apps/server/src/pages/api/internal/spaces/:id/storage-destination.ts`. POST → returns the resolved `StorageDestination` row + decrypted credentials. INTERNAL_TOKEN-gated.
- [ ] E.1.2 Vitest under `apps/server/tests/integration/storage-destination-route.test.ts`.

## Phase F — Retention integration

- [ ] F.1 Update `runCleanupPass` (from `baseout-backup-retention-and-cleanup`) — for `r2_managed` destinations only, call `writer.delete(path)`. For BYOS destinations, skip the delete (customer-managed) but still set `backup_runs.deleted_at` so the history widget hides the row.
- [ ] F.2 Tests for the BYOS-skip path.

## Phase G — Documentation scope-lock

- [ ] G.1 Update [openspec/changes/baseout-server/specs/storage-destinations/spec.md](../baseout-server/specs/storage-destinations/spec.md) — link this change as the implementation.
- [ ] G.2 Update [shared/Baseout_Backlog_MVP.md](../../../shared/Baseout_Backlog_MVP.md).
- [ ] G.3 Update [openspec/changes/baseout-server-schedule-and-cancel/proposal.md](../baseout-server-schedule-and-cancel/proposal.md) Out-of-Scope table.

## Phase H — Final verification

- [ ] H.1 `pnpm --filter @baseout/server typecheck && pnpm --filter @baseout/server test` — all green.
- [ ] H.2 `pnpm --filter @baseout/web typecheck && pnpm --filter @baseout/web test:unit` — all green.
- [ ] H.3 Human checkpoint smoke: per provider, connect a real dev account, run a backup, verify a file lands at the destination. Run a backup of a base with attachments → verify attachments land too (depends on attachments change shipping).
- [ ] H.4 On approval: stage by name, commit locally.

## Out of this change (follow-ups, file separately)

- [ ] OUT-1 `baseout-backup-custom-byos` — Pro+ self-hosted destination with HMAC service-token auth.
- [ ] OUT-2 `baseout-backup-byos-folder-picker` — Rich GUI folder picker for OAuth destinations.
- [ ] OUT-3 `baseout-backup-storage-failover` — Auto-failover to managed R2 on extended provider downtime.
- [ ] OUT-4 `baseout-backup-byos-cleanup` — Optional Baseout-side retention enforcement for BYOS destinations.
- [ ] OUT-5 `baseout-backup-restore-from-byos` — Restore engine support for BYOS source.
- [ ] OUT-6 Extend `baseout-server-cron-oauth-refresh` — Refresh `storage_destinations.oauth_*` tokens proactively rather than lazy.
