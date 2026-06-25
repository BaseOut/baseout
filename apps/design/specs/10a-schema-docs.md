# 10a — Schema Docs (Browse + Docs tabs on `/schema`)

The **Schema Docs** feature: user-authored documentation about a
Space's Airtable schema. Two tabs on the Schema page — **Browse**
(read-oriented entity browser, surfaces per-entity docs) and **Docs**
(the authoring surface). Distinct from inline AI/imported entity
descriptions; this is rich, free-form documentation people write.

**Source:**
- Today: `apps/design/src/pages/schema.astro` (`PlaceholderView`)
- Once built: tabs inside `apps/web/src/views/SchemaView.astro`

**Layout:** `SidebarLayout` (Space-scoped). Sits beside Visualize /
Changelog / Health — see `10-schema.md`.

> Upstream design home: the `ui-only` repo (`overview/schema/`). This
> file is the working copy promoted into the monorepo.

**Storage / data path:** per-Space `bo_at_documents` /
`bo_at_document_tags` / `bo_at_document_links` / `bo_at_document_diagrams`.
All reads/writes are brokered by the engine; the browser talks only to
`apps/web` `/api/spaces/[spaceId]/*` proxy routes. PRD §3.7;
Features §1 (Document, Docs tab, Browse tab, Tag, External Link,
Mini-Diagram), §7 (tier gating).

---

## Purpose

Let a team capture the *why* behind their schema — conventions,
gotchas, ownership, runbooks — anchored to the actual Bases, Tables,
Fields, and Views, so the knowledge lives next to the structure
instead of in a scattered wiki.

---

## User goal

1. **"Write down what this table/field is for."** Author a Document,
   tag it to the entities it describes.
2. **"When I'm looking at a Field, show me what's been written about
   it."** Open an entity in Browse → its Documentation section lists
   the Documents that tag it.
3. **"Sketch how these tables relate, for this doc."** Embed a saved
   mini-Diagram scoped to the Document.

---

## Tab — Browse

A read-oriented browser of the captured schema.

- **Entity list/tree:** Bases → Tables → Fields → Views. Searchable.
  Each row: name, a type `Badge`, lifecycle status (active / removed).
- **Detail panel** (on select): reuse `EntityDetailHeader` +
  `DefinitionList` for the entity's facts — type, options, field/record
  counts, the imported Airtable description, and the *effective*
  description (`description_override ?? ai_description ?? description`).
- **Documentation section** (in the detail panel): every Document that
  Tags this entity, each a clickable `Badge`/row linking into the Docs
  tab. Each tag is removable here. A Tag whose entity was later removed
  from Airtable shows a warning `Badge` ("removed from Airtable") and is
  retained — never silently dropped.
- Empty: "No documentation yet for this {entity}. Write one →" linking
  to a new Document pre-tagged to this entity.

## Tab — Docs

The authoring surface.

- **Document list:** title, derived excerpt, tag count, updated-at.
  `EmptyState` when none. "New document" → `Modal` with a `TextInput`
  for the title, creating an empty Document.
- **Document editor:**
  - **Title** — `TextInput`.
  - **Body** — a Plate rich-text editor (`DocBodyEditor` island).
    Supports headings, lists, code, etc., plus an inline **`@`-tag**:
    typing `@` opens an entity picker; choosing one inserts an inline
    tag node *and* writes a `bo_at_document_tags` row (`added_via:
    'inline'`). The body persists as opaque JSON.
  - **Tags panel** — the entities this Document tags (added inline or
    explicitly via an "Add tag" entity picker, `added_via: 'manual'`).
    Removable here or from Browse.
  - **External Links** — a list of named URLs (`name` + `url`),
    reorderable; add/remove.
  - **Mini-Diagrams** — zero or more named, saved schema mini-diagrams
    (`DocDiagram` island, React Flow). Each is its own saved row; a
    Document may hold several. Add / rename / delete.
  - **Save** — one atomic save (title + body + tags + links + diagrams)
    through the proxy route. Use `setButtonLoading` on the save control.
- **AI affordance:** a "Generate with AI" control, shown **disabled and
  labeled "Soon"** for Pro+ tiers; absent below Pro. No request is made
  (deferred to `server-schema-ai-docs`).

---

## Tier gating

| Tier | Schema Docs |
|---|---|
| Trial, Starter | **None** — Docs tab shows an upsell `EmptyState`; Browse shows entities but no authoring |
| Launch, Growth | **Manual** — full authoring (body, tags, links, diagrams) |
| Pro, Business, Enterprise | **Manual + AI** — same, plus the (deferred, "Soon") AI affordance |

Gating is enforced server-side in the proxy routes (403 below Launch),
resolved from the cached Stripe tier — never product-name strings.

---

## States to design for

| State | What |
|---|---|
| **Below gate (Trial/Starter)** | Docs tab = upsell `EmptyState` ("Upgrade to Launch to document your schema") |
| **Entitled, no docs yet** | Docs tab `EmptyState` with a "New document" CTA |
| **Entity with no docs** | Browse detail Documentation section empty state |
| **Tagged entity removed** | Tag shown with a warning `Badge`, still clickable |
| **Long document / many tags** | Editor scroll + a compact tags/links/diagrams rail |
| **Pro+ AI** | Disabled "Generate with AI — Soon" control |

---

## Component reuse / governance

- daisyUI-first primitives: `Tabs`, `Card`, `Badge`, `Button`,
  `TextInput`, `Modal`, `EmptyState`; patterns `EntityDetailHeader`,
  `DefinitionList`.
- **Carve-out:** the rich-text editor (`DocBodyEditor`) and diagram
  canvas (`DocDiagram`) are React islands (`.tsx` under
  `apps/web/src/components/islands/`), hydrated `client:visible`.
  daisyUI provides neither a rich-text editor nor a node graph, so
  these are a documented exception to the Storybook/daisyUI-only rule
  (see `apps/web` component-governance §4.2 + `islands/README.md`).
  Style them with theme tokens; keep them scoped to `/schema` only.

---

## Out of scope here

- Auto-generated data dictionary + documentation **exports** (PDF /
  Markdown / Notion / Confluence) — V2 (PRD §3.7).
- AI generation of Document content — gated "soon"
  (`server-schema-ai-docs`).
- Write-back of documentation to Airtable — V2.
