# Schema · Tab 1 — Visualize

> Design this tab first. It's the most "wow", the most technically
> novel, and the clearest expression of "Baseout is more than a
> backup tool." Companion wireframe: `02-visualize-wireframe.excalidraw`.

The default tab. A **read-only schema diagram** of the Space's
Airtable structure: tables as nodes, linked-record fields as edges.
The goal is *faster to scan than navigating Airtable itself.*

---

## User goal

"Show me my data's structure visually." A power user who already
lives in Airtable wants a single canvas that answers: how many
tables, how they link, where the complexity is, which tables look
unhealthy — without clicking through Airtable base by base.

---

## Layout

A full-bleed **canvas** inside the tab body, with light chrome
floating on top:

```
┌─ Visualize ─────────────────────────────────────────────────────┐
│  [Base: Sales ▾] [+ filter]                       [ Export ▾ ]    │
│                                                                   │
│        ┌──────────┐         ┌──────────┐                          │
│        │ ● Leads  │────────▶│ ● Deals  │      ┌── side panel ──┐  │
│        └──────────┘         └────┬─────┘      │  Table: Deals  │  │
│                                  │            │  ● healthy     │  │
│        ┌──────────┐              ▼            │  12 fields     │  │
│        │ ● People │◀────────┌──────────┐      │  ───────────── │  │
│        └──────────┘         │ ● Notes  │      │  ▢ Name   text │  │
│                             └──────────┘      │  ▢ Stage  sel. │  │
│                                               │  ▢ Owner  link │  │
│                                  ┌─ minimap ─┐│  …             │  │
│                                  │  ▫ ▫  ▫   ││                │  │
│                                  └───────────┘└────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

### Canvas
- **Tables are nodes.** Linked-record fields are **edges** between
  the nodes (directional where Airtable's link is one-way).
- **Auto-arranged layout.** Hierarchical / linked-record groupings —
  not a hand-placed map. Users can pan/zoom but the initial arrange
  is algorithmic and stable.
- Pan, zoom, fit-to-screen. Built on **React Flow** (engineering's
  chosen library) — design within what a node-graph lib affords.

### Node anatomy (each table)
A compact card showing:
- **Health dot** — green / amber / red (mirrors the Health tab band).
- **Table name** (primary).
- **Field count.**
- **Record count** — *only when the Space has a dynamic backup*;
  schema-only Spaces show field count alone (see gating below).
- Selected state when clicked (the side panel opens for it).

Keep nodes dense and uniform — this is structural, not a dashboard
of mini-charts.

### Side panel (on table click)
Opens a right-side panel with the **full field list** for that table:
- Per field: **type icon**, field name, Airtable type, key settings
  (e.g. linked-to table, single/multi for selects).
- The field-type icon uses the **vendored Airtable icon set** in
  [`field-icons/`](field-icons/) — one icon per Airtable field type,
  `currentColor` so it tints to the row's text colour. See
  `field-icons/README.md` for the mapping and
  `field-icons/contact-sheet.html` for a preview.
- This is also where the **AI "Generate description"** action lives
  (see below).

### AI "Generate description" (Pro+, in scope)
Per field **and** per table, a way to generate a plain-language
description with AI:

- **Where:** an action on each field row and on the table header in
  the side panel (e.g. a small "Generate" / sparkle affordance that
  reveals on hover/focus, so it doesn't clutter the dense field list).
- **Empty vs filled:** if a field/table has no description, offer
  "Generate description." If it already has one, show the description
  with a quieter "Regenerate" affordance. The generated text is
  **saved back** to the schema's description (persisted), so design
  the read state too, not just the button.
- **In-flight:** the call is synchronous and may take a moment —
  show a loading state on the control (spinner, disabled), per the
  house loading-state rule. Don't block the rest of the panel.
- **Cost:** each generation **debits 10 credits**. Surface the cost
  before the user commits (e.g. on the button or a confirm), and
  handle the **insufficient-credits** state — route to the
  upgrade/credits affordance rather than failing silently.
- **Gating:** **Pro+.** Below Pro+, show the affordance as a locked
  upgrade prompt (consistent with the export-format gating pattern),
  not a dead control.
- **Tone:** the generated copy is a draft the user owns — frame it as
  "generated, editable," not authoritative. Allow edit/clear.

States to draw for this feature: no-description (generate), has
AI-description (regenerate/edit), generating (loading), error /
out-of-credits, and the Pro+ upgrade-locked state.

### Base filter (multi-base Spaces)
- A filter to scope the canvas to one or more bases.
- Single-base Spaces: hide it.
- Many-base Spaces: this is the primary way to keep the canvas
  legible — treat it as load-bearing, not a nicety.

### Minimap
- A small zoom-out "miniature" panel in a corner for orientation on
  large schemas. Standard React Flow minimap is fine.

### Export menu (tier-gated)
- **PNG** (Growth) · **SVG** (Pro) · **PDF** (Business) · **embed
  widget** (Enterprise). All rendered client-side from the graph.
- Formats above the user's tier render as upgrade affordances, not
  dead buttons.

---

## Visual direction

**References that hit the right note:** dbdiagram.io, Airtable's own
"Field overview" extension, Lucidchart ER diagrams.

**Avoid:** force-directed "network graph" aesthetics —
edges-everywhere, floating bubbles, organic blobs. This is
**structural, not topological.** Think entity-relationship diagram,
not social-graph.

Stay visually distinct from Airtable's consumer brand while using its
vocabulary. Density target Linear / Vercel / Plaid.

---

## Gating

- The tab itself: **Launch+** (also the pre-registration conversion
  hook — schema viz can render before sign-up/payment).
- **Record counts** on nodes require a **dynamic backup**; schema-only
  plans show field counts only. Design the node so the record-count
  slot can be absent without looking broken.
- **Export formats** step by tier (see above).
- **AI "Generate description"** is **Pro+** and costs 10 credits per
  generation (see the dedicated section above).

---

## States

| State | Canvas shows |
|---|---|
| No bases connected | Empty: "Connect Airtable to see your schema." |
| Connected, never backed up | "Schema appears after your first backup completes." |
| Single base, healthy | Clean diagram, mostly green dots |
| Many bases | Base filter does the work; canvas stays legible |
| Very large base (many tables) | Minimap + zoom matter; nodes stay compact |
| Unhealthy tables | Amber/red dots draw the eye; click → side panel → cross-link to Health tab for the why |

---

## Explicitly not this tab

- Not an editor — no drag-to-rename, no write-back to Airtable.
  (Layout auto-arranges; schema does not change.)
- Not a record browser — clicking a table shows its **fields**, not
  its rows. Row-level data lives in the Data view, not here.
</content>
</invoke>
