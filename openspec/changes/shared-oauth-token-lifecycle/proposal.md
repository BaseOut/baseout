# shared-oauth-token-lifecycle — Proposal

> **STATUS: CLOSED 2026-07-15 — already satisfied by shipped code.** A code audit
> (see tasks.md §1) found the Jul 15 meeting notes lagged reality: the pre-backup
> verify+refresh gate (on-demand `/token`), in-place token swap with rotated-refresh
> persistence, and the "needs reconnect / backups paused" surfacing (notifications-inbox,
> state-backed) all shipped via `server-cron-oauth-refresh`, `server-oauth-refresh-cron-health`,
> and `server-notifications-inbox`. Not implementing this change would duplicate working
> code (§3.2). Kept for the audit trail. Optional follow-up (a `skipped_reauth` history row
> on scheduler skip) to be filed separately if wanted. The Why/What below is the ORIGINAL
> proposal, retained as-was.

## Why

In the 2026-07-15 Dan/Autumn sync, Dan raised that Airtable Connections keep dropping and that **scheduled backups will fail** without a more robust, automated auth check. Two root causes surfaced, both distinct from the refresh cron already shipped — `server-cron-oauth-refresh` built the refresh primitives and `server-oauth-refresh-cron-health` gave them a clock plus a stale-token gauge:

1. **No verify-before-backup gate.** The refresh sweep is time-based (`*/15 * * * *`), not backup-triggered. A backup can still initiate against a Connection whose access token died between sweeps — or whose refresh token was revoked Airtable-side — and then fail noisily mid-run. Dan explicitly asked for a function that verifies and, if needed, re-authenticates a Connection **before a backup initiates**.
2. **Token swap forces a full re-auth instead of updating in place.** The current stabilisation is a stopgap — auth is checked only on login (a "band-aid" built with ChatGPT). The storage/swap path can force a full re-authentication flow rather than updating the existing token row, which produced the observed "excessive connections" and the customer-visible reconnect loop (the recurring failure mode in [oauth-setup.md](../../../shared/internal/oauth-setup.md)). This needs a durable DB-architecture fix so a refresh/rotation updates the existing `Connection` in place and never strands the user in a manual re-auth.

The transcript's explicit goal: keep scheduled backups authenticated **without manual re-authentication flows**.

## What Changes

- **Add a pre-backup token-verification gate** in `apps/server`: before the engine enqueues a backup for a `Connection`, it verifies the access token is valid, refreshes on demand if it is near/past expiry, and — if the refresh token is dead — transitions the Connection to `pending_reauth` and declines to start a doomed run (surfacing a clean state instead of a mid-run failure). Reuses the existing ConnectionDO `/token` on-demand path rather than a parallel refresh code path.
- **Fix token storage/swap to update in place.** Audit how `apps/web`'s OAuth callback/reconnect and `apps/server`'s refresh persist tokens, and guarantee that a token rotation (Airtable rotates the refresh token on every use) updates the existing Connection row — persisting the newly rotated `refresh_token_enc` — instead of inserting a duplicate or forcing a full reconnect. Eliminate the "excessive connections" path.
- **Retire the login-only band-aid.** Replace the temporary on-login-only check with the automated pre-backup gate + the existing refresh cron, so correctness no longer depends on a user having logged in recently.
- **Tests (regression-first).** A failing test that reproduces "backup starts against an expired-token Connection" and "refresh rotation loses the new refresh token → next refresh forces re-auth" before the fix; then the gate + swap-in-place logic. Server tests use the local-Postgres + stub Airtable token-endpoint pattern already established for the refresh sweep.

## Capabilities

### New Capabilities

- `pre-backup-token-verification`: the engine verifies and, if needed, refreshes a Connection's token before a backup initiates, and declines to start a run that would fail on `invalid_grant`.

### Modified Capabilities

- `connection-token-storage`: token refresh and reconnect update the existing Connection row in place (persisting rotated refresh tokens) and never force a full re-authentication flow or spawn duplicate Connections.

## Impact

- **apps/server** — backup enqueue path (SpaceDO scheduler / internal run-start), on-demand refresh persistence, ConnectionDO `/token` reuse.
- **apps/web** — retire the on-login-only auth check; audit `src/lib/airtable/persist.ts` reconnect/update path.
- **Master DB** — schema is web-owned; assess whether any column is actually needed (expected: none — the fix is behavioral, the `status` enum already carries `refreshing`/`pending_reauth`).
- **Security (CLAUDE.md §3.3 / oauth-setup.md)** — touches OAuth token handling and the encryption-key agreement between web (writes `*_enc`) and server (reads/refreshes). Key drift silently flips Connections to `invalid`; the change must not widen who can read tokens and must keep web/server on the identical master key.

## Out of Scope

- The refresh-cron **clock and observability** — owned by `server-oauth-refresh-cron-health`; this change consumes that machinery, it does not re-wire it.
- **BYOS storage-provider** (Google Drive / Box / Dropbox / OneDrive) token refresh — Airtable only here.
- Extracting the Airtable OAuth client into `@baseout/shared` — a separate `system-*`/`shared-*` dedup follow-up; this change may duplicate a small refresh helper rather than block on that.
