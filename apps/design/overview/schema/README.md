# Schema page — designer brief

What to design for the **Schema** page (`/schema`). This folder is
the build brief for the most differentiated surface in the product:
the "Data Intelligence" half of Baseout. Read this overview first,
then the per-tab docs.

> These docs expand on the one-page intent spec at
> [`../../specs/10-schema.md`](../../specs/10-schema.md). The spec
> says *what the page is for*; this folder says *what to draw*.

---

## Files in this folder

| File | What |
|---|---|
| [README.md](README.md) | This overview — page purpose, structure, gating, states |
| [04-browse-tab.md](04-browse-tab.md) | **Browse** tab — list/explorer of bases/tables/fields + shared detail panel |
| [01-visualize-tab.md](01-visualize-tab.md) | **Visualize** tab — the schema diagram |
| [02-changelog-tab.md](02-changelog-tab.md) | **Changelog** tab — the schema change feed |
| [03-health-tab.md](03-health-tab.md) | **Health** tab — per-Base health grades + issues |
| [05-docs-tab.md](05-docs-tab.md) | **Docs** tab — author docs about the schema (Plate editor + entity tags + diagrams) |
| [field-icons/](field-icons/) | Airtable field-type icon set (31 SVGs) + mapping + `contact-sheet.html` preview |
| `*.excalidraw` | Wireframe per tab + a page-anatomy diagram (see below) |

(File numbers are doc order, not tab order. Tab order is **Browse ·
Visualize · Changelog · Health · Docs**.)

**Diagrams** (open at <https://excalidraw.com> by drag-and-drop, or
the VS Code Excalidraw extension):

| # | File | What it shows |
|---|---|---|
| 01 | `01-page-anatomy.excalidraw` | The whole page: shell, header, tab bar, what each tab does, gating callouts |
| 02 | `02-visualize-wireframe.excalidraw` | Visualize tab — canvas, node anatomy, side panel, base filter, minimap, export |
| 03 | `03-changelog-wireframe.excalidraw` | Changelog tab — filter rail + day-grouped feed of change rows |
| 04 | `04-health-wireframe.excalidraw` | Health tab — grade cards, category breakdown, issue list |
| 05 | `05-browse-wireframe.excalidraw` | Browse tab — Tree/Flat list + global search + stacking entity detail panel |
| 06 | `06-docs-wireframe.excalidraw` | Docs tab — list + Plate editor, @-tag dropdown, tags / links / diagrams |

Regenerate the diagrams after editing copy/layout in the script:

```bash
node overview/schema/generate.mjs
```

---

## Where it lives in the app

- **Route:** `/schema`, **Space-scoped** — it always reflects the
  Space selected in the sidebar. Sidebar SPACE group order:
  Overview · Backups · Restore · **Schema** · Reports.
- **Today:** a `PlaceholderView`. Live at
  <http://localhost:4332/schema> (placeholder only — nothing to see
  yet; that's the point of this brief).
- **Once designed:** a new `SchemaView.astro` in `apps/web/src/views/`.
- **Layout:** `SidebarLayout` (same shell as every interior page).

---

## What the page is for

The Space's schema, five ways — each a tab:

1. **Browse** — a searchable list/explorer of every base, table, and
   field, with a shared detail panel to drill into any one. The home
   for inspecting and annotating the schema.
2. **Visualize** — a schema diagram (tables as nodes, linked-record
   fields as edges), faster to scan than navigating Airtable.
3. **Changelog** — a time-ordered feed of schema changes, generated
   automatically from backup-snapshot diffs.
4. **Health** — a per-Base composite grade that surfaces unnamed
   fields, empty tables, broken links, risky type changes, etc.
5. **Docs** — author long-form documentation about the schema, tagging
   the actual bases/tables/fields, with external links and saved
   mini-diagrams.

This is where Baseout most actively **differs from "just a backup
tool."** Other backup products don't visualize or document schema; we
do. Treat it as a chance to make a memorable, technically-credible
surface.

**Mostly read-only toward Airtable.** Baseout sits on top of Airtable;
it doesn't replace it. The one anticipated exception is "push your
description back to Airtable" on the Browse detail panel — a **V2
management action, shown disabled / "Coming soon"** in V1. The schema
itself can't be edited from here (layout auto-arranges; structure
doesn't).

---

## Page structure

