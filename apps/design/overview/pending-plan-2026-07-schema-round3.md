# Schema — round 3 backlog (Dan / "fellars" feedback 2026-07-02/03)

Captured from Slack after Dan played with the round-2 build (table-style Automations /
Interfaces / Relationships + the `/schema-nav` navigation prototype). Two threads.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done.
Source of truth = Dan's Slack (no committed OpenSpec yet).
**STATUS: all items BUILT + browser-verified 2026-07-03 (UNCOMMITTED).** astro check clean.

---

## A. Navigation (Schema tabs) — DIRECTION CONFIRMED

Dan on the `/schema-nav` prototype:

- [x] **A1. Variant A wins — groupings are visual labels ABOVE each group, NOT tabs.**
  ("have the groupings just be the visual above each (and not tabs)"). This is exactly the
  Variant A we built (cluster label over each group's tab row). Variant B (two-level) is dropped.
- [x] **A2. Mobile: use the groupings AS tabs.** On the mobile breakpoint, turn the 4 clusters
  (Explore · App layer · Monitor · Knowledge) into tabs to aid small-screen navigation — the
  one place the tab treatment earns its keep.
- [x] **A3. Chat: keep the global Ask button + add "Chat History" under Knowledge.** Dan likes the
  global "Ask about your schema" launcher (opens the drawer). ADDITIONALLY, add a **Chat History**
  entry under the **Knowledge** group that brings up the **full chat page** (the expanded 3-column
  view). So: quick ask = global drawer; browse past threads / go full-page = Knowledge ▸ Chat
  History. (Oleg confirmed: "will add chat history".)

---

## B. Cross-tab table / filter / search UX (Automations · Interfaces · Relationships)

Dan wants the same table/filter/search UX across all schema tabs; Oleg agreed and is aligning them.

- [x] **B1. Sortable columns** — click a table header to sort asc/desc (toggle). Applies to the
  table views (Automations, Interfaces, Relationships).
- [x] **B2. Search bar on Automations + Interfaces** — they currently lack one (Browse/
  Relationships have it). Add a consistent search input to the toolbar.
- [x] **B3. Add Table + Field to the filter area on Automations + Interfaces** — today only a Base
  filter. Add Table and Field facets (filter by the tagged table/field), matching Browse's facets.
- [x] **B4. Filter dropdowns: Show all / Hide all keeps the menu OPEN** — selecting the bulk
  show/hide inside a facet dropdown should NOT close the menu (let the user keep adjusting).
  Applies to the shared FacetFilter component (so it fixes every tab at once).

---

## C. Relationships

- [x] **C1. Row click → open the primary FIELD's EntityPanel (field sidecart), not the custom
  relationship detail** — for **linked record, formula, rollup, lookup**. This reuses the Browse
  field sidecart (which already shows the field, its links, Linked Fields, etc.). For **synced
  tables**, keep the current relationship detail panel as-is (no single primary field to open).
  → Simplifies: one detail surface (the field panel) for the field-based relationship types.
- [x] **C2. Add a Rollup-type field to the fixtures/data set** — we're missing a rollup to review.
  Note the nuance Dan flagged: a rollup has **both** a relationship (like a lookup — it rolls up
  from a linked table) **and** a formula that can reference **other fields in the same table**. So
  a rollup row should exercise BOTH the primary link (A→B across tables) AND the Linked Fields
  section (same-table referenced fields). Make sure the fixture + detail cover that dual nature.

---

## Notes / sequencing
- B4 (FacetFilter Show-all-keeps-open) is a shared-component fix → do once, benefits every tab.
- B1/B2/B3 are the "same UX across tabs" push Oleg committed to — batch them per tab.
- C1 changes the relationship click target — verify the field sidecart already surfaces what the
  relationship detail did (Linked Fields, Changelog) so nothing is lost; if not, port those bits.
- C2 is a fixtures + possibly detail-logic change (rollup = link + same-table formula fields).
- Cross-cutting (unchanged): design-system-first · Drawer not Modal · SM/12px floor · Storybook
  badges for status · astro check clean · browser-verify · commit/push only when asked.
