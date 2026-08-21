# Architecture

`@baseout/web` is the customer-facing Astro SSR app. It owns customer auth, OAuth Connect flows, the dashboard, settings, marketing pages, the `/ops` console, and **master-DB schema ownership**.

It's deployed as Cloudflare Pages + Workers. Astro's Cloudflare adapter handles the SSR runtime; the same code path serves both pages and `/api/*` routes.

## SSR Entry

Astro's adapter wraps the entry — there is no hand-written `index.ts` for the public Worker fetch handler. Routing is file-based under [src/pages/](../src/pages/), with `.astro` files for pages and `.ts` files for API routes.

Middleware runs before every request via the file-based [src/middleware.ts](../src/middleware.ts) — see [[auth#Auth#Route Protection]].

## Per-Request Locals

[src/middleware.ts](../src/middleware.ts) attaches per-request locals to `Astro.locals` for downstream pages and handlers:

- `db` — per-request Drizzle client over postgres-js (Hyperdrive in deployed envs, direct DATABASE_URL in `wrangler dev`).
- `auth` — better-auth instance built per request via `createAppAuth` with env-derived secrets.
- `session` and `user` — resolved from the session cookie via [src/lib/session-cache.ts](../src/lib/session-cache.ts), cached for `SESSION_TTL_MS` to avoid hammering better-auth on every navigation.
- `account` — the viewer's [[architecture#Architecture#Account Context]] when the request is authenticated.

## Account Context

[src/lib/account.ts](../src/lib/account.ts) resolves the full "viewer" for an authenticated user — current Organization, current Space, available Spaces, role. It reads `user_preferences` for active Org/Space and falls back to the user's first org membership.

The same shape (`AccountContext`) is hydrated into [[state-management]]'s `$account` store on page load so client islands get the same data without a second fetch.

## App Shell Chrome

[src/layouts/SidebarLayout.astro](../src/layouts/SidebarLayout.astro) wraps every authenticated page. Two chrome loads used to run **before** the page HTML could leave the Worker:

- Connection-health banner — one master-DB read of Airtable connection status. Cheap; stays in layout SSR.
- Overlay inbox — `fetchInboxItems` fans `getNotifications` across every Space with a 3s timeout. That blocked every click (and viewport-prefetch of every sidebar link multiplied it).

The overlay now renders via [src/layouts/InboxOverlay.astro](../src/layouts/InboxOverlay.astro) with Astro `server:defer`, so the page body is not held hostage. The `/inbox` page still SSR-fetches the feed for its body and passes `inboxItems` into the layout for the badge. Sidebar nav uses hover prefetch (`lib/shell-chrome.ts`), not viewport.

## Drizzle and DB

[src/db/](../src/db/) holds the Drizzle schema and per-request client. `apps/web` is the **canonical owner** of the master-DB schema — migrations live in [drizzle/](../drizzle/) and are applied via drizzle-kit.

Mirrored tables in `apps/server` follow the rule from [root db-schema-overview](../../../lat.md/db-schema-overview.md) — only a strict subset, with header comments naming this canonical source.

## Deployment

Cloudflare Pages + Workers via Wrangler. Configuration in [wrangler.jsonc](../wrangler.jsonc); environments are `production` and `staging`. Hyperdrive binding for the master DB.

`launch.mjs` (or equivalent script) renders environment-specific config from `.env` before `astro build` + `wrangler deploy`.

## Where to Look

Pointers to source and per-app rules.

- Per-app frontend rules: [.claude/CLAUDE.md](../.claude/CLAUDE.md)
- Middleware: [src/middleware.ts](../src/middleware.ts)
- Account context: [src/lib/account.ts](../src/lib/account.ts)
- App shell chrome: [src/layouts/SidebarLayout.astro](../src/layouts/SidebarLayout.astro) + [src/lib/shell-chrome.ts](../src/lib/shell-chrome.ts)
- Schema: [src/db/](../src/db/) + [drizzle/](../drizzle/)
- Root architecture rules: [root engineering-principles](../../../lat.md/engineering-principles.md)
