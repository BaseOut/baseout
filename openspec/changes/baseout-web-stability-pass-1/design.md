## Context

Post-cutover web app. The foundation works (verified end-to-end in [plans/2026-05-07-monorepo-cutover-day.md](../../../plans/2026-05-07-monorepo-cutover-day.md) Block 1) but two issues block confident continued work:

- **Hydration drift on space switch.** The pattern in CLAUDE.md §4 mandates JSON-script SSR hydration for cross-component reactive state. Three stores (`$account`, `$integrations`, `$spaces`) qualify. Two of them (`$account`, `$integrations`) follow the pattern; `$spaces` was implemented ad-hoc with a manual `refreshSpaces()` fetch. That asymmetry is the proximate cause of the stale UI: the switch handler updates `$spaces` cleanly but the other two stores remain pinned to the SSR snapshot.
- **No test runtime.** PRD §14.4 sets coverage targets but the harness has never been exercised after the monorepo cutover. Without a green Vitest baseline, every subsequent feature change has to debug both itself *and* the harness.

Today's pass is intentionally conservative: minimum viable fixes plus the lowest-effort V1 polish. Anything that needs `apps/server` real implementations (backups, restore, schema, reports) is out of scope and tracked in cutover plan §6.2.

## Goals

- Switching Space updates the UI in place — no hard reload required, no stale data on `/`, `/integrations`, `/profile`.
- `pnpm --filter @baseout/web test` runs green and the CI workflow exercises it on every PR.
- `/settings` is no longer a placeholder for the V1 essentials a real user would expect to find.
- All three tracks land in a single working session by a single agent.

## Non-Goals

- Refactoring the auth flow, the dashboard composition, or the integrations OAuth flow — they all work; touching them is drive-by churn (CLAUDE.md §1.5).
- Hitting PRD §14.4's full coverage target. Today bootstraps the harness with three high-leverage tests that lock in store + auth-utils contracts.
- Building out backups/restore/schema/reports surfaces. Those depend on `apps/server` real implementation.
- Adding a help-center page, notification center, quota usage display, or onboarding wizard polish — each gets its own future change.
- Doc-layer reconciliation, Fontawesome rotation, decomposing `baseout-backup`, `openspec/AGENTS.md`, PR template, CI openspec-validate — those are cutover-plan repo-meta items, not web-app work.
- Account deletion flow, if the `deletion_requests` schema isn't ready. Surface the blocker; don't invent a table.

## Decisions

### D1 — `$spaces` hydration pattern

**Decision:** Hydrate `$spaces` via JSON-script in `SidebarLayout.astro`, same as `$account` and `$integrations`. Keep `refreshSpaces()` as a manual-fetch fallback for cases where the layout isn't mounted (e.g., a future page that loads stores out-of-band).

**Why:** Symmetry across the three layout-bound stores. CLAUDE.md §4 explicitly endorses the JSON-script pattern as the canonical approach. Manual-fetch on initial load means an extra round-trip on every page navigation.

**Trade-off:** Slightly larger initial HTML payload (the spaces list serialized once). Acceptable — spaces lists are bounded.

### D2 — Atomic store update on switch vs. hard reload

**Decision:** Make `POST /api/spaces/switch` return `{ account, integrations, spaces }` payloads. The client updates all three stores in a single tick after the switch responds.

**Why:** A hard reload (`window.location.reload()`) would also fix the bug, but it discards client-side scroll position, blanks the UI for a moment, and re-runs every store's hydration. The atomic update is faster and matches Astro's view-transitions ethos.

**Trade-off:** A larger response payload from `/api/spaces/switch` (was: `204`; will be: ~5–20KB depending on org size). The endpoint is called only on user-initiated switch, not on every render — bandwidth cost is negligible.

### D3 — Track C scope: ship-or-skip per piece

**Decision:** The settings page V1 ships four cards (trial badge, org info, sign-out, deletion request). Each is independently verifiable. If the deletion-request schema isn't in the master DB yet, ship the first three and add a TODO comment + surface the blocker.

**Why:** "All-or-nothing" risks losing the whole track if one piece blocks; "best-effort" delivers user-visible value even when one piece is blocked.

**Trade-off:** Slightly more state to track (which piece shipped vs. didn't). Mitigated by tasks.md being explicit per piece.

### D4 — Test selection

**Decision:** Three unit tests today: `auth-utils.ts`, `stores/spaces.ts`, `stores/account.ts`. Defer integration / E2E tests.

**Why:** auth-utils is pure DOM manipulation, easy to test, used everywhere. Both stores are state-management code where regression risk is high — locking in the contract early is high-leverage. Integration / E2E is more setup cost than today's budget allows.

**Trade-off:** No coverage on Astro components today. Acceptable — they don't change in this pass.

## Risks / Trade-offs

| # | Risk | Likelihood | Mitigation |
|---|------|------------|------------|
| R1 | The atomic-update payload from `/api/spaces/switch` doesn't include some derived field a view depends on | Medium | Explicit list of fields in tasks.md §A.4; test by manually switching on every authenticated page |
| R2 | Vitest config drift since cutover means tests don't even boot | Medium | Track B step 1 is "make `pnpm test` boot." If config needs more than ~30 min of repair, file as a follow-up and ship Tracks A + C only |
| R3 | `deletion_requests` schema doesn't exist in the master DB | Medium | D3 — ship the other three settings pieces; new change `baseout-web-account-deletion` for the rest |
| R4 | Atomic store update introduces a race (e.g., subscriber fires before all three stores updated) | Low | Use nanostores' synchronous `.set()` and update in a deterministic order: spaces → account → integrations. Subscribers see the consistent post-update state |
| R5 | The `$spaces` JSON-script hydration changes break the existing manual-fetch fallback used elsewhere | Low | Keep `refreshSpaces()` as the named fallback; the SSR hydration is a new code path, not a replacement |

## Verification

End-to-end:

```bash
# Build / typecheck — clean
pnpm --filter @baseout/web typecheck
pnpm --filter @baseout/web build

# Track A — manual, 3 minutes
pnpm --filter @baseout/web dev
# Open / in browser; switch Spaces via sidebar dropdown
# Verify: org name, space name, integrations list, base count all update
# Repeat on /integrations and /profile

# Track B — automated
pnpm --filter @baseout/web test
# Expect: 0 failures; 3 new test files green; coverage report includes
# auth-utils, spaces store, account store

# Track C — manual, 2 minutes
# Navigate to /settings
# Verify: trial badge shows correct state; sign-out works; org card renders;
# (if shipped) deletion request opens modal and POSTs cleanly
```

CI: `.github/workflows/ci.yml` must run `pnpm --filter @baseout/web test` on every PR. Confirm in the workflow file before closing the change.
