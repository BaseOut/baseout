# Schema — round 2 plan (Dan feedback 2026-07-01)

From Dan's Slack answers + his "things I'm realizing" list (see memory
`client-feedback-schema-round2-2026-07-01`). Round-1 (Epics 1–4: backup depth, Visualize
modes, Automations/Interfaces tabs, app-layer graph) is DONE + pushed (`4a6c99d`).

Legend: `[ ]` not started · `[~]` in progress · `[x]` done.
Source of truth = Dan's Slack (no committed OpenSpec for these yet — reconcile if he commits
specs later, per the read-client-commits-first rule).

**Locked decisions (Oleh, 2026-07-01):**
- Backup layout = **A** (horizontal / table view). Delete B + the `?sched` switcher.
- `definition` JSON = **conditional** (render only when a DB value exists; hide otherwise).
- Automation `group` → **replaced by Base**. Drop the `group` field; group by Base, **reusing
  the Browse tree nesting + visual** (Base ▸ items; interfaces keep Interface ▸ Pages under a Base).
- Graph stays **one combined mode** (Q2 resolved by Dan's own "automation connected to a page").
- Tab grouping = **greenlit** → the final epic.

---

## EPIC 1 — Confirmed cleanups (quick, zero ambiguity)

- [x] **1.1 Backup → A.** Deleted the B (integrated) variant + the `?sched` switcher + the
  `variant` prop + B-only CSS; A is the only layout. Storybook updated (toggle + horizontal).
  ✓ verified (Options step renders A; no switcher). openspec spec.md = follow-up.
- [x] **1.2 `definition` JSON conditional.** Removed the JSON input from BOTH create/edit forms
  (API-only, never hand-entered); read view shows a read-only JSON block **only when a value
  exists**; on edit the stored `definition` is preserved untouched. ✓ verified (JSON shows for
  "Notify owner", hidden for "Weekly pipeline", absent from the form).

---

## EPIC 2 — Base as the organizing axis (replaces `group`)

**Goal:** every automation + interface/page belongs to a **single Base** (required); listings and
sidebars group **by Base**, reusing the Browse tree's nesting + visual. Drop the `group` field.

- [x] **2.1 Data model.** `baseId` added (required) to `SchemaAutomation` + `SchemaInterface`;
  `group` removed. Fixtures assigned bases (+ 1 Marketing & 1 Operations automation, 1 Marketing
  interface for a multi-base demo). ✓
- [x] **2.2 Automations listing → group by Base.** Base-grouped collapsible sections (blue
  database concept-icon + base name + count), ordered by the bases prop. `data-base`=baseId
  (also fixes the base filter, previously mismatched). ✓ verified (Sales CRM/Marketing/Operations).
- [x] **2.3 Interfaces listing → Base ▸ Interface ▸ Pages.** Reworked to ONE bordered container
  per base (Browse-style) — base row on top, indented interface rows, deeper page rows, row
  separators, collapse at base + interface levels (Oleh: "put the base inside the card, collapsible
  like Browse"). Automations already had this container shape. ✓ verified (collapse + nesting).
- [x] **2.4 Create/edit form.** Required Base `<select>` replaces the Group field (both tabs); the
  page parent-interface picker is scoped to the chosen Base (re-scopes on base change). ✓
  (Tag-picker Base-scoping = minor follow-up; not blocking.)
- [x] **2.5 Read detail shows Base.** Read drawer meta line gains a base chip (blue database icon +
  name) for automations + interfaces/pages. EntityPanel "Referenced by" left as-is (a ref's base ==
  the entity's base — redundant). Storybook updated (group→Base + JSON-removed). ✓

---

## EPIC 3 — Automations & Interfaces enrichment (statuses · descriptions · subscribers)

**Goal:** flesh out the entities with the fields Dan named. Touches the same detail/form as Epic 2
(sequence after it, not in parallel).

- [x] **3.1 Automation On/Off status** — `enabled` (Active/Inactive), distinct from `removed`.
  Muted "Inactive" row badge + status dot in the read view + an Active toggle in the form. ✓
- [x] **3.2 Interface/Page Published status** — `published`; "Not published" row badge +
  Published/Not-published status in read + a Published toggle in the form. ✓
- [x] **3.3 Automation description → SINGLE Internal note** (Oleh 2026-07-02, revised from dual).
  Verified via Airtable docs (Context7): the API doesn't expose automations, so there's no
  syncable Airtable description — a second field would be manual double-entry. Collapsed to one
  `internalDescription`. Diverges from Dan's dual-tab ask → flagged for Dan. ✓
- [x] **3.4 Interface/Page = Internal-only description** — `internalDescription` (renamed from
  `description`); form field relabeled "Internal note", read shows it under an Internal-note label. ✓
- [x] **3.5 Automation email subscribers** — `subscribers[]`; email chip input (validate + add on
  Enter, removable), listed as mail chips in the read view. ✓ storybook updated.

---

## EPIC 4 — Relationships tab rework

**Goal:** Dan's corrections to the Relationships tab.

- [x] **4.1 Removed links → Changelog section.** The relationship detail now derives a **Changelog**
  (added/removed events with dates) from the per-link firstSeen/removedAt; removed links live here,
  not inline in the summary. ✓ verified.
- [x] **4.2 Dropped the redundant "Links" section** — the A↔B "Connects" pair IS the single primary
  link for linked/lookup/lastModified/synced; the generic Links list is gone. ✓.
- [x] **4.3 "Linked Fields" section** for **formula & rollup** — lists the referenced fields (same
  table) as click-through chips instead of repeating "source → field". ✓ verified (Weighted Value
  → Amount, Probability).
- [x] **4.4 Create/edit Synced Tables** — a "New synced relationship" toolbar button + an Edit
  action on every synced-view row open a right-Drawer form (Base · Synced table · Source table ·
  Note); save inserts the declared row (tree + flat, creating the base▸Synced-views group as
  needed) or replaces it on edit. ✓ verified (new insert + edit prefill).

---

## EPIC 5 — Changelog coverage for the app layer

**Goal:** the app-layer entities join the change history.

- [x] **5.1 App-layer changes in the Changelog list.** ChangelogEntry gained `entityKind`
  (automation/interface/page) + `entityName`; the feed renders base ▸ [concept icon] name (amber/
  violet/blue), the loc-link opens the automation/interface (tab + read drawer); status changes use
  the `config` type (e.g. "Automation turned off · Active → Inactive"). Filters/search/date work
  as-is. Fixtures added (added/renamed/removed/config across automations + interfaces + pages). ✓
- [x] **5.2 Changelog on their sidebars.** The automation + interface read drawers gain a
  Changelog section (this entity's own history, added/removed/renamed/config with dates), fed a
  slim per-entity changelog blob. ✓ verified (Weekly pipeline digest → "turned off").

---

## EPIC 6 — Navigation rework of the 9 Schema tabs (LAST)

**Goal (greenlit by Dan):** Schema is at 9 top-level tabs and growing. Keep every tab; add a
grouping layer so the bar stays scannable. (This is the former round-1 "Epic 5" / Q10.)

- [ ] **6.1 Cluster the tabs** — Structure (Browse · Visualize · Relationships) · App layer
  (Automations · Interfaces) · History & QA (Changelog · Health) · Knowledge (Docs · Chat).
- [ ] **6.2 Pick the pattern** — visual group-dividers in the tab bar · primary tabs + a "More"
  overflow · or a light 2-level sub-nav. (Research/propose before building.)
- [ ] **6.3 Implement + verify** across states + mobile breakpoints.

---

## Open confirmations for Dan (non-blocking — proceed on the defaults above)
- Base vs `group`: we're dropping `group` (Oleh's call — Base is the real axis; `group` was our
  manual-only field). Confirm Dan doesn't want a secondary sub-grouping.
- Automation Airtable description: confirm it's a stored edit/save copy, never pushed (no publish).

## Cross-cutting
Design-system-first (build from /styleguide; storybook entry before bespoke) · Drawer not Modal ·
SM/12px floor · astro check clean · browser-verify each state · fixtures in apps/design ·
commit/push only when asked.
