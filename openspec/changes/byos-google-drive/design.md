## Context

Google Drive is the **first BYOS destination** on `main`. There is no precedent in the current codebase for a storage-destination OAuth flow, a per-Space encrypted-credential row, or a `StorageWriter` that consumes refreshable creds from the engine. The only OAuth flow that exists is **Airtable Platform Connection** ([apps/web/src/lib/airtable/](../../../apps/web/src/lib/airtable/)) — which we are forbidden from sharing code with, but free to mirror in pattern. This design pins down the shape of every interface that Drive will introduce, with explicit notes on what NOT to share with Airtable.

A previous attempt at this work landed on `autumn/backup-fix-local` (commits `52c1315` / `cea7f08` / `c8d3d1a`). The boss has flagged that branch as having broken Airtable OAuth at some point; we are rebuilding from `main` with hard-isolation constraints. Where the prior implementation made smart choices that don't violate the isolation rule, this design reuses them.

## Goals

- One module per surface (web OAuth, engine credential route, workflows writer). Each has a single concern and its own test file.
- All Drive-specific code lives under `*/google-drive/` or `*/storage-writers/google-drive*` paths — easy to grep, easy to revert.
- The `StorageWriter` interface ships sized for V1's six BYOS destinations but factory-dispatches **only Drive** in this change. Adding Dropbox/Box/OneDrive/S3 later is "add a strategy + a factory branch."
- Token refresh is **engine-owned**, not workflows-owned — refresh-during-upload races are a known pain point that's worth centralizing.
- **Zero risk to Airtable.** Every shared touch-point (`stores/connections.ts`, `integrations.ts`) takes additive-only edits; every helper Drive needs gets its own copy.

## Non-Goals

- **Dropbox / Box / OneDrive / S3 / Frame.io / R2.** Each is a separate change. Drive ships first because it has zero proxy requirement and the boss has handed over working credentials.
- **Folder picker UI** (the user choosing an arbitrary Drive folder). Drive creates a `Baseout-<spaceId>` folder at the root of My Drive on first Connect; revisiting picker is a follow-up. Per PRD §10 the picker is "post-OAuth"; deferring keeps the slice tight.
- **Multi-destination per Space.** Schema supports `is_default` boolean for future multi-destination, but `UNIQUE (space_id)` is the V1 constraint. Lifting it is a future change.
- **Tier gating in the picker.** Drive is "All tiers" per Features §6.6, so no `enforceCapability` call is needed. (The first destination that DOES need gating — S3 / Frame.io — will be the first to use the helper from [baseout-web-capability-api](../baseout-web-capability-api/proposal.md).)
- **Sharing OAuth utilities with Airtable.** Explicitly out; see Decisions D1 and D8.
- **Touching `apps/web/src/lib/airtable/`** in any way, even seemingly-safe refactors. Out for this entire change.
- **Touching `apps/web/src/middleware.ts`** beyond what's required to let `/oauth/callback/google` through unauthenticated-on-arrival (which it likely isn't — the user is in-session when they kick off Connect; we'll verify before deciding the route needs a `PUBLIC_PATHS` entry).
- **Managed R2.** Out per the system-r2-park stance (which lives on `autumn/backup-fix-local`, not on `main`; the pause is documented in [memory project-r2-documented-pause](../../../../.claude/projects/-Users-autumnshakespeare-baseout/memory/project_r2_documented_pause.md)).

## Decisions

### D1 — One module per provider; no cross-provider shared OAuth utils

Every OAuth flow on this project gets its own module tree:

- Airtable: [apps/web/src/lib/airtable/](../../../apps/web/src/lib/airtable/) — **do not touch**.
- Google Drive: `apps/web/src/lib/google-drive/` — new in this change.

