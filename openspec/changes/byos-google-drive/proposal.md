## Why

V1 ships with **BYOS-only** storage on `main` ([R2 pause memo](../../../shared/internal/refactor-roadmap.md) — managed R2 is documented-pause via a separate `system-r2-park` change that lives on a different branch). Today, [`main`](../../../) has zero BYOS implementation: no `storage_destinations` table in [apps/web/src/db/schema](../../../apps/web/src/db/schema/), no `StorageWriter` interface in [apps/server/src/lib](../../../apps/server/src/lib/), no OAuth flow for any cloud provider, and no writer in [apps/workflows](../../../apps/workflows/). The [integrations page](../../../apps/web/src/pages/integrations.astro) surfaces Airtable Connections only.

Per [PRD §7.2](../../../shared/Baseout_PRD.md) and [Features §6.6](../../../shared/Baseout_Features.md):

> Google Drive — BYOS — OAuth — No proxy — All tiers.

Google Drive is the **first BYOS destination to ship** because (a) it has the broadest user base, (b) it's the only destination that needs no proxy stream (Drive's resumable-upload API accepts piped streams directly from Worker memory), and (c) the boss has handed over Google Cloud Console OAuth credentials with the redirect URI `https://localhost:4331/oauth/callback/google` already registered in project `baseout-dev`.

A complete Drive implementation exists on branch `autumn/backup-fix-local` (commits `52c1315` / `cea7f08` / `c8d3d1a`, ~50 files, tests green) — but that branch is being treated as untrusted because prior Drive work clobbered Airtable OAuth at least once. This change re-lands Drive on a clean branch (`autumn/byos-drive-clean`) from `main`, with hard-isolation constraints around Airtable code.

## What Changes

End-to-end Google Drive as the first BYOS cloud destination. Five vertical-slice phases (each independently testable):

**Phase A — Schema (apps/web + engine mirror)**
- **Add** [apps/web/drizzle/0009_storage_destinations.sql](../../../apps/web/drizzle/) — per-Space table matching [Master_DB_Schema §322](../../../shared/Master_DB_Schema.md). Columns: `id`, `space_id` (FK CASCADE), `destination_type` (CHECK in `'google_drive'` only this change; widens with future providers), `display_name`, `is_default`, `access_token_enc`, `refresh_token_enc`, `token_expires_at`, `config_json` (jsonb: `{folder_id, folder_name, account_email}` for Drive), `status` (`'active' | 'invalid' | 'pending_auth'`), `created_at`, `modified_at`. UNIQUE `(space_id)` for V1 (one destination per Space).
- **Add** [apps/web/drizzle/0010_oauth_states.sql](../../../apps/web/drizzle/) — CSRF + PKCE state-handoff table behind the sealed cookie. Columns: `state` (PK text), `space_id` (FK CASCADE), `code_verifier_enc`, `created_at` (indexed for 10-minute purge).
- **Add** [apps/server/src/db/schema/storage-destinations.ts](../../../apps/server/src/db/schema/) — engine mirror with canonical-source header comment per [CLAUDE.md §5.3](../../../CLAUDE.md).

**Phase B — Storage interface (apps/server)**
- **Add** [apps/server/src/lib/storage/storage-writer.ts](../../../apps/server/src/lib/storage/) — `StorageWriter` interface (`init`, `writeFile(stream, path)`, `getDownloadUrl(path)`, `delete(path)`, `deletePrefix(prefix)`) + `resolveStorageWriter(type, creds?)` factory. Factory dispatches Drive only in this change; `local_fs` (existing dev path) remains as default fallback.

