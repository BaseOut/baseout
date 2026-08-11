# web-app-performance — Design

## Context

Two loosely-coupled problems reported together: perceived slowness (no feedback during waits) and actual slowness (loads take too long). The perceived side has a canonical, already-adopted helper — `setButtonLoading` (§4.5) — so the work is coverage, not invention. The actual side is unmeasured; the reported pain is loading Spaces / the dashboard.

## Goals / Non-Goals

**Goals:** no server wait in `apps/web` leaves the user staring at an unchanged screen; the primary load paths (Space list, dashboard) are measurably faster after targeted fixes; changes stay small and reversible (§3.2).

**Non-Goals:** a rewrite of the data-loading layer; a CI perf-budget system; backend/engine latency; the already-fixed Space-lock bug.

## Decisions

1. **Measure before optimising.** Instrument/observe the slow surfaces first (browser devtools timing, SSR query counts) and fix the dominant cost — do not speculatively refactor. A 5-line query tightening beats a 50-line restructure (§3.2).
2. **Reuse the loading primitives, don't invent.** `setButtonLoading` for buttons/forms; a daisyUI `loading` component (via a Storybook-cataloged pattern) for page/data waits. No custom spinner components (§4.2). Every spinner is cleared in a `finally` so an error never leaves a stuck spinner.
3. **Defer, don't delete, non-critical work.** Prefer `client:idle`/`client:visible` on heavy islands and narrower SELECTs over ripping out features. Load-bearing behavior stays intact.
4. **Coverage is driven by an interaction inventory.** Enumerate the server-waiting interactions (form submits, Run-backup, Space switch, data refreshes, page loads) and check each for feedback — the inventory is the checklist, so nothing is silently missed.

## Risks / Trade-offs

- **[Deferring island hydration could delay interactivity of a control the user wants immediately]** → apply per-island, verify the deferred island isn't above-the-fold-critical.
- **[Spinner not cleared on error path]** → the `finally` discipline is mandatory; the spot-check test asserts it.
- **[Optimisation scope creep]** → bounded by Decision 1: only the measured dominant costs, low blast radius.

## Migration Plan

Incremental and reversible per surface. Each spinner/optimisation is independently shippable; no data or config migration. Rollback is a per-surface revert.

## Open Questions

| # | Question | Default answer |
|---|----------|----------------|
| P1 | Is the Space/dashboard slowness dominated by SSR query time or client JS? | Measure in 1.1 before deciding; don't assume. |
| P2 | Extract a shared `withPageLoading` helper for non-button waits? | Only if a second real call site appears (YAGNI, §3.2). |
