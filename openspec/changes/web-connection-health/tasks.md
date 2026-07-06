## Status

PROPOSED — not yet implemented.

Promote the ui-only ConnectionHealthBanner + ConnectionHealthPill into `apps/web`
as governed `patterns/` chrome, wired to the connection + storage-destination
status already in `$integrations`. No backend/engine/DB/capability-key change —
the reconnect affordance routes to the existing reconnect flow.

---

## 1. Derive banner props from existing state (TDD)

- [ ] 1.1 Write `apps/web/src/lib/connection-health.test.ts` first — assert
  `deriveBannerProps` maps the real status vocabulary onto banner states: all
  `connections` + `storageDestinations` active → `null` (healthy, nothing
  rendered); one `invalid` → red `broken` (naming the provider + `side`); one
  `pending_reauth` → amber `expiring`/`degraded`; one `refreshing` →
  `reconnecting`; 2+ broken → grouped roll-up (`count`/`names`); `reconnectHref`
  points at the existing reconnect entry for that provider.
- [ ] 1.2 Add `apps/web/src/lib/connection-health.ts` — pure
  `deriveBannerProps(state: { connections; storageDestinations }) →
  ConnectionBannerProps | null`. No engine/DB access; consumes only the shape
  already hydrated into `$integrations`. Green the 1.1 tests.

## 2. Promote the components (governed patterns)

- [ ] 2.1 Add `patterns/connection-health-banner.ts` — port
  `ConnectionBannerProps` / `ConnectionBannerState` / `BannerConfig` +
  `getBannerConfig()` from the ui-only harness verbatim (union-heavy TS stays in
  the `.ts` module, out of Astro frontmatter). Import `emph` from `../../lib/ui`.
- [ ] 2.2 Add `patterns/ConnectionHealthBanner.astro` — thin render of
  `getBannerConfig()`; daisyUI `alert alert-soft` + the `Button` ui primitive +
  Lucide icons; collapse/dismiss delegated `<script>`. **No `<style>` block.**
- [ ] 2.3 Add `patterns/ConnectionHealthPill.astro` — compact topbar form sharing
  `getBannerConfig()` + the collapse `group`; **no `<style>` block**.
- [ ] 2.4 Register both in `component-classification.json` as `storybook-pattern`
  (`styleguideId: pattern-connection-health`, `designHarnessPath:
  pages/connection-banner.astro`, rationale naming the daisyUI provenance).
- [ ] 2.5 Add `ConnectionHealthBanner.stories.ts` + `ConnectionHealthPill.stories.ts`
  — Container-API render over the state matrix (broken/broken-dest/multiple/
  expiring/degraded/reconnecting/restored), fixtures sourced from
  `apps/design`'s catalog per the existing story pattern.
- [ ] 2.6 Add a `pattern-connection-health` entry to the `apps/design`
  `/styleguide` (Patterns section, provenance `daisyUI+custom`, "when to use").

## 3. Mount in the app shell + hydrate

- [ ] 3.1 Add an `app-banner` slot (top of the work area, under the topbar) and a
  `topbar-status` slot to `SidebarLayout.astro`; expose the `topbar-status` slot
  next to the notification bell in `AppShellHeader.astro`.
- [ ] 3.2 In the shell, call `deriveBannerProps` and render
  `<ConnectionHealthBanner>` + `<ConnectionHealthPill>` only when it returns
  non-null; hydrate the derived props via the JSON-script pattern (§4.1 of the
  root CLAUDE.md), never via `window` globals.
- [ ] 3.3 Point the reconnect CTA `href` at the EXISTING reconnect flow (Sources /
  Destinations reconnect entry — `/connections/storage/*` + Airtable connect).
  Add no new route and no new OAuth surface.

## 4. Land the deferred harness fixture

- [ ] 4.1 Add `apps/design/src/fixtures/connection-health.ts` (the deferred
  fixture — imports the promoted banner type from `apps/web`), driving every
  state on `/connection-banner`.
- [ ] 4.2 Repoint `apps/design/src/pages/connection-banner.astro` imports at the
  promoted `apps/web` components (was harness-local).

## 5. Verification

- [ ] 5.1 web `typecheck` 0 errors + `build` green + full unit suite green (incl.
  the new `connection-health` tests). No stray `console.*` in the diff.
- [ ] 5.2 `pnpm --filter @baseout/web audit:components` green — both new patterns
  have a sibling story, a classification entry, and no raw-markup violation.
- [ ] 5.3 Storybook (`pnpm --filter @baseout/web storybook`) renders every state
  of both components; `apps/design` `/connection-banner` renders the in-context
  bar + collapse-to-pill handshake.
- [ ] 5.4 Human smoke: on a Space with a broken Connection (flip a connection to
  `invalid` / `pending_reauth` in dev), the app-wide banner appears at the top of
  every page; Reconnect routes to the real reconnect flow; collapse tucks it into
  the topbar pill and expand restores it; a warning/success state dismisses; an
  all-healthy Space renders no banner. (Airtable status is smoke-able locally;
  Drive/Box/etc. destination status per the deployed-only OAuth caveats.)

## Deferred follow-ups

- [ ] Additive banner kinds off `SpaceEventSummary.kind` (token-expiry,
  schema-drift) once the engine emits them — `kind` is already extensible.
- [ ] Real Airtable / Drive brand logos in the banner in place of the named
  provider text.
- [ ] A genuine `expiring` (days-to-expiry) state, gated on the source/destination
  token APIs exposing a TTL (research §8.2, unverified).
