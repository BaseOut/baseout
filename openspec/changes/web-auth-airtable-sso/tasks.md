# Tasks

## 0. OAuth app + runbook

- [ ] 0.1 Register the NEW login OAuth app under the team account (scopes `user.email:read` + `schema.bases:read`); confirm any Airtable app-review friction (design open question 3).
- [ ] 0.2 Register `/api/auth/oauth2/callback/airtable` for local + dev; secrets `AIRTABLE_LOGIN_OAUTH_CLIENT_ID/SECRET` into `.dev.vars` (house rule — no hand `secret put`); **update oauth-setup.md (new §3.6 + §2 row + checklist) in this change** (CLAUDE.md §3.7).

## 1. Schema

- [ ] 1.1 None here — association tables owned by `web-signup-domain-association`; verify it lands first or together.

## 2. Flow (TDD — auth flow, §3.4 mandatory)

- [ ] 2.1 `auth-factory.ts` genericOAuth provider: endpoints from `airtable/config.ts`, login-app credentials, PKCE, two scopes, `getUserInfo` → whoami adapter.
- [ ] 2.2 Resolution ladder: account-link → email match (+ audit, at_user_id corroboration note) → invoke the shared `signup-domain-association` fork (that change's task 2.2 is the counterpart).
- [ ] 2.3 Failure paths: consent denied, missing email, whoami error → login page error, no partial state.
- [ ] 2.4 2FA challenge hand-off (with `web-auth-2fa`).

## 3. Verification

- [ ] 3.1 Vitest + integration green (association ladder is pure-module TDD); `typecheck`/`build`; no `console.*`.
- [ ] 3.2 Spike sign-in against dev: two-scope consent screen renders sanely.
- [ ] 3.3 E2E: SSO happy path; email-match link; known-domain join request + approval; denied consent. Caveat: deployed-dev until local URI registered (runbook §5).
- [ ] 3.4 Cross-check button/association/error states with ui-only `login-methods`.
