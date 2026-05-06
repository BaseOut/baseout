# Architecture

`@baseout/sql` is the public read-only SQL REST API at `sql.baseout.com`. Customers send SQL queries scoped to **their own client DB only**; the Worker authenticates the request, resolves the right Hyperdrive binding, and proxies the query.

Currently scaffolded as [src/index.ts](../src/index.ts) only. Phase 3 ships the v1 surface (Pro+).

## Scope

What this app does and doesn't do. Strict scope is the whole point — public SQL access is a sharp tool.

- For: customer-issued read-only SQL queries against their own client DB.
- Not for: cross-customer queries, master-DB access, write operations on the default plan.

## Tier Gating

`apps/sql` is a Pro+ feature per [root pricing-tiers](../../../lat.md/pricing-tiers.md). Tier gating reads from Stripe metadata via the capability resolver — never from product name strings. Sub-tier customers receive a 403 with a clear upgrade message.

## Hyperdrive Routing

Each customer client DB has its own Hyperdrive binding (D1, Shared PG, Dedicated PG, BYODB). `apps/sql` resolves the right binding from the request's API-key context (Organization + Space) and proxies the query.

Connections are per-request — see the runtime rules in [root tech-stack](../../../lat.md/tech-stack.md). No connection pooling that survives a request.

## Where to Look

Pointers to related rules and apps.

- Tier gating: [root pricing-tiers](../../../lat.md/pricing-tiers.md)
- Read-only contract: [[read-only-default]]
- Client-DB provisioning: [[provisioning]]
- Cross-app token map: [root cross-app-comm](../../../lat.md/cross-app-comm.md)
