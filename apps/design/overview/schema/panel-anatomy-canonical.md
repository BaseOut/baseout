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

## Drawer canon v2 (2026-07-06 — BUILT, supersedes the header/width specifics below)

After the Stage-2 refactor the five detail drawers still visibly diverged (three mechanisms, four
widths, icon in body vs header, crumbs present-or-not, inconsistent section headers/footers/row
containers). Oleh's call: **harmonize IN PLACE** (no shared component — each file edited to match the
same tokens) so a user gets the identical drawer UX on Browse, Relationships, Automations, Interfaces
and Changelog. The locked tokens (these override the Stage-1 `H*`/`T1`/`S*` details above where they
conflict):

- **Width — ONE value:** every detail sheet is `min(94vw, 30rem)` (**480px**). EntityPanel keeps its
  optional wide/expand mode (900px); the other four have no expand.
- **Header — THE ONE canonical structure (2026-07-07). Every drawer is identical; only the PRESENCE of a
  field varies, never the order or the element used.**
  - **Row 1 (title rail):** `[back — EntityPanel only] · concept-icon tile (2rem, radius .55rem, bg base-200) ·
    entity NAME (~15px/650, ellipsis) · [expand — EntityPanel only] · close (btn btn-sm btn-ghost btn-square +
    lucide--x size-4)`.
  - **Row 2 (crumbs sub-row), inside the same `<header>`:** the LOCATION (Base ▸ Table ▸ … / Base ▸ parent) —
    the ONE shared **`location-crumbs`** element (`locationCrumbs()` builder + `.sb-crumb*` in global.css), a
    muted row of concept-icon + name segments joined by `›`. Ancestors only (the current entity is the title,
    never a repeated crumb); existing ancestors are clickable. Shown only where the entity has a location.
  - **[header border-bottom]**, then the body owns the scroll.
  - **First body element = the identity meta line** — one `.ep-title-meta` style everywhere:
    `[kind] · ● status(dot+label) · [trailing]`, muted, "·" separators at .4.
  - **Presence table** (the only variation): back/expand → EntityPanel only · crumbs → all where a location
    exists · kind-in-meta → shown when NAME≠kind (Browse/au/if), OMITTED for Relationship (its type is the
    title) · status → health (Browse) / Published (Interface) / Active-Removed (Automation) / Valid-Invalid-
    Inferred (Relationship) · trailing → `as of last backup` (entity drawers) / readable cardinality (Relationship).
  - *Outliers fixed 2026-07-07: the Relationship drawer used to put the meta IN the header and the crumbs as a
    separate row after it; Changelog kept its crumbs outside the header — both now follow Row1/Row2/first-body.*
  - **ONE header token set (2026-07-07, after the Impeccable critique — the four header CSS blocks were
    structurally aligned but drifted on padding/size/tracking):** header padding = **12px 16px**; **row gap
    (title → crumbs) = 8px** (was 4px — too cramped, Oleh 2026-07-07); title =
    **15px / 650 / letter-spacing -0.15px / line-height 1.2**; tile = 2rem / radius .55rem / base-200, glyph
    **opacity .8**; close × via `margin-left:auto`; identity meta line = `base-content/.65` with the
    "as of last backup" freshness at the SAME .65 (no extra dimming — it's the trust signal, must stay legible).
    These values are identical across `.ep-head` · `.sb-drawer-head` · `.rl-detail-head` · `.cl-detail-head`.
- **Identity meta line** = the first body element: `kind · STATUS soft-semantic chip · health chip (where
  it applies) · base chip`, in the `.ep-title-meta` style. The old Automations/Interfaces soft-badges row
  folds into this line.
- **Section headers** = the `section()` convention everywhere: leading SECTION_ICON concept icon +
  uppercase 11px/700 label + `badge badge-sm badge-neutral` count **only when count ≥ 2** (the lone "1"
  is suppressed). Sections separated by ~28px whitespace, **no divider hairline**.
- **Row-list container** = the shared `.ep-rows` recipe everywhere (1px base-300 border · color-mix
  base-200 45% fill · radius 11px · overflow hidden · rows hairline-split by 1px base-200). A 1–2-item
  list must sit inside it, never float (Automations Touches/Subscribers, Interfaces Touches were bare —
  now wrapped).
- **Footer** = read-only by default (EntityPanel / Relationship / Changelog have NO action bar; Changelog
  keeps its "Detected <date>" meta line). Automations + Interfaces keep Edit/Delete but through ONE
  identical standardized footer bar (border-top 1px base-200 · Edit = `btn btn-sm btn-neutral` + pencil ·
  Delete = `btn btn-sm btn-ghost text-error` + trash).
- **"Raw definition (JSON)"** (Automations/Interfaces) = identical `<details>/<summary>` disclosure in both,
  with a trailing **chevron that rotates on open** (the `+N more` affordance) so it reads as expandable.

### Identity model (2026-07-07 — the meta line + location, standardized on Browse)

The header/title tell the user WHAT and its NAME. Below that, a user must read — at a glance — its **status**
and **where it lives**, not a flat comma-list of cryptic tokens (the old `Interface · Published · Sales CRM`,
`Sales CRM · m:1 · invalid`). Locked with Oleh:
- **Location → the crumbs sub-row** (Base, or Base ▸ Table ▸ … / Base ▸ parent-interface for a page). The
  base is NEVER a chip in the meta line. The catalog `Drawer` hosts this via a `[data-sb-drawer-crumbs]` hook.
- **Identity meta line = `kind · STATUS · trailing note`** — kind label kept everywhere (Interface / Page /
  Automation / Lookup / Table / relationship type), consistent with Browse.
- **STATUS = a colored DOT + label**, never a soft badge (a badge reads as a button/tag). Same treatment as
  the Browse health chip. Color map: **green** = Published / Active / Valid / Healthy · **amber** = Draft /
  Paused / Could improve · **red** = Invalid / Not published / At risk / Removed · **grey** = Inactive /
  Unknown. (Soft badges still belong in LISTING table cells — the dot+label is for the detail meta line.)
- **Trailing note** = `as of last backup` on the entity drawers (Browse / Automations / Interfaces) — honest
  (all Schema is a read-only post-backup mirror) and the explanatory touch Oleh liked.
- **Cardinality (Relationships)** = a READABLE label — "Many-to-one" / "One-to-many" / "One-to-one" /
  "Many-to-many" — with the compact token (`m:1`) as a daisyUI tooltip. It takes the trailing slot; the
  relationship meta reads `● Valid|Invalid · Many-to-one` (the type is already the title, so it isn't repeated).

Every inline **entity reference** (Touches · Connects · Linked fields · referenced-by · doc/chat/insight
refs) is the ONE shared **`entity-chip`** — built by `entityChip()` (markup) + `styles/global.css`
(`.sb-chip*`), never a per-surface hand-rolled pill. Neutral soft pill; variants =
clickable / static / removable / derived. A **chip GROUP never floats bare** — it sits in the same shared
bordered container as a row list (Connects · Linked fields · Touches all boxed). The `derived` variant is a
**quiet muted pill (never dashed)** and appears only in the edit form; read views show plain chips.

**Inferred (synced-view) relationships** read as ONE coherent context: the identity meta shows `● Inferred`
(a primary/info dot, not the valid/invalid dot), and the provenance explanation + the **Confirm / Dismiss**
actions live together inside a single `alert-soft alert-info` **inference card** ("Inferred — best guess" +
copy + the two buttons) — so the buttons are obviously the action for *this* inference, not orphaned.

Storybook authority: `pattern-detail-panel` (+ the drawer-footer, status-dot, disclosure-chevron notes) and `entity-chip` in `storybook.ts`.

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
4. **Progressive section jump-nav — BUILT (2026-07-07).** An Airtable-style horizontal chip-strip of the
   panel's section names, rendered as the **THIRD header row — inside `.ep-head`, ABOVE its border** (part
   of the fixed header, so it stays put while the body scrolls), shown **only when the panel has ≥ 4
   top-level sections** (progressive — shorter panels hide it). Each top-level section carries a stable
   anchor id (`ep-sec-<slug>`) + a small `scroll-margin-top`; a chip click scrolls `.ep-body` (never the window) to that
   section, and a scroll-spy (`IntersectionObserver` rooted on `.ep-body`, rebuilt every re-render) marks
   the top-most visible section's chip `.is-active`. Selectors: `.ep-secnav` / `.ep-secnav-chip` /
   `.is-active`. Storybook: [`panel-section-nav`]. Resolves the (b.4) fork's "ship only if it earns its
   keep" — it does, gated behind the ≥ 4-section threshold. *(Dan A5.)*

---

## (c) Count-badge alignment + section-divider / heading rules

- **Section heading:** uppercase label (`~11px`, weight 700, letter-spacing `.05em`, dimmed) — kept.
- **Section separation:** adjacent top-level body sections are separated by **generous whitespace, NOT a
  divider line** (Oleh 2026-07-06 — the hairline ladder got busy once panels grew many sections). Give each
  section a comfortable top margin (~28px in EntityPanel; ≥24px elsewhere); no `border-top` rule. Sub-items
  indent UNDER their parent section and never sit at the parent's level (Dan A2 hierarchy bug). *(This
  supersedes the earlier hairline-divider decision; the row-list CONTAINER borders stay — those group data,
  they are not section dividers.)*
- **Count badge:** a small **catalog `badge`** (`badge-sm badge-neutral`) **pressed right after
  the section name** (Oleh 2026-07-06 — a badge reads as a count and is easier to parse next to its label
  than a far-right float; `badge-xs` is below our SM sizing floor so use `badge-sm`). Same treatment for every
  counted section + Referenced-by group sub-header (Relationships · Changelog · Documentation · Referenced by ·
  Children · Options · Formulas/Rollups/Lookups/Automations/Chats). *(Supersedes the earlier right-align
  decision — the "references to 2" ambiguity is gone once it's a distinct badge pill.)*
  **Show the badge only from 2 upward — suppress the lone "1"** (Oleh 2026-07-06): a count of 1 is self-evident
  from the single row directly below, so a "1" badge is noise (and read as disabled/faint). Applies to both the
  section badge and the Referenced-by group sub-headers.

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
