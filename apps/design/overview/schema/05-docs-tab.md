# Schema · Tab — Docs

> Author rich, long-form documentation *about* the schema — distinct
> from the short per-entity descriptions on Browse. A document is
> markdown + entity tags + external links + saved mini-diagrams,
> scoped to the Space. Companion wireframe: `06-docs-wireframe.excalidraw`.

Tab order on the Schema page: **Browse · Visualize · Changelog ·
Health · Docs**. Docs lives under Schema.

---

## Descriptions vs documents — keep these distinct

- **Descriptions** (Browse tab): one short description per entity,
  stored inline — Airtable's, AI-generated, and your override.
- **Documents** (this tab): long-form narrative that can span *many*
  entities, with diagrams and links. A document **tags** entities;
  those tags show up in each tagged entity's Documentation section on
  Browse.

Don't conflate them in the UI — a document is a page you write; a
description is a field on an entity.

---

## User goal

"Let me write up how this part of the schema works — referencing the
actual tables and fields, with a diagram and some links — and have
those references stay live and clickable."

---

## Layout

### List view
All documents for the Space: title, last edited, tag count, a short
excerpt, and a row of linked-entity chips. Search/filter. A **New
document** button. (Empty state: "No documents yet — document how a
base or workflow is structured.")

### Document view (full screen)
Four parts:

1. **Editor (main)** — a **[Plate](https://platejs.org/)** rich-text /
   markdown editor. Plate is required (not a plain textarea) because
   the editor must render **custom inline nodes** — the entity tags.
2. **Inline `@`-tagging** — typing `@` opens an **inline dropdown**
   (the shared entity-search typeahead) to find a base / table / field
   / view. Selecting inserts a **tag chip** into the document. In
   reading mode, clicking the chip opens that entity's **detail panel**
   — the *same* shared panel from the Browse tab.
3. **Tags panel** — a rail (or section below the editor) listing every
   tagged entity, **add/remove here too** — not only inline. This is
   the explicit association list, and it's what populates Browse's
   "Documentation" section. Tagging is bidirectional and live.
4. **Links & Diagrams**
   - **Links** — named external references (name + URL), shown as a
     list on the document.
   - **Diagrams** — one or more **saved mini-diagrams**, each built on
     **React Flow** (the same engine as the Visualize tab, embedded in
     an editable mode). The author curates a small view — pick the
     tables/fields relevant to what they're describing, show one
     relationship — and the **diagram's state is saved** (which
     entities, positions, which fields are visible, layout). Multiple
     named diagrams per document.

### Reading / shared view
A clean full-screen read view: tag chips are clickable → entity detail
panel (shared with Browse); links listed; diagrams rendered (read-only,
expandable). This is the "click any reference to see its details" loop.

---

## Component reuse
- **Plate** (`platejs.org`) — the editor, with a custom inline node
  type for entity tags.
- **Entity-search typeahead** — the `@` dropdown *and* the "add tag"
  control reuse the same component as Browse's global search and the
  Visualize "add entity" picker.
- **Entity detail panel** — shared with Browse (tag click opens it).
- **React Flow** — the mini-diagram editor/renderer, the same engine as
  Visualize, in an embedded "scoped + state-saving" mode.

---

## States

| State | What |
|---|---|
| **No documents** | Empty state with a clear "New document" CTA |
| **New / empty document** | Editor with placeholder; tags/links/diagrams empty |
| **Document with tags** | Tag chips inline + in the tags panel; reverse-listed on Browse |
| **Tagged entity removed from Airtable** | Tag still shows, flagged "no longer in schema" (don't silently drop it) |
| **Multiple diagrams** | Named, reorderable; one expanded at a time |
| **Reading mode** | Tags clickable → panel; links + diagrams rendered read-only |

Preview via `?fixture=` — ask engineering for a fixture with a couple
of sample documents (tags + a saved diagram + links) to design against.

---

## Gating
- The Docs tab is a Data-Intelligence feature — likely **Pro+**
  (confirm tier with the capability matrix; AI generation within a doc
  follows the same 10-credit rule as elsewhere).
- Diagram export/embed, if offered from a doc, follows the same tier
  steps as Visualize export.

---

## Explicitly not this tab
- Not the per-entity descriptions (those are inline on Browse).
- Not the full Visualize editor — doc diagrams are *scoped, saved*
  mini-views, not the Space-wide canvas.
- Not write-back to Airtable.

---

## Notes for the designer
- The tag chip is the connective tissue of the whole Schema area —
  it's the same entity identity used by Browse, Visualize, and Docs.
  Make it instantly recognizable (type icon + name) and obviously
  clickable in reading mode.
- Plate gives you a lot (slash commands, blocks, markdown). Keep the
  surface restrained to match the utility-admin tone — direct, dense,
  no decorative blocks. The point is documenting a schema, not a
  publishing tool.
</content>
