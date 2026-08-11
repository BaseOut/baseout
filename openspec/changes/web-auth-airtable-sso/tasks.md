# Tasks

## 0. OAuth app + runbook

- [ ] 0.1 Register the NEW login OAuth app under the team account (scopes `user.email:read` + `schema.bases:read`); confirm any Airtable app-review friction (design open question 3). → blocked: app registration pending (Dan).
- [ ] 0.2 Register `/api/auth/oauth2/callback/airtable` for local + dev; secrets `AIRTABLE_LOGIN_OAUTH_CLIENT_ID/SECRET` into `.dev.vars` (house rule — no hand `secret put`); **update oauth-setup.md (new §3.6 + §2 row + checklist) in this change** (CLAUDE.md §3.7). → runbook side DONE 2026-07-28 (oauth-setup.md §3.6 status table + §2 callback row + §4.6 create-from-scratch checklist). App registration itself still pending — it's the ONLY remaining step: follow §4.6, paste creds into `apps/web/.dev.vars`, deploy. Code side is ready: the provider registers ONLY when both env vars are present (absent ⇒ SSO hidden, zero behavior change).

## 1. Schema

- [x] 1.1 None here — association tables owned by `web-signup-domain-association`; verify it lands first or together. → landed together in this branch; association migration is `apps/web/drizzle/0031_signup_domain_association.sql` (generated first).

## 2. Flow (TDD — auth flow, §3.4 mandatory)

- [x] 2.1 `auth-factory.ts` genericOAuth provider: endpoints from `airtable/config.ts`, login-app credentials, PKCE, two scopes, `getUserInfo` → whoami adapter. → provider built in `src/lib/airtable/sso.ts` (endpoints reuse AIRTABLE_AUTHORIZE_URL/TOKEN_URL/API_BASE; PKCE; `authentication:'basic'` — Airtable is client_secret_basic-only); conditionally registered in `auth-factory.ts` when AIRTABLE_LOGIN_OAUTH_CLIENT_ID/SECRET present (middleware reads them from env). Login token is whoami-only; `account.encryptOAuthTokens:true` keeps it encrypted on the accounts row; NO Connection row is written anywhere in the flow.
- [x] 2.2 Resolution ladder: account-link → email match (+ audit, at_user_id corroboration note) → invoke the shared `signup-domain-association` fork (that change's task 2.2 is the counterpart). → rungs 1+2 are better-auth-native (`handleOAuthUserInfo`: existing account link signs in; exact verified-email match links implicitly because whoami email is `emailVerified:true`); audit + corroboration via `databaseHooks.account.create.after` → `src/lib/airtable/sso-linked.ts` (audit kinds `sso_account_linked`/`sso_user_created`, metadata `{atUserId, corroborated, corroborationMismatch}` — mismatch recorded, never blocks). Rung 3: new SSO users flow through the SAME `databaseHooks.user.create.after` fork hook + /welcome offer as magic link (delegation is structural, nothing SSO-specific).
- [x] 2.3 Failure paths: consent denied, missing email, whoami error → login page error, no partial state. → `getUserInfo` returns null on missing email / whoami error / thrown fetch (genericOAuth then redirects with an error param and creates nothing); `onAPIError.errorURL='/login'` routes OAuth failures (incl. denied consent) to /login, which now renders a non-technical alert for `?error=`.
- [x] 2.4 2FA challenge hand-off (with `web-auth-2fa`). → the `twoFactorAllMethods` interception hook matches `/oauth2/callback/:providerId` — SSO sign-ins by 2FA-enrolled users land on /2fa exactly like magic link (pinned by `INTERCEPTED_SIGN_IN_PATHS` test).

## 3. Verification

- [x] 3.1 Vitest + integration green (association ladder is pure-module TDD); `typecheck`/`build`; no `console.*`. → `src/lib/airtable/sso.test.ts` (13 tests: config gate, whoami mapping, provider shape, getUserInfo fetch behavior, conditional registration incl. real-instance `signInWithOAuth2` endpoint) green; `astro check` no NEW errors; no `console.*`.
- [ ] 3.2 Spike sign-in against dev: two-scope consent screen renders sanely. → blocked on task 0.1 (login app not registered).
- [ ] 3.3 E2E: SSO happy path; email-match link; known-domain join request + approval; denied consent. Caveat: deployed-dev until local URI registered (runbook §5). → blocked on tasks 0.1/0.2.
- [ ] 3.4 Cross-check button/association/error states with ui-only `login-methods`. → deferred with the ui-only screens (only /login's minimal `?error=` alert ships here).
