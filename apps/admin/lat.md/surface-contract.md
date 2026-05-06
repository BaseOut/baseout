# Surface Contract

`apps/admin`'s public surface is **only what's needed for staff workflows**. Outbound calls into `apps/server` use the same `INTERNAL_TOKEN` mechanism that `apps/web` uses.

Currently no routes — Phase 1+ adds the staff console.

## Outbound Calls

When an admin operation needs to act on customer data, the path is the same as for customers: call `apps/server`'s `/api/internal/*`. Don't bypass the engine to write directly to customer DBs from `apps/admin`.

The token used is the same `INTERNAL_TOKEN` shared with `apps/web` — see [root cross-app-comm](../../../lat.md/cross-app-comm.md). Rotation requires updating all three Worker Secret namespaces.

## Read-Only by Default

Pages that show customer state should read from the master DB directly via Drizzle. Pages that change customer state should call `apps/server` so the action is logged and rate-limited at the engine level.

This is a soft rule today (no enforcement) — make it explicit per page in the implementation PR.

## Where to Look

Pointers into related surfaces and rules.

- Cross-app token map: [root cross-app-comm](../../../lat.md/cross-app-comm.md)
- Root security model: [root security-model](../../../lat.md/security-model.md)
- `apps/server` surface: [apps/server surface contract](../../server/lat.md/surface-contract.md)
