## Status

IMPLEMENTED — awaiting human smoke (task 5.4).

Promoted the ui-only ConnectionHealthBanner + ConnectionHealthPill into `apps/web`
as governed `patterns/` chrome, wired to the connection status already loaded for
the active org. No backend/engine/DB/capability-key change — the reconnect
affordance routes to the existing Sources/Destinations flow.

**Deviation from the original proposal (3.1–3.2):** rather than an `app-banner`
slot filled per-page + JSON-script hydration, the shell **derives the banner
server-side** in `SidebarLayout` via `deriveBannerProps(getConnectionHealthSummary(...))`
and renders it directly (SSR). This is strictly better: the banner appears on
every authenticated page automatically without each page opting in, and the
collapse/dismiss interactions are delegated DOM events (no store to hydrate). The
`topbar-status` slot on `AppShellHeader` is kept for the pill.

---

## 1. Derive banner props from existing state (TDD)

- [x] 1.1 `apps/web/src/lib/connection-health.test.ts` — asserts `deriveBannerProps`
  maps the real status vocabulary onto banner states (active → null; invalid →
  broken; pending_reauth → expiring; refreshing → reconnecting; 2+ invalid →
  grouped roll-up; precedence broken > pending_reauth > refreshing). 7 tests.
- [x] 1.2 `apps/web/src/lib/connection-health.ts` — pure `deriveBannerProps`; no
  engine/DB access; storage destinations carry no status column so they add no
  live state (documented). Green.

## 2. Promote the components (governed patterns)

- [x] 2.1 `patterns/connection-health-banner.ts` — ported `ConnectionBannerProps`
  / `ConnectionBannerState` / `BannerConfig` + `getBannerConfig()`; `emph` added to
  `lib/ui.ts` (escapes then promotes `*…*`). `daysToExpiry` made optional so the
  live-derived `expiring` copy never fabricates a TTL.
- [x] 2.2 `patterns/ConnectionHealthBanner.astro` — thin render of
  `getBannerConfig()`; daisyUI `alert alert-soft` + `Button` + Lucide; delegated
  collapse/dismiss `<script>`. No `<style>` block.
- [x] 2.3 `patterns/ConnectionHealthPill.astro` — compact topbar form sharing
  `getBannerConfig()` + the collapse `group`. No `<style>` block.
- [x] 2.4 Registered both in `component-classification.json` as `storybook-pattern`
  (`pattern-connection-health`, harness `pages/connection-banner.astro`).
- [x] 2.5 `ConnectionHealthBanner.stories.ts` + `ConnectionHealthPill.stories.ts` —
  Container-API render over the state matrix, fixtures from the shared
  `apps/design` component-catalog.
- [x] 2.6 `pattern-connection-health` entry added to the `apps/design` `/styleguide`
  (Patterns, provenance daisyUI+custom, do/don't).

## 3. Mount in the app shell + hydrate

- [x] 3.1 `topbar-status` slot added to `AppShellHeader.astro` (next to the bell).
  (App-banner slot superseded by server-side derivation — see Deviation above.)
- [x] 3.2 `SidebarLayout.astro` derives the banner server-side (guarded/best-effort:
  a read failure renders no banner, never breaks the shell) and renders
  `<ConnectionHealthBanner>` under the topbar + `<ConnectionHealthPill>` into the
  header slot when the state is broken.
- [x] 3.3 Reconnect CTA `href` points at the existing Sources/Destinations flow
  (`/sources` · `/destinations`). No new route, no new OAuth surface.

## 4. Land the deferred harness fixture

- [x] 4.1 `apps/design/src/fixtures/connection-health.ts` (imports the promoted
  banner type from `@web/components/patterns/connection-health-banner`).
- [x] 4.2 `apps/design/src/pages/connection-banner.astro` renders the promoted
  `@web` components (selected state in context + all-states gallery). In the
  fixture harness the shell has no live account, so the page drives the component
  directly.

## 5. Verification

- [x] 5.1 web `typecheck` 0 errors; `test:unit` **1007** green (incl. the 7 new
  connection-health tests). apps/design `typecheck` 0 errors. No stray `console.*`.
- [x] 5.2 `pnpm --filter @baseout/web audit:components` green — both patterns have
  a story + classification entry + styleguide link; no raw-markup / `<style>`
  violation; `storybook build` renders every state.
- [x] 5.3 Storybook build renders both components' states; `apps/design`
  `/connection-banner` renders the in-context bar + all-states gallery.
- [ ] 5.4 Human smoke: on a Space with a broken Connection (flip a connection to
  `invalid` / `pending_reauth` in dev), the app-wide banner appears at the top of
  every authenticated page; Reconnect routes to the real flow; collapse tucks it
  into the topbar pill and expand restores it; an all-healthy Space renders no
  banner.

## Deferred follow-ups

- [ ] Additive banner kinds off `SpaceEventSummary.kind` (token-expiry,
  schema-drift) once the engine emits them.
- [ ] Destination-side broken/expiring states once `storage_destinations` tracks a
  health status (today only source connection status is trackable).
- [ ] Real Airtable / Drive brand logos in place of the named provider text.
