# Canonical panel anatomy — Schema detail panels

**Stage 1 of 2** (analysis + spec; no code changed). The Stage-2 refactor aligns the 5 Schema
detail panels to this canon and folds in Dan's 2026-07-06 video backlog
([[client-feedback-fields-sidebar-2026-07-06]]).

**Why:** three different panel shells exist today (a custom `EntityPanel`, the shared `ui/Drawer`,
and hand-rolled `.rl-detail` / `.cl-detail` / `.scd` overlays). A user should read any detail panel's
hierarchy "in half a second" (Oleh) and every panel must degrade gracefully under high-volume data
(Dan: a formula can reference 50 fields; a description can be a paragraph; a changelog can be huge).

**Scope:** the 5 Schema-family panels only —
1. `EntityPanel.astro` (anchor) · 2. `RelationshipPanel.astro` (`.rl-detail`) ·
3. Automations read-drawer (`#au-modal`, `ui/Drawer`) · 4. Interfaces read-drawer (`#if-modal`, `ui/Drawer`) ·
5. Changelog entry detail (`.cl-detail`) · + the quick-ask chat drawer (`.scd`).
Modals (confirm/create/connect) are OUT. Backups/Setup panels are a later pass on this same canon.

---

## (a) Canonical ordered slot list + presence rules

Every detail panel renders these slots in THIS fixed order, top→bottom. **Presence rule:** a slot that
does not apply is **omitted entirely** (no empty placeholder) — EXCEPT the two slots marked *invite*,
which render an actionable empty state. A slot that DOES apply always sits in its canonical position, so
the panel never reshuffles between entity kinds.

**Fixed header rail** (never scrolls):
- `H1` Back (shown when stack depth > 1)
- `H2` Breadcrumb trail (structural: Base ▸ Table ▸ Field)
- `H3` Expand / shrink toggle
- `H4` Close (×)

**Title block** (scrolls with body):
- `T1` Type/kind icon tile · name (+ `Primary` badge) · type sub-label

**Status band** (conditional):
- `S1` Removed / error banner (only when the entity is removed or load failed)
- `S2` Metric strip — Records · Fields · Health tiles (only the tiles that apply)

**Body sections** (owns scroll; each present-only, in this order):
1. `B1` **Descriptions** (Airtable · Internal tabs) — *invite* empty
2. `B2` **Configuration** (formula / looks-up / rolls-up)
3. `B3` **Relationships** — the unified section: links-to · linked-from · looked-up-by · rolled-up-by ·
   referenced-by, each row = entity · **type** · **direction**. *(Stage-2 expands field-level back-refs.)*
4. `B4` **Children** (Tables / Fields / Pages)
5. `B5` **Options** (field choice lists)
6. `B6` **Changelog**
7. `B7` **Documentation** — *invite* empty ("No documents reference this yet")
8. `B8` **Referenced by** — grouped by kind (Automations · Pages · Formulas · Rollups · Lookups · Chats).
   *(Stage-2.)*
9. `B9` **Tagged** — where tagged (doc / chat), with kind icons. *(Stage-2.)*

**Fixed footer rail** (conditional):
- `F1` Primary/secondary actions (Edit · Delete · Save · Publish). **Canonical rule:** destructive/edit
  actions live in ONE footer rail, not scattered inline. Read-only panels have no footer.

---

## (b) Large-data rules (the worst-case contract)

1. **Panel owns its own scroll.** The body region is `overflow-y:auto`; the header + footer are fixed
   rails. Scrolling over the panel NEVER scrolls the page/canvas behind it. *(All 5 panels already do
   this — it is now an invariant, not a per-panel choice.)*
2. **List cap + "+N more".** Any list section renders at most a threshold (default **5** rows; **3** chips
   for inline reference cells) then a **"+N more"** affordance. "+N more" expands inline OR opens a hover
   popover that lists the rest; each item is clickable. A formula that references 50 fields shows 3 + "+47
   more", never 50 rows. *(Dan A1/A5.)*
3. **Grow-to-max then inner-scroll for free text.** Long descriptions / notes grow to a max-height
   (~`40vh`) then scroll inside their own box — never push the panel. *(Dan A3.)*
