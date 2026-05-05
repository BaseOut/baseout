# CLAUDE.md Compliance Refactor — Roadmap

Reference document extracted from the approved plan. Local-only (covered by `docs/` gitignore allowlist). The authoritative planning doc lives at `/Users/autumnshakespeare/.claude/plans/we-need-to-use-kind-peacock.md`.

## Current compliance state

| Standard | Status |
|---|---|
| `console.*` / `debugger` hygiene | ✓ zero occurrences in `src/` |
| `setButtonLoading` pattern in auth forms | ✓ login / register / profile all follow it |
| `@opensided/theme` + daisyUI integration | ✓ wired in `src/styles/global.css` |
| TypeScript strict mode | ✓ `astro/tsconfigs/strict` |
| Middleware + better-auth gate | ✓ `src/middleware.ts` (160 LOC) |
| Vitest installed + lib/ tests | ~ 510 LOC, only covers `src/lib/` |
| Mobile-first responsive breakpoints | ~ some pages, not systematic |
| DRY — shared client-side form logic | ~ 3 auth pages duplicate inline `<script>` blocks |
| `@nanostores/astro` reactive state | ✗ not installed, no `src/stores/` |
| A11y audit | ✗ ad-hoc ARIA, no axe-core, no systematic pass |

## Workstreams

### A. Testing coverage expansion — IN PROGRESS

Expand Vitest to middleware + API routes; add one Playwright tracer-bullet E2E.

- Middleware + `/api/me` + `/api/onboarding/complete` integration tests
- Real local Postgres via Docker, per-test transaction rollback
- Boundary isolation: fake `EMAIL` Worker binding + msw for Stripe HTTP
- One Playwright tracer: magic-link login → welcome → profile save
- Coverage ratchet (soft threshold, only goes up)

### B. Mobile responsiveness audit — deferred

**Problem:** Some pages use `sm:`/`md:`/`lg:` breakpoints, others are implicitly desktop-first. CLAUDE.md §3 and §13 require tested behaviour at <375px / <768px / <1024px.

**Scope candidates:**
- Page-by-page audit at three breakpoints
- Fix broken layouts, touch-target sizing
- Document the breakpoint system
- Playwright viewport snapshots (depends on A's E2E harness)

### C. DRY cleanup — deferred

**Problem:** Near-duplicate inline `<script>` blocks in `login.astro`, `register.astro`, `profile.astro`; `TextInput.astro` has 20+ props (SRP smell).

**Scope candidates:**
- Extract shared client-side form helper (`src/lib/ui/form.ts`)
- Audit `TextInput.astro`, split if doing too much
- Factor duplicated layout fragments
- Depends on A's test coverage to refactor safely

### D. Introduce `@nanostores/astro` — deferred

**Problem:** CLAUDE.md §4 mandates `@nanostores/astro` for cross-component reactive state; `src/stores/` doesn't exist.

**Scope candidates:**
- Install `nanostores` + `@nanostores/astro`
- Seed `src/stores/` with one reference store (current Organization/Space, or toast queue)
- Wire one consumer island
- **Defer until a concrete feature actually needs cross-island reactivity** — don't stand up speculatively

## Order of execution

A first (unblocks safe refactoring), then C (needs A's tests as a net), then B (uses A's E2E harness for viewport snapshots), then D (wait for a real use case).
