# Schema · Tab — Browse

> The list/explorer counterpart to Visualize. Where Visualize is the
> *diagram*, Browse is the *index* — see every base, table, and field
> in the Space and drill into any one of them. Companion wireframe:
> `05-browse-wireframe.excalidraw`.

Tab order on the Schema page: **Browse · Visualize · Changelog ·
Health · Docs**. Browse is the natural landing for working *with* the
schema (annotating, inspecting); Visualize stays the "wow" diagram.

---

## User goal

"Let me find and inspect any base, table, or field fast — and see
everything attached to it." A power user who knows roughly what
they're looking for shouldn't have to pan around a diagram; they want
a searchable, navigable list and a detail panel.

---

## Layout

Two regions: a **browse area** (left/main) and a **detail panel**
(right, opens on selection).

### Browse area — Tree + Flat, one global search
A persistent **search/filter bar** across the top, and a toggle
between two display modes:

- **Tree** (default) — collapsible hierarchy: Base ▸ Table ▸ Field.
  Expand a base to see its tables, a table to see its fields. Good
  for "walk the structure."
- **Flat index** — one dense, sortable list of *every* entity (rows =
  bases, tables, fields) with columns for type, parent, counts, and
  health. Good for "find that one field across all bases."

Filters: by **base**, **entity type** (base/table/field), **health**,
and useful derived ones — **"missing description"**, **"has AI
description"**, **"linked / has relationships."** Each row shows: the
**Airtable field-type icon** (our vendored set), name, parent context,
a **health dot**, and a small indicator if the entity has
descriptions or is referenced by any documents.

### Detail panel — stacking sheets
Selecting any entity slides in a detail panel from the right.
Clicking a child or related entity **pushes a new sheet on top**
(with a **breadcrumb trail** at the panel header); **back** pops it.
So you can drill in and out — base → table → field → linked table →
… — without losing your place.

**This panel is a shared component** — the Docs tab opens the exact
same panel when you click an entity tag. Design it once.

---

## Detail panel sections

For the selected entity (base / table / field):

1. **Context + type** — name, a type badge, breadcrumb of where it
   lives (Base ▸ Table ▸ Field), key stats (field/record counts,
   health dot). For fields, the Airtable field-type icon + the type.
2. **Descriptions** — the core annotation block:
   - **Airtable's description** — read-only; what's live in Airtable now.
   - **AI description** — with **Generate / Regenerate** (Pro+).
   - **Your description** — editable, with a **"Copy AI → Yours"**
     button.
   - **"Push to Airtable"** — writes your description back to
     Airtable. **Show this disabled / "Coming soon"** — write-back is
     a V2 management action (Baseout is read-only toward Airtable in
     V1). Design the affordance so the intent is visible, but it
     can't be used yet.
3. **Children** — base → its tables; table → its fields; field → its
   options (e.g. select choices). Each child is clickable → pushes
   its sheet.
4. **Relationships** — field → its linked/lookup/rollup target;
   table → other tables linked via field relationships or sync.
   Clickable → pushes the related entity's sheet. This is "see the
   relationship, click through to it."
5. **Documentation** — the documents (from the Docs tab) that **tag**
   this entity, clickable to open them. (The reverse side of Docs
   tagging.)

---

## Visual direction

Density target Linear / Vercel / Plaid — this is a working tool, not a
showcase. The list should be scannable and fast; the panel dense but
legible. Reuse the status-dot / health-band palette from
`/integrations` and `/backups`. Lucide icons for chrome; the vendored
Airtable field-type icons (`field-icons/`) for field rows and the
panel.

---

## States

| State | What |
|---|---|
| **No bases connected** | "Connect Airtable to see your schema." → Integrations |
| **Connected, never backed up** | "Your schema appears after your first backup completes." |
| **Normal** | Tree/Flat populated; panel closed until a selection |
| **Large schema (many bases/tables)** | Search + filters carry it; Flat index + filters are the fast path |
| **Entity with no description** | Description block invites Generate / write your own |
| **Entity referenced by docs** | Documentation section lists them; otherwise an empty "No documents reference this yet" |
| **Removed entity (from history)** | If shown, marked removed; panel notes it's no longer in Airtable |

Preview states use the repo's `?fixture=` (`empty`, `failed`,
`trial`). Ask engineering to extend fixtures with a richer multi-base
schema to design the Tree/Flat density against.

---

## Gating
- **AI Generate description** — Pro+ (10 credits/use), same as on Visualize.
- **Push to Airtable** — shown disabled / "Coming soon" (V2).
- The Browse tab itself — Launch+ (same as the rest of Schema).

---

## Component reuse
- **Entity detail panel** — shared with the Docs tab (tag click opens it).
- **Entity search/typeahead** in the search bar — the *same* component
  powers the Docs `@`-tag dropdown and the Visualize "add entity"
  picker. Build one, use three places.
- Airtable field-type icons (`field-icons/`), health dots, `Card` /
  `Badge` / `Button` / `Tabs`.

## Explicitly not this tab
- Not the diagram — spatial relationships live on Visualize.
- Not a record browser — clicking a table shows its **fields**, not
  its rows. Record data lives in the Data view.
- Not rich documentation — long-form notes live on the Docs tab; this
  tab shows only the per-entity descriptions and a list of docs that
  reference the entity.
</content>
