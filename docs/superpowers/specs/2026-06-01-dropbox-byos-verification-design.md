# Dropbox BYOS — End-to-End Verification & Runbook Flip

**Date:** 2026-06-01
**Branch:** `autumn/backup-fix-local`
**Status:** Approved, ready for implementation plan
**Spec for:** verification work, not new feature code

---

## Context

Dropbox is already implemented as a V1 BYOS storage destination. Five commits shipped the full vertical between `5a90d07` and `9a1953a`:

- `apps/web/src/lib/dropbox/` — OAuth client, config, cookie, oauth helpers, persist (+ unit tests)
- `apps/web/src/pages/api/connections/storage/dropbox/` — authorize, callback, disconnect routes
- `apps/server/src/lib/storage/refresh-dropbox.ts` — engine-side refresh (preserves stored refresh token; Dropbox refresh tokens are stable, no rotation)
- `apps/workflows/trigger/tasks/_lib/storage-writers/dropbox.ts` — Trigger.dev writer using Dropbox content-upload API
- Storage-destination engine route, factory dispatch, and `defaultFetchStorageCreds` all include the `dropbox` branch
- `shared/internal/oauth-setup.md` §2 / §3.4 / §4.4 / §8 contain the Dropbox sections

The capability matches PRD §7.2 (Dropbox = V1, existing, proxy stream required) and Features §6.6 (BYOS / OAuth / proxy required / all tiers).

The one outstanding blocker per `oauth-setup.md` §3.4 was the **`https://baseout-dev.openside.workers.dev/api/connections/storage/dropbox/callback`** redirect URI being ❌ MISSING in the Dropbox App Console. This URI is required for local-dev smoke because `apps/web`'s dev script passes `--remote` to wrangler, which makes `url.origin` resolve to `baseout-dev.openside.workers.dev` even though the browser URL is `localhost:4331`.

The boss has now applied the OAuth-app settings the user previously passed along (covering Dropbox, OneDrive, and Box). The reasonable read is that the missing Dropbox URI is now registered. This spec proves it and updates the runbook to reflect reality.

There is an uncommitted edit to `apps/web/src/components/backups/StoragePicker.astro` that adds `<input type="hidden" name="returnTo">` to all four storage Connect forms and scrolls the user back to the storage section after the OAuth round-trip. It's part of the same end-to-end UX and lands together with the doc flip.

## Goal

Confirm the Dropbox V1 BYOS path is functional end-to-end now that the redirect URI is registered, then make `shared/internal/oauth-setup.md` truthful about app-console state. No new feature code.

## Non-Goals

- OneDrive verification (`oauth-setup.md` §3.5 has ❓ unknowns across all 5 URIs — separate task, the user picked Dropbox first).
- Box re-smoke (Box already shipped; revisit only if the Dropbox smoke surfaces a regression that points at Box).
- Adding additional Dropbox writer integration tests beyond what already exists.
- Refactoring or "tidying up" any of the BYOS code (CLAUDE.md §3.2).

## Topology

**Approach A — deployed engine + local web + local trigger.dev.**

This is the validated topology that produced the first Drive smoke green (auto-memory: `project_drive_backup_first_smoke_green`).

```
┌─ Browser at localhost:4331 ────────────────┐
│                                            │
│   pnpm --filter @baseout/web run dev       │   ← wrangler dev --remote
│   (apps/web local, sees                    │     so url.origin =
│    baseout-dev.openside.workers.dev        │     baseout-dev URI
│    as origin)                              │
│                                            │
│           │ BACKUP_ENGINE service binding  │
│           │ (remote: true)                 │
│           ▼                                │
│   apps/server deployed at                  │   ← pnpm --filter @baseout/server
│   baseout-server-dev.openside.workers.dev  │     deploy:dev
│                                            │     (also syncs .dev.vars secrets)
│           │ tasks.trigger(...)             │
│           ▼                                │
│   Trigger.dev local dev worker             │   ← npx trigger.dev dev
│   (runs backup-base task body)             │     from apps/workflows
│           │                                │
│           ▼                                │
│   Real Dropbox account                     │
│   /Apps/Baseout/Baseout-<spaceId>/         │
│                                            │
└────────────────────────────────────────────┘
```

Why not all-deployed or all-local: all-deployed forces a deploy before knowing Dropbox works and doesn't pick up the uncommitted StoragePicker diff; all-local without `--remote` exercises the `localhost:4331` redirect URI (already registered before this update) and therefore doesn't prove the actual unblock.

## Verification Steps (in order)

1. **Preflight.**
   - `git status` shows the expected state: branch `autumn/backup-fix-local`, only `M apps/web/src/components/backups/StoragePicker.astro` uncommitted.
   - `apps/web/.dev.vars` contains the Dropbox env vars (`DROPBOX_OAUTH_CLIENT_ID`, `DROPBOX_OAUTH_CLIENT_SECRET`, the local `DROPBOX_REDIRECT_URI` override from commit `262f999` if present).
   - `apps/server/.dev.vars` contains the matching `BASEOUT_ENCRYPTION_KEY` (must match `apps/web/.dev.vars` exactly — drift is the recurring Airtable-disconnect failure mode per auto-memory `feedback_no_hand_wrangler_secret_put`).
   - Trigger.dev dashboard development env has `BACKUP_ENGINE_URL` + `INTERNAL_TOKEN` set (per `project_trigger_dev_env_setup`).

