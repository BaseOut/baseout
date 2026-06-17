# Client walkthrough — IA restructure (Airbyte model)

A click-through script for showing the `experiment/nav-restructure` branch. Dev server at
`http://localhost:4332` (use `http://`, not `https://`). Screens captured under
`assets/screens/` for reference.

## The one-sentence frame

> We restructured the app to the proven Airbyte model: **Sources** (Airtable connections) and
> **Destinations** (storage / databases) are connected **once on your account** and reused; each
> **Space is a backup pairing** of one Source + its bases + a Destination + a schedule.

This removes the old confusion of two "connect Airtable" surfaces, and surfaces the reusable
connections in the sidebar instead of burying them in Settings.

## Demo order

### 1. Space Overview — configured (the home screen of a Space)
`http://localhost:4332/integrations`  ·  `assets/screens/01-overview-configured.png`

- **Sidebar, two scopes:** a **Space** group (Overview, Backups, Restore, Schema, Reports —
  follows the Space selector) and an **Account** group (Sources, Destinations — reusable, no
  longer hidden in Settings).
- The Space page is now its **backup overview**, read as a pipeline:
  **FROM** Ops Airtable → **BACKS UP** 2 bases → **TO** Company Drive `/Baseout/Demo Space`.
- Status line: schedule · next backup · last run. Actions: Configure / Run backup now.
- Talking point: "The Space doesn't connect anything itself — it just references a Source and a
  Destination you set up once."

### 2. Space Overview — not set up yet (guided)
`http://localhost:4332/integrations?fixture=empty`  ·  `02-overview-unconfigured.png`

- Four-step guide: pick a Source → choose bases → pick a Destination → set a schedule.
- Talking point: "Setup reuses what you already connected; you're not re-authorizing Airtable
  per Space."

### 3. Space Overview — a connection broke (backups paused)
`http://localhost:4332/integrations?fixture=reauth`  ·  `03-overview-broken.png`

- Amber "Backups paused" + "Source Founder Airtable lost Airtable access" + **Reconnect**.
- Talking point: "Because the Source is shared, **one reconnect heals every Space using it** —
  you fix it in one place, not per Space."

### 4. Sources — the account registry
`http://localhost:4332/sources`  ·  `04-sources-registry.png`

- Table: Name (+ auth method) · Authorized as · Status · In use by (N Spaces) · Bases.
- Broken-source banner at the top mirrors the Space's paused state.

### 5. Source detail — health + who uses it
`http://localhost:4332/sources/detail?id=src-ops`  ·  `05-source-detail.png`

- Identity + **"status reflects the last successful check, not live"** — honest about Airtable's
  API (no revocation webhook; status is last-known-good).
- **"In use by" table:** each Space, its bases, destination, schedule, last backup, status.
- Remove is **guarded** while Spaces depend on it.

### 6. Destinations — the account registry
`http://localhost:4332/destinations`  ·  `06-destinations-registry.png`

- Same shape as Sources: Name · Type (Drive / S3 / Postgres) · Status · In use by · Last write.

### 7. Destination detail
`http://localhost:4332/destinations/detail?id=company-drive`  ·  `07-destination-detail.png`

- Identity + per-Space subfolder explanation + "In use by" + guarded Remove.
- See rough edge #1 below before showing this one.

## Rough edges (decide before the show)

1. **Destination detail shows usage as chips, not the table** that Source detail has. The founder
   asked for the usage table on **both**. It's a known backlog item (`tasks.md`). Options: build
   the table now (small, self-contained, on-branch), or just don't drill into Destination detail
   in the demo. Recommend building it for symmetry.
2. **Stale fixture dates.** "Next backup Jun 4, 2026" reads as past (today is Jun 11), and the
   broken/paused state still shows a confident next-backup time. One-line fixture fix.
3. **Rocket emoji** on the unconfigured empty state is a touch consumer-y for a Linear/Vercel
   utility tone. Optional swap to a line icon.

None of these are structural; all three are quick. Say the word and I'll fix any or all before
you present.

## Safety

- We are on branch `experiment/nav-restructure` (3 commits on top of `main`).
- `main` is untouched at `a6f36f3`. Rollback = `git checkout main`.
- Do **not** merge to `main` until the client signs off on the IA.
