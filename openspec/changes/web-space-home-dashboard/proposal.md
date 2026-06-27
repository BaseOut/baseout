# Space Home is the dashboard (fold in the Overview)

## Why
`web-nav-ia-restructure` introduced a per-Space **Overview** page (`SpaceOverviewView` at
`/integrations`) as the Airbyte-style "Connection" view. In parallel we built a richer
per-Space **Home** dashboard (`SpaceHomeView` at `/`) that already renders the same
backup pipeline as one of its sections. The two pages overlapped: the sidebar carried
**both** "Home" and "Overview", and every flow in the handoff registry pointed at the
Overview URL.

A backup tool's home is a **control plane**, not a read-only analytics dashboard, so it
is correct for the pipeline (the Space's primary object) to live on Home as a status
section that also opens the focused setup/edit flow. With that settled (client direction:
keep the pipeline on Home), the standalone Overview page is redundant.

## What changes
- **Remove the Overview page.** Delete `SpaceOverviewView.astro`; the `/integrations`
  route redirects to `/` so old bookmarks / handoff links do not 404. Drop the "Overview"
  item from the sidebar (`app-config.json`).
- **Home carries every Space-level state** the Overview used to: configured/healthy,
  not-set-up (the setup diagram), paused (a broken Source/Destination), first-backup
  running (right after setup), and edit-saved. Connection-level diagnostics
  (reauth/invalid/refreshing/nobases/capped) stay in **account scope** (Sources /
  Destinations) and the wizard, and surface on Home only as the "paused + Reconnect" state.
- **Deep configuration stays in a focused flow** at `/integrations/configure` (the setup
  wizard / edit tabs), reached from Home. Home leads with status; it does not inline the
  full config form.
- **Re-anchor the handoff.** Every flow in `flow-registry.ts` now opens on Home
  (`/?fixture=empty`, `/?broken=src`, `/?status=running`, `/?status=saved`, `/`); the
  configure sub-flow keeps its `/integrations/configure*` URLs.

## Impact
- apps/web: **delete** `SpaceOverviewView.astro`; `SpaceHomeView.astro` gains the
  first-backup-running + saved confirmations; `IntegrationsSetupWizard.astro` and
  `BackupRunDetailView.astro` back/cancel/finish links point at Home; `app-config.json`
  navigation drops "Overview".
- apps/design: `index.astro` handles `?status=running|saved`, `?broken=both`, and the
  wizard's `src/dest/bases`; `integrations.astro` becomes a redirect; the `ScenarioSwitcher`
  moves to Home; `flow-registry.ts` re-anchored.
- Supersedes the Overview-page parts of `web-nav-ia-restructure` (the two-scope sidebar and the
  account Sources/Destinations stand).
