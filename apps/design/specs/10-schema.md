# 10 — Schema (`/schema`)

The schema visualization, browsing, documentation, history, and
health page. Currently a placeholder. This is the page that delivers
the "Data Intelligence" half of the product positioning.

**Source:**
- Today: `apps/design/src/pages/schema.astro` (`PlaceholderView`)
- Once designed: a new `apps/web/src/views/SchemaView.astro`

**Layout:** `SidebarLayout`

**Live preview:** <http://localhost:4332/schema> — placeholder

---

## Purpose

Show the user **what their Airtable data looks like, structurally**,
how that structure has evolved over time, and a per-Base health
grade that surfaces problems.

PRD §3.1, §3.2, §3.3 — read all three before designing. This is
arguably the most differentiated page in the product.

---

## User goal

Three layered goals:

1. **"Show me my data's structure visually."** Tables, fields,
   relationships. A schema-diagram view that's faster to scan than
   navigating Airtable itself.
2. **"Show me what changed."** Schema changelog: a field was
   renamed last Tuesday, a new table appeared on May 20th. Who
   changed what, when.
3. **"Tell me where the rot is."** Health Score — composite grade
   that surfaces issues like: unnamed fields, duplicate field
   names, empty tables, fields whose type changed in a way that
   broke existing data, etc.

---

## Suggested page structure

Tabs at the top:

- **Visualize** (default)
- **Browse** — entity browser + per-entity documentation
- **Docs** — user-authored schema documents
- **Changelog**
- **Health**

> **Browse + Docs are the Schema Docs feature (V1).** Their full UI
> spec lives in `10a-schema-docs.md` — design that alongside this page.
> Summary below; the dedicated spec is authoritative for the editor,
> tag-picker, links, and mini-diagram surfaces.

### Tab 1 — Visualize

- A schema-diagram canvas. Tables as nodes; linked-record fields as
  edges between nodes.
- One zoom-out "miniature" panel in a corner for orienting.
- Each table node shows: table name, field count, record count, a
  health dot (green / amber / red).
- Click a table → side panel with the full field list (name, type,
  Airtable type icon, settings).
- Filter by Base (multi-base spaces).

References that hit roughly the right note: dbdiagram.io, Airtable's
own "Field overview" extension, Lucidchart's ER diagrams. Avoid
"network graph" aesthetics (force-directed, edges-everywhere) —
this is structural, not topological.

### Tab 2 — Browse

An entity browser for the captured schema — the read-oriented home of
per-entity documentation.

- A list/tree of schema entities: Bases → Tables → Fields → Views.
- Click an entity → a detail panel (reuse the `EntityDetailHeader`
  pattern + a `DefinitionList` of its facts: type, options, counts,
  imported + effective description).
- The detail panel has a **Documentation** section listing every
  Document that Tags this entity, each as a clickable `Badge` linking
  to the Doc. A Tag whose entity was later removed from Airtable is
  shown with a warning `Badge` ("removed from Airtable") — retained,
  never silently dropped.
- Tags are removable from here (as well as from the Doc).

### Tab 3 — Docs

User-authored Documents about the schema (distinct from inline
descriptions). See `05-docs-tab.md` for the authoritative UI.

- A list of Documents (title + derived excerpt + tag count).
- A Document editor: rich-text body (Plate), inline `@`-tags to
  entities, named external Links, and saved mini-Diagrams (React Flow).
- Tier-gated: manual authoring on Launch+; a disabled "Generate with
  AI — Soon" affordance on Pro+. Below Launch → upsell empty state.
- The editor and diagram canvas are React islands (`client:visible`) —
  the sanctioned carve-out from the daisyUI-first governance.

### Tab 4 — Changelog

A time-ordered feed:

- "May 20, 2026 — *Sales Pipeline* base: new table *Q2 Forecast*
  added (3 fields, 0 records)."
- "May 18, 2026 — *Marketing* base: field *Lead Source* renamed to
  *Acquisition Channel*."
