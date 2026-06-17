## Why

The founder confirmed (Slack, 2026-06-10) that the Airtable connection is **account-level**: an account can have **multiple** Airtable sources, and each Space uses **exactly one** (different Spaces can use different sources). This mirrors the account-level Destinations model — together they are the account's reusable "connections" (the Airbyte model the founder referenced). Today the Airtable connection is treated as per-Space, with no account-level home and no view of which Spaces use which source.

## What Changes

- A dedicated **account-level Sources registry** (in account settings, next to Destinations): the account's Airtable connections — name · status · in use by N Spaces — with **Add source** (OAuth or API key).
- **Space setup picks a source**: a Space chooses which account Airtable source it backs up from, then selects bases (a Space uses exactly one source).
- **Per-Space usage table** on a Source's page: the Spaces using it, each with its meta (e.g. number of bases included, schedule, last backup, status).
- Connection recovery (reconnect) and new-base discovery live on the source, shared by every Space that uses it.

## Capabilities

### New Capabilities
- `sources`: account-level Airtable source connections, their add / connect / reconnect lifecycle, the Spaces that use each one (with per-Space meta), and picking a source in a Space's setup.

## Impact

- New (apps/web): a Sources registry view + a source detail/usage view (mirroring the Destinations views); the Space setup gains a source-pick step.
- apps/design harness only: source fixtures, routes under `pages/settings/sources/`, a Sources entry on the Settings page. Not shipped.
- No backend in this repo; real auth, persistence and source↔Space linking are an engineering follow-up in the monorepo.
- Symmetric with the `shared-destinations` change — sources + destinations together form the account's reusable "connections".