Both modules will end up with very similar `oauth.ts` / `cookie.ts` / `client.ts` / `persist.ts` files. That is **intentional duplication**. Per [feedback-dont-break-airtable-auth](../../../../.claude/projects/-Users-autumnshakespeare-baseout/memory/feedback_dont_break_airtable_auth.md), the prior Drive work introduced shared OAuth utils between Airtable and Drive, and that was the suspected regression vector. Rule of three applies — wait for Dropbox (#3) before extracting any shared helper.

**Why:** YAGNI + explicit isolation. The cost of duplicating ~200 lines of OAuth boilerplate is well below the cost of regressing Airtable.

**Trade-off:** Future bug fixes to the OAuth pattern require touching N files. Acceptable — OAuth code is small, well-tested, and changes rarely after Connect/disconnect round-trips work.

### D2 — `storage_destinations` schema matches Master_DB_Schema §322 verbatim

Use the canonical shape from [shared/Master_DB_Schema.md §322](../../../shared/Master_DB_Schema.md):

```sql
storage_destinations (
  id                    uuid PK,
  space_id              uuid NOT NULL FK→spaces ON DELETE CASCADE,
  destination_type      text NOT NULL CHECK (destination_type IN ('google_drive')),  -- widens with future providers
  display_name          text NOT NULL,
  is_default            boolean NOT NULL DEFAULT false,
  access_token_enc      text NULL,
  refresh_token_enc     text NULL,
  token_expires_at      timestamptz NULL,
  config_json           jsonb NULL,  -- Drive: { folder_id, folder_name, account_email }
  status                text NOT NULL CHECK (status IN ('active', 'invalid', 'pending_auth')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  modified_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id)
)
```

CHECK constraints are narrowed to `'google_drive'` only in this change. Future providers widen the CHECK in their own change (Dropbox migration adds `'dropbox'`, etc.). The migration to widen is a single `ALTER TABLE ... DROP CONSTRAINT / ADD CONSTRAINT` — cheap.

**Why narrow:** unknown-value writes become CHECK failures instead of silently-broken rows.

**Why `UNIQUE (space_id)`:** V1 ships with one destination per Space (per [PRD §5.1](../../../shared/Baseout_PRD.md)). Multi-destination is a future feature.

### D3 — `oauth_states` is a small CSRF-handoff table; sealed cookie is primary

PKCE state + code-verifier travel two ways:

- **Primary:** AES-256-GCM-encrypted cookie set on Connect; read on callback. Same pattern as [apps/web/src/lib/airtable/cookie.ts](../../../apps/web/src/lib/airtable/cookie.ts).
- **Fallback:** `oauth_states` table row keyed by `state`, expiry = 10 min, indexed `created_at` for purge. Used when the cookie comes back missing (cross-site cookie quirks in some browsers).

**Why both:** Airtable already does this and it has proven robust; Drive shouldn't be weaker.

**Why a separate table:** different lifecycle from `storage_destinations` (10-min TTL vs. permanent), different access pattern. Conflating would muddle the schema.

### D4 — Scopes pinned to `profile` + `drive.file` + `drive.appdata`

These are the three the boss has approved in the OAuth consent screen for project `baseout-dev`. **Do not request additional scopes** without re-approval.

- `profile` — needed for the `Connected as <email>` display.
- `drive.file` — Baseout sees only files Baseout itself creates. No risk of accidentally listing the user's whole Drive.
- `drive.appdata` — hidden per-app folder, for any future per-Space metadata Baseout might want to colocate with the user's data.

The `drive.file` scope means the user's entire Drive is **invisible to Baseout** by design. This is a security feature, not a limitation.

**Why pinned:** scope creep on OAuth consent screens needs re-review by Google when going to production. Easier to stay narrow.

### D5 — `Baseout-<spaceId>` folder created at root on first Connect

On the OAuth callback, after token exchange + userinfo, the Drive client calls `POST /drive/v3/files` with `{ name: "Baseout-<spaceId>", mimeType: "application/vnd.google-apps.folder", parents: ["root"] }`. The returned folder ID is stored in `config_json.folder_id`; the chosen name in `config_json.folder_name`.

Subsequent backups land inside that folder. Re-Connect re-uses the existing folder (lookup by name + parent).

**Why:** zero-config; the user doesn't have to navigate a picker on first Connect. Picker can come later.

**Trade-off:** users with a pre-existing `Baseout-<spaceId>` folder might collide. Drive folder names aren't unique — this is fine; we always resolve by folder ID, not name.

### D6 — Engine owns token refresh; workflows are stateless

Workflows do NOT call Google's token endpoint. The engine internal route handles all refreshes:

```
workflows ──[GET /api/internal/spaces/:id/storage-destination]──> engine
                                                                      │
                                                                      ▼
                                                        if expires_at < now + 5min:
                                                          refresh against Google,
                                                          persist new access_token
                                                                      │
                                                                      ▼
                                                        respond with current access_token
```

The workflow gets a `refresh()` closure that re-hits the same endpoint with `?refresh=1` to force a refresh on a reactive 401 (proactive 5-min margin + reactive once-only on 401).

**Why:** centralizes the refresh-during-race logic in one place. Workflows can be killed and resumed without losing refresh state.

**Trade-off:** one extra round-trip per backup vs. caching creds inside the worker. Worth it for the simpler invariants.

### D7 — `DriveRefreshOutcome` discriminated union, not exceptions

```ts
type DriveRefreshOutcome =
  | { kind: 'success'; accessToken: string; expiresAt: Date }
  | { kind: 'pending_reauth'; reason: 'invalid_grant' | 'unauthorized' }
  | { kind: 'transient'; retryAfterMs: number }
  | { kind: 'invalid'; reason: string };
```

Caller switches on `kind`. `pending_reauth` flips `storage_destinations.status = 'pending_auth'` (next user Connect re-authorizes). `transient` retries. `invalid` fails the run with a typed reason.

**Why:** discriminated unions force the caller to handle every refresh outcome at the type level. Exceptions force runtime handling that's easy to forget.

**Trade-off:** more boilerplate at the switch site vs. a `try/catch`. Worth it for the type guarantees.

### D8 — Integrations store changes are **additive only**

The existing [apps/web/src/stores/connections.ts](../../../apps/web/src/stores/connections.ts) holds Airtable Connection state. Drive extends it by adding two **new optional fields** to the existing types:

```ts
type IntegrationsState = {
  connections: Connection[];           // existing — DO NOT TOUCH
  bases: Base[];                       // existing — DO NOT TOUCH
  tierBasesPerSpace: number;           // existing — DO NOT TOUCH
  hasBackupConfig: boolean;            // existing — DO NOT TOUCH
  googleDriveConnected?: boolean;      // NEW — additive
  googleDriveAccountEmail?: string | null;  // NEW — additive
};
```

No existing field is removed, renamed, or re-typed. Any existing Airtable code that reads `state.connections` keeps working unchanged.

**Why:** the [memory feedback-dont-break-airtable-auth](../../../../.claude/projects/-Users-autumnshakespeare-baseout/memory/feedback_dont_break_airtable_auth.md) calls out integrations-store changes as a regression vector. Additive-only avoids touching any Airtable code path.

### D9 — Callback route lives under `/api/connections/storage/google-drive/callback`

The redirect URI is `https://baseout.local:4331/api/connections/storage/google-drive/callback` (dev) / `https://console.baseout.dev/api/connections/storage/google-drive/callback` (prod). The earlier `https://localhost:4331/oauth/callback/google` registration is stale on two axes: the path doesn't route on this branch, and `localhost:4331` is unsupported per [oauth-setup.md §5.5](../../../shared/internal/oauth-setup.md). Boss to register the new URIs and remove the stale one per [oauth-setup.md §4.1](../../../shared/internal/oauth-setup.md).

All Drive routes (authorize / callback / disconnect) live under `/api/connections/storage/google-drive/` for consistency with the existing Airtable `/api/connections/airtable/start|callback` layout and the parallel paths reserved for Box / Dropbox / OneDrive.

**Why:** keep one path shape across all OAuth providers — easier middleware regex, easier docs, no special-case for Drive.

### D10 — Drive writer uses resumable upload, **not** simple upload

Drive v3 `POST /upload/drive/v3/files?uploadType=media` accepts a single-shot upload — fine for small files. For backup CSVs which can be tens of MB and attachments which can be hundreds of MB, we use `uploadType=resumable`:

1. `POST /upload/drive/v3/files?uploadType=resumable` with metadata → returns `Location: <session-uri>`.
2. `PUT <session-uri>` with the stream → 200 with file metadata.

The Workers runtime accepts a `ReadableStream` as the `PUT` body without buffering; the Drive resumable endpoint accepts a chunked stream.

**Why:** Workers has a 128MB memory ceiling. Buffering 100MB attachments breaks it. Resumable upload streams.

**Trade-off:** two round-trips per file instead of one. Acceptable — file count is bounded by the Airtable schema, not by user volume.

### D11 — `deletePrefix` for retention: recursive folder delete, not file enumeration

For Smart Rolling Cleanup ([Features §6.9](../../../shared/Baseout_Features.md)), retention drops older snapshot folders. The Drive writer's `deletePrefix(prefix)` resolves a sub-folder by name within the per-Space root and `DELETE`s it. Drive's recursive folder delete handles all children atomically.

**Why:** simpler than enumerating children, listing pages, deleting one-by-one. Atomic.

**Trade-off:** no per-file feedback on which files were dropped. Acceptable for retention; not used for surgical operations.

## Risks / Trade-offs

| # | Risk | Likelihood | Mitigation |
|---|------|------------|------------|
| R1 | Drive work edits a file that Airtable OAuth depends on, breaking Connect or refresh | **Medium-High** (the explicit reason this change exists) | Hard rule: zero edits under `apps/web/src/lib/airtable/`, `apps/web/src/pages/api/connections/airtable/`. Additive-only edits to shared scaffolding. Airtable smoke checkpoint after every phase that touches a shared file. PR-style review checklist in `tasks.md`. |
| R2 | Token-refresh race: workflow uploads with stale token, Google returns 401, refresh succeeds but second 401 (very unlikely) | Low | Reactive 401-retry-**once-only**. If a second 401 fires after a forced refresh, treat as `pending_reauth` and fail the run with a typed reason. |
| R3 | `drive.file` scope means Baseout can't see folders not created by Baseout — if the user manually moves the `Baseout-<spaceId>` folder, lookup-by-id still works, but the user might be confused | Low | Documented in the success-state UI ("Files Baseout creates are visible to Baseout; everything else in your Drive stays invisible"). |
| R4 | `oauth_states` table fills up if the 10-min purge never runs | Low | Cron in [apps/server](../../../apps/server/) — a 10-min purge cron is a future addition; for V1 the cookie is the primary path and `oauth_states` is rarely written. |
| R5 | User revokes Drive access from their Google account → next backup fails with `pending_reauth` | Expected | `status='pending_auth'` flag on the row; UI shows a Re-connect button. Backup runs fail gracefully with a typed reason. |
| R6 | The migration adds two tables to `apps/web/drizzle/` — drizzle-kit's snapshot regeneration will rewrite `_journal.json` and `meta/*` | Expected | Re-run `pnpm --filter @baseout/web db:check` after generating; commit the regenerated snapshots in the same commit as the SQL files. |
| R7 | Refresh tokens are returned only on first consent (Google quirk). If a user re-Connects without revoking first, no refresh token comes back; existing refresh token must be preserved | Medium | `persist.ts` upserts access token + expires_at on every callback, but only overwrites `refresh_token_enc` when the callback response includes one. Test for this case explicitly. |

## Verification

Phase-by-phase smoke commands (also enumerated in [tasks.md](./tasks.md)):

```bash
# After each phase
pnpm --filter @baseout/web typecheck
pnpm --filter @baseout/server typecheck
pnpm --filter @baseout/workflows typecheck
pnpm --filter @baseout/web test
pnpm --filter @baseout/server test
pnpm --filter @baseout/workflows test
```

**Airtable smoke (after every phase that touches shared scaffolding):**

```bash
pnpm --filter @baseout/web test -- airtable
# Manual: in dev, click Connect Airtable on /integrations; expect success.
# Manual: confirm existing Airtable Connections still listed on /integrations.
```

**Phase-E end-to-end smoke (operator):**

```
1. Apply migrations: pnpm --filter @baseout/web db:migrate
2. Start web dev: pnpm --filter @baseout/web dev
3. Start workflows: pnpm --filter @baseout/workflows trigger:dev
4. Navigate to /integrations → click Connect Google Drive
5. Google consent screen → grant → redirected to /integrations?connected=google_drive
6. Confirm storage_destinations row exists: psql ... -c "SELECT * FROM storage_destinations"
7. Trigger a backup: /backups → Run Now
8. Open Google Drive in browser → confirm Baseout-<spaceId>/ folder exists with CSV inside
```

**Airtable regression smoke (after Phase E, before declaring done):**

```
1. /integrations → Disconnect Airtable.
2. /integrations → Connect Airtable → grant → redirected back, Connection re-listed.
3. Trigger a backup that uses Airtable refresh: confirm token-refresh path still works.
```

If ANY of the Airtable smoke steps fail at ANY phase, the phase is **not done** — root-cause the regression before continuing.

## Open Questions

| # | Question | Default if unanswered |
|---|----------|----------------------|
| Q1 | Should the `Baseout-<spaceId>` folder be created in My Drive root or in the AppData hidden folder? | My Drive root (visible to the user; matches the WIP branch's choice). |
| Q2 | When a user revokes Drive access externally, should Baseout proactively probe and flip `status='pending_auth'`, or wait until the next backup fails? | Wait until next backup fails. Proactive probing is a follow-up change. |
| Q3 | Should we add a 10-min `oauth_states` purge cron in this change, or defer? | Defer. The sealed cookie is primary; `oauth_states` is a rarely-used fallback. Purge cron lands when a second BYOS provider lands. |
| Q4 | Should the engine credential route response include the refresh token for workflow-side caching, or never? | **Never.** Refresh stays engine-only per D6. |