- "May 12, 2026 — *Ops* base: field *Status* type changed from
  *Single select* to *Multiple select*. ⚠️ 12 records may have
  invalid values now."

Each entry: timestamp, base, change type, description, optional
warning icon if the change might have broken data.

Filter by base, by change-type, by date range.

This is generated automatically from backup-snapshot diffs — there's
no manual annotation involved. Per Features §1 ("Changelog").

### Tab 5 — Health

A per-Base composite grade and a breakdown of the issues:

- Big number / letter grade per base (A / B / C / D / F or 0–100).
- Each grade decomposed into categories: Schema cleanliness, Data
  quality, Configuration best practices.
- Within each category, a list of detected issues: "3 unnamed
  fields in table X," "Empty primary field in 47 records in table
  Y," "Linked-record field Z points to deleted records," etc.
- Each issue: severity, occurrence count, "show me" link that
  jumps to that field/record in Airtable.

The list should be sortable by severity and filterable by base.

---

## States to design for

| State | What |
|---|---|
| **No bases connected** | Empty state — "Connect Airtable to see your schema." |
| **Bases connected, never backed up** | "Schema appears after your first backup completes." |
| **Single base, healthy** | Visualize tab shows clean diagram, Health tab shows mostly green |
| **Many bases** | Visualize tab needs base-filter UI |
| **Lots of changes** | Changelog tab needs density + grouping (by day, by base) |
| **Health failures** | Health tab needs sortable severity, "fix in Airtable" affordances |

---

## What to design first

If you have limited time on this page:

1. **The Visualize tab** is the most "wow" surface and the most
   technically novel. Worth designing first.
2. **Health tab** is the most commercially valuable (the kind of
   thing that justifies a Pro/Business upgrade). Worth second.
3. **Changelog tab** is the easiest to design — it's basically a
   structured feed.

---

## Notes for designer

- This is where Baseout most actively *differs* from "just a
  backup tool." Other backup products don't visualize schema; we
  do. Use that as a design opportunity to make a memorable surface.
- Field-type icons should match Airtable's iconography (we use
  Airtable's own icons where they help — see PRD §6.0 principle
  #4). Don't reinvent the icon set; lean on what users already
  recognize.
- The schema visualizer is *not* an interactive editor — users
  can't drag/drop tables to rearrange them and have it write back
  to Airtable. It's read-only. But the visual layout itself can be
  auto-arranged with a thoughtful algorithm (hierarchical layout,
  linked-record groupings).
- Health scores are *advisory*, not pejorative. Wording matters:
  "12 fields could use clearer names" not "Your schema is bad."
- This page benefits from sample data to design against. Once
  designed, we should ask engineering to extend the fixtures with
  a richer schema + a longer changelog.

---

## V2 / out of scope here

- **Auto-generated** data dictionary + documentation **exports**
  (Markdown, PDF, Confluence, Notion) — V2 (PRD §3.7). Note:
  *user-authored* Schema Docs (the Browse + Docs tabs above) are V1.
- AI generation of Document content — gated "soon" (the manual editor
  ships in V1; AI authoring is a Pro+ follow-up, `server-schema-ai-docs`).
- Schema diffing UI between snapshots ("show me what changed
  between yesterday's snapshot and today's") — could land in V1
  Changelog tab; defer to engineering on scope.
- Edit / write-back to Airtable from this page — explicitly out of
  scope per PRD positioning ("not an Airtable replacement").

---

## Component reuse

- `Card`, `Tabs`, `Badge`, `Button`, `Avatar` (for users
  referenced in changelog rows)
- Browse/Docs: `EntityDetailHeader` + `DefinitionList` (entity detail
  panel), `EmptyState` (upsell + empty Docs), `Modal` + `TextInput`
  (new Document); the Plate editor + React Flow canvas are `.tsx`
  islands under `apps/web/src/components/islands/` (governance carve-out)
- The status-dot / health-badge color palette already established
  on `/integrations` and `/backups`
- Material Symbols + Lucide icons; Airtable field-type icons need
  to be sourced separately (likely vendored into
  `apps/web/public/icons/airtable/`)
