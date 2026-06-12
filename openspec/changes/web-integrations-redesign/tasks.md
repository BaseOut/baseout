# Tasks — Integrations redesign

## Research & concepts (done)
- [x] UX research: ground truth, user modes, JTBD, decision flow, **state inventory**, competitors (`design.md`, `research-integration-patterns.*`)
- [x] Flow/state diagrams (`flows.html`) + conformance audit (`audit.md`)
- [x] Explored two early directions (v2 Panel, v3 Guided); **retired** in favour of the route model below

## Design model — built
- [x] **Overview** (`IntegrationsView.redesign.astro`): provider card, status via badge, neutral surface; empty → connected; **no "connected" status before a valid config**; New-bases-discovered banner; no inline history (lives on Backups)
- [x] **Configure route** (`IntegrationsView.configure` → `IntegrationsConfigureView.astro`): dedicated page, sectioned (bases → layers → schedule → destinations → connection), single Cancel / "Save & run first backup" (first-time) or "Save changes" (edit)
- [x] **Authorizing** interstitial; first-time setup → loader → "connected, first backup running" final
- [x] Redesign is the default at `/integrations`; the client's current screen is opt-in via `?v=base` ("View Old")
- [x] Scenario panel (`ScenarioSwitcher.astro`): Flow mode (start the clickable path) vs Screens mode (states + legends); 3-position dock; persists across navigation

## Founder-call deltas — done
- [x] Connect: **API-key** alternative to OAuth (+ harness stub)
- [x] Destinations: **static AND dynamic in parallel**
- [x] Destinations: **authenticate + pick folder** sub-step (Google Drive connect + folder; BYODB connection string; managed/hosted authenticated in a follow-up step)
- [x] **Backup layers** (Schema always / Data default / Attachments billed opt-in)
- [x] Plan-locked frequencies with an upgrade affordance
- [x] **Manage connection**: Rescan workspace + Disconnect

## Base selection at scale — done
- [x] Dedicated, full-width base picker (`components/integrations/BaseSelectionTable.astro`), shared by both configure layouts — handles hundreds of bases with name **search**, **sort** (name / tables / fields), **select-all up to the plan limit** (hard cap), **show-selected-only**, sticky header, and **pagination with a 10/20/50 page-size dropdown** (added 2026-06-10 as an illustrative option atop search/sort)
- [x] Columns are **Base · Tables · Fields** only — the metrics Airtable's schema API (`GET /v0/meta/bases/{id}/tables`) exposes; **Workspace / Records / last-Changed removed** as not retrievable from the standard API (shown values are illustrative placeholders)
- [x] Nothing pre-selected by default — the user chooses
- [x] **Auto-add new bases** is a **toggle** (left of its label) shown **only when every base is selected** ("back up everything"); hidden on a partial selection and never shown above the plan cap (`policy.autoAddFutureBases`)
- [x] Two configure layouts built behind a harness pill (`?layout=`): **v1 Summary + Manage** (vertical flow → full-width Manage drill-in, `IntegrationsManageBasesView.astro`) vs **v2 Tabs / Stepper** (`IntegrationsConfigureView.tabs.astro`; first-run stepper, edit free-tabs); harness fixtures `many` (50 / cap 10), `fits` (8 / cap 10) with a fixture pill on the Manage screen
- [x] **Destination step links account destinations** (two treatments: v1 summary drill-out, v2 tabs inline picker + "Add custom") — see the `shared-destinations` change (imported from the ui-only repo's `account-destinations`)
- [x] **Stepper bar tidied:** the contextual hint moved next to the active section (warn only when blocked; generic filler dropped); "Back" gets a ← arrow

## Audit follow-ups (`audit.md`)
- [x] API-key harness stub · discovery banner · auto-add toggle · disconnect/rescan · auth+folder interactive · Refreshing state preview · spec.md sync
- [ ] Minor polish: surface "found N bases" in-flow; Reconnect → healthy overview (not first-time setup); dynamic "Not set" badge reflects selection
- [ ] Persistence note for the engineer: schedule / destinations / layers are presentational in the prototype; only base selection is wired to a save

## Monorepo wiring (2026-06-12, autumn/design-sync)
- [x] Redesign promoted into `apps/web/src/views/IntegrationsView.astro`; pre-redesign screen preserved as `IntegrationsView.legacy.astro` (harness "Old" + rollback target)
- [x] Production routes: `/integrations/configure` (v1 Summary + Manage as the working default) and `/integrations/configure/bases`, auth-gated by middleware, redirect to `/integrations` when no connection exists
- [x] Real persistence: schedule via `lib/backups/configure-save.ts` (PATCH backup-config + first-run POST backup-runs), base selection + auto-add via `lib/backups/save-selection.ts` + `saveBackupConfig` from the Manage screen; destination step embeds the working `StoragePicker`
- [x] Honest gating for capabilities without a backend: API-key connect tab disabled ("soon"), layers informational (all three captured today), account-destinations preview kept harness-only (`linkedDestinations` prop)
- [x] **First-run routing**: OAuth callback sends a first-time connect (no backup config for the Space) to `/integrations/configure?first=1` via `lib/airtable/success-redirect.ts`; returning users keep `returnTo?connected=1`. The design's `/integrations/authorizing` interstitial stays harness-only — in production the authorization completes before the callback redirects, so an animated wait would be fake (per the interstitial's own "Harness-only" header)
- [ ] **API-key connect backend** — `/api/connections/airtable/api-key` route (encrypted PAT on `connections`), then enable the tab
- [ ] **Backup layers backend** — per-config opt-in/out columns + engine/workflows threading, then enable the checkboxes
- [ ] **Airtable disconnect** — `/api/connections/airtable/disconnect` route (the design's Disconnect affordance was held back until it exists)

## Decisions & handoff (pending)
- [ ] **Confirm the base-selection layout** — v1 Summary + Manage is wired in production; v2 Tabs / Stepper remains a harness candidate (`?layout=tabs`) → confirm with client, then delete the loser
- [ ] **Auto-add at exactly the cap** — when the account has exactly as many bases as the plan allows (no headroom), decide whether to show or hide the toggle
- [ ] Resolve open questions with client: **naming** (Backup vs Sync), **connection scope** (Org-level vs per-Space), **auto-add default** on connect (`design.md` → Open questions)
