# Port spec — redesigned multi-panel Schema drawer → production

Port the approved prototype (`research/multi-panel-drawer/prototype.html`, served `/prototypes/multi-panel.html`)
into production `apps/web/src/components/schema/EntityPanel.astro`. This is a real product change ported back
to the Baseout monorepo, so **every element must be built from the design-system catalog** and **nothing that
exists today may be lost**. Grounding audit lives in this conversation; key file map below.

## Locked decisions (do not re-ask)
- **FULL REPLACEMENT** of the shipped parent-child "Anchor+Focus, cap 2" model with the independent-tabs model.
  Rewrite the storybook `pattern-multi-panel-drawer` entry to match.
- Work directly on **`main`**, committing in small reviewable increments (this repo is a designer mirror, not
  deployed). Do **NOT** merge/PR. Do **NOT** touch standing excludes: `.claude/hooks/*`, `.claude/settings.json`,
  `package.json` (ds-lint), the `apps/web/public/images/auth-bg.png` deletion.
- Panel cap = **5**. Include the responsive **AUTO-ACCORDION** (#10).
- Include the **SPACE level**: add a synthetic `space` entity to `apps/design/src/fixtures/schema-lab.ts` +
  `buildEntityIndex` (`apps/web/src/components/schema/schemaEntities.ts`) so drill is Space→Base→Table→Field.
  Do not fabricate other data.
- **View in Airtable** uses `airtable.com/{baseId}/{tableId}/{fieldId}`, ids from fixtures, `// TODO` +
  placeholder where an id is missing.
- Section-nav trigger: reconcile to the documented **≥4** sections. Master-detail highlight → a light **"opened"
  marker** on the source row when opening beside.

## Behaviors to achieve (each demonstrated with a Playwright screenshot you read back)
1. Independent tab-like panels opening from the right over the Browse table (strip stays clickable); each closes
   independently (no parent-child cascade).
2. **Preview + Pin**: a plain row click reuses ONE transient "preview" panel; Pin (top in-panel "Preview — … /
   Pin to keep" bar, ⌘/Ctrl-click, the ⧉, or the picker) makes it permanent and the next click opens a fresh
   preview beside. Preview cue = italic title; focus = accent brow across the panel top.
3. **"+" Compare-with picker**, HYBRID: scoped to the focused panel's base by default with an "All bases" toggle,
   plus a Suggested Enter-default (current table "all fields" / whole base). **REUSE `EntitySearch.astro`
   (`pattern-entity-typeahead`)** — do not hand-roll a new typeahead.
4. **Open-beside**: hover ⧉ button on reference/field rows AND ⌘/Ctrl/middle-click → new panel beside; plain
   click drills in place. Shortcut shown in the tooltip (daisyUI `tooltip-left`, not native `title`).
5. **Drill Space→Base→Table→Field** inside a panel with a clickable location breadcrumb + back.
6. **Per-panel Compare toggle** (columns icon in each field-panel header): ≥2 on → highlight only the attributes
   that differ across that chosen set. Replaces any global diff.
7. **Reorder** panels via a ⠿ grip in the header (live sortable swap).
8. **Collapse-to-rail**: a panel parks to a ~46px vertical strip (icon + vertical name + a ✕ close at the top)
   via a header button OR by dragging it narrower than the floor; click the strip to expand.
9. **Left control rail** (＋ add + open-count) at the leftmost drawer's left edge; no top bar.
10. **AUTO-ACCORDION** (responsive): capacity C = floor(availWidth / minExpandedWidth) expanded slots; panels
    beyond C auto-park to strips; clicking a strip expands it and parks the least-recently-focused expanded
    panel; recompute on window resize. Demonstrate at ~1280px width.
11. **"View in Airtable"** button on base/table/field panels (and the automation/interface read drawers).

## MUST PRESERVE — re-verify each still works after the rewrite (NOT in the prototype; easy to lose)
- Dual Airtable/Internal description system: source tabs, Draft→Publish write-back with confirm + stale warning,
  AI Generate, autosave-on-nav, a11y announce.
- Progressive section-nav (trigger ≥4), scroll-spy, click-lock.
- Referenced-by (B8), back-references (B3), cardinality + backlink (A6), per-entity Changelog (C4), Options,
  stat tiles.
- Removed/deleted read-only entity banner; cross-tab handoffs (`data-ep-doc` / `ref-auto` / `ref-iface` / `chat`
  closing panels + dispatching to other tabs).
- Width persistence (`localStorage ep-w-*`), mobile single-column collapse, `astro:after-swap` re-wire guard.
- Leave intact and OUT of scope: `RelationshipPanel` (`.rl-`), the separate Automations/Interfaces `ui/Drawer`
  read/edit drawers, the quick-ask chat dock (`.scd` in SchemaView) — except adding #11's button.

## Design-system (non-negotiable — THE SEQUENCE)
Build only from the catalog (`apps/design/src/lib/storybook.ts`). Reuse `pattern-detail-panel` (480px canon,
row-list container, +N more, section count = `badge-sm badge-neutral`) INSIDE each panel, plus `location-crumbs`,
`entity-chip`, `EntitySearch`, `Drawer`, `tabs`, `badge`/`alert`/`button`/`tooltip`/`toast`. **Author a NEW
storybook entry FIRST** (before building it) for each element with no catalog coverage: control rail,
collapse-to-rail strip, reorder handle, auto-accordion, preview/pin, View-in-Airtable button. Rewrite
`pattern-multi-panel-drawer`. Rules: Lucide-only icons; badges soft + semantic (no `*-outline`; dot for standalone
status); sizing floor SM/12px (no `*-xs`, no ~10px; buttons default `md`); colours via `var(--color-*)`/`color-mix`,
no raw hex/rgb; 4px spacing grid; daisyUI `tooltip` not native `title=`; hints = soft `alert` + icon. `ds-ok` on a
line only for a justified exception. `.ep-`-prefixed classes in `<style is:global>` (bodies are innerHTML-injected).

## Key files
`apps/web/src/components/schema/EntityPanel.astro` (controller `makePanel`/`wireEntityPanel`; replace anchor/focus
with a `panels[]` array), `schemaEntities.ts` (`buildEntityIndex` — add `space`), `apps/web/src/views/SchemaView.astro`
(mount + entry points), `apps/design/src/fixtures/schema-lab.ts` (+ space fixture), `apps/design/src/lib/storybook.ts`.
Entry points to keep working: `schema:openEntity` event + `[data-entity-open]` delegate; all 8 tabs open via one of
those. Automations/Interfaces/Relationships open EntityPanel via those too.

## Exercise surface
`/panels` (Panel Lab) + `/schema` against `schema-lab.ts`. Dev: `corepack pnpm@11 --filter @baseout/design dev`
→ http://localhost:4332 (http, not https). Typecheck: `cd apps/design && node_modules/.bin/astro check`.

## Sequencing
1) #1 independent-panels model (risky core; preserve `makePanel`'s body/description machinery unchanged).
2) #2 preview/pin + #9 control rail. 3) #4 open-beside + #3 picker (reuse EntitySearch). 4) #8 collapse then
#10 accordion. 5) #7 reorder, #6 per-panel Compare, #11 View-in-Airtable, #5 Space level. Author/rewrite the
storybook entries before each element. Exercise via `/panels` + `/schema`; gate on `pnpm ds-lint` + `astro check`.

## Verify, don't trust
Drive the real app and READ the PNGs; a green exit code is the gate, not your say-so. If a behavior can't meet a
DS rule, STOP and flag it rather than going bespoke.
