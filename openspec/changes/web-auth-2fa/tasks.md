# Tasks

## 1. better-auth config + schema

- [ ] 1.1 `auth-factory.ts`: `twoFactor` plugin (TOTP, backup codes, trusted device, rate limiting) + TOTP-secret encryption hook using the master key.
- [ ] 1.2 Migration via better-auth schema generation (twoFactor table); `db:check` clean. No password columns.

## 2. Flows (TDD — auth flows are §3.4 mandatory-test surface)

- [ ] 2.1 Enrollment (verify-to-activate) + backup-code issuance; audit rows + notification emails.
- [ ] 2.2 Challenge interception for magic link AND SSO; trusted device; backup-code consumption; disable-requires-factor.
- [ ] 2.3 CSRF via better-auth helpers on enrollment/disable; no `console.*`.

## 3. Verification

- [ ] 3.1 Vitest + integration suites green; `typecheck` + `build`.
- [ ] 3.2 E2E (Playwright): magic-link + challenge; backup-code recovery; trusted-device skip.
- [ ] 3.3 Cross-check challenge hand-off with `web-auth-airtable-sso`; UI states with ui-only `login-methods`.
