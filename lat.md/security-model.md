# Security Model

Security is a gate on every change, not an afterthought. This section is the searchable summary of the rules.

Long-form rationale is in [CLAUDE.md](../CLAUDE.md) §3.3 and [shared/Baseout_PRD.md](../shared/Baseout_PRD.md) §20. When introducing a new secret, auth path, SQL surface, internal-API surface, or external integration, the change must explicitly call out review points against this section.

## Secrets

All secrets live in Cloudflare Secrets — never hardcoded, never in committed `.env` files. Each Worker repo maintains its own Cloudflare Secrets namespace; rotation is via the Cloudflare dashboard.

The minimum set of secrets the system depends on:

| Secret | Where stored | Notes |
|---|---|---|
| Stripe API keys | Cloudflare Secrets | Separate keys per environment |
| Master encryption key | Cloudflare Secrets | Used to encrypt OAuth tokens + API keys at rest |
| Airtable OAuth client secret | Cloudflare Secrets | |
| Storage provider OAuth secrets | Cloudflare Secrets | Google, Dropbox, Box, OneDrive |
| Database connection strings | Cloudflare Secrets | Per-environment |
| Trigger.dev API key | Cloudflare Secrets | |
| better-auth secret | Cloudflare Secrets | Session signing key |
| `INTERNAL_TOKEN` | Cloudflare Secrets | Service-to-service gate for `apps/server` |

The `${FONTAWESOME_TOKEN}` env-var form is mandatory in `.npmrc` — never commit a literal token.

## Encryption at Rest

OAuth tokens, refresh tokens, and customer API keys are AES-256-GCM encrypted before write to the master DB and decrypted at runtime via the Cloudflare Secrets master key. Plaintext storage of any of these is forbidden.

| Data | Method |
|---|---|
| OAuth tokens (Airtable, storage destinations) | AES-256-GCM in master DB; decrypted at runtime |
| API keys (Inbound API, SQL REST) | AES-256-GCM, same approach |
| Backup files (R2 managed) | Cloudflare R2 server-side encryption |
| Customer DBs (D1, shared PG, dedicated PG) | Provider-managed at-rest encryption |
| Passwords (when email+password is enabled) | bcrypt via better-auth (better-auth handles natively) |

Encrypted columns in Drizzle schemas use the `_enc` suffix — see [[db-schema-overview]].

## Authentication

Baseout is **passwordless** — magic-link via better-auth is the V1 auth path. There are no password inputs, no hashing flows, no "forgot password" flows. If a requirement implies passwords, surface it as a scope conflict with [shared/Baseout_PRD.md](../shared/Baseout_PRD.md) §13.

- Customer auth: magic link, email+password (post-V1), 2FA TOTP, Enterprise SAML — all via better-auth.
- Connection auth: Airtable OAuth, scoped to an Organization.
- Admin app: Google SSO.
- API tokens: store hashes (`api_tokens.token_hash`), not plaintext.

## Authorization

Frontend route protection lives in `apps/web/src/middleware.ts`. Every protected page and API route passes through it — no ad-hoc checks.

CSRF is enforced via better-auth helpers on mutating forms; raw POST handlers without a CSRF token are forbidden.

Service-to-service auth between apps:

- `apps/server`'s `/api/internal/*` routes are gated by the `x-internal-token` header (`INTERNAL_TOKEN` secret). Public surface is `/api/health` only.
- Cross-app HTTP calls are authenticated with HMAC tokens minted from `@baseout/shared` — see [[cross-app-comm]].

Principle of least privilege applies to OAuth scopes, DB roles, and API tokens — narrowest viable set.

## SQL and Input Handling

Parameterised queries via Drizzle only — never string-concatenate SQL. The Direct SQL API (`apps/sql`, Pro+) is read-only by default; write access is an explicit Enterprise opt-in.

Server-side input validation runs on every API route and form handler; client validation is UX, not security. Output relies on Astro auto-escaping; never `set:html` user-supplied data.

## Audit

Auth and billing state changes write to the appropriate log table on the frontend. Backup runs write rows to `baseout.backup_runs` (mirrored in `apps/server` — see [[db-schema-overview]]). New mutating surfaces should add audit rows; ad-hoc logging is not a substitute.

## Where to Look

Pointers to authoritative sources for these rules.

- Long-form rules: [CLAUDE.md](../CLAUDE.md) §3.3
- PRD security spec: [shared/Baseout_PRD.md](../shared/Baseout_PRD.md) §20
- Cross-app token mechanics: [[cross-app-comm]]
- Encrypted-column conventions: [[db-schema-overview]]
