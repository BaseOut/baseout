## Why

`apps/web` is post-cutover (commits `65ea066`, `a9c8506`). Auth, dashboard, integrations, spaces management, and profile are production-ready end-to-end. Two specific gaps were flagged in the last commit message and need to land before subsequent feature work piles on top:

1. **Switching Space leaves the UI in a stale state.** The `$spaces` store updates correctly, but `$account` and `$integrations` stores were SSR-hydrated against the *old* space's context, so `DashboardView` and `IntegrationsView` keep rendering stale Astro props. Users have to hard-reload to see the right data.
2. **The web app has no real test coverage.** Vitest configs exist (`vitest.config.ts`, `vitest.integration.config.ts`) but the harness has not been verified post-cutover and there are no unit tests for the auth-utils helpers or the nanostores. PRD §14.4 targets 60% on UI; we're at 0%.

Today's pass also closes the lowest-hanging stub on the authenticated surface — `/settings` is currently 22 lines of placeholder copy. PRD §13 (Auth) and §6.5 (UX) imply minimum V1 settings: trial state, sign-out, account-deletion request, org info.

## What Changes

- **Track A — Spaces refresh fix.** Hydrate `$spaces` server-side via the JSON-script pattern (matching `$account` and `$integrations` per CLAUDE.md §4). Extend `POST /api/spaces/switch` to return refreshed `account` + `integrations` payloads. Update `Sidebar.astro`'s `handleSwitch()` to atomically update all three stores so SSR-rendered markup reflects the new space without a hard reload.
- **Track B — Vitest bootstrap + happy-path unit tests.** Verify `pnpm --filter @baseout/web test` boots clean. Add unit tests for `src/lib/auth-utils.ts`, `src/stores/spaces.ts`, and `src/stores/account.ts`. Confirm CI runs the suite.
- **Track C — Settings page V1 essentials.** Replace the placeholder `/settings` page with: trial-state badge card, sign-out button, org info card (read-only), and account-deletion request CTA. Account deletion gated on whether the `deletion_requests` schema exists; if not, ship the other three and surface it as a blocker for a follow-up change.

## Capabilities

### New Capabilities

- `web-settings-page` — `/settings` renders V1 essentials: trial-state badge, sign-out button, org info card (read-only), and account-deletion request CTA. Spec: [specs/web-settings-page/spec.md](./specs/web-settings-page/spec.md). Future enrichments (member mgmt, billing portal, preferences) will land in a follow-up `baseout-web-settings-extended` change.

### Modified Capabilities

None at the spec level — no SHALL contracts change. Track A repairs an existing capability (Space switching) to match its intended behavior without changing the contract; Track B is test bootstrap with no spec implications.

## Impact

- [apps/web/src/layouts/SidebarLayout.astro](../../../apps/web/src/layouts/SidebarLayout.astro) — add `$spaces` JSON-script hydration alongside the existing account + integrations scripts.
- [apps/web/src/stores/spaces.ts](../../../apps/web/src/stores/spaces.ts) — add SSR hydration code path; keep `refreshSpaces()` as fallback.
- [apps/web/src/pages/api/spaces/switch.ts](../../../apps/web/src/pages/api/spaces/switch.ts) — return `{ account, integrations, spaces }` payload on success.
- [apps/web/src/components/layout/Sidebar.astro](../../../apps/web/src/components/layout/Sidebar.astro) — `handleSwitch()` updates all three stores atomically.
- [apps/web/vitest.config.ts](../../../apps/web/vitest.config.ts) — verify config is post-cutover-clean.
- [apps/web/tests/](../../../apps/web/tests/) — three new unit test files: `auth-utils.test.ts`, `stores/spaces.test.ts`, `stores/account.test.ts`.
- [apps/web/src/pages/settings.astro](../../../apps/web/src/pages/settings.astro) — replace placeholder with the four V1 cards.
- [apps/web/src/pages/api/account/delete-request.ts](../../../apps/web/src/pages/api/account/delete-request.ts) — new POST route (conditional on schema availability).
- [.github/workflows/ci.yml](../../../.github/workflows/ci.yml) — confirm `pnpm --filter @baseout/web test` runs on every PR.

No cross-app contract changes. No `apps/server` interaction. No `packages/db-schema` or `packages/ui` modifications, so no parallel-change serialization needed (per [openspec/AGENTS.md] conventions in cutover plan §6.1).

## Reversibility

Fully reversible. Each track is independent; if Track C's deletion-request route hits a schema blocker, only that one piece is deferred. Track A is a pure additive change (no API removals). Track B adds tests, never removes them.
