# Schema drawer panels — multi-panel navigation research + prototype

**Status:** Research + interactive prototype only. **Nothing here is wired into `apps/web` yet.**
This folder is the handoff for whoever ports the interaction into the real app.

**Branch of origin:** `feat/drawer-stacking` (will be deleted after merge — everything needed lives here).
**Date:** 2026-07-07.

---

## The problem

In the Schema section (`apps/web` — `SchemaView` / `EntityPanel`), clicking a schema entity
(Table, Field, Relationship, Automation…) opens a right-side detail drawer. The schema is a
dense reference graph: a field references many others and is referenced back by automations,
formulas, rollups, lookups, pages. Following one thread spawns another.

**Goal:** let a power user open several related entities at once, navigate between them, keep
context, arrange them, and resize them — the way Airtable's expanded-record panels work. Driven
by two client (Dan) videos analysed here.

## What's in this folder

| File | What it is |
|------|-----------|
| `prototype.html` | **The deliverable.** A self-contained, clickable prototype of the final interaction, built on a faithful mock of the real Schema **Browse** interface. Open in any browser. |
| `index.html` | Research report — the **6-paradigm design survey** (peek, pinned stack, resizable tile, tabs, Miller columns, canvas) with a layered recommendation and **inline source links**. |
| `video-airtable-multipanel.html` | Analysis of Dan's *"Resizable multi-panel sidebar navigation inspired by Airtable"* video, with extracted screenshots. This is the video that defined the direction. |
| `video-field-detail.html` | Analysis of Dan's *"Formula Field Display and Reference Handling"* video (field-detail-panel feedback: back-references, worst-case data, truncation). Adjacent context. |

> Source videos were in the user's `~/Downloads/` (may not persist). The screenshots are embedded
> in the two `video-*.html` reports.

## The prototype: what it does (open `prototype.html`)

Click a field row in the table → a **full-height, non-modal overlay drawer** opens on the right.
The table stays **fully visible and clickable** behind it (no scrim/dimming). Every drawer's body
matches the real `EntityPanel` (breadcrumb, Health box, Airtable/Internal description tabs, synced
lines, Configuration/Formula/Lookup/Rollup, References with typed rows, Referenced-by, Changelog,
Documentation).

Drilling a reference row opens **another panel**. Two layout modes, switchable via a **small icon
toggle** in the active (rightmost) panel's header (Lucide `columns-2` = side-by-side, `copy` = overlap):

### Mode A — Side-by-side (default)
- Panels sit next to each other, all **live** (click references in any panel to drill).
- **Each panel independently resizable** via a grip on its left edge.
- Widths **auto-fit**: shrink proportionally so a strip of the table always stays visible.
- **Balancer button** (blue circular `move-horizontal` icon) on hover of the **leftmost** panel,
  at its top-left edge:
  - **Click** → equalise panels **50/50** (splits current total evenly).
  - **Drag** → resize **both** panels **proportionally** (scales total, preserves ratio).
  - Click-vs-drag disambiguated by a 3px move threshold.

### Mode B — Overlap · Airtable
- All panels **pinned to the right edge**, **z-stacked** (newest on top).
- The top panel **covers** the content of the ones below; lower (older) panels are **wider** so they
  **peek on the left** (min `STEP` = 100px).
- **Each panel resizable**. Widening the top panel **auto-stretches the lower panels** so the 100px
  peek is always preserved — cascades down the whole stack.

Shared: `✕` closes a panel (and any to its right); `Esc` closes the last; theme toggle (dark/light)
in the sidebar; both themes styled.

### Key constants (in `prototype.html`)
`DEFW=468` (default panel width) · `MINW=300` · `TABLEGAP=110` (min table strip in side-by-side) ·
`STEP=100` (min peek / cascade step in overlap). All easy to tweak.

## Research summary (full detail + sources in `index.html`)

Three independent research passes (dev-tools/terminals, web/canvas apps, Mobbin) **converged on one
insight — "Preview vs Pinned"**: most panels are transient (glance & discard while following
references); only a few are worth keeping. This defeats the clutter trap of "just open everything".

**Paradigm verdicts:** Peek (Linear/Notion) = the base layer we already have · Pinned stack
(Roam/Qatalog) & Resizable tile (Airtable/VS Code) = High fit · Closable tabs (Salesforce) = low-novelty
alt · Miller columns (Finder/Attio) = for linear drills · Spatial canvas (Heptabase/Miro) = **rejected**
for a read-only tool (structure is authoritative; canvas adds friction without meaning).

**Honest gap:** no shipping B2B tool combines "pin + arbitrary side-by-side" as one product — this is a
composition of individually-proven primitives, which is why it was prototyped before committing to build.
Airtable's resizable side-by-side records + VS Code editor groups are the closest shipped precedents.

**Web feasibility (for the port):** resizable docked splits, zoom, pin-state, keyboard focus = cheap
(`react-resizable-panels` / Allotment exist). Free-floating windows, tear-off, saved-workspaces = expensive
— avoid/defer.

## Decisions locked

- Non-modal, full-page-height, right-side overlay; table stays live behind.
- Two modes: **Side-by-side** (default) and **Overlap · Airtable**, user-switchable via the header icon toggle.
- Side-by-side: per-panel resize + balancer (50/50 click, proportional drag).
- Overlap: right-pinned z-stack, older panels peek ≥100px, top-resize auto-stretches lowers.

## Open knobs / follow-ups for the port

- Default mode (currently side-by-side) and whether to persist the user's choice.
- Peek size (`STEP=100`) and table-gap (`TABLEGAP=110`).
- Whether the balancer should sit on the **divider between** panels instead of the left edge.
- Overlap: whether clicking a lower panel's peek should **raise it to front** (not implemented).
- Max visible panel count before folding older ones.

## How to port (next agent)

The real target is `apps/web/src/**` — the `EntityPanel` component and the `SchemaView` that hosts it.
This prototype is **presentational reference only** — do not copy its markup verbatim.

Follow the repo's DS discipline (see root `CLAUDE.md`): build from the catalog (`apps/design/src/lib/storybook.ts`),
Lucide-only icons, spacing on the 4px grid, colours via `var(--color-*)` tokens, and the task is not done
until `pnpm ds-lint` and `pnpm typecheck` are both green. If a multi-panel container isn't in the catalog,
add a `storybook.ts` entry first (consider `react-resizable-panels`/Allotment for the split mechanics).

See the auto-memory note `research-drawer-multipanel-navigation.md` for the full decision trail (revisions 1–6).
