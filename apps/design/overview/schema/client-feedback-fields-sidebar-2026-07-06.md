# Client feedback — Entity detail sidebar (formula display & reference handling)

**Source:** Dan Fellars screen recording `Formula Field Display and Reference Handling.mp4`
(10:51, 1080p, narrated). Recorded to expand on the **4th item** of his Slack message
("For fields sidebar, there's a few things I'd like to see you experiment with… was easier
to create a video to discuss").
**Analyzed:** 2026-07-06 (offline video-vision: whisper.cpp transcript + frame extraction).

**Scope:** everything here is about the **right-hand entity detail panel** (`EntityPanel.astro`)
— the sidecart that opens when you click a field / table — plus two spill-overs into the
**Relationships listing table** (`SchemaRelationships.astro`) and the **Browse top-level table**
(`SchemaBrowse.astro`). It is Dan "thinking out loud through worst-case data", not a locked spec —
several items are explicitly "experiment and show me options".

The recording was made against the **live Cloudflare deploy** (`ui.baseout.dev/schema`), so it
reflects `main` as of the recording, i.e. the panel we shipped through round-3.

---

## Part A — Chronological walkthrough (walk the video with this open)

| # | Time | On screen | What Dan wants |
|---|------|-----------|----------------|
| A1 | 0:02–1:09 | Relationships tab; row **"Weighted Value → Amount / Formulas"**. The formula references **two** fields (`{Amount} * {Probability}`) but the list row shows only **Amount**. | In the **listing table**, a formula/rollup that references multiple fields should show **all** referenced fields on one row, cap at ~3, then **"+N more"**. Some formulas reference 50 fields → must not blow up the row. On **hover** of the cell → quick popover previewing the other referenced fields; **click** a field → open its panel. (This is the Slack item #3, now demoed.) |
| A2 | 1:10–2:00 | Panel open on **Amount / Weighted Value**. Sections DESCRIPTIONS · CONFIGURATION · CHANGELOG · DOCUMENTATION stacked with only faint labels. | **Section separation is too weak** — the sections "blend together". Add a clearer divider (a line between sections, stronger heading). Also a **hierarchy bug**: a sub-item (the formula/config detail) sits at the *same* visual level as its parent "Configuration" — nest it visually under Configuration. |
| A3 | 2:00–2:33 | Descriptions block in edit mode (textarea). | **Worst-case long content.** What if the Airtable description is a full paragraph? It should grow to a max height, then **scroll inside its own box** rather than pushing the whole panel down. |
| A4 | 2:34–3:00 | Pointing at the **⚠ warning-triangle icon** next to "Shown to everyone in Airtable · the only synced copy." | **Change that icon** — the ⚠ triangle reads as "something is wrong / there's a problem". It's just an informational "this is public" note. Use a neutral/info icon (e.g. globe/eye/info), not a warning. Also consider putting the two meta lines ("Shown to everyone…" + "Synced with Airtable") **on the same line** to save vertical space. |
| A5 | 3:01–4:14 | Same panel; talks about long formula (50 refs), long changelog. | **Worst-case for every section + in-panel navigation.** Design how each section behaves with a *ton* of data. Consider an **Airtable-style sticky sub-nav** across the top of the panel (Description · Configuration · Relationships · Changelog…) that scroll-jumps to a section. Fix scroll ownership: right now scrolling over the panel scrolls the **page/canvas behind it**; the **panel itself must own its scroll** once content overflows. |
| A6 | 4:15–4:38 | Pointing at the **"REFERENCES 2"** count. | The count badges next to section headers ("REFERENCES **2**", "CHANGELOG **1**") sit **too close to the label** and read like "references *to* 2". **Right-align the count** to the far edge of the section header to separate it from the label. |
| A7 | 4:38–5:21 | Browse; field-visibility filter set to show only rollups/lookups. Rollup **Pipeline Value** on Companies. | ✅ **Praise, keep as-is.** He confirms the **rollup type in the field-visibility filter** is exactly right: "I'd hide them all and turn that one on — that's how I look for rollups." Don't regress this. |
| A8 | 5:21–7:06 | Panel on **Company Industry / Lookup**: CONFIGURATION → LOOKS UP → Industry (in Companies, via Company). | **Back-references (reverse relationships).** Clicking a field currently shows only the **forward** direction ("this looks up Industry"). Dan wants the **reverse** too: "this field is **looked up by** X". Proposal: a single **Relationships** section in the panel that lists looked-up-by / rolled-up-by / referenced-by, each row showing the field **+ its relationship type** (lookup / rollup / formula). Group by type. |
| A9 | 7:06–8:07 | Same. | **Type + direction vocabulary.** Plain formula references belong in the same Relationships section (type = "formula reference"). Types: `formula reference`, `rollup reference`, `lookup reference`, plain `reference`. Distinguish **forward vs back** direction — maybe the same type icon **+ an arrow** pointing one way or the other. Goal: "quickly jump back and forth and see where it's referenced." (Direction-icon design = open, wants our proposal.) |
| A10 | 8:08–8:47 | Browse top-level table now shows columns NAME · TYPE · **LINK** · **CARDINALITY** · STATUS · TAGGED. | **Trim the top-level table.** The **LINK** and **CARDINALITY** columns aren't worth the width — they only apply to link/relationship fields, and you can see the link by clicking into the field. **Remove LINK + CARDINALITY from the top-level table**, keep **TYPE**; that frees room. |
| A11 | 8:47–9:43 | Hovering the **TAGGED** column → tooltip "Tagged in Sales CRM — how it fits together." | **Tagged column** is worth the freed space. A field can be tagged in a **doc** or a **chat** → show an **icon per kind**. He likes the hover preview. **Edge:** if tagged in **multiple** places, hovering should list **all** of them and let you **click through to any**. Maybe two kinds (doc/chat) shown distinctly. |
| A12 | 9:44–10:38 | Contacts panel scrolled: FIELDS · RELATIONSHIPS (LINKS TO / LINKED FROM) · DOCUMENTATION · **REFERENCED BY 1** (Sync new contact to CRM · Automation). | **"Referenced by" section, richer.** He likes that it scrolls (A3/A5 confirmed working here). Two options he floats for the *Referenced by* section: (a) **one flat list** of every place it's referenced, with an **icon telling how** (automation / page / formula / rollup / lookup); or (b) **grouped** by kind (Automations, Pages, Formulas, Rollups, Lookups). Also **include chats** as a referenced-by kind. |
| A13 | 10:38–10:49 | Wrap-up. | "Just thinking about **what we do if we have a lot of data** — think through those scenarios. Hopefully that's enough to get you going." → the whole video is a **worst-case / high-volume** stress-test of the panel. |

---

## Part B — Consolidated backlog (build from this)

Grouped by surface. Severity: 🔴 breaks/blocks · 🟠 real friction · 🟢 polish/praise.
Effort: S ≈ ½ day · M ≈ 1–2 days · L ≈ 3+ days. "Data" = where the values come from
(anti-fabrication check).

### B1 · Relationships listing table (`SchemaRelationships.astro` + `schemaRelationships.ts`)
- **B1.1 — Multi-field reference cell** 🟠 M. A formula/rollup row must render **all** referenced
  fields (not just the first), capped at ~3 chips + a **"+N more"** chip. *Data:* forward refs are
  already in the field config from the Airtable meta API — we currently only render the first.
- **B1.2 — Hover preview + click-through** 🟠 M. Hovering the "+N more" (or the cell) opens a small
  popover listing every referenced field; each is clickable → opens that field's panel. Reuse the
  Tagged-hover pattern (A11) so hover behaviour is consistent. *Do NOT duplicate rows per field —*
  Dan explicitly wants one row (Slack #3).

### B2 · Entity panel — structure & readability (`EntityPanel.astro`)
- **B2.1 — Stronger section separation** 🟠 S. Add a divider / heavier heading between DESCRIPTIONS ·
  CONFIGURATION · RELATIONSHIPS · CHANGELOG · DOCUMENTATION so sections stop blending. (A2)
- **B2.2 — Fix section hierarchy** 🟠 S. The config/formula detail must nest **under** its
  Configuration parent, not sit at the same level. (A2)
- **B2.3 — Long-description growth + inner scroll** 🟠 M. Description box grows to a max height then
  scrolls internally; never pushes the panel. Apply the same to any long section. (A3)
- **B2.4 — Replace the ⚠ "public" icon** 🟢 S. Swap the warning triangle for a neutral info/globe/eye
  icon on "Shown to everyone in Airtable · the only synced copy"; consider merging the two meta
  lines onto one row. *Catalog check:* Lucide only — likely `lucide--globe` / `lucide--eye` /
  `lucide--info`. (A4)
- **B2.5 — Right-align section count badges** 🟢 S. "REFERENCES 2", "CHANGELOG 1" etc.: push the
  count to the far right of the header so it stops reading as "references *to 2*". (A6)
- **B2.6 — Panel owns its scroll** 🔴 S/M. Scrolling over the panel must scroll the **panel**, not the
  page/canvas behind it, once content overflows. (A5) — bug, highest severity here.
- **B2.7 — In-panel section nav (experiment)** 🟠 L. Airtable-style sticky header of section jump-links
  across the top of the panel that scroll to each section; only earns its keep on tall panels.
  Propose + show Oleh before building. (A5)

### B3 · Entity panel — unified Relationships section w/ back-references (`EntityPanel.astro` + `schemaEntities.ts`)
- **B3.1 — One Relationships section for fields** 🟠 L. Fold looked-up-by / rolled-up-by /
  formula-referenced-by / plain reference into a **single Relationships table** in the field panel,
  each row = field · **type** (lookup/rollup/formula/reference) · **direction**. Table-level panels
  already do this (LINKS TO / LINKED FROM at 10:20) — extend the same idea to field level. (A8/A9)
- **B3.2 — Forward + back direction** 🟠 (part of B3.1). Show both "references → X" and "referenced by
  ← X". *Data:* forward is in the field config; the **reverse index must be computed by the engine**
  by inverting the reference graph across the base — obtainable, not fabricated, but needs the engine
  to emit it. Flag to the Baseout engineer. (A8)
- **B3.3 — Direction affordance (design fork)** 🟢 M. Distinguish forward vs back — proposal: shared
  type icon + a small directional arrow. Bring Dan 2 options. (A9)

### B4 · Browse top-level table columns (`SchemaBrowse.astro`)
- **B4.1 — Drop LINK + CARDINALITY columns** 🟠 S. Remove both from the top-level table; keep TYPE.
  The link relationship is visible on click-in. Frees horizontal room. (A10) — *note:* this walks back
  part of the columnar work from the 2026-07-03 round; confirm with Dan it's the listing table he
  means, not the sidebar.

### B5 · Tagged & Referenced-by (`SchemaBrowse.astro` + `EntityPanel.astro`)
- **B5.1 — Tagged column with kind icons** 🟠 M. TAGGED cell shows an icon per kind (**doc** vs
  **chat**). *Data:* doc tags exist (Docs @-tagging); chat tags exist (chat convert-to-doc / reference
  chips). (A11)
- **B5.2 — Tagged hover: list all + click-through** 🟠 M. If tagged in multiple places, hover lists
  every one and each is clickable to open it. Same popover pattern as B1.2. (A11)
- **B5.3 — Referenced-by: flat-with-icons OR grouped (fork)** 🟠 L. The panel's "Referenced by"
  section either (a) one list with a per-row kind icon, or (b) grouped by Automations / Pages /
  Formulas / Rollups / Lookups. **Include chats** as a kind. Bring Dan both. *Data:* automations/pages
  from captured Automations/Interfaces tags; formulas/rollups/lookups from the reverse index (B3.2);
  chats from chat references. (A12)

---

## Part C — Cross-cutting theme & open forks

**Theme (Dan's own summary, A13):** this is a **worst-case / high-volume stress test** of the entity
panel. Every fix should be validated against "what if there are 50 references / a paragraph
description / a huge changelog / tagged in 10 docs". Build with overflow, capping, and "+N more"
from the start.

**Forks to resolve before building (bring options, don't guess):**
1. **In-panel section nav** (B2.7) — sticky jump-nav yes/no, and only-when-tall?
2. **Direction affordance** (B3.3) — how to show forward vs back (icon+arrow vs separate sub-lists).
3. **Referenced-by layout** (B5.3) — flat-with-icons vs grouped-by-kind.
4. **B4.1 regression check** — dropping LINK/CARDINALITY partly reverses the 2026-07-03 columnar
   table; confirm scope (listing table vs panel) so we don't undo agreed work.

**Anti-fabrication note:** the reverse-reference graph (looked-up-by / rolled-up-by /
formula-referenced-by) is **derivable** from Airtable field metadata but is **not** a field the API
returns directly — the engine must invert the forward graph. Everything else (forward refs, doc/chat
tags, automation/page tags) is already obtainable. No invented data.

**Consistency note (from Oleh's Slack reply):** sidebars across the whole app should share one UX so
users read the hierarchy "in half a second" — so B2.1/B2.2/B2.5 should land as a **reusable panel
pattern**, not a Schema-only tweak. Candidate for a Storybook pattern entry once the shape is agreed.