4. **Optional sticky section jump-nav.** When the body exceeds a height/section-count threshold, an
   Airtable-style sticky sub-nav of section links may appear at the top of the body and scroll-jump to a
   section. Fork — see the doc's open questions; ship only if it earns its keep. *(Dan A5.)*

---

## (c) Count-badge alignment + section-divider / heading rules

- **Section heading:** uppercase label (`~11px`, weight 700, letter-spacing `.05em`, dimmed) — kept.
- **Divider:** a hairline `1px` `var(--color-base-200)` rule separates adjacent top-level body sections
  (today it is label-only spacing, which blends — Dan A2). Sub-items indent UNDER their parent section
  and never sit at the parent's level (Dan A2 hierarchy bug).
- **Count badge:** **right-aligned** to the trailing edge of the section header row, not inline 4px after
  the label. "REFERENCES 2" must not read as "references to 2" (Dan A6). Same treatment for every
  counted section (Relationships · Changelog · Documentation · Referenced by · Children · Options).

---

## (d) The ⚠ → info icon decision

Replace `lucide--triangle-alert` on the informational Airtable caption
("Shown to everyone in Airtable · the only synced copy") with **`lucide--globe`** (public / visible-to-all
connotation), tinted **neutral/info** (`var(--color-base-content)` dimmed), NOT warning amber. The Internal
caption keeps `lucide--lock`. **Reserve `lucide--triangle-alert` strictly for genuine problems** — the
publish stale-overwrite warning and broken-data changelog flags. This removes the false "something is
wrong" read (Dan A4). Lucide-only, catalog-safe.

---

## (e) Tooltip / notification conventions

- **Tooltips:** daisyUI `tooltip` everywhere; **never native `title=`** (EntityPanel has 2 native
  `title=` today — convert). Interface-rule already: no native `title=`.
- **Icon semantics (fixed vocabulary):** `lucide--triangle-alert` = real warning only · `lucide--globe`
  = public/synced-to-all info · `lucide--lock` = internal-only · `lucide--circle-check` (green) =
  synced/success · `lucide--sparkles` = AI-generated · `lucide--info` = neutral explainer.
- **Transient confirms:** a bottom-center toast (auto-dismiss ~2.4s), consistent across panels.
- **Draft/status:** soft semantic badges in the section heading (`badge-soft badge-warning` Draft, etc.),
  never `*-outline`.

---

## (f) Mapping table — 5 panels × canonical slots

Legend: ✅ present & canonical · ⚠️ present, needs-change (Stage-2) · — absent (correctly) ·
➕ absent, should ADD (Stage-2).

| Slot | EntityPanel | RelationshipPanel | Automations drawer | Interfaces drawer | Changelog detail | Chat drawer |
|------|:--:|:--:|:--:|:--:|:--:|:--:|
| H1 Back | ✅ | — | — | — | — | — |
| H2 Breadcrumb | ✅ | ⚠️ (sub-line, not crumb) | — | ✅ (page only) | ✅ (Location) | — |
| H3 Expand | ✅ | — | — | — | — | ✅ |
| H4 Close | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| T1 Title+type | ✅ | ✅ | ✅ (drawer title) | ✅ | ✅ | ✅ (assistant) |
| S1 Removed banner | ✅ | ⚠️ (inline invalid) | — (status badge) | — (status badge) | — | — |
| S2 Metric strip | ✅ | — | — | — | — | — |
| B1 Descriptions | ✅ | — | ✅ (Airtable+Internal) | ✅ (Internal only) | — | — |
| B2 Configuration | ✅ | ⚠️ (Linked fields) | ⚠️ (Trigger) | — | — | — |
| B3 Relationships (unified) | ⚠️ (fwd only, ➕ back-refs) | ✅ (Connects) | — | — | — | — |
| B4 Children | ✅ | — | — | ✅ (Pages) | — | — |
| B5 Options | ✅ | — | — | — | — | — |
| B6 Changelog | ✅ | ✅ | ✅ | ✅ | (is the entry) | — |
| B7 Documentation | ✅ | — | — | — | — | — |
| B8 Referenced by | ⚠️ (flat, ➕ group+chats) | — | — | — | — | — |
| B9 Tagged | ➕ (Stage-2) | — | — | — | — | — |
| F1 Footer actions | ⚠️ (inline in Descriptions) | ⚠️ (inline Confirm/Dismiss) | ⚠️ (in-body foot) | ⚠️ (in-body foot) | — (read-only) | ✅ (composer) |
| Count badges | ⚠️ inline → right-align | — | — | — | — | — |
| Section dividers | ⚠️ label-only → +hairline | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ✅ (has dividers) |
| Panel owns scroll | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| List cap / "+N more" | ➕ none today | ➕ | ➕ | ➕ | — | — |
| daisyUI tooltip (not title=) | ⚠️ (2 native) | ✅ | ✅ | ✅ | ✅ | ✅ |

