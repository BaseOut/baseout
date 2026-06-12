## Why

Integrations is the client's #1 priority and the densest screen — it takes a user from an empty Space to actively backing up Airtable. Today it dumps every control on one screen at once, scatters the trust signals (is it working / when's next / did the last run succeed), and several important states are unhandled (broken connection looks editable, tier-blocked bases look normal, no "you're protected" moment, no verify-after-connect). We redesign it for progressive disclosure and full state coverage, aligned with the founder's authoritative product model.

## What Changes

- **Empty** → a focused Connect hero with a read-only promise. Connect via **OAuth or API key**.
- **Connected & protected** → a calm summary card (status · next run · last run) with all configuration **collapsed behind "Edit settings"** (progressive disclosure).
- **Connected but not yet configured** → setup is surfaced (guided wizard, or auto-expanded config) so the user can finish.
- **Base selection** is built for scale — search, sort, select-all-up-to-limit, show-selected, and no pagination on a dedicated full-width surface — with **Base · Tables · Fields** cues (the only per-base metrics Airtable's schema API exposes; record counts and last-modified are not retrievable, so they are not shown), a prominent tier counter, and visually-distinct tier-blocked bases. Two configure layouts (Summary + Manage vs Tabs / Stepper) are built behind a harness switch for the client to pick.
- **Destination** supports **static AND dynamic in parallel** (not either/or); each destination has its own **auth + folder-pick** sub-step. Managed-vs-BYOS is framed as a deliberate choice.
- New: choose backup **layers** — Schema (always) / Data (default) / Attachments (opt-in, billed separately).
- **Remove** the Notion / HubSpot / Salesforce "coming soon" cards — Airtable-only now.
- Full coverage of **connection-recovery** (pending_reauth / invalid / refreshing) and **new-base discovery** states.
- Open (NOT committed, needs client decision): "Backup" vs "Sync" naming; connection scope (Org-level vs per-Space).

## Capabilities

### New Capabilities
- `integrations`: connecting a platform (Airtable via OAuth or API key), selecting which bases a Space backs up, choosing a schedule, choosing static and/or dynamic destinations and the backup layers, running the first backup, and the settled / recovery / discovery states of the screen.

### Modified Capabilities
<!-- none — no existing openspec specs in this repo yet -->

## Impact

- `apps/web/src/views/IntegrationsView.astro` (current, untouched baseline). The redesign is built as `IntegrationsView.redesign.astro` (overview), a dedicated Configure route in two candidate layouts (`IntegrationsConfigureView.astro` Summary + Manage, `IntegrationsConfigureView.tabs.astro` Tabs / Stepper), `IntegrationsManageBasesView.astro` (full-width base management), and the shared `components/integrations/BaseSelectionTable.astro`. The early `IntegrationsView.v2.astro` (Panel) and `IntegrationsView.v3.astro` (Guided) explorations are retired.
- `apps/design` harness only: preview fixtures (`?fixture=…`), the version switcher (`?v=`), and the API stub. Not shipped to prod.
- No backend in this repo. Real wiring of the new capabilities (API-key connect, destination auth + folder pick, parallel static+dynamic, layer opt-in) is an engineering follow-up in the full monorepo.