2. **Apply pending migrations.** Per `feedback_schema_migrate_before_ship` — schema-aware SSR can 404 silently when a SELECT references a column that doesn't exist yet. Run `pnpm --filter @baseout/web db:check`; migrate if anything is pending.

3. **Boot the three processes.**
   - `pnpm --filter @baseout/server deploy:dev` — deploys engine, auto-runs `wrangler secret bulk` against `apps/server/.dev.vars`.
   - `npx trigger.dev dev` from `apps/workflows/` — local Node task runner.
   - `pnpm --filter @baseout/web run dev` — local web with `--remote` and the `PUBLIC_AUTH_BASE_URL` `--var` flag.

4. **OAuth Connect smoke.** In the browser, sign in, pick the test Space, click Dropbox's **Connect** button on the storage picker. Complete the Dropbox OAuth dance. Expected outcome:
   - Callback returns cleanly (no `redirect_uri_mismatch`).
   - The page SSRs back at the storage section (the uncommitted `returnTo` + scroll-into-view diff is what makes this nice).
   - A row in `connections` with `provider='dropbox'`, `status='active'`, encrypted access + refresh tokens in `oauth_access_token_enc` / `oauth_refresh_token_enc`.

5. **Select Dropbox as storage destination.** Submit the StoragePicker form with Dropbox selected. Expected:
   - `storage_destinations` row exists for the Space with `provider='dropbox'`.
   - StoragePicker re-renders showing Dropbox as the current destination.

6. **Backup run.** Trigger a backup of a small known Airtable base from the Space's backups page. Expected:
   - Engine accepts the trigger, enqueues to Trigger.dev.
   - `npx trigger.dev dev` console shows the `backup-base` task running.
   - Task posts progress → engine writes to `backup_runs`.
   - CSV file(s) appear in the user's actual Dropbox at `/Apps/Baseout/Baseout-<spaceId>/<run-timestamp>/<table>.csv` (path layout per the workflows writer).
   - Task posts completion → `backup_runs.status='completed'`.

7. **Airtable no-regression check.** Per `feedback_dont_break_airtable_auth.md` — Airtable has regressed multiple times when storage providers landed. Confirm:
   - The existing Airtable connection row in `connections` is still `status='active'`.
   - Triggering an Airtable refresh via the existing UI succeeds (does not flip the row to `status='invalid'`).

## Doc Updates (Same Commit)

In `shared/internal/oauth-setup.md`:

- §3.4 — Flip `baseout-dev.openside.workers.dev` row from ❌ MISSING → ✅ done. Flip the optional `baseout.local:4331` row to ✅ only if the boss actually registered it (ask if uncertain; default is to leave unchanged).
- §4.4 — Flip the matching checkbox(es) in the gap checklist.
- §3.4 note — Remove or update the "boss-to-add" caveat now that it's done.

Cite "§3.4 / §4.4" in the eventual commit message per CLAUDE.md §3.7.

## Exit Criteria

All four must hold:

- One real CSV (or set of CSVs, depending on the test base) in Dropbox at `/Apps/Baseout/Baseout-<spaceId>/`.
- Airtable connection still `status='active'`; Airtable refresh through the UI still works.
- `shared/internal/oauth-setup.md` §3.4 + §4.4 reflect the actual app-console state.
- One local commit contains: the StoragePicker.astro uncommitted diff + the oauth-setup.md flips. No push, no PR (per `feedback_no_prs_human_test_then_local_commit`).

## Failure Modes to Watch

| Symptom | Likely cause | Action |
|---|---|---|
| `redirect_uri_mismatch` on Dropbox callback | Boss didn't actually register `baseout-dev` URI | Stop. Surface to user. Don't paper over with a `--var` swap (`feedback_oauth_runbook_first.md`). |
| Engine refresh 400/401 on token exchange | Encryption-key drift between `apps/web/.dev.vars` and the deployed engine | Compare `BASEOUT_ENCRYPTION_KEY` between `.dev.vars` files; re-run `deploy:dev` to re-sync. Never `wrangler secret put` by hand. |
| Trigger.dev task fails to start / `Cannot find task` | `BACKUP_ENGINE_URL` / `INTERNAL_TOKEN` not set in Trigger.dev dashboard development env | Set in dashboard, restart `npx trigger.dev dev`. |
| Trigger.dev task starts but POST to engine callback 401s | `INTERNAL_TOKEN` mismatch between engine deploy and dashboard | Re-sync. |
| Airtable connection flips to `status='invalid'` mid-smoke | Encryption-key drift (recurring failure mode) | **Halt.** Do not proceed with Dropbox verification. Investigate per `feedback_no_hand_wrangler_secret_put`. |
| Dropbox writer 403 on upload | App folder permission missing one of the `files.content.write` / `files.metadata.write` scopes | Verify scopes in Dropbox App Console Permissions tab. |
| Schema-aware page 404s during smoke | Pending migration not applied | Run `pnpm --filter @baseout/web db:check` + migrate (`feedback_schema_migrate_before_ship`). |

## Out of Scope

- New code in `apps/web/src/lib/dropbox`, `apps/server/src/lib/storage/refresh-dropbox.ts`, or `apps/workflows/trigger/tasks/_lib/storage-writers/dropbox.ts`. If smoke surfaces a defect in any of these, file a follow-up — don't fix opportunistically in this change.
- OneDrive verification (separate task per the user's pick).
- Box re-smoke.
- Touching `wrangler.jsonc`, `package.json` dev scripts, or any other config (CLAUDE.md §3.2).
