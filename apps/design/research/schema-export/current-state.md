# What Baseout already ships (audit before designing)

Read from the code on 2026-07-10, not from memory. This matters: "add Export to the Schema tabs" is
the wrong framing. Three Export controls already exist, they disagree with each other, and all three
now disagree with the client.

## The three existing controls

| Tab | File | Trigger | Menu contents | Wired? |
|---|---|---|---|---|
| Changelog | `SchemaChangelog.astro:182` | `btn btn-sm btn-neutral` + chevron | menu-title "Changelog" → `CSV` · `JSON` | No — bare `<a>`, no href, no handler |
| Health | `SchemaHealth.astro:197` | `btn btn-sm btn-neutral` + chevron | menu-title "Health report" → `CSV` · `PDF` | No |
| Visualize | `SchemaCanvas.tsx:1390` | `btn btn-sm btn-neutral` + chevron | "Diagram" → `PNG` · `PDF`; "Data" → `JSON` · `CSV` | No |
| Browse, Relationships, Automations, Interfaces, Docs, Chat | — | none | — | — |

## Every one of them contradicts the client's answer

Dan, Slack (2026-07-08):

> Q1 — For all Browse, Relationships, Automations, Interfaces, Changelogs, export as **CSV** is
> sufficient. For Visualize, export as **image** is sufficient. For Health, Docs, and Chat, export as
> **PDF** (like a report style)
> Q2 — Yes, **keep filters with option to export all**

So:

- Changelog offers **JSON** — a format he did not ask for and which the earlier round marked
  "conditional". Offering it promises an implementation.
- Health offers **CSV** — he asked for PDF only.
- Visualize offers **PDF, JSON and CSV** on top of the image.
- Six of the nine surfaces offer nothing at all.

Every menu is a **format picker**, which is exactly the decision the client just removed. The work is
not "add export"; it is "collapse three divergent format pickers into one scope control."

## They also carry the same design debt the Inbox filter had

- `btn-neutral` triggers — the loudest button in a toolbar full of quiet facet filters.
- Hand-rolled `dropdown-content menu` markup with `menu-title`, rather than the catalog's
  `pattern-faceted-filter` construction (`ff-trigger` / `ff-panel` / `ff-group` / `ff-opt`) which now
  lives in `styles/components/facet-filter.css` and is shared by Schema, Backups and the Inbox.
- No catalog entry exists for an export control at all (`grep pattern-export storybook.ts` → 0).

Per THE SEQUENCE, the storybook entry has to be written before the component.

## Open gaps the client's answer does not close

These are design questions, not preferences. Each one changes what file lands on disk:

1. **Visualize → "image"**: the whole graph or the current viewport? Theme background baked in, or
   transparent? PNG or SVG? At what scale?
2. **Chat → PDF**: the open thread, or the whole chat history? Archived threads too?
3. **Docs → PDF**: the open document, or every document in the Space?
4. **Changelog**: is the date range part of "current filters"?
5. **Browse**: the Tree/Flat toggle — does it change the CSV, or is CSV always flat?
6. **Health**: one base's report, or every base in the Space? (The tab renders a card per base.)
7. Filename convention; tier gating (Chat is already Pro+); empty-result behaviour.
