# Design — Account-level sources

## Product model (founder-confirmed, 2026-06-10)

"Accounts could have multiple Airtable sources. But spaces would only use 1 Airtable source. So they could have a different source for each space." → the Airtable connection is an **account-level reusable object** (like a destination): created once, linked to Spaces, each Space using exactly one. Sources + Destinations together = the account's reusable "connections" (the Airbyte model the founder referenced).

## What we build

- **Sources registry** in account Settings, next to Destinations: name · status · in use by N Spaces, with Add source. Mirror the `DestinationsView` status table.
- **Source detail = a per-Space usage table** (the founder's ask): instead of a bare "in use by N" count, list each Space using this source with its meta — **number of bases included**, schedule, last backup, status. The destination side gets the same treatment (folder / schema per Space — see `shared-destinations`).
- **Space setup picks a source**: a step to choose which account source the Space backs up from (symmetric to choosing a destination), then base selection runs against that source's bases.

## Symmetry with destinations

This is the source half of the account-level "connections" model. Both registries live in Settings; both show a **per-Space usage table**; both reuse one connection across Spaces with **per-Space config** (source: which bases the Space includes; destination: which folder / schema the Space writes to).

## Out of scope / later

Founder: "may evolve it to be more complex over time" — for now a Space uses **exactly one** source; multi-source-per-Space is deferred.
