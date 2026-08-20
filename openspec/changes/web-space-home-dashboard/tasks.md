# Tasks — Space Home is the dashboard (fold in the Overview)

## Built — committed-pending
- [x] **Remove the Overview page**: delete `apps/web/src/views/SpaceOverviewView.astro`;
      `apps/design/src/pages/integrations.astro` becomes a redirect to `/`
- [x] **Sidebar**: drop the "Overview" item from `apps/web/app-config.json` (Home only)
- [x] **`SpaceHomeView.astro`** carries the Space-level states:
      configured/healthy · not-set-up (`SpacePipelineHero`) · paused (`broken` Source/Dest) ·
      **first-backup running** (status header "First backup running", confirmation banner →
      Backups, in-progress history placeholder, "—" counts, spinner icon) · **edit-saved** banner
- [x] **Two-region layout (2026-06-17, client-chosen):** LEFT = metrics strip + Backup history +
      Schema tables; RIGHT = sticky status rail (health → vertical pipeline → usage). Chosen from a
      4-way lab (health-in-rail vs top-banner × metrics-top vs metrics-in-rail); lab scaffolding
      (`SpaceHomeView.experiment.astro`, `home-lab.astro`) built, used, then removed. Empty state
      stays a full-width setup hero (no split). See design.md "Layout".
- [x] **`index.astro`** (Home route) handles `?status=running|saved`, `?broken=src|dest|both`,
      and the wizard's `?src=&dest=&bases=`; passes `statusCode`; hosts the `ScenarioSwitcher`
- [x] **Re-anchor the wizard**: `IntegrationsSetupWizard.astro` back/cancel → `/`; finish →
      `/?status=running`; edit-save → `/?status=saved`. `BackupRunDetailView` "Run again" → `/?status=running`
- [x] **Re-anchor `flow-registry.ts`**: every flow opens on Home (`/`, `/?fixture=empty`,
      `/?broken=src`, `/?status=running`, `/?status=saved`); `code[]` → `SpaceHomeView.astro`;
      the "Space overview" group renamed "Space Home"; `configured-dashboard` flow flipped to
      `built` (first-backup-running + saved confirmations). Configure sub-flow keeps `/integrations/configure*`
- [x] `astro check` green (0 errors, 44 files); all Home states walked (healthy / empty /
      paused / running / saved), `/integrations` 302→`/`, `/integrations/configure` + `/handoff` 200,
      spinner icon renders (real SVG mask, not a square)

## To do
- [ ] **Client review** of Home-as-the-only-Space-landing (no separate Overview)
- [ ] Engineer: real `?status=running` (a live first-run progress feed) instead of the harness placeholder
- [ ] Orphaned cleanup (separate pass): legacy `IntegrationsView.astro` / `.v2` / `.v3` /
      `.redesign` and `IntegrationsConfigureView*.astro` are now unreferenced (were behind the
      old `?v=` switch) — delete once confirmed nothing in prod imports them. **`DashboardView.astro`
      joined this orphan list 2026-06-26** (Home switched off it — see Applied note below).
      **RESOLVED 2026-08-20 (Phase 7.4):** `DashboardView.astro` retired → `DashboardView.legacy.astro`
      (dead code — imported nowhere; the fork deleted it outright). Kept as `.legacy` for rollback.

## Applied to monorepo apps/web (2026-06-26)
The harness state above was already true in the design app; this pass landed it in production `apps/web`:
- [x] `pages/index.astro` now renders `SpaceHomeView` (was `DashboardView`), wiring `state`/`source`/
      `destinations`/`runs`/`statusCode`; `?status=running|saved` carried from the Configure flow.
- [x] `pages/integrations.astro` → `Astro.redirect('/' + search)`; deleted `views/SpaceOverviewView.astro`;
      dropped the "Overview" item from `app-config.json`.
- [x] `SpaceHomeView` renders the running/saved confirmation (via the `<Alert>` component, governance-clean).
- [x] Re-anchored `IntegrationsSetupWizard` (BackLink→`/` "Home", Cancel→`/`, finish→`/?status=running`,
      edit-save→`/?status=saved`) + `configure-save.ts` redirects (+ its test). `BackupRunDetailView`
      "Run again" already pointed at `/?status=running`.
- [x] Verified: web `astro check` 0 errors (349 files) · web unit 804/804 · governance 12/12 · design `astro check` 0 errors.
- [x] **Two-region layout adopted (2026-06-26):** replaced the interim bento layout with ui-only's two-region
      design (LEFT metrics strip + Backup history + Schema previews; RIGHT sticky status rail — health +
      "Run backup now" + vertical pipeline + usage). Ported ui-only's `SpaceHomeView` verbatim (identical Props +
      data derivation; already wires `RunBackupNowModal` on the rail), fixed the one divergent import
      (`SpacePipelineHero` → `components/patterns/`), added a raw-markup-allowlist entry (daisyUI-direct alert/btn/table).
      Verified: web `astro check` 0 errors (354 files) · unit 805/805 · governance 12/12 · design 0 errors.
- `baseMetrics`/`usage` still passed empty (gated until the engine/billing feed them — the rail/Schema sections hide when empty).

## Re-promoted the fork's grown Home (2026-08-20, Phase 7.4 on `autumn/cursor-ui-implementation-test`)
Reference promotion `53bbef82` / ui-only@7c7202d7 (did **not** merge `web-ui-sync-promotion`). The 2026-06-26 pass ported an earlier `SpaceHomeView`. The fork then grew it ~2× (28KB→57KB) — a DERIVED space-health verdict (audit D01), Kind/When columns + clickable history rows, nullable-`spaceName` copy, and a manual `<LiveRefresh>` in the status header. This pass promotes that grown view into `apps/web` on the program branch:
- [x] `views/SpaceHomeView.astro` (old → `.legacy.astro`) replaced with the ref view;
      **Props contract IDENTICAL** → `pages/index.astro` UNCHANGED (real feed + the page-level 2s
      `data-backup-history`/home-live poll both preserved; the poll wraps the view and keys off
      page-level DOM, so the swap does not drop it).
- [x] Health derivation grafted into `lib/backups/format.ts`: `deriveSpaceHealth` / `isInFlightRun` /
      `isSuccessRun` / `runKind` / `runMovedAt` + `SpaceHealth*` types — ADDITIVE (no existing export
      removed; `formatNextScheduledAt` from `lib/time` imported aliased). **+ unit tests** (+11 cases).
- [x] `components/patterns/SpacePipelineHero.astro` widened to nullable `spaceName?: string | null`.
- [x] Reconciliations vs fork-verbatim (same as ref): (1) `SpacePipelineHero` from `patterns/`;
      (2) `RunBackupNowModal` real `spaceId`+`redirectTo`; (3) `.hm-kpi*` scoped in the view.
- [x] `DashboardView.astro` retired → `DashboardView.legacy.astro` (dead code; fork deleted it).
- [x] Governance: `SpaceHomeView.legacy.astro` added to `raw-markup-audit-allowlist.json`.

## To do (this pass)
- [ ] **Client / human browser smoke** of the grown Home on real data: healthy / paused / first-run-running /
      failed / empty; confirm the 2s poll still flips a running run to done without a manual refresh.
- [ ] Follow-up (separate app-shell surface): the fork's `SidebarLayout` connection banner reads the
      same `deriveSpaceHealth` — promote when the app-shell change lands.
