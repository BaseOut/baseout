## Why

Backups need somewhere to land, and the founder confirmed destinations are **account-level, reusable objects**: created once, linked to 1+ Spaces as "in use", each with its own status and reconnect. A backup fans out to **one file store plus, optionally, one database** (the database is encouraged to drive utilization, never required). Today destinations are only configured inline inside a Space's setup, with no reuse, no shared status/reconnect, and no account-level home — so a user who sets up the same Drive or database for several Spaces re-enters it each time, and a broken destination has nowhere to surface.

## What Changes

- A dedicated **account-level Destinations registry** (in account settings): a status table — name · type · status · in use by N Spaces · last write — with **Add destination**.
- **Add flow**: pick a type (file storage required; database optional + recommended), name and configure it, save. A new destination that needs authorization lands as **"Needs connection"** and is connected from its own page (managed storage lands connected).
- **Per-destination page**: status plus connect/reconnect **independent of any Space**, the Spaces using it, and removal **guarded while in use**.
- **Space setup links account destinations** instead of configuring storage inline — pick existing (file required + optional database) or add new. Two treatments are built behind the configure-layout switch (summary = drill out to settings; tabs = inline picker + add custom).
- Broken or never-connected destinations surface their state ("affects N Spaces") so users don't hunt for them.

## Capabilities

### New Capabilities
- `destinations`: account-level reusable backup destinations (file storage + optional database), their add / connect / reconnect / remove lifecycle, and linking them to Spaces.

### Modified Capabilities
<!-- `integrations`: the Space-setup destination step now links account destinations rather than configuring storage inline. Tracked in the web-integrations-redesign change's tasks. -->

## Impact

- New (apps/web): `stores/destinations.ts`, `views/DestinationsView.astro`, `views/DestinationDetailView.astro`, `views/DestinationAddView.astro`.
- Modified (apps/web): `views/IntegrationsConfigureView.astro` (Space setup → drill out to set up a destination), `views/IntegrationsConfigureView.tabs.astro` (Space setup → inline picker of account destinations + add custom).
- apps/design harness only: `fixtures/destinations.ts`, routes under `pages/settings/destinations/`, a Destinations entry on `pages/settings.astro`. Not shipped.
- No backend in this repo; real persistence, linking, auth/test and status sync are an engineering follow-up in the monorepo.
- Open (needs client decision): the **source (Airtable) connection scope** (account vs per-Space). If account-level too, sources and destinations unify under one account "Connections" area, and the per-Space Integrations page becomes "which account connections this Space uses".