**Reading of the table:** scroll-ownership is already universal (keep). The gaps are: heading/divider +
count-badge alignment (all body panels), footer-action consolidation (Entity/Relationship/Automations/
Interfaces), list caps / "+N more" (all list-bearing panels), the ⚠→info icon + 2 native `title=`
(EntityPanel), and the Stage-2 additive slots B3 back-refs / B8 grouped referenced-by / B9 Tagged.

---

## (g) Proposed Storybook pattern (proposal only — add in Stage 2)

- **id:** `pattern-detail-panel`
- **name:** "Entity detail panel (canonical anatomy)"
- **shape:** fixed header rail (back · breadcrumb · expand · close) → title block → conditional status
  band → scroll-owning body of ordered present-only sections (uppercase label + right-aligned count +
  hairline divider; list sections cap at 5 + "+N more"; free-text grows-to-max then inner-scrolls) →
  conditional fixed footer action rail. Documents the icon vocabulary (d) + tooltip conventions (e).
- **guides / usageDo:** same slot order everywhere; omit absent sections; right-align counts; one footer
  rail for actions; `lucide--globe` for public-info (never `triangle-alert`); daisyUI tooltip never
  `title=`. **usageDont:** inline scattered actions; inline count badges; uncapped lists; warning icon on
  informational lines.

---

## Dan B2 backlog → home in the canon

| Dan B2 item (video) | Lands in |
|---|---|
| Section dividers (sections blend) | (c) hairline divider rule |
| Fix sub-item hierarchy | (c) indent-under-parent rule + (a) fixed slot order |
| Grow-to-max then inner-scroll (long desc) | (b) rule 3 |
| ⚠ → neutral info/globe icon | (d) `lucide--globe` decision |
| Right-align count badges | (c) count-badge alignment |
| Panel owns its scroll (bug) | (b) rule 1 (now an invariant) |
| Large-data theme (50 refs, huge changelog) | (b) rules 2 + 4 |

*(Dan's B1 "+N more" in the listing TABLE, B3 back-references, B4 Browse columns, B5 Tagged/Referenced-by
are Stage-2 build items; the panel-side homes for B3/B8/B9 are marked ➕ in the mapping table.)*

---

## Resolved fork decisions (Oleh delegated — 2026-07-06)

1. **Sticky section jump-nav** (b.4) — **YES, conditional.** Render the sticky section-link sub-nav ONLY
   when the body overflows a threshold (tall panel / more than ~4 sections). Short panels stay clean.
2. **"+N more" behaviour** — **hover popover with click-through.** Reuse the Tagged-hover pattern Dan
   liked (A11): the "+N more" chip opens a small popover listing the rest; each item is clickable to open
   its panel. Consistent hover behaviour everywhere a list is capped.
3. **Footer vs inline actions** — **hybrid.** ENTITY-level actions (read-drawer Edit/Delete) live in ONE
   footer rail. SECTION-level contextual actions (Descriptions Publish/Save/Generate, Relationships
   Confirm/Dismiss) STAY inline next to their target for proximity, but get a single standardized
   action-row style. Rationale: publishing a specific description must sit with that description; a global
   footer would divorce the action from its object. Consistency comes from the shared action-row style,
   not from relocating every action.

## Anti-fabrication note

Everything above renders data we already have EXCEPT the unified back-references (B3 looked-up-by /
rolled-up-by / formula-referenced-by) and grouped Referenced-by (B8), which need the **engine to invert
the forward reference graph** — derivable from Airtable metadata, not returned directly. Flag to the
Baseout engineer; do not fabricate the reverse edges in the mirror (stub with fixtures only, labelled).
