# Architecture

`@baseout/admin` is the internal staff Astro SSR app. Google SSO only; **no customer auth, no customer data writes** — operations on customer data go through `apps/server`'s `/api/internal/*` surface so they're audit-logged and rate-limited there.

Currently scaffolded as [src/index.ts](../src/index.ts) only. Phase 1+ adds the real Astro pages.

## Scope

What the admin app is for, and what it isn't. The boundary matters because the temptation to put "just one customer-facing page" here is real.

- For: staff-only observability — system health, run inspection, customer support tooling, manual interventions.
- Not for: customer-facing UI (that's `apps/web`), backup execution (that's `apps/server`), public APIs (that's `apps/api`).

## Deployment

Cloudflare Workers via Wrangler. Configuration in [wrangler.jsonc](../wrangler.jsonc). Worker name: `baseout-admin`. Environments: `production`, `staging`.

The deployed surface is reachable only from staff IPs — additional perimeter rules live in Cloudflare Access, not in code.

## Where to Look

Pointers to scope rules and the related apps.

- Wrangler config: [wrangler.jsonc](../wrangler.jsonc)
- Cross-app token map: [root cross-app-comm](../../../lat.md/cross-app-comm.md)
- `apps/server` surface: [apps/server lat graph](../../server/lat.md/)
