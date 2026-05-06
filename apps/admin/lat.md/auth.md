# Auth

Google SSO only via better-auth's Google provider. No magic-link, no passwords, no customer flows.

Access is gated by an explicit staff allowlist (email / domain) loaded from Cloudflare Secrets — not by a database role table. This keeps admin access provisionable from outside the app, even if the master DB is unreachable.

## Allowlist

Staff identity check happens in middleware. Implementation lands with the auth scaffold in Phase 1; the contract:

- Cloudflare Secret holds a JSON allowlist of `{ emails: [], domains: [] }`.
- Middleware resolves the SSO claim, then matches against the allowlist.
- Mismatches return 403 with a generic error — no information disclosure about who is or isn't authorised.

Adding or removing staff is a Cloudflare Secret update, not a code change.

## CSRF

All mutating forms in `apps/admin` use better-auth CSRF helpers, the same way `apps/web` does. Raw POST handlers without a CSRF token are forbidden.

## Where to Look

Pointers to root rules and the related auth surface.

- Root security model: [root security-model](../../../lat.md/security-model.md)
- Frontend auth (for comparison): [apps/web auth](../../web/lat.md/auth.md)
- better-auth Google provider: <https://www.better-auth.com/docs/authentication/google>
