# Design — Integrations redesign

UX research backing this change. (Source of truth for the requirements in `specs/integrations/spec.md`.)

## Product context (authoritative — founder call + `overview/` diagrams)

Baseout = Openside's next-gen successor to On2Air Backups. Core today = a backup/**sync** tool that pulls data OUT of Airtable (Airtable-only now; other platforms ~1 year out — downplay). Hierarchy: **Organization → Connection(s) → Space(s) → selected Bases → Tables/Fields/Records/Attachments**. A Space = one backup configuration (bases + schedule + destination(s)); bases can belong to multiple Spaces. Register auto-creates a default Space.

**Static vs Dynamic backup — not exclusive, can do BOTH:** Static = CSV/JSON + attachment binaries to storage you own (Drive/Dropbox/Box/OneDrive/S3/R2). Dynamic = rows into a relational DB (Postgres/D1/Neon/Supabase/BYODB) → SQL query, live mirror. **Layers (opt-in per Space):** Schema (always), Data (default on), Attachments (opt-in, billed). Pricing is credit-based; frequency + base count + features are plan-gated.

## User modes (not personas)

1. **First-time setup** ("get me protected") — anxious (production data) + impatient. Win = a real first backup ran and they know when the next one is.
2. **Returning spot-editor** ("change one thing and leave") — low patience for scrolling. Win = changed one control, confident it saved.
3. **Recovery** ("why aren't my backups running?") — connection broke / tier cap. Win = clear diagnosis + obvious fix.

## Job stories (selection)

- When I've just connected, I want to protect my *important* bases (not archives), so I don't waste quota or miss critical data.
- When I'm about to authorize, I want to know it's read-only, so I feel safe connecting production data.
- When I finish, I want proof a real backup ran, so I can trust it and stop thinking about it.
- When a base appears in Airtable, I want to decide fast whether it's protected.
- When my connection breaks, I want to know backups are paused and exactly how to resume.

## Decision flow & friction (today)

Connect → Pick bases → Schedule → Destination(s) → Run. Friction today: thin connect (no read-only promise / no verify-after); base list shows cryptic IDs only (can't judge importance); next-run buried; managed-vs-BYOS choice unframed; run never feels confirmed; no "you're protected" completion; trust signals scattered.

## Direction (built) — overview + dedicated Configure route

The two early explorations (A "Panel" `IntegrationsView.v2.astro`, B "Guided" `IntegrationsView.v3.astro`) were **retired** in favour of a route model: a calm **overview** (`IntegrationsView.redesign.astro`) that flips empty → connected, with heavy configuration on a dedicated **Configure route** (not inline, not a modal). Both early variants dropped the coming-soon cards and surfaced managed-vs-BYOS; the route model keeps that.

### Base selection at scale (built)

Selecting from potentially hundreds of bases gets its own full-width surface (`components/integrations/BaseSelectionTable.astro`): name **search**, **sort** (name / tables / fields), **select-all up to the plan limit** (hard cap), **show-selected-only**, sticky header + scroll, **no pagination**. Nothing is pre-selected — the user chooses.

**Data feasibility (verified against Airtable's API).** The only per-base metrics available are **table count** and **field count** (`GET /v0/meta/bases/{baseId}/tables`). Record counts, last-modified, and workspace grouping are **not** in the standard API (workspace grouping is Enterprise-Admin-only), so the columns are **Base · Tables · Fields** only and the shown numbers are illustrative placeholders. We do not surface fields we cannot actually retrieve.

**Auto-add future bases** is a toggle shown **only when every base is selected** (the intent is then "back up everything"); it is hidden on a partial selection and is unreachable when the account has more bases than the plan cap.

**Two configure layouts** are built for the client to compare (harness `?layout=`): **v1 Summary + Manage** (a light vertical flow that drills into the full-width Manage screen) and **v2 Tabs / Stepper** (first-run is a locked-ahead stepper; edit is free tabs). Both share `BaseSelectionTable`. Pending: the client picks one.

## Competitor patterns (shared research)

Steal: connect promises speed + read-only + reversible (ProBackup); "Save & Test" verify-after (Fivetran); importance cues + scale handling on the base list; anomaly alerts. Baseout wins on: schema intelligence (On2Air retired theirs), dynamic + point-in-time SQL, storage flexibility (managed R2 **and** BYOS).

## Open questions (need client decision — not specced yet)

1. **Naming:** "Backup" vs "Sync" across the flow.
2. **Connection scope:** Org-level (auth once, reuse across Spaces — diagrams assert this) vs per-Space. Determines whether "Connect" lives in an Org settings area or on the Space's Integrations page.
3. **Auto-add default on connect:** Connection and base-selection are separate layers (`connections[].status` vs `bases[].isIncluded`), so "connected but no bases selected" is structurally possible. The question is the *default*: on a first-time connect, do we **auto-add discovered bases up to the tier cap** (so the user lands protected immediately — "default sensibly", matches the discovery banner's "M auto-added" wording) or leave everything unselected and force a manual pick? Recommendation: **auto-add ON** at connect, which makes "Connected but not configured / No bases" an *edge* state (deliberate deselection · empty Airtable account · all bases tier-blocked) rather than the default first-run. Determines whether the happy path after OAuth is "Protected · run your first backup" or "Finish setup".

## Status

Research (brief steps 0–5) + v2/v3 + version switcher + preview fixtures + harness API-stub fix are done. Founder-call deltas (API-key connect, parallel static+dynamic with auth+folder, layer opt-in) are specced here and pending implementation.
