# V1 scope trim — hide the Reports tab, defer SQL access

## Why
At the Jul 6, 2026 Dan/Autumn sync, Dan set the V1 launch scope: **backup, restore,
schema, and potentially a REST API** — the reports tab is removed and SQL database
access is deferred to a later version, to be reconsidered on user feedback. The unused
Reports page will be hidden for the time being.

Today the sidebar still carries a **Reports** item (`apps/web/app-config.json`
`navigation.top`) routed to `apps/web/src/pages/reports.astro`, which renders only
`<PlaceholderView label="Reports" />` — a dead tab in front of customers at launch.

**Spec conflict (flagged per CLAUDE.md §1):** the PRD v1.1 lists SQL REST API (Pro+)
and Direct SQL Access (Business+) as ✅ In V1 (Baseout_PRD.md §10, lines 775–776; §3.5;
Baseout_Features.md §14.1). The Jul 6 meeting decision supersedes this scope, and **Dan
owns the PRD revision** (his action item from the same meeting). This change defers
Direct SQL Access firmly; the SQL REST API's fate ("potentially a REST API") is left to
Dan's PRD update rather than decided here. Reports was already V2-leaning in the specs
(PRD §10 line 764 marks Reports ❌ V2; §3.6 keeps only basic usage metrics in V1), so
hiding the tab has no spec conflict.

## What changes
- **Remove the Reports nav item** from `apps/web/app-config.json` (`navigation.top`).
- **Remove `apps/web/src/pages/reports.astro`**, replacing it with a redirect to `/`
  so any stale link or bookmark doesn't 404 (mirrors the `/integrations` → `/`
  precedent from `web-space-home-dashboard`).
- **Record the SQL deferral as a spec delta.** No code removal needed: `apps/sql` is a
  placeholder Worker (`"baseout-sql placeholder"`), and apps/web has no SQL UI,
  routes, or capability gating yet — the deferral is a decision-of-record that stops
  new SQL surface work until Dan's PRD update re-scopes it.
- Mirror the trim in `apps/design` (its `reports.astro` harness page) so the design
  app's nav matches production.

## Non-goals
- No deletion of `apps/sql` or the archived/current `direct-sql-access` /
  `sql-rest-api` specs — deferral, not removal; the openspec `sql` change stays parked.
- No other nav restructuring (the two-scope sidebar from `web-nav-ia-restructure` stands).

## Impact
- `apps/web/app-config.json` — drop the Reports entry (navigation only).
- `apps/web/src/pages/reports.astro` — becomes a redirect to `/`.
- `apps/design/src/pages/reports.astro` + design nav — same trim in the harness.
- `openspec/changes/sql/`, `server/specs/direct-sql-access/` — untouched, parked.
- PRD §10 / §3.5 — updated by Dan (out of band).
