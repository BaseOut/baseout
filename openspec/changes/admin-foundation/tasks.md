## 1. Scaffold the Astro SSR app

- [x] 1.1 Add deps to `apps/admin/package.json`: `astro`, `@astrojs/cloudflare`, `tailwindcss` + `@tailwindcss/vite`, `daisyui`, `drizzle-orm`, `postgres`, `@baseout/db-schema`; dev: `vitest`, `@astrojs/check`, `typescript`, `wrangler` 4.x. (`@baseout/ui` dropped — it's an empty stub; daisyUI used directly per CLAUDE.md §4.2.)
- [x] 1.2 Replace placeholder scripts: `dev` = `scripts/dev.mjs` (renders `wrangler.jsonc` from `.example` with `DATABASE_URL`, then `astro dev`) on `baseout.local:4332` (host/port in `astro.config.mjs`); `build` = `astro build`; `typecheck` = `astro check`. `wrangler.jsonc` is gitignored (rendered); `wrangler.jsonc.example` is tracked.
- [x] 1.3 Add `astro.config.mjs` (output `server`, `@astrojs/cloudflare` adapter + platformProxy, Tailwind via vite plugin, `server.host/port`), mirroring `apps/web/astro.config.mjs`.
- [x] 1.4 Update `apps/admin/wrangler.jsonc`: no `main` (adapter owns it; declaring it breaks the CF vite plugin), placeholder Hyperdrive binding for the future deploy, `routes` left commented.
- [x] 1.5 Delete the placeholder `src/index.ts`.

## 2. Master-DB access (per-request) + table mirror

- [x] 2.1 Copy `createDb(connectionString)` from `apps/web/src/db/worker.ts` into `apps/admin/src/db/worker.ts`.
- [x] 2.2 Create `apps/admin/src/db/schema/` mirroring only: `organizations`, `spaces`, `space_platforms`, `platforms`, `subscriptions`, `subscription_items` (from `core.ts`); re-export `sessions`, `users` from `@baseout/db-schema`. Header comment names the canonical source.
- [x] 2.3 `resolveDbUrl()` returns `env.HYPERDRIVE.connectionString` (workerd dev + deployed both go through Hyperdrive; no direct-`DATABASE_URL` branch — that fails inside `astro dev`'s workerd runner). Never hardcoded.

## 3. Auth gate

- [x] 3.1 Copy `extractSessionTokenCookie` (from `apps/web/src/lib/session-cache.ts`) into `apps/admin/src/lib/admin-session.ts`.
- [x] 3.2 `src/middleware.ts`: parse cookie → look up `sessions` by token candidates → check `expires_at > now()` → join `users` → require `role === 'super'`. Stash `{ user }` on `context.locals`; release `sql` after response.
- [x] 3.3 Non-`super` / missing / expired session → render a minimal 403 page. No login UI.
- [x] 3.4 `src/env.d.ts`: type `App.Locals` (`{ db, user }`) and a minimal `cloudflare:workers` module decl (Hyperdrive).

## 4. Organizations → Spaces surface

- [x] 4.1 `src/pages/index.astro`: query every Organization with its Spaces (name, status, platform via `space_platforms`) and tier (via `subscription_items` → `subscriptions`); render with daisyUI table. Read-only.
- [x] 4.2 Empty/zero-data state renders cleanly (org-with-no-spaces + zero-orgs branches; covered by `buildTracker` tests).

## 5. Tests (Vitest, node)

- [x] 5.1 Auth-gate unit test (`admin-session.test.ts`): `role='super'` → allowed; `role='customer'` → not-super; no/expired session → rejected; cookie parsing + token-candidate extraction.
- [x] 5.2 Query-shape test (`tracker.test.ts`) for the org→spaces aggregation (Orgs with/without Spaces, tier join, sort).

## 6. Verify locally

- [x] 6.1 `astro dev` serves on `http://baseout.local:4332` (dev cookie is non-Secure, so http is sufficient; smoke-confirmed).
- [ ] 6.2 Logged into `apps/web` as a `super` user → admin URL shows the Org/Spaces table. **(needs human session — see smoke steps)**
- [ ] 6.3 A `customer` session → 403. **(needs human session)** — no-cookie → 403 already smoke-confirmed (`reason: no-session`).
- [x] 6.4 `typecheck` (astro check) and Vitest (16 tests) green; no stray `console.*`.

## 8. Sign-in round-trip (cross-app: apps/web + apps/admin)

- [x] 8.1 admin 403 routing: `no-session`/`expired` → "Sign in to Baseout" CTA → `${WEB_APP_URL}/login?returnTo=<admin origin>`; `not-super` → informational page (no sign-in prompt). `WEB_APP_URL` configurable, defaults to canonical dev origin.
- [x] 8.2 web `src/lib/return-to.ts` (+ test): `validateReturnTo()` open-redirect guard — `baseout.local` in dev, allowlisted origins otherwise; rejects off-domain, non-http(s), malformed.
- [x] 8.3 web `src/pages/login.astro`: read + validate `?returnTo=`, use as magic-link `callbackURL` (fallback `/welcome`).
- [x] 8.4 web `auth-factory.ts`: add `http://baseout.local:*` to dev-only `DEV_TRUSTED_ORIGINS` so the cross-origin callback is permitted.
- [x] 8.5 Tests green: web (return-to 7, auth-factory + middleware unchanged) + admin (16); typecheck clean.
- [ ] 8.6 Human smoke: from admin → Sign in → magic link → land back on admin tracker. **(needs both apps running + email round-trip)**

## 7. Definition of Done

- [x] 7.1 Placeholder Worker replaced by a real Astro SSR app that runs locally.
- [x] 7.2 Access gated on an existing `role='super'` better-auth session; non-super / no-session → 403.
- [ ] 7.3 Organizations → Spaces tracker renders real master-DB rows. **(needs human session against the real DB)**
- [x] 7.4 Tests + typecheck green; `apps/web`/`server`/`workflows` untouched at runtime.
- [x] 7.5 Interim auth decision + `CLAUDE.md` role-wording correction noted for follow-up in `admin`.
