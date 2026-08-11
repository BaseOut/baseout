# Tasks — Account-level sources

## Decided (client, 2026-06-10)
- [x] Airtable source is **account-level**; an account can have **multiple** sources; each Space uses **exactly one** (different Spaces can use different sources)

## To build
- [ ] **Sources registry** in Settings (mirror Destinations): account Airtable connections — name · status · in use by N Spaces · Add source (OAuth / API key)
- [ ] **Source detail page** with a **per-Space usage table**: each Space using it → number of bases included, schedule, last backup, status; plus reconnect + new-base discovery on the source
- [ ] **Space setup: pick a source** — choose which account Airtable source this Space uses, then select bases (exactly one source per Space)
- [ ] Harness: source fixtures (1–2 Airtable connections, some shared across Spaces), routes under `pages/settings/sources/`, Sources entry on Settings

## Provider availability (web — restore coming-soon teaser)
- [ ] **Source Platform catalog** (`apps/web/src/lib/provider-catalog.ts`, shared with destinations): `SOURCE_PLATFORMS` — Airtable available; Notion / HubSpot / Salesforce coming soon (Features §1)
- [ ] **Add flow** (`SourceAddView`): keep Airtable connectable; add a coming-soon section listing future Platforms as disabled
- [ ] **Registry teaser** (`SourcesView`): tease the coming-soon Platforms below the table
- [ ] **Local dev test** (apps/design harness): source fixtures for connected / reconnect states + the coming-soon Platform list; drive via `?fixture=`

## Pending / handoff
- [ ] Exact usage-table columns (our defaults: Space · # bases · schedule · last backup · status — confirm if the founder wants more)
- [ ] Engineer (monorepo): real auth / persistence, link source ↔ Space, status sync, new-base discovery
- [ ] Later (founder: "may evolve to be more complex over time") — a Space using more than one source is out of scope for now
