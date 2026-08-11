# Tasks

> Imported from ui-only `openspec/changes/login-methods` at `ui-only/main@9a8b448`
> (2026-07-29 scoped sync; task state preserved). Backend context: the auth
> backends this change fronts ALREADY EXIST in apps/web — Airtable SSO
> (`lib/airtable/sso.ts`, env-gated + stub mode), TOTP 2FA (`lib/two-factor/`),
> and domain-association join requests (`lib/signup/`) all shipped in the
> Jul-27 capability wave. Promotion here is UI-only wiring, not new backend.

## 1. Fixtures + harness

- [ ] 1.1 Login-state fixtures: default, challenge (fresh/wrong-code/lockout/backup-code), trusted-device, SSO error, association offer + pending, linked/unlinked identity; static fixture QR.
- [ ] 1.2 Harness `?state=` wiring for every fixture state (incl. `assoc`, `assoc-pending`).

## 2. Login surface

- [ ] 2.1 Airtable button (brand rules + "doesn't connect your data" microcopy) above the magic-link form (Decision 1). No password affordances.
- [ ] 2.2 2FA challenge step: code input (auto-advance, paste-tolerant), backup-code swap, trust checkbox, error/lockout copy (Decisions 2/6).
- [ ] 2.3 Association fork screen: two cards, join-pending banner, notifications-inbox approval surfacing (Decision 3); fixture variants for BOTH entry paths (magic link + SSO — identical screen).

## 3. Security settings panel

- [ ] 3.1 2FA enrollment wizard (scan → verify → save codes w/ confirmation gate); status + code-gated disable; regeneration warning (Decisions 4/5).
- [ ] 3.2 Linked Airtable identity row (linked/unlinked).

## 4. Gate

- [ ] 4.1 `pnpm ds-lint` + `pnpm typecheck` green; state names cross-checked against baseout `web-auth-2fa` / `web-auth-airtable-sso` flow contracts.
