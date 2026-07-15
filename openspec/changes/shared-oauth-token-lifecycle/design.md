# shared-oauth-token-lifecycle — Design

## Context

The refresh machinery exists and now has a heartbeat: `server-cron-oauth-refresh` built `apps/server/src/lib/airtable-refresh.ts`, the ConnectionDO `/token` on-demand path, and the claim protocol; `server-oauth-refresh-cron-health` wired the `*/15 * * * *` clock, the `event.cron` dispatch router, and the `GET /api/internal/connections/token-health` stale gauge. What is **missing** is (a) a backup-triggered verification step and (b) a guarantee that a token rotation updates the existing row. Web's reconnect already uses `onConflictDoUpdate` on the newest `(org, platform)` row ([apps/web/src/lib/airtable/persist.ts:72](../../../apps/web/src/lib/airtable/persist.ts#L72)), so the suspected swap defect lives on the **refresh** side (a rotated `refresh_token_enc` not being persisted) and/or the login-only stopgap re-inserting rather than updating. This must be confirmed by reading the actual persist paths before writing the fix.

## Goals / Non-Goals

**Goals:** a backup never starts against a Connection whose token cannot be made valid; a refresh that rotates the refresh token persists the new one so the *next* refresh succeeds (no re-auth loop); the login-only band-aid is removed; the fix is behavioral (no new master-DB columns if avoidable).

**Non-Goals:** re-implementing the refresh algorithm or claim protocol (owned upstream); BYOS token refresh; the cron clock/gauge; the Airtable-client dedup into `@baseout/shared`.

## Decisions

1. **The gate lives at run-start in `apps/server`, not in the Trigger.dev task.** The engine owns the enqueue decision and holds the encryption key + `CONNECTION_DO` binding; the Node runner (workflows) must never hold the key. So the verification runs just before the task is enqueued (or in the internal run-start route), transitioning `active → refreshing → active | pending_reauth` and only enqueuing when the token resolves.
2. **Reuse the ConnectionDO `/token` on-demand path — do not fork a second refresh path.** Same rationale as `server-oauth-refresh-cron-health` Decision 2: per-connection serialization via `idFromName`, one production claim/refresh/persist flow. The gate calls `/token`; a 200 means "safe to back up", a `pending_reauth` result means "decline and surface".
3. **Persist rotated refresh tokens in the same update.** The swap fix is: every refresh writes both `access_token_enc` **and** the rotated `refresh_token_enc` (when Airtable returns a new one) in a single `UPDATE ... WHERE id = ?` on the existing row. Confirm the current refresh persist does this; if it drops the rotated refresh token, that is the "forces full re-auth" root cause.
4. **Retire the login-only check by replacing, not deleting blind.** Identify the web on-login auth check, confirm the pre-backup gate + cron fully cover its intent, then remove it so there is a single source of truth. If it also serves a UX signal (dashboard "needs reconnect"), keep the *read* and drop only the *refresh* side.
5. **No new master-DB columns unless the audit proves one is needed.** The `connections.status` enum already carries `refreshing` and `pending_reauth`; `token_expires_at` and `*_enc` exist. Behavioral fix preferred. If a column is unavoidable, `apps/web` owns the migration and the `apps/server` mirror gets a header-comment pointer (CLAUDE.md §5.3).

## Risks / Trade-offs

- **[Verify-before-every-backup adds a DO round-trip at run-start]** → bounded (one call per run, runs are not high-frequency); acceptable for correctness. Skip the round-trip when `token_expires_at` is comfortably in the future.
- **[Deleting the login-only check could drop a UX signal]** → mitigated by Decision 4 (keep the read, drop the refresh).
- **[Encryption-key drift between web and server]** → out-of-band operational risk, not introduced here, but the change touches the exact seam; verification must confirm web/server share the master key before claiming the swap works (oauth-setup.md, and the "never `wrangler secret put` by hand" memory).
- **[Scope may split]** per CLAUDE.md §3.6 this `shared-*` parent likely decomposes into a `server-*` follow-up (gate) and a `web-*` follow-up (retire login check) once the audit pins down where each lands.

## Migration Plan

Ship server-side gate first (additive — a backup that would have failed now fails *earlier and cleaner*, or succeeds after refresh). Then retire the web login-only check. Rollback: the gate is a guard in front of enqueue; removing it restores prior behavior. No data migration expected.

## Open Questions

| # | Question | Default answer |
|---|----------|----------------|
| O1 | Does the current refresh persist drop the rotated `refresh_token_enc`? | Assume yes until the audit disproves it — that is the leading swap-defect hypothesis. |
| O2 | Is the "login-only check" in web middleware or the OAuth callback? | Locate in the audit; likely a helper invoked on session establishment. |
| O3 | Should a declined-at-gate run write a `backup_runs` row (`pending_reauth`) or no row at all? | Write a short-lived row so the dashboard shows *why* the scheduled backup didn't run. |
