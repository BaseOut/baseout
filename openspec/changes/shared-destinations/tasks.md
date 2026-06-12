# Tasks — Account-level destinations

## Research (done)
- [x] Competitor model: reusable account-level destinations (Airbyte, Fivetran, Census, Hevo, Customer.io); backup-tool managed-default + BYOS-optional + soft-DB-upsell (Rewind, ProBackup, On2Air); Mobbin patterns (Customer.io destinations table, Amplitude recommended-destinations, Twingate status column)

## Built (skeleton — presentational)
- [x] **Account Destinations registry** (`DestinationsView`): status table (name · type · status · in use by · last write), broken-destination alert ("affects N Spaces"), empty state, "Add destination"
- [x] **Add flow** (`DestinationAddView`): type picker — file storage (managed R2 / Google Drive / Dropbox / Box / Amazon S3) required, database (Postgres / Neon / Supabase / other) recommended-optional — then name + config → "Save destination"
- [x] **Per-destination page** (`DestinationDetailView`): status, **Connect** (needs_connection) / **Reconnect** (broken), in-use-by Space chips, **remove guarded while in use**, per-Space subfolder note
- [x] **"Needs connection" lifecycle**: a new destination requiring auth lands `needs_connection` → Connect on its page → connected; managed R2 lands connected; add-flow defers authorization to the detail page
- [x] **Space setup linking** — two treatments (A/B, under the configure layout switch):
  - [x] v1 (summary, `IntegrationsConfigureView.astro`): Destination section is an empty drill-out → set up in Settings, return (summary when linked)
  - [x] v2 (tabs, `IntegrationsConfigureView.tabs.astro`): inline picker of account destinations (file required + optional database + "Skip") + "Add custom destination"
- [x] Harness: fixtures (Drive + S3 connected, Postgres reconnect), `newDestination()` for the just-created one, routes under `pages/settings/destinations/`, Settings entry; verified clickable end-to-end + `astro check` green

## Pending / handoff
- [ ] Decide **source (Airtable) connection scope** (account vs per-Space); if account-level, unify sources + destinations under an account "Connections" area
- [ ] Decide whether a Space links **both file + database** or just a file by default; per-Space subfolder default naming
- [ ] Engineer (monorepo): real persistence — destination objects, link to Spaces, auth + test, status sync, remove guardrail enforcement
