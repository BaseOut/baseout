# Provisioning

Client DBs are provisioned by `apps/server`, not by `apps/sql`. This Worker assumes a Hyperdrive binding already exists for the customer's Space and proxies queries against it.

If a customer queries before their client DB is ready, return a clear 409 — don't auto-provision from the request path.

## Provisioning Flow (in `apps/server`)

The provisioning lives in `apps/server`'s Trigger.dev tasks; documented here only because `apps/sql` depends on its output.

1. `apps/web` records the customer's tier upgrade and triggers `apps/server`.
2. `apps/server` provisions the appropriate DB tier (D1 / Shared PG / Dedicated PG / BYODB) per [root pricing-tiers](../../../lat.md/pricing-tiers.md).
3. `apps/server` writes the connection details (encrypted) to the master DB.
4. `apps/server` registers a Hyperdrive binding visible to `apps/sql`.
5. `apps/server` runs schema-creation against the new client DB.
6. The customer's API key becomes usable on `sql.baseout.com`.

Until step 6 completes, `apps/sql` returns 409 with `"client database not yet provisioned"`.

## DB Tier Mapping

The DB tier each plan provisions, summarised. See [root pricing-tiers](../../../lat.md/pricing-tiers.md) for the canonical matrix.

| Plan | Client DB |
|---|---|
| Trial / Starter | D1 (schema only) |
| Launch / Growth | D1 (full) |
| Pro | Shared PostgreSQL (schema-isolated) |
| Business | Dedicated PostgreSQL |
| Enterprise | BYODB (customer-hosted) |

## Where to Look

Pointers to provisioning sources and related rules.

- Tier matrix: [root pricing-tiers](../../../lat.md/pricing-tiers.md)
- `apps/server` Trigger.dev tasks: [apps/server trigger-tasks](../../server/lat.md/trigger-tasks.md)
- Cross-app token map: [root cross-app-comm](../../../lat.md/cross-app-comm.md)
