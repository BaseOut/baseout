# Auth

Customer auth is **passwordless** — magic link via [better-auth](https://www.better-auth.com). No password inputs, no hashing flows, no "forgot password" flows in V1.

`apps/web` is the only place in the monorepo that runs better-auth. `apps/server` and the other backend apps have no customer auth — they take `INTERNAL_TOKEN`-bearing service calls only.

## Magic Link Flow

The end-to-end flow as it stands today.

1. User submits email on [src/pages/login.astro](../src/pages/login.astro) (or `/register`).
2. `apps/web` better-auth issues a magic-link email via Mailgun (env `EMAIL`, `EMAIL_FROM`, base URL via `PUBLIC_AUTH_BASE_URL`).
3. User clicks the link, which hits `/api/auth/<callback>`.
4. better-auth issues a session cookie; middleware caches the resolved session.
5. Subsequent requests pass through [[auth#Auth#Route Protection]] using the cached session.

## Route Protection

[src/middleware.ts](../src/middleware.ts) is the single auth gate. It runs on every request and decides whether to allow the response, redirect to `/login`, or forward to better-auth.

Public path predicates live in `isPublicRoute(pathname)`:

- `/login`, `/register`
- Anything under `/api/auth/`
- Dev-only stubs at `/api/stub/*` when `AIRTABLE_STUBS_ENABLED === '1'`
- Dev-only e2e helpers at `/api/internal/test/*` when `E2E_TEST_MODE === 'true'`

Anything else is auth-gated. There is no ad-hoc auth check anywhere in the app — every protected page and API route flows through this middleware.

## Session Cache

[src/lib/session-cache.ts](../src/lib/session-cache.ts) caches resolved sessions for `SESSION_TTL_MS` keyed off the cookie value, so per-page navigation doesn't re-validate against better-auth on every click.

The cache is intentionally Worker-instance-local — there's no shared KV. On a cold isolate the next request validates fresh; for a hot isolate the cache is fast. This is acceptable because session validation is read-only and idempotent.

## Auth Env

The middleware builds the auth config per request via `createAppAuth(env)` with these inputs from Cloudflare Secrets / `wrangler.jsonc` vars:

| Env var | Purpose |
|---|---|
| `BETTER_AUTH_SECRET` | Session cookie signing key |
| `EMAIL`, `EMAIL_FROM` | Mailgun config for magic-link emails |
| `PUBLIC_AUTH_BASE_URL` | Explicit magic-link base URL — required under `wrangler dev --remote` |

Per [root security-model](../../../lat.md/security-model.md), all of these live in Cloudflare Secrets — never in committed `.env` files.

## CSRF

Mutating forms must use better-auth's CSRF helpers. Raw POST handlers without a CSRF token are forbidden by [.claude/CLAUDE.md](../.claude/CLAUDE.md) §2.

## Logout

Logout clears the session cookie and **must reset every user-scoped nanostore**. The canonical pattern is in `src/components/layout/Sidebar.astro`'s logout handler — see [[state-management#State Management#Reset on Logout]].

## Where to Look

Pointers to source files and rules.

- Middleware: [src/middleware.ts](../src/middleware.ts)
- Session cache: [src/lib/session-cache.ts](../src/lib/session-cache.ts)
- Auth factory: [src/lib/auth.ts](../src/lib/auth.ts)
- Per-app rules: [.claude/CLAUDE.md](../.claude/CLAUDE.md)
- PRD auth spec: [shared/Baseout_PRD.md §13](../../../shared/Baseout_PRD.md)
