# 11 — Reports (`/reports`)

Usage analytics + activity history. Currently a placeholder. This
page answers: "How much have I been using Baseout, and what has
been happening?"

**Source:**
- Today: `apps/design/src/pages/reports.astro` (`PlaceholderView`)
- Once designed: a new `apps/web/src/views/ReportsView.astro`

**Layout:** `SidebarLayout`

**Live preview:** <http://localhost:4332/reports` — placeholder

---

## Purpose

Two distinct things lumped under one page heading. Be deliberate
about not blending them.

1. **Usage metrics** — credits used vs. tier allowance, storage
   used, projected overages. Billing-adjacent.
2. **Activity reports** — what's been happening across the Space:
   backup run counts by week, restore counts, integration changes,
   user actions.

PRD §3.6 ("Analytics") is the relevant section. Features §12
covers the Analytics capability tier breakdown.

---

## User goal

> "Am I on track this month, or am I about to blow through my
> allowance?"

And:

> "Give me something I can paste into a status report or a
> quarterly review."

The user here is often a team lead or ops person who has to *show*
that backups are happening on time. They want exportable, scannable
proof.

---

## Suggested page structure

Two top-level sections (or two tabs — designer's call):

### Section 1 — Usage this period

A summary card row showing:

- **Transfer credits used** — e.g., "12,400 / 50,000 this month."
  Progress bar. Days remaining in period.
- **Activity credits used** — same pattern.
- **Storage used** — e.g., "4.2 GB / 10 GB." Progress bar.
- **Overage charges so far** — "$0.00" / "$3.12" if over.

Below: a trend chart (line or area) showing daily credit usage for
the current period vs. the previous period.

### Section 2 — Activity report

A filterable list / table of meaningful events:

- Backup Run started / completed / failed
- Restore Run started / completed
- Schema changes detected (delegate to /schema for detail)
- Integration changes (connection added, base added/removed, schedule
  changed, storage destination changed)
- Member changes (user invited, role changed, removed)
- Tier / billing changes (upgrade, downgrade, payment failed)

Columns: timestamp, user, event type, target, brief description,
"view detail" link.

Filterable by date range, event type, user. Exportable to CSV.

---

## States to design for

| State | What |
|---|---|
| **Pre-trial** | Empty — "Reports populate after your first backup." |
| **Trial** | Limited reporting — single backup run, tiny usage numbers |
| **Active, under quota** | All green, plenty of headroom |
| **Approaching quota** | Yellow / warning treatment on the at-risk metric |
| **Over quota** | Red treatment + clear "you're being billed for overage" copy + "review" CTA |
| **Heavy activity** | Activity log is long; pagination / filter UX matters |

---

## What this page is NOT

- **Not a custom report builder.** No "drag fields here to make a
  chart." That's a V2+ idea if at all.
- **Not the billing surface.** The user pays for Baseout on a
  separate Billing page (or `/settings`); this page only
  *describes* current usage so they understand what they'll owe.
- **Not real-time monitoring.** Numbers refresh on page-load or via
  a manual refresh button — not via WebSockets. The user isn't
  staring at this page; they check it weekly.
- **Not the Schema changelog.** Schema changes are *mentioned* here
  briefly with a "see details on Schema page" link.

---

## Notes for designer

- This page is, by default, *boring* — and that's correct. A
  utility-admin user wants the data quickly; they don't want
  visualization theater.
- The progress bars for credits / storage are the most important
  visual element. Make them confident — clear filled portion,
  clear scale, percentage label.
- Charts: use the simplest possible chart per piece of data. A
  single line chart for daily credit usage. A bar chart for
  weekly run counts. Don't go heatmap / sankey / pie unless there's
  a compelling reason.
- CSV export is a real feature, not a nice-to-have — ops people
  paste activity logs into compliance reports. Make the export
  button obvious.
- Time zone matters. Show timestamps in the user's local time zone
  with the zone abbreviation. Avoid UTC unless explicitly opted
  into.

---

## What about charting library?

We don't have a chart library wired in yet. Recommended (in order
of preference for a utility-admin app):

1. **Apache ECharts** or **Chart.js** — battle-tested, theme-able,
   reasonable bundle size if you tree-shake.
2. **Recharts** — React-only, but apps/web is Astro + occasional
   islands; would need a React island. Acceptable trade-off if you
   want React-y composability.
3. **Vega-Lite** — overkill for these needs.
4. **D3 directly** — only if you've outgrown the above.

Don't pick yet — design first with stub visuals (Tailwind divs as
placeholder charts is fine). Once a design is settled, engineering
picks the library to match.

---

## V2 / out of scope here

- AI-assisted insights ("Your backups got 30% slower last week —
  here's why") — Capability 6 (AI), V2.
- Cross-Space rollup reports (multi-Space orgs) — V2.
- Custom alerting from this page (set up an alert when transfer
  credits hit 80%) — Alerts capability is V1.5+; the *setting* of
  alerts probably lives in Settings rather than here.

---

## Component reuse

- `Card`, `Badge`, `ProgressBar`, `Button`, `Tabs`, `Select`
  (filter), `TextInput` (date range / search), `Divider`
- The same status-color palette from /backups for "good / warning /
  failure" usage states
- `BackupHistoryWidget`-style accordion rows for the Activity log
  detail expansion
