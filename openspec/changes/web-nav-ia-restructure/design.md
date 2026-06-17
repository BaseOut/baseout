# Design — Nav + IA restructure

Adopts **Airbyte's information architecture** (confirmed from Airbyte's docs; screenshots at `../web-integrations-redesign/assets/airbyte-*.png`): top-level **Sources / Destinations / Connections**, where a connector is set up once and reused, and a "Connection" pairs a source with a destination plus config.

## Mapping to Baseout
- **Sources** (Airtable connections) and **Destinations** (storage / DB) are **account-level reusable** objects, shown in the sidebar's **Account** group at top-level URLs.
- **A Space = an Airbyte "Connection"** — one backup pairing one Source + Destination(s) + selected bases + schedule. The Space's page is its **backup overview**, not a place to connect a platform.

## The per-Space page (was "Integrations" → "Overview")
Airbyte connects a source **once**, then connections **reference** it; there is no per-connection "connect your source" surface. So the per-Space page drops the connect-from-scratch provider card and becomes the Space's overview: a pipeline **FROM a Source → selected bases → TO a Destination** (with the Space's own folder), plus schedule and last / next run, and Configure / Run. A broken Source or Destination shows "Backups paused" and links to **reconnect that account object** (one reconnect heals every Space using it). A not-yet-configured Space gets a guided pick-Source → bases → Destination → schedule.

## Sidebar — two scopes
A **Space** group (switched by the Space selector — Overview, Backups, Restore, Schema, Reports) and an **Account** group (Sources, Destinations). Surfacing the reusable connections under a labelled Account heading (rather than burying them in Settings) matches Airbyte/Fivetran's top-level placement and removes the confusion of two "connect Airtable" surfaces.

## Status
EXPERIMENT on branch `experiment/nav-restructure`; pending client review before merging to `main`.
