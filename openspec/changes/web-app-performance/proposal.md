# web-app-performance — Proposal

## Why

In the 2026-07-15 Dan/Autumn sync, Autumn reported resolving an intermittent issue where the app would lock up and fail to load Spaces (that bug is **already fixed** — not part of this change). The forward-looking items Autumn committed to are: (1) the app is generally slow to load and needs optimisation, and (2) slow waits give no feedback, so users can't tell whether the app is working or stuck. Dan is one of those users hitting the slow loads today.

Baseout already has the canonical fix for (2): `setButtonLoading` in [apps/web/src/lib/ui.ts](../../../apps/web/src/lib/ui.ts) (CLAUDE.md §4.5). The gap is coverage — server-waiting interactions and full-page/data loads that currently show nothing during the wait — plus measuring and trimming the actual load cost.

## What Changes

- **Loading feedback for every server wait.** Audit the interactions that trigger a network round-trip or a slow page/data load and ensure each shows a visible spinner while in flight — `setButtonLoading` for buttons/forms (cleared in a `finally`), and a context-appropriate daisyUI `loading` component for non-button waits (Space list load, data refreshes, page transitions). A disabled control alone is not sufficient (§4.5).
- **Load-path optimisation.** Measure the slow surfaces (Space/dashboard load is the reported pain), identify the dominant cost (SSR query fan-out, oversized client JS, unhydrated islands loading eagerly), and apply targeted, low-blast-radius fixes — e.g. tighten SELECTs, defer non-critical islands to `client:idle`/`client:visible`, remove redundant round-trips. No sweeping rewrite (§3.2).
- **Tests.** Unit coverage for any extracted loading helper; a spot check that the audited interactions set `aria-busy`/spinner state while pending.

## Capabilities

### New Capabilities

- `app-loading-performance`: server-waiting interactions and slow loads show visible progress feedback, and the primary load paths are measurably faster.

## Impact

- **apps/web** — views and islands with server waits (Space list/dashboard, data refreshes, form submits), `src/lib/ui.ts` (existing `setButtonLoading`), island hydration directives. No backend or schema change.
- **Design system** — spinners use existing daisyUI `loading` primitives / Storybook components; no custom components (§4.2). Update the relevant story if a loading state variant is added.
- No security surface (no new auth, secret, SQL, or external integration).

## Out of Scope

- The already-fixed "app locks / can't load Spaces" bug — it is done; this change does not re-open it.
- A performance-budget/CI-perf-gate framework — measure and fix here; formal budgets can be a later `system-*` change.
- Backend/engine latency (backup throughput, Trigger.dev task time) — this is `apps/web` perceived + load performance only.