```
┌─ SidebarLayout ────────────────────────────────────────────────┐
│  Page header:  "Schema"   ·   [ Base filter ▾ ]   [ Export ▾ ]  │
│  Tab bar:  [ Browse ] [ Visualize ] [ Changelog ] [ Health ] [ Docs ] │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  active tab body                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

- **Tabs**, not separate routes — **Browse** is the default landing.
- **Base filter** is page-level (multi-base Spaces); it scopes the
  tabs that show schema. Single-base Spaces can hide it.
- **Export** menu is most relevant on Visualize; show it there.
- The **entity detail panel** is a shared component used by both
  Browse (row click) and Docs (entity-tag click) — design it once.

See `01-page-anatomy.excalidraw`.

---

## What to design first

If time is limited, in this order:

1. **Browse + the shared detail panel** — foundational. The panel is
   reused by Docs, and the entity-search typeahead it uses is reused
   by Docs (`@`-tagging) and Visualize (add-entity). Design it first
   so the rest composes on it.
2. **Visualize** — the "wow" surface; most technically novel.
3. **Health** — most commercially valuable (justifies a Pro/Business
   upgrade).
4. **Docs** — the richest build (Plate editor + tagging + React Flow
   mini-diagrams); design after the shared panel exists.
5. **Changelog** — easiest; a structured feed.

---

## Data behind each tab (so the design is feasible)

The engine computes everything during/after backup runs; the page
only reads. You don't need to design any of this, but it bounds
what's real:

- **Visualize** reads `GET /spaces/{id}/schema` → bases → tables →
  fields, plus linked-record relationships for the edges.
- **Changelog** reads `GET /spaces/{id}/schema/changelog?since=…` →
  pre-rendered, human-readable diff strings with timestamps.
- **Health** reads the per-Base computed score (0–100) + band, with
  a per-rule breakdown for the drill-in.
- **Browse** reads the same schema data as Visualize, plus each
  entity's descriptions (Airtable / AI / yours) and the list of
  documents that tag it.
- **Docs** reads and writes documents (body, entity tags, links,
  saved diagrams) scoped to the Space.

Implication for empty states: **the schema only exists after the
first backup run.** Before that, there's nothing to draw.

---

## Tiering & gating (design the gates, not just the happy path)

| Capability | Tier | Note |
|---|---|---|
| Schema page (Visualize / Changelog / Health) | **Launch+** | Schema-only plans included |
| Pre-registration Visualize | before sign-up | Conversion hook — schema viz shown before payment |
| Record counts on nodes / data-level metrics | **dynamic backup** | Schema-only plans show field counts, not record counts |
| Export → **PNG** | Growth | client-side render |
| Export → **SVG** | Pro | |
| Export → **PDF** | Business | |
| Export → **embed widget** | Enterprise | |
| Health-score **rule configuration** | **Pro+** | defaults shown to everyone; editing is Pro+ |
| AI **"Generate description"** on fields/tables | **Pro+** | **in scope for this design** — 10 credits/use (see Visualize tab doc) |
| **Browse** tab | **Launch+** | same as the rest of Schema |
| **Docs** tab | **Pro+** (confirm w/ capability matrix) | Data-Intelligence feature |
| **Push description to Airtable** | **V2** | shown disabled / "Coming soon" on the Browse detail panel |

Design the locked states too: an export format above the user's tier
should read as an upgrade affordance, not a dead control. Match the
upgrade-prompt pattern already used elsewhere in the app rather than
inventing a new one.

---

## States to cover (every tab)

| State | What to show |
|---|---|
| **No bases connected** | "Connect Airtable to see your schema." → link to Integrations |
| **Bases connected, never backed up** | "Schema appears after your first backup completes." |
| **Single base, healthy** | Clean diagram; Health mostly green |
| **Many bases** | Base-filter UI carries the load |
| **Lots of changes** | Changelog needs density + day/base grouping |
| **Health failures** | Sortable severity + "fix in Airtable" affordances |

In this repo, preview states come from `?fixture=` — `empty` (zero
state), `failed`, `trial` (pre-onboarding; pair with `/welcome`).
Default = fully-onboarded. The current fixtures are thin on schema
data; once the design lands, ask engineering to extend fixtures with
a richer schema + a longer changelog to design against.

---

## House rules that apply here

From `../../specs/00-design-principles.md` — these are constraints,
not suggestions:

- **Utility admin tool, not a dashboard product.** Density target:
  Linear / Vercel / Plaid. Functional over decorative.
- **Trust signals first.** Health dots, last-run time, "did the last
  thing succeed" should be legible at a glance.
- **Copy:** direct, second-person, no exclamation marks, no mascots.
  Health wording is **advisory, not pejorative** — "12 fields could
  use clearer names," never "your schema is bad."
- **Icons: Lucide only** (via Iconify), single icon set. Brand/social
  logos are the only exception.
- **Visually distinct from Airtable**, but use Airtable's vocabulary
  (Base, Table, Field, View) where it aids recognition.

### Field-type icons — resolved

The page uses **Airtable's own field-type icons** (single select,
linked record, attachment, etc.) so field rows are instantly
recognizable. The set is vendored in
[`field-icons/`](field-icons/) — 31 SVGs, one per Airtable field
type — as a documented exception to this repo's otherwise
Lucide-only rule. See [`field-icons/README.md`](field-icons/README.md)
for the filename→type mapping and usage notes, and open
`field-icons/contact-sheet.html` to preview the set. They apply to
the Visualize side panel and the Changelog rows.

---

## Out of scope here (V2 / explicitly not this page)

- Auto-generated **Data Dictionary export** (Features §3.7 — V2). The
  **Docs tab is in scope** (author docs about the schema), as is the
  per-entity **"Generate description"** AI button — but a one-click
  auto-generated dictionary *export* is V2.
- Snapshot-to-snapshot diff UI ("compare yesterday vs today") —
  *may* fold into the Changelog tab; defer scope to engineering.
- Write-back to Airtable — V2 management action; shown disabled on the
  Browse detail panel, not functional in V1.
</content>
</invoke>