**Phase C — Web OAuth Connect flow (apps/web)**
- **Add** [apps/web/src/lib/google-drive/](../../../apps/web/src/lib/) — `config.ts` (env reader), `oauth.ts` (PKCE-S256 + token exchange + refresh), `cookie.ts` (encrypted handoff cookie, mirroring [apps/web/src/lib/airtable/cookie.ts](../../../apps/web/src/lib/airtable/cookie.ts) **by copy, not by shared module**), `client.ts` (Drive v3 REST wrapper — userinfo, folders.create, drive.about), `persist.ts` (upsert `storage_destinations` row + encrypt tokens).
- **Add** [apps/web/src/pages/api/connections/storage/google-drive/](../../../apps/web/src/pages/api/connections/storage/) — `authorize.ts` (POST, generates PKCE state, seals cookie, redirects to Google consent), `disconnect.ts` (POST, deletes the row).
- **Add** [apps/web/src/pages/oauth/callback/google.ts](../../../apps/web/src/pages/oauth/) — GET handler matching the registered redirect URI. Validates state, exchanges code, calls userinfo + Drive folders.create for a per-Space `Baseout-<spaceId>` folder, upserts `storage_destinations`. Drive scopes: `profile` + `https://www.googleapis.com/auth/drive.file` + `https://www.googleapis.com/auth/drive.appdata` (the only three available per the boss's OAuth-consent screen config).
- **Edit** [apps/web/src/components/backups/StoragePicker.astro](../../../apps/web/src/components/backups/) — Drive option enabled, Connect button when no row exists, "Connected as <email>" when one does. Spinner via [`setButtonLoading`](../../../apps/web/src/lib/ui.ts).
- **Edit** [apps/web/src/lib/integrations.ts](../../../apps/web/src/lib/) — additive: extend `IntegrationsState` with `googleDriveConnected: boolean` + `googleDriveAccountEmail: string | null`. Existing Airtable fields untouched.
- **Edit** [apps/web/src/stores/connections.ts](../../../apps/web/src/stores/) — additive: surface the new fields on the existing store. Existing atoms untouched.

**Phase D — Engine credential route (apps/server)**
- **Add** [apps/server/src/pages/api/internal/spaces/[spaceId]/storage-destination.ts](../../../apps/server/src/pages/api/internal/) — `GET`, `INTERNAL_TOKEN`-gated. Decrypts access + refresh tokens, lazy-refreshes when `expires_at` is within 5 minutes (or `?refresh=1` forces it), persists refreshed access token + new `expires_at`. Response shape: `{ destinationType, accessToken, expiresAt, config: { folderId, folderName } }`. Refresh token never returned to workflows.
- **Add** [apps/server/src/lib/storage/refresh-drive.ts](../../../apps/server/src/lib/storage/) — `DriveRefreshOutcome` discriminated union (`success` / `pending_reauth` / `transient` / `invalid`). Mirrors the existing [airtable-refresh.ts](../../../apps/server/src/lib/airtable-refresh.ts) shape (if it exists; otherwise lifted from the Airtable refresh inline in callers).

**Phase E — Workflows writer (apps/workflows)**
- **Add** [apps/workflows/trigger/tasks/\_lib/storage-writers/google-drive.ts](../../../apps/workflows/trigger/tasks/_lib/) — implements `StorageWriter`. Drive v3 resumable upload (`POST /upload/drive/v3/files?uploadType=resumable`), per-instance sub-folder cache, **proactive refresh** when token <5min from expiry + **reactive 401-retry-once** on the rare race, path-traversal guard (reject `..` and absolute paths), idempotent `deletePrefix` via Drive folder recursive DELETE.
- **Add** [apps/workflows/trigger/tasks/\_lib/storage-writers/index.ts](../../../apps/workflows/trigger/tasks/_lib/) — `resolveStorageWriter(type, creds?)` factory mirroring the engine factory. Falls back to `LocalFsWriter` for unknown types (defensive).
- **Edit** [apps/workflows/trigger/tasks/backup-base.task.ts](../../../apps/workflows/trigger/tasks/) — when `storageType === 'google_drive'`, fetch creds from the engine internal route (Phase D); pass a `refresh()` closure that re-hits the endpoint with `?refresh=1`.
- **Edit** [apps/web/src/lib/backup-config/persist-policy.ts](../../../apps/web/src/lib/backup-config/) — widen accept-list to `{'local_fs', 'google_drive'}`. (R2 remains absent on this branch.)

**Tests** (every phase has its own):
- Web unit: `oauth.test.ts`, `cookie.test.ts`, `client.test.ts`, `persist.test.ts`, `integrations.test.ts` extension.
- Web integration: `oauth/callback/google.test.ts` against MSW-mocked Google endpoints.
- Engine unit: `refresh-drive.test.ts`.
- Engine integration (Miniflare): `storage-destination.route.test.ts` (`INTERNAL_TOKEN` gate, decrypt, refresh path).
- Workflows unit: `google-drive.test.ts` (resumable upload, refresh-retry, traversal guard, deletePrefix).
- **Airtable smoke checkpoint** after every phase that touches `stores/connections.ts`, `integrations.ts`, `crypto.ts`, or middleware (per [feedback-dont-break-airtable-auth](../../../../.claude/projects/-Users-autumnshakespeare-baseout/memory/feedback_dont_break_airtable_auth.md)).

## Capabilities

### New Capabilities

- `byos-google-drive` — end-to-end Google Drive as a per-Space BYOS storage destination, spanning `apps/web` (OAuth + UI + schema), `apps/server` (engine schema mirror + credential route + refresh policy), and `apps/workflows` (writer). Spec: [specs/byos-google-drive/spec.md](./specs/byos-google-drive/spec.md).

### Modified Capabilities

None at the spec level. The Airtable Connection capability is **explicitly out of scope** and untouched.

## Hard Constraints (carry into implementation)

1. **DO NOT modify Airtable OAuth code.** No edits to [apps/web/src/lib/airtable/](../../../apps/web/src/lib/airtable/), [apps/web/src/pages/api/connections/airtable/](../../../apps/web/src/pages/api/connections/airtable/), or anything routed through them. Integrations store changes are **additive only**.
2. **DO NOT create shared OAuth utilities** between Airtable and Drive. Mirror the pattern by copy; do not extract. Per [memory feedback-dont-break-airtable-auth](../../../../.claude/projects/-Users-autumnshakespeare-baseout/memory/feedback_dont_break_airtable_auth.md), shared utils were the suspected regression vector in prior Drive work.
3. **DO NOT pull from `autumn/backup-fix-local`.** Reference its commits for design intent (`git show 52c1315 / cea7f08 / c8d3d1a`) — do not cherry-pick. The branch is treated as untrusted.
4. **DO NOT touch R2.** Managed R2 stays absent on this branch (the `system-r2-park` change is on the WIP branch, not on `main`). Out of scope for `byos-google-drive`.
5. **Tier gating:** Drive available to **every tier (Starter+)** per Features §6.6. No capability check needed.
6. **Encryption:** all tokens AES-256-GCM via [apps/web/src/lib/crypto.ts](../../../apps/web/src/lib/crypto.ts) and `env.BASEOUT_ENCRYPTION_KEY` (already provisioned in `.dev.vars`). Per [PRD §20.2](../../../shared/Baseout_PRD.md).
7. **OAuth scopes** are the three the boss has approved in the consent screen: `profile`, `https://www.googleapis.com/auth/drive.file`, `https://www.googleapis.com/auth/drive.appdata`. No other scopes may be requested without a new boss approval.
8. **Redirect URI** is `https://localhost:4331/oauth/callback/google` (dev) — already registered in Google Cloud Console for project `baseout-dev`. Prod redirect URI is `https://console.baseout.dev/oauth/callback/google` (also registered).

## Impact

| Area | New | Edited | Deleted |
|---|---|---|---|
| `apps/web/drizzle` | 2 (schema migrations + meta snapshots) | journal | — |
| `apps/web/src/db/schema` | 1 (storage_destinations + oauth_states tables in `core.ts` ext or new files) | `core.ts` (additive) | — |
| `apps/web/src/lib/google-drive` | 5 + 5 tests | — | — |
| `apps/web/src/pages/api/connections/storage/google-drive` | 2 (authorize, disconnect) | — | — |
| `apps/web/src/pages/oauth/callback` | 1 (google.ts) + test | — | — |
| `apps/web/src/components/backups/StoragePicker.astro` | — | 1 (Drive option) | — |
| `apps/web/src/lib/integrations.ts` + `stores/connections.ts` | — | 2 (additive only) | — |
| `apps/web/src/lib/backup-config/persist-policy.ts` | — | 1 (accept-list widen) | — |
| `apps/server/src/db/schema/storage-destinations.ts` | 1 | `index.ts` | — |
| `apps/server/src/lib/storage/` | 2 (storage-writer.ts, refresh-drive.ts) + tests | — | — |
| `apps/server/src/pages/api/internal/spaces/[spaceId]/storage-destination.ts` | 1 + test | — | — |
| `apps/workflows/trigger/tasks/_lib/storage-writers` | 2 (google-drive.ts, index.ts) + tests | — | — |
| `apps/workflows/trigger/tasks/backup-base.task.ts` | — | 1 (Drive branch) | — |
| New env vars | `GOOGLE_DRIVE_OAUTH_CLIENT_ID`, `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET` (already in `.dev.vars`; document in `.env.example`) | — | — |

## Reversibility

Branch-isolated: revert by `git checkout main && git branch -D autumn/byos-drive-clean`. No `main` commits planned in this change; no production rollout planned in this change (user-tested local-commit loop per [memory feedback-no-prs-human-test-then-local-commit](../../../../.claude/projects/-Users-autumnshakespeare-baseout/memory/feedback_no_prs_human_test_then_local_commit.md)).

If landed and a regression appears: the Drive code is in its own modules; revert is `git revert` of the Phase-E commit (writer) → Phase-D (engine route) → Phase-C (OAuth flow). Phase A/B (schema + interface) can stay because they don't change Airtable behavior.

The two schema migrations are additive (new tables only); rolling back means dropping the two tables — destructive but safe (no existing rows on `main`).
