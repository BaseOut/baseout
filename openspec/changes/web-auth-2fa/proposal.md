# web-auth-2fa — Proposal

## Why

Login is magic-link-only today. Founder direction (2026-07-25, revised): **Baseout stays passwordless** — no password login — but users can optionally enable **TOTP two-factor authentication** (authenticator app) on top of magic link and the new Airtable SSO ([`web-auth-airtable-sso`](../web-auth-airtable-sso/proposal.md)). 2FA is the security posture upgrade for users who consider email possession alone insufficient, without introducing the password surface CLAUDE.md §3.3 deliberately bans. **No spec conflict:** the passwordless rule stands; this change adds a second factor, not a first-factor credential.

## What Changes

- **TOTP 2FA** via better-auth's `twoFactor` plugin, as an **optional per-user setting**: authenticator-app enrollment (QR + manual secret, activation only after a verified code), **10 single-use backup codes** (shown once, downloadable), optional **trusted-device** (30 days), disable-requires-a-valid-code.
- **2FA challenges every sign-in method when enabled** — magic link and Airtable SSO both land on the challenge step before a session is usable.
- **TOTP secrets encrypted at rest** with the master encryption key (same AES-256-GCM posture as OAuth tokens, PRD §20.2).
- **Auth event audit rows + notification emails** for enrollment, disablement, backup-code consumption, and failed challenges (rate-limited via better-auth built-ins).
- Magic link remains the default and only first factor alongside SSO; middleware/route protection unchanged.

## Capabilities

### New Capabilities

- `totp-2fa`: optional authenticator-app enrollment, all-method challenge, backup codes, trusted devices.

### Modified Capabilities

None — magic-link behavior is untouched; login-surface UI lives in ui-only `login-methods`.

## Impact

- **App:** `apps/web` only — `auth-factory.ts` (`twoFactor` plugin config + secret-encryption hook), account security settings routes. Master-DB: better-auth `twoFactor` table via its schema generation — web-owned migration.
- **No password columns, no reset flows, no CLAUDE.md/PRD amendment** — the passwordless standard survives intact.
- **Security review points (§3.3):** TOTP secret storage (encrypted), rate limiting on challenge attempts, CSRF on enrollment/disable forms, audit coverage.
- **Pairs with:** [`web-auth-airtable-sso`](../web-auth-airtable-sso/proposal.md) (consumes the challenge step) and ui-only `login-methods` (all UI).
