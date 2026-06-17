# Tasks — Per-Space setup wizard + empty state

## Built — branch `experiment/nav-restructure`, NOT merged
- [x] **`SpacePipelineHero.astro`** — unconfigured Overview as a Source → Space hub → Destinations diagram (brand marks, restrained line animation, one CTA); replaces the 4-step card
- [x] **`IntegrationsSetupWizard.astro`** — 5-step flow Source → Bases → Destination → Options → Review → Run first backup
- [x] **Empty-first + drawer**: empty Source/Destination steps open a right-hand drawer; create is simulated client-side, auto-selected on success; wizard never unmounts
- [x] Destination drawer is a mini-flow (pick type → configure name/folder/connection); file required + optional database
- [x] **Two modes**: setup = gated stepper ("Run first backup"); edit = free tabs + "Save changes" (no Review), pre-filled with current config — reached via the overview's Configure
- [x] **Review** step polished (icons, connection-dot connectors, Schedule·Depth·Folder meta strip)
- [x] **Configured Overview pipeline** connectors = status line + badge (green check healthy / amber paused); caps relabelled Source / Backs up / Destination
- [x] Running Overview reflects the just-created Source/Destination names + base count (harness passes them via query params; no persistence)
- [x] **Inline reconnect** (edge case a): a broken Source/Destination shows a "Lost access" chip + Reconnect button; Reconnect opens a drawer (OAuth or re-entered secret), flips the row to Connected; a broken *selected* object blocks Run/Save. Demo via `?broken=src|dest|db|both`.
- [x] **Source change resets bases** (edge case b): switching the selected Source asks to confirm ("bases belong to a source"), then clears the selection via the table's Clear (count/cap reset too) and notes the new source; "Keep current" reverts with bases intact. Wizard demos run all-connected by default.
- [x] **Plan base cap + new bases** (edge case c): over-cap selection blocked with an upgrade nudge (already built); NEW — bases discovered since the last backup (`isNew` on `BaseSummary`) are tagged "New" with a notify banner (Review filters to them / Add up to the cap); at the cap, Add disables + upgrade nudge. Decision: **notify by default, opt-in auto-add** (the existing toggle). Demo `?newbases=N`.
- [x] `astro check` green; walked end-to-end (Playwright), light + dark, healthy + broken + reconnect + source-switch + cap/new-bases

## Done
- [x] **Client review** + **merge to `main`** (2026-06-15, ff) — client confirmed the batch is portable.

## To do
- [ ] Real-app inline create/reconnect: OAuth **popup** + callback (backend), key/credential methods inline
- [ ] Naming decision: "Set up backup" vs "Sync" (founder open question)
