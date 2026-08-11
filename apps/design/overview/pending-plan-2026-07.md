# Pending work plan — 2026-07 batch

Consolidated plan for the changes Dan requested (backup review video + Slack) and the
two OpenSpec changes he committed (`e7904e1`). **Status: build ON HOLD** — Oleh is still
gathering changes; this is the plan we execute step by step once given the go.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done.
Source of truth = the `openspec/changes/*` specs + memory (`research-backup-schedule-scope`,
`open-questions-for-client` Q7–Q10, `decision-schema-section`).

---

## EPIC 1 — Backup schedule/scope restructure (Dan's video, 2026-07-01)

**Goal:** rebuild the Options backup config so what's backed up is driven by three DEPTH
toggles, and Schema gets its own schedule box that can be tied to or split from the data
schedule. Replaces the shipped `b062ffc` (scope radio-cards) model.
Files: `components/backups/BackupScheduleScope.astro` (+ `CadencePicker.astro`),
`IntegrationsConfigureView.astro`, `IntegrationsSetupWizard.astro` step 4.

- [x] **1.1 DEPTH → three toggles.** Schema (always on) · **Record data** (checkbox) · Attachments (checkbox). Independent. ✓ verified.
- [x] **1.2 Remove the "Schema + Data / Schema Only" radio cards.** Schedule now driven by the depth checkboxes.
- [x] **1.3 Dynamic data-box title.** "Data & attachments" / "Data" / "Attachments" backup. Box hidden unless Record data OR Attachments on. ✓ verified all 3 titles.
- [x] **1.4 Schema backup = its own box + tie checkbox.** Label = **"Same schedule as the data backup"** (Oleh's pick), CHECKED by default → greyed read-only preview "Runs with the data backup · {cadence}". Unchecked → own cadence picker + hint + warn. ✓ verified.
- [x] **1.5 Schema-only conditional.** No data box, no tie checkbox; schema cadence direct. **Cleanup ladder keys off schema cadence** (via the hidden [data-frequency] mirror) — ✓ verified (Monthly→Daily on going schema-only).
- [x] **1.6 Applied to BOTH** — wizard step 4 + ConfigureView (folded depth+schedule into one self-contained component). `.tabs.astro` variant is DEAD (not imported) → left as-is.
- [~] **1.7 storybook `pattern-backup-schedule-scope` updated** to the new model ✓. **OpenSpec `backup-schedule-and-scope` spec.md still to update** (deferred — do with the commit).

**✅ COMMITTED+PUSHED 2026-07-01 as `ea84c95`.** Ships TWO layout variants for Dan (`?sched=a|b`): A=horizontal (What|Schedule cols, data-first), B=integrated (schedule in each layer block); both with a toggle tie + dynamic noun. astro check 0, browser-verified (both/data-only/attachments-only/schema-only; tie/untie; cleanup re-key). AFTER DAN PICKS: delete loser + switcher; finalize storybook + openspec spec.md.

---

## EPIC 2 — Visualize multi-mode (Q8, host for the graph modes)

**Goal:** the Visualize tab gets an internal **mode menu** so all visualization lives in one
tab. Relationships tab stays as the table listing. Extensible ("more options to come").
Files: `views/SchemaView.astro`, `components/schema/SchemaCanvas.tsx`.

- [x] **2.1 Mode switcher on the Visualize tab** (segmented Data/Relationships in the canvas toolbar), Data = default. Automations & Interfaces slot = Epic 4.
- [x] **2.2 Data mode** = the current ER diagram, unchanged.
- [x] **2.3 Relationships visual mode** — table-level nodes (Oleh's pick) + typed relationship edges (colour by RelType, cardinality label, direction ↔, inferred dashed / invalid muted); node click → shared EntityPanel.
- [x] **2.4 Per-mode filter sets + re-render on mode switch** (Data: Field types/Fields/Relationships; Relationships: Relationship types).
- [ ] **2.5 (confirm w/ Oleh) tab label** — kept "Visualize"; Dan called it "Visual". Minor, deferred.

Built 2026-07-01, UNCOMMITTED, astro check 0, browser-verified. **Fixed a React Flow "Maximum update depth" loop** = a fresh `[]` default in the Canvas signature changed identity every render → re-fired the re-layout effect. Fix = a module-level stable `EMPTY_REL` default (reusable gotcha). Decision locked: **3 modes total** (Data · Relationships · Automations & Interfaces) — Q9.

---

## EPIC 3 — Automations & Interfaces tabs (manual entry)

**Goal:** two new Schema tabs to hand-enter + list Automations and Interfaces (Airtable's
API doesn't expose them). Spec: `openspec/changes/automations-interfaces-tabs/`.
New files: `SchemaAutomations.astro`+`.ts`, `SchemaInterfaces.astro`+`.ts`; reuse Browse
entity-search + shared EntityPanel + field icons + status badges + `setButtonLoading`.

- [ ] **3.1 Automations tab** — list grouped by `group` (collapsible), row = name · trigger type · status · tag count; Base filter.
- [ ] **3.2 Automations create/edit form** — required Automation ID + Name; optional trigger type + raw `definition` JSON (validated); Table/Field tag-picker.
- [ ] **3.3 Interfaces tab** — Interfaces with child Pages nested beneath each.
- [ ] **3.4 Interfaces create/edit form** — Interface ID + type (`interface | page`); `page` requires a parent-interface picker; name + tag-picker + raw JSON.
- [ ] **3.5 Soft-delete rendering** — muted + "removed from Airtable" badge + include-removed toggle (consistent with Relationships).
- [ ] **3.6 Bidirectional tag surfacing** — entity's tagged Tables/Fields = clickable badges → sidebar; on Browse, a Table/Field shows the automations/interfaces tagging it. `auto` vs `manual` distinguishable; only `manual` removable; removed-target tag → warning badge.
- [ ] **3.7 Below-Growth upsell** empty state (instead of listing/form).
- [ ] **3.8 Loading spinners** on every create/edit/delete (`setButtonLoading`).
- [ ] **3.9 Wire into SchemaView** (tab order: Browse·Visualize·Relationships·**Automations**·**Interfaces**·Changelog·Health·Docs·Chat) + fixtures + storybook.

---

## EPIC 4 — Visualize "Automations & Interfaces" graph mode

**Goal:** the 3rd Visualize mode — a graph of the app layer on the shared table/field
substrate. Spec: `openspec/changes/visualize-automations-interfaces/`.
**Depends on** Epic 3 (captured entities) + Epic 2 (mode-menu host; has a self-contained
toggle fallback). Extends the existing React Flow island — no second island.

- [x] **4.1 Register the mode** — third entry in the `.rl-modes` switcher (Data · Relationships · **Automations & Interfaces**), same React Flow island. ✓ verified.
- [x] **4.2 Node model** — automation/interface/page = neutral card + coloured accent + type chip + Lucide icon (Fibery pattern); table = compact card; field = chip w/ Airtable field-type icon. ✓.
- [x] **4.3 Three edge kinds** — `references` (amber solid) · `reads` (blue dashed) · `triggers` (violet animated) — colour+dash+arrowhead+inline label; faint `contains` connector; legend keys nodes+edges. ✓.
- [x] **4.4 Filters + collapsing** — Bases + Node-types facets; **Expand fields** toggle (fields collapse under their table by default → edge docks to table w/ field name on label; expanded → field chips). ✓ verified both.
- [x] **4.5 Removed entities** muted + "Removed from Airtable" badge behind **Include removed** toggle. ✓ verified (Old lead-scoring / Forecast archived).
- [x] **4.6 Node click → shared detail** — table/field → EntityPanel (`schema:openEntity`); automation/interface/page → its tab + read drawer (`schema:openAutomation`/`openInterface`). ✓ verified (Sync-new-contact opened the drawer).
- [x] **4.7 States** — harness passes the automations/interfaces fixtures (stand-in for `entity-graph`); empty → points to the tabs; below-Growth → upsell (canvas overlay off `genState`). ✓.

**✅ BUILT 2026-07-01, UNCOMMITTED.** astro check 0/0/0, browser-verified all states. Research: Mobbin (Supabase/Vercel table-container + Fibery type-chip + Jira/Relevance edge-styles + one-chip legend==filter). Added `triggers?: string[]` to SchemaInterface (captured page→automation links) + 2 fixture links. Storybook `pattern-schema-app-graph`. Deferred: mobile breakpoints spot-check.

---

## EPIC 5 — Schema IA / tab-density grouping (deferred, non-blocking)

**Goal:** Schema is heading to ~9 tabs. Don't ship flat long-term — group into clusters.
Our call to make; build tabs flat first, layer grouping once all 9 exist. See Q10.

- [ ] **5.1 Decide grouping** — clusters: Structure (Browse·Visualize·Relationships) · App layer (Automations·Interfaces) · History/QA (Changelog·Health) · Knowledge (Docs·Chat).
- [ ] **5.2 Pick the pattern** — visual group-dividers in the tab bar · primary tabs + "More" overflow · or a 2-level sub-nav.
- [ ] **5.3 Implement + verify** once density is real.

---

## Suggested build order

1. **Epic 1** — independent (Backups area); can go anytime.
2. **Epic 2** — establishes the mode menu + Relationships visual mode (host for Epic 4).
3. **Epic 3** — the two manual-entry tabs (Epic 4 needs their entities).
4. **Epic 4** — the graph mode, consuming Epic 3's data, hosted by Epic 2's menu.
5. **Epic 5** — IA grouping once all tabs exist.

## Open questions to send Dan (fixed for later, per Oleh — not blocking)
- **Q9** — confirm 3 combined viz modes (we're going with the spec).
- Backup restructure box **titles/labels** (Epic 1.3).
- Q8 tab label **Visualize → Visual?**

## Cross-cutting per task
Design-system-first (build from /styleguide; add a storybook entry before bespoke) ·
typecheck (astro check) clean · browser-verify each state · fixtures in `apps/design` ·
update the relevant `openspec/changes/*/tasks.md` · commit/push only when asked.
