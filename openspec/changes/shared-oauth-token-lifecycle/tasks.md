# Tasks

## 1. Audit (confirm root causes before touching code) — DONE 2026-07-15

**Headline: the change is ~90% already shipped** by `server-cron-oauth-refresh` +
`server-oauth-refresh-cron-health` + the on-demand `/token` refresh path. The
Jul 15 meeting notes describe a state that predates/co-occurs with that work.

- [x] 1.1 **O1 — "refresh drops the rotated refresh token": FALSE.** `resolveAirtableToken` re-encrypts `outcome.refreshToken` (the rotated value from `refreshAirtableAccessToken`, airtable-refresh.ts:99-102) and `persistRefreshSuccess`/ConnectionDO write BOTH `*_enc` in place under a claim protocol (resolve-airtable-token.ts:176-185, ConnectionDO.ts:150-178). No forced reauth, no duplicate rows on the refresh path.
- [x] 1.2 **O2 — web "login-only band-aid": NOT FOUND.** No refresh-on-login check in current web code; reconnect already updates in place (`airtable/persist.ts` `.update`/`onConflictDoUpdate`). Only a read-only connection-health display mapper runs at login. Nothing to retire.
- [x] 1.3 Encryption key: web writes `*_enc`, server refreshes with `BASEOUT_ENCRYPTION_KEY`; agreement is an operational concern (oauth-setup.md + "no hand `wrangler secret put`" memory), not a code defect. No change needed here.
- [x] 1.4 **Pre-backup verification gate (Dan's ask): ALREADY EXISTS + LIVE in dev.** Backup task → `POST /connections/:id/token` at run start; with `AIRTABLE_ON_DEMAND_REFRESH_ENABLED=1` (dev .dev.vars) the DO runs `resolveAirtableToken(refreshEnabled:true)` → verifies expiry, refreshes within a 5-min lookahead, persists rotated tokens. Dead refresh token → `409 reauth_required` + connection marked `pending_reauth`; the backup returns a clean structured `failed('token_409')`, not a noisy mid-run crash (ConnectionDO.ts:286-313, backup-base.ts:443-451).

### O3 gap verification — DONE 2026-07-15 → gap is COVERED

- SpaceDO scheduler (`alarm()`, SpaceDO.ts:159-174): only inserts a scheduled
  `backup_runs` row when `connection.status === 'active'`; a `pending_reauth`/
  `invalid` connection is skipped and the schedule still advances. So a doomed
  scheduled run never starts (no noisy failure) — but there's no per-skip row.
- Surfacing IS present, state-backed off connection status (NOT gated on a run):
  the notifications-inbox derives a `connection-broken` item — *"connection needs
  reconnecting / Backups are paused until you reconnect"* + Reconnect action
  (derive.ts:163-177), which auto-resolves on reconnect; the connection-health
  banner surfaces `pending_reauth` too (connection-health.ts:34-59); and a
  `connection_status_audit` trail records the flip (core.ts:276).
- Net: the user IS told "backups are paused until you reconnect." A per-skipped-
  scheduled-tick history row would be noise, not signal — NOT part of Dan's ask.

**Verdict: CLOSED — already satisfied by shipped code** (`server-cron-oauth-refresh`,
`server-oauth-refresh-cron-health`, on-demand `/token`, notifications-inbox).
Sections 2–4 below are intentionally NOT implemented (would duplicate working
code, §3.2). Optional follow-up if ever wanted: a `skipped_reauth` history row
on scheduler skip — file separately, do not reopen this.

## 2. Token swap in place (regression-first)

- [ ] 2.1 **Red:** failing test — a refresh that rotates the refresh token must persist the new `refresh_token_enc`; a second refresh using the stored token succeeds (no `invalid_grant` → no forced re-auth).
- [ ] 2.2 **Green:** ensure every refresh `UPDATE`s the existing row with both `access_token_enc` and the rotated `refresh_token_enc`; remove any path that inserts a duplicate Connection or forces a full reconnect.
- [ ] 2.3 Retire the login-only band-aid per design Decision 4 (keep the dashboard read signal if present; drop only the refresh side).

## 3. Pre-backup verification gate

- [ ] 3.1 **Red:** failing test — enqueuing a backup for a Connection with an expired access token and a valid refresh token refreshes first and then enqueues; with a dead refresh token it does NOT enqueue and the Connection moves to `pending_reauth`.
- [ ] 3.2 **Green:** implement the gate at run-start in `apps/server`, driving the ConnectionDO `/token` on-demand path (design Decision 2); skip the round-trip when `token_expires_at` is comfortably future.
- [ ] 3.3 Decide + implement the declined-run surfacing (O3): short-lived `backup_runs` row in a `pending_reauth`-style state so the dashboard shows why a scheduled backup didn't run.

## 4. Verification

- [ ] 4.1 `pnpm --filter @baseout/server test` targeted suites + `tsc` green; server full-suite DO hang is pre-existing (verify with targeted suites per the auto-memory).
- [ ] 4.2 Dev smoke: force a dev Connection's token to expire, trigger a scheduled/manual backup, confirm it refreshes-then-runs (or cleanly declines when the refresh token is revoked) with NO manual reconnect.
- [ ] 4.3 Commit message `Verification` section (Demo/Test/Checks/Caveats) per §3.8; engine smoke is `--remote` (deploy first — apps/web remote mode).

## 5. Scope decomposition (per §3.6)

- [ ] 5.1 If the audit confirms the split, spawn `server-<topic>` (gate + refresh persist) and `web-<topic>` (retire login check) follow-ups and cross-reference this parent; otherwise land here.
