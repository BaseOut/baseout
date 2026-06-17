# Tasks — Nav + IA restructure (Airbyte model)

## Decided (Airbyte docs + founder/client)
- [x] Sources / Destinations = account-level reusable; **Space = Airbyte "Connection"**
- [x] Connecting happens once on a Source, referenced by Spaces (no per-Space connect-from-scratch)

## Built — branch `experiment/nav-restructure`, NOT merged
- [x] **Two-scope sidebar**: SPACE group (Overview, Backups, Restore, Schema, Reports) + ACCOUNT group (Sources, Destinations), via `app-config.json` `isTitle` labels
- [x] Sources/Destinations at **top-level URLs** `/sources`, `/destinations`; removed the redundant Sources/Destinations cards from the Settings page
- [x] **`SpaceOverviewView.astro`** = the Space's backup overview (Connection): pipeline From Source → bases → To Destination + status (schedule / next / last) + Configure / Run; broken Source/Dest → "Backups paused" + Reconnect; unconfigured → guided 4-step setup
- [x] Nav label **Integrations → Overview**; harness renders Overview by default (`?v=redesign` / `?v=base` keep old screens); `astro check` green

## To do
- [ ] **Client review of the IA** (sidebar + Integrations→Overview) → then **merge to `main`**
- [ ] **Source-pick inside Configure** — the Overview shows the Source, but Configure can't change which Source a Space uses yet
- [ ] **Per-Space usage TABLE on Destinations** — mirror the one built on the Source detail (founder wanted it on both); Destination detail currently shows chips
- [ ] Wire "Run backup now" / "Change source / destination" (presentational stubs)
- [ ] Naming: "Overview" vs "Backup" for the per-Space page (founder call)
