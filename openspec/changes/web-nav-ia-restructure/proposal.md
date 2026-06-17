## Why

With account-level **Sources** and **Destinations** in place, the old per-Space "Integrations" page (a provider card that connects Airtable from scratch) **duplicates** the connect step now owned by Sources, and the account registries were buried in Settings. We restructure the information architecture to the proven **Airbyte model** (Sources / Destinations / Connections), confirmed from Airbyte's own docs (screenshots in `../web-integrations-redesign/assets/airbyte-*.png`).

## What Changes

- **Two-scope sidebar**: a **Space** group (switched by the Space selector) and an **Account** group that surfaces **Sources + Destinations as top-level items** (out of Settings). Matches where Airbyte/Fivetran put them.
- Sources/Destinations move to **top-level URLs** (`/sources`, `/destinations`).
- **The per-Space page becomes the Space's backup OVERVIEW** (the Airbyte "Connection"): a pipeline **From Source → bases → To Destination** + status (schedule / next / last run) + Configure / Run actions; a broken Source/Destination → "Backups paused" + Reconnect; a not-yet-configured Space → a guided 4-step setup. Renamed **Integrations → Overview**. **Connecting Airtable moves to Sources** (a Space references a Source, it does not re-connect).

## Capabilities

### New Capabilities
- `navigation`: the two-scope (Space / Account) sidebar and the Space-overview-as-Connection model.

### Modified Capabilities
- `integrations`: the per-Space page no longer connects a platform from scratch; it references account Sources/Destinations.

## Impact

- apps/web: new `SpaceOverviewView.astro`; `app-config.json` navigation (grouped via `isTitle` labels; Integrations → Overview).
- apps/design harness: routes moved to `/sources`, `/destinations`; `integrations.astro` renders `SpaceOverviewView` by default (old provider-card screens kept behind `?v=redesign` / `?v=base`); redundant Sources/Destinations cards removed from the Settings page.
- **EXPERIMENT on branch `experiment/nav-restructure`** — built + `astro check` green; **pending client review before merge to main** (the client confirmed Sources/Destinations but has not yet reviewed what happens to Integrations / the sidebar).
