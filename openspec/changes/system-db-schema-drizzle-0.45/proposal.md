# system-db-schema-drizzle-0.45

> Follow-up to [`system-dep-remediation`](../system-dep-remediation/proposal.md) — clears the 2 residual `drizzle-orm` high CVEs (ledger §9).

## Why

Two high Dependabot alerts remain on `drizzle-orm` because **`packages/db-schema` resolves drizzle-orm 0.36.4** while the CVE fix is in **0.45.2**. `system-dep-remediation` could not close these with a lockfile override — 0.36→0.45 is a library-API jump that can change query/type behavior, so it's a real (small) migration, not a pin. Notably **`apps/web` already runs drizzle-orm `^0.45.2`**, so the workspace is internally inconsistent (two drizzle majors), which is itself worth resolving.

## What Changes

- Bump `packages/db-schema` `drizzle-orm` from `^0.36.0` to **`^0.45.2`** (align with `apps/web`), and any other `apps/*` still on 0.36.x.
- Reconcile the 0.36→0.45 API deltas in the shared schema + query code (column/relation builders, `sql` helpers, type inference changes) so `@baseout/db-schema` and its consumers (`apps/web`, `apps/server`, `apps/admin` mirrors) typecheck and pass tests.
- Regenerate `pnpm-lock.yaml`; confirm the 2 `drizzle-orm` highs clear on rescan.

Out of scope: schema/migration changes (this is a library version bump + API reconciliation only); the entitlements/per-space schema work owned by other changes.

## Capabilities

### Modified Capabilities

_None in `openspec/specs/` — a dependency-version + API-reconciliation change; no new product requirement._

## Impact

- **`system-*`** — `@baseout/db-schema` is the shared Drizzle package; the bump ripples to every consumer that imports its query builders. Touches `packages/db-schema/package.json`, any 0.36-era query/type code, and `pnpm-lock.yaml`.
- **Security:** clears 2 high CVEs. No new secret/auth/SQL surface; parameterized-query discipline (§3.3) unchanged.
- **Testing (§3.4):** db-schema has no `test` script on `main` today — add/extend unit coverage for any query builder touched by the API reconciliation, and verify `apps/web`/`server`/`admin` typecheck + suites stay green (they already consume 0.45.x in web).
- **Risk:** low-medium — API drift between 0.36 and 0.45 is the main hazard; caught by typecheck + tests. Reversible via lockfile + code revert.
