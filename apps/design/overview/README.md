# Overview — Diagrams

Five Excalidraw diagrams that explain what Baseout does and how the
pieces fit together. Open any `.excalidraw` file at
<https://excalidraw.com> (drag-and-drop) or in the Excalidraw VS
Code extension.

These are *companions* to the page specs in `../specs/`. The specs
describe individual screens; these diagrams describe the product as
a whole, so the screens have context.

---

## The diagrams

| # | File | What it explains |
|---|---|---|
| 01 | [01-what-baseout-does.excalidraw](01-what-baseout-does.excalidraw) | One-pager. Airtable → Baseout (Connection / Space / Engine) → your chosen destination (static or dynamic). Numbered footnotes walk through the lifecycle. Read this first. |
| 02 | [02-hierarchy.excalidraw](02-hierarchy.excalidraw) | How things nest: Organization → Spaces → Bases → contents. Side notes call out the key rules (one Connection serves many Spaces; each Space is one Platform). |
| 03 | [03-backup-config-flow.excalidraw](03-backup-config-flow.excalidraw) | The five steps a user walks through on the Integrations page to go from "empty Space" to "actively running backups." |
| 04 | [04-static-vs-dynamic.excalidraw](04-static-vs-dynamic.excalidraw) | The two backup output shapes. Files vs. database. When to pick which. (You can pick both.) |
| 05 | [05-what-gets-backed-up.excalidraw](05-what-gets-backed-up.excalidraw) | The three captured layers of an Airtable Base: Schema, Data, Attachments — plus metadata (automations / interfaces / comments). |

---

## Page build briefs

Deeper, page-specific briefs (overview + per-tab docs + wireframes)
live in subfolders here:

| Folder | What |
|---|---|
| [schema/](schema/) | **Schema page** designer brief — overview + one doc per tab (Visualize / Changelog / Health) and a wireframe `.excalidraw` for each. Start at [schema/README.md](schema/README.md). |

---

## How to view

**Easiest:** open <https://excalidraw.com> in a browser and drag
the `.excalidraw` file onto the canvas. It opens read-write; your
edits stay local until you File → Save.

**In VS Code / Cursor:** install the
[Excalidraw](https://marketplace.visualstudio.com/items?itemName=pomdtr.excalidraw-editor)
extension. `.excalidraw` files open as a native editor.

**Exporting to PNG/SVG:** in Excalidraw, File → Export → PNG (or
SVG). Useful for pasting into Notion, slides, or PRs.

---

## Editing the diagrams

You can edit any `.excalidraw` file directly in Excalidraw and
overwrite the file — they're plain JSON. If you'd rather change
something programmatically (rename a label across all five
diagrams, swap the color palette, etc.), edit
[generate.mjs](generate.mjs) and re-run it:

```bash
node overview/generate.mjs
```

This regenerates all five files from the script. Useful when you
want consistent styling — colors, fonts, arrow rules — across
diagrams without hand-editing each one.

> Re-running the script **overwrites** the `.excalidraw` files. If
> you've made manual edits in Excalidraw that you want to keep,
> either fold them into the script or stop running the script.

The script uses a small set of helpers (`rect`, `ellipse`,
`diamond`, `text`, `arrow`) and a deliberately restrained color
palette. If you want to add a sixth diagram, paste a new
`diagram06()` function next to the existing ones and add it to the
`outputs` array at the bottom.

---

## Where these fit in the design conversation

Use them as **shared vocabulary** when discussing the UI.

- "On diagram 02, that's the Connection box — the OAuth thing that
  feeds both Spaces."
- "Diagram 04 explains why the Integrations page asks the user to
  pick a destination."
- "Diagram 05 is why the Backup Settings card has three checkboxes."

You don't have to memorize them. You don't have to design *from*
them. They exist so when a question comes up like "wait, what's a
Space again?" — there's a picture.

---

## Companion docs

- `../specs/` — page-by-page design specs
- `../README.md` — repo-level readme (boot the preview app, push
  your work)
- `../apps/design/README.md` — design app's own readme (state
  variants, what's faked)
