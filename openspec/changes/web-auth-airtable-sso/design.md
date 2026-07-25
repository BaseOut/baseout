# web-auth-airtable-sso — Design

## Decision 1 — A dedicated login OAuth app, not the Connect integration

Separate app = separate consent story ("Baseout wants to know who you are and see your schema" vs. the Connect grant's data scopes), separate blast radius (revoking/rotating login credentials never touches customer backups), and freedom from the existing integration's unresolved ownership (runbook §4.2) — the login app is minted fresh under the team account. Cost: one more app to manage per env; the runbook §7.2 process covers it. Scopes locked to `user.email:read` + `schema.bases:read`.

## Decision 2 — Email match links; Airtable user id anchors afterwards

First SSO sign-in links by **exact match on the Airtable-verified email**; thereafter the better-auth account row (Airtable user id) is authoritative — later email changes on either side don't re-route the link. Takeover analysis: Airtable verifies emails, the same trust bar as "Sign in with Google"; residual risk is email-account compromise, to which magic link is already fully exposed — SSO adds no new weakness. Corroboration hardening: when whoami's user id matches a `connections.platformConfig.at_user_id` in the matched user's Organization, the audit row notes it; mismatch logs but doesn't block.

## Decision 3 — Domain-aware association is delegated to the shared capability

The no-match branch hands off to `web-signup-domain-association` (suggest-never-auto-join, known-domain resolution, join-request lifecycle) — extracted because the founder extended the fork to magic-link signups (2026-07-25), making association a property of account creation, not of this sign-in method. The original single-change analysis below is preserved for context and now lives normatively in that change's design.

### (superseded original) Domain-aware association: suggest, never auto-join

For a new user (no email match) from a **non-public domain that matches an existing Organization**: offer "We found an existing organization for `acme.com` — request to join, or create your own." A join request notifies org admins (approve/decline); the user is never blocked — they can proceed with their own account while the request pends, and an approved request converts to membership. **Auto-join is rejected**: domain possession isn't authorization (contractors, ex-employees, look-alike signups), and silent joins leak org existence. Public email domains (gmail, outlook, etc. — a maintained denylist) never associate.

**Known-domain resolution:** an Organization's domains are derived from its members' verified email domains (public domains excluded), with an explicit `organization_domains` override table for edge cases (org on multiple domains; domain the org wants ignored). Derivation keeps day-one behavior zero-config; the table is the escape hatch.

New user from an unknown/public domain → their own account + Organization, standard onboarding, email pre-verified.

## Decision 4 — better-auth genericOAuth, not a hand-rolled flow

PKCE, state, token exchange, account-link storage, callback route — all plugin. Custom code is the `getUserInfo` whoami adapter and the association step that runs after identity resolution.

## Decision 5 — The schema scope is granted but dormant

`schema.bases:read` rides the login grant for the future **pre-registration schema preview** ("here's what your schema backup would look like") — a conversion hook the pricing docs already treasure. Deliberately NOT specced or built here; the login token remains whoami-only at launch, and no schema call is made. When that feature is specced, it gets its own change; this design note is the breadcrumb.

## Open questions

1. Join-request expiry (7 days?) and whether a declined request cools down repeat requests.
2. ~~Should the "request to join" screen appear for magic-link signups too?~~ **Resolved (founder, 2026-07-25): yes** — extracted to `web-signup-domain-association`, consumed by both paths.
3. Airtable app-approval friction: does a new OAuth app need Airtable review before third-party users can authorize it? Verify during registration.
