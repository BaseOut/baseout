# web-auth-airtable-sso — Proposal

## Why

Founder direction (2026-07-25, revised): let users sign in to Baseout with their **Airtable login** — the identity our customers already hold — as the interim SSO story before standard providers arrive. Implemented via better-auth's `genericOAuth` against a **NEW, dedicated Airtable OAuth app registered for login** (not the existing Connect integration): a separate app lets us lock the consent screen down to **profile read + schema read only** (`user.email:read`, `schema.bases:read`), making the grant easy to say yes to — and it sidesteps the ownership blocker on the existing integration (oauth-setup.md §4.2: owning account unclear; the login app is minted fresh under the team account).

## What Changes

- **New Airtable OAuth app for login** (registered at airtable.com/create/oauth under the team account): scopes `user.email:read` + `schema.bases:read`; its own secrets (`AIRTABLE_LOGIN_OAUTH_CLIENT_ID` / `AIRTABLE_LOGIN_OAUTH_CLIENT_SECRET`, `.dev.vars`-managed per house rule); callback path `/api/auth/oauth2/callback/airtable` registered per environment. Per CLAUDE.md §3.7, **oauth-setup.md is updated in this same change**: new §3.6 subsection for the login app (per-env URI matrix), §2 callback-path table row, §7.2 new-provider process followed.
- **"Continue with Airtable"** sign-in via better-auth `genericOAuth`: Airtable authorize/token endpoints (from `airtable/config.ts`), **PKCE**, the login app's credentials and scopes. After token exchange, `whoami` returns the Airtable user id + verified email.
- **Identity resolution, in order:** (1) an existing better-auth account link (Airtable user id) signs straight in; (2) an **exact match on the Airtable-verified email** links the identity to that user and signs in; (3) no email match → **domain-aware association** (below).
- **Domain-aware association for new users:** the no-match branch delegates to the shared **[`web-signup-domain-association`](../web-signup-domain-association/proposal.md)** capability (founder direction 2026-07-25: the join-or-create fork applies to **magic-link signups too**, so the machinery — known-domain resolution, join requests, admin approval, public-domain denylist — is owned there and consumed identically by both paths). Unknown/public domains → own account/Organization with a pre-verified email.
- **Login ≠ Connection:** signing in creates **no Connection row**, grants no backup access, and the login token is used for `whoami` only. The `schema.bases:read` scope is granted but deliberately unused at launch — reserved for a future pre-registration schema preview (see design; explicitly NOT specced here).
- **2FA applies:** users with TOTP enabled land on the challenge step after SSO ([`web-auth-2fa`](../web-auth-2fa/proposal.md)).

## Capabilities

### New Capabilities

- `airtable-sso`: sign-in/sign-up with Airtable identity via a dedicated minimal-scope OAuth app, email-matched with domain-aware association, Connection-independent.

### Modified Capabilities

None — magic link and the Connect flow are untouched.

## Impact

- **App:** `apps/web` only — `auth-factory.ts` genericOAuth config, whoami identity helper, association logic + join-request notification, login-surface button (UI in ui-only `login-methods`).
- **Master-DB:** none in this change — the association tables (`organization_domains`, join requests) are owned by [`web-signup-domain-association`](../web-signup-domain-association/proposal.md); land it first or together.
- **Docs in-change:** `shared/internal/oauth-setup.md` new §3.6 + §2 + checklist (per §3.7 same-change rule).
- **New secrets:** the login app's client id/secret per env (`.dev.vars` source-of-truth rule; never `wrangler secret put` by hand on dev).
- **Security review points (§3.3):** account-linking policy (verified-email + domain rules — takeover analysis in design), join-request approval as the safeguard against domain-squatting, PKCE/state via better-auth, audit rows for link/sign-in/join events.
- **Pairs with:** [`web-auth-2fa`](../web-auth-2fa/proposal.md) and ui-only `login-methods`.
