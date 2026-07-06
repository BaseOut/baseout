## Why

Connection health is scattered. A broken Airtable Connection or a broken storage
destination silently pauses backups, but the only signal lives on the Sources /
Destinations badges and inside per-view banners — a customer on the Backups or
Schema page never sees it until a run fails. The connection-health research
(design harness) established that a broken pipeline needs one **app-wide** signal,
graded by severity, with a one-click reconnect path — not a badge buried two
navs away.

The ui-only design harness already built the components for this — a full-width
**ConnectionHealthBanner** at the top of the work area plus a compact topbar
**ConnectionHealthPill** it collapses into — and validated every state at
`/connection-banner`. They were never promoted into `apps/web`: the design
fixture `apps/design/src/fixtures/connection-health.ts` was even deferred in the
design merge because it imports the banner's type. This change promotes both
components into `apps/web` (as governed `patterns/` chrome), wires them to the
connection + storage-destination status **already** hydrated into
`$integrations`, and mounts them in the app shell. No backend, engine, DB, or
capability-key change — the banner reads state the frontend already has.

## What Changes

- Promote **ConnectionHealthBanner** + **ConnectionHealthPill** from the ui-only
  harness into `apps/web/src/components/patterns/` (this repo has `components/ui`
  + `components/patterns`, NOT `components/layout` — the harness's `layout/`
  placement does not apply here). Presentation logic + types move alongside in a
  `connection-health-banner.ts` sibling module.
- **States**, mapped onto the real connection vocabulary: `healthy` (nothing
  rendered), reconnect-required **amber** (`expiring` / `degraded`), disconnected
  **red** (`broken`, incl. a grouped roll-up when 2+ are down), **refreshing**
  (`reconnecting`), and a transient `restored` success. The banner is
  **dismissible** for warning/success states and **collapsible** (into the pill)
  for the hard-broken state.
- **Wire to existing state, no new backend.** Derive banner props from
  `$integrations` — `connections[].status` (`active` / `pending_reauth` /
  `invalid` / `refreshing`) and `storageDestinations[]` — computed once and
  hydrated via the JSON-script pattern, same as the rest of the shell. `invalid`
  → red `broken`; `pending_reauth` → amber; `refreshing` → `reconnecting`;
  all-active → `healthy` (nothing rendered).
- **Reconnect affordance routes to the EXISTING reconnect flow** — the Sources /
  Destinations reconnect entry point already wired in `apps/web`
  (`/connections/storage/*` + Airtable connect). No new route, no new OAuth
  surface.
- **Mount in the app shell.** Add an optional `app-banner` slot (top of the work
  area, under the topbar) and a `topbar-status` slot (next to the notification
  bell) to `SidebarLayout`, and render the banner/pill there when a Space's
  computed health is not `healthy`. The collapse ⇄ expand handshake between bar
  and pill is delegated client JS keyed by a shared `group`.
- **Governance (mandatory).** Both promoted components are registered in
  `component-classification.json` as `storybook-pattern`, each gets a sibling
  `*.stories.ts` (Container-API render over the state matrix), and each links to
  a `/styleguide` entry in `apps/design` — per `apps/web/.claude/CLAUDE.md` §2.5.
  Neither carries a `<style>` block (daisyUI `alert` + `@opensided/theme` +
  `Button` primitive only). The deferred design fixture
  `apps/design/src/fixtures/connection-health.ts` lands with this change to drive
  the harness preview.

## Capabilities

### New Capabilities
- `connection-health-banner`: an app-wide, severity-graded connection-health
  signal — a dismissible/collapsible **ConnectionHealthBanner** at the top of the
  work area plus a compact topbar **ConnectionHealthPill**, wired to the existing
  connection + storage-destination status in `$integrations`, with a reconnect
  affordance that routes to the existing reconnect flow. No new backend, engine,
  DB, or capability key.

### Modified Capabilities
<!-- Adds two chrome components + two SidebarLayout slots and derives their props
from state already hydrated into $integrations. No new DB/migration/engine
route/capability-key. -->

## Impact

- `apps/web/src/components/patterns/ConnectionHealthBanner.astro` (new) — thin
  render of `getBannerConfig()`; no `<style>`; daisyUI `alert` + `Button`.
- `apps/web/src/components/patterns/ConnectionHealthPill.astro` (new) — compact
  topbar form sharing `getBannerConfig()` + the collapse `group`.
- `apps/web/src/components/patterns/connection-health-banner.ts` (new) — types
  (`ConnectionBannerProps` / `ConnectionBannerState` / `BannerConfig`) +
  `getBannerConfig()` presentation logic (union-heavy TS kept out of Astro
  frontmatter on purpose).
- `apps/web/src/components/patterns/ConnectionHealthBanner.stories.ts` +
  `ConnectionHealthPill.stories.ts` (new) — Container-API stories over the state
  matrix.
- `apps/web/src/components/component-classification.json` — two new
  `storybook-pattern` entries (`styleguideId: pattern-connection-health`,
  `designHarnessPath: pages/connection-banner.astro`).
- `apps/web/src/lib/connection-health.ts` (new) — pure
  `deriveBannerProps($integrations state) → ConnectionBannerProps | null`
  mapping the real status vocabulary onto banner states (unit-tested).
- `apps/web/src/layouts/SidebarLayout.astro` — add `app-banner` + `topbar-status`
  slots; render the banner/pill when computed health ≠ `healthy`; hydrate derived
  props via the JSON-script pattern.
- `apps/web/src/components/patterns/AppShellHeader.astro` — expose the
  `topbar-status` slot next to the notification bell.
- `apps/design/src/fixtures/connection-health.ts` (new) — the deferred harness
  fixture (imports the promoted banner type), driving `/connection-banner`.
- `apps/design/src/pages/connection-banner.astro` — repoint imports at the
  promoted `apps/web` components (was harness-local).
- **Pairs with** none — web-only. No backend/engine/workflows counterpart.
- **Deferred follow-ups:** additive banner kinds off `SpaceEventSummary.kind`
  (token-expiry, schema-drift) once the engine emits them — the `kind` field is
  already extensible; real Airtable/Drive brand logos in place of the named
  provider text; a genuine `expiring` state gated on the source/destination token
  APIs exposing a TTL (research §8.2, unverified). No DB/migration/engine/
  capability-key change.
