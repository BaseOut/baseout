## Status

IN PROGRESS — census complete; early ship items landing. Umbrella over the design audit's 41-item ship order ([`apps/design/audit/SHIP-ORDER.md`](../../../apps/design/audit/SHIP-ORDER.md)) as it applies to **our** tree.

**Live worklist:** [`census.md`](./census.md) · [`apps/design/audit/OUR-TREE-STATUS.md`](../../../apps/design/audit/OUR-TREE-STATUS.md).

The vessels landed with `2bb5b46a`; the **adoption sweeps did not**. Several S1s also landed independently, so **task 1 is a census, not a fix** — see [`design.md`](./design.md) D1.

**⛔ Task 8 is a hard gate.** Nothing in tasks 9+ starts until `D15` is answered in writing.

Delegated elsewhere (struck here, tracked there): items 1 + 6 → [`web-auth-convergence`](../web-auth-convergence/) · item 11 → [`web-automations-interfaces-tabs`](../web-automations-interfaces-tabs/) · item 20 → [`support`](../support/) · items 12/16 Reports halves → [`web-reports-page`](../web-reports-page/) · item 19 → `/sync-reconcile`.

**Census corrections to proposal samples:** item 5 already-satisfied (`PanelHost.astro:688`); item 3 was NOT fixed; item 4 was partial.

---

## 1. Census (blocking — no fix lands before this)

- [x] 1.1 Produce `apps/design/audit/OUR-TREE-STATUS.md` + `census.md`: one row per ship item with verdict ∈ `already-satisfied` / `outstanding` / `never-applied-here` / `owned-by-<change>`, **each with evidence**.
- [x] 1.2 Used `/usr/bin/grep -a` for quoted counts.
- [x] 1.3 Re-verified samples: item 3 **outstanding** (no `:166` guard); item 4 **partial** then closed this session; item 9 fixed (`toneDotOf`); item 5 **already-satisfied** (`PanelHost.astro:688` `left: 0` + `pointer-events: none`).
- [x] 1.4 Re-census notes recorded: item 26 ≈19/25; item 29 Escape ledger still multi-owner despite `escapeStack`.

## 2. Item 5 — `.ph-panels` gets a width (do this first; it is also the fork delta)

- [x] 2.1–2.4 **Already on this branch** — `PanelHost.astro:668-689`. Struck with evidence; no re-fix.

## 3. A11y — the four real defects

- [x] 3.1 **Item 10a** — focus enters the overlay. Already on branch (`panelStack.ts` `focusPanel`).
- [x] 3.2 **Item 10b** — `Drawer` `aria-modal="false"` (was `"true"` twice). Landed this session.
- [x] 3.3 **Item 17** — `wireRowKeys` already landed.
- [ ] 3.4 **Item 29c** — Escape stack adoption incomplete (Drawer + others still bespoke).

## 4. Item 8 — the gate walks states, not labels

- [ ] 4.1 `smoke.mjs` only — **never-applied-here** (no smoke.mjs in apps/web). Outstanding.
- [x] 4.2 DataBrowse NUL-byte — **already fixed** on this branch (0 NUL bytes).
- [ ] 4.3 D17 empty-state verification still blocked on smoke/fixture gate.

## 5. Vessel adoption — batched by surface family (Schema → Data → Backups/Restore → Reports → registries)

- [x] 5.1 **Item 13 — `Alert` adoption, scope A (Schema→Data start)** — vessel restored + DataBrowse `showAlert`, BrowseTab/mediaReadBody/Retention/SourceAdd. Registries/Backups/Reports still open → continues under 5.2.
- [x] 5.2 **Item 13 — scope B (registries + Backups)** — Sources/Dest (+ detail ConfirmModal), BackupRunDetail/Base on Alert. Reports/Home/Settings + wizard switch-confirm remain → residue.
- [x] 5.3 **Item 14 — `EmptyState` adoption (Data + Backups/Restore)** — 46ch; Data gates/tabs; BackupsListView + RestoreHistoryView (+ action slot). Registry `.reg-empty` left deliberate.
- [ ] 5.4 **Item 15 — `Badge` as the only path** — vessel present; **banned soft+neutral → ghost** (Inbox ×4, Won't retry ×2). Full raw-class sweep still outstanding.
- [x] 5.5 **Item 15b — `Running` is PRIMARY (blue)** — landed this session (`list-row.ts`, Backups/Restore/Run detail views).
- [x] 5.6 **Item 35 — `setButtonLoading` (DocsTab)** — DocsTab Save/Delete/New converged. Other one-offs remain (track under residue / follow-up).
- [ ] 5.7 **Item 21** — connect wizard Alert — **partial**: cleanup schedule + BaseSelectionTable; `.switch-confirm` / `.bases-reset-note` remain.
- [x] 5.8 **Item 16 — cancel failure toast** — `postCancelRun` toasts on !ok/throw; UndoToast mounted on run detail + history widget.
- [x] 5.9 **Item 29 — Escape (Drawer + wizard)** — `pushEscape` on Drawer + wizard drawer-shell. inbox/Schema/DataBrowse remain.

## 6. Tables, toolbars and headers

- [ ] 6.1 **Item 26** — nine header constructions become one; sortable cells become real `<button>`s with `aria-sort` (**both are 0 tree-wide today**); Schema Health drops `aria-hidden` from its column band. Batch: Schema (six of twelve files) → Data → Home. Use the re-censused 19-of-25 figure.
- [ ] 6.2 **Item 27** — `[data-sort-col]` moves off the element name so a grid head can carry it; Health, Docs and Interfaces sort by header and their toolbar sort menus delete.
- [ ] 6.3 **Item 28** — **already-satisfied on this branch** (`toolbarFit.ts` content-wrap measurement; permanent-narrow threshold fixed). Confirm with screenshot at 1440 if product-visible wording returns — otherwise strike.
- [ ] 6.4 **Item 24** — the lead cell of all twelve clickable rows gains a real `<a href>`, restoring ⌘-click and new-tab on every list.
- [ ] 6.5 **Item 25** — the Record panel's trail becomes clickable (one file, independent); then the breadcrumb component gains its first consumer and the 25-page `getBreadcrumbs()` pipeline is either painted or deleted.

## 7. Sweeps with no vessel

- [x] 7.1 **Item 18 — Home `.hm-conn-badge` glyph** — `var(--t-12)`; badge box stays 1rem (open Q2). Wizard/global residual rem icon sizes still open.
- [x] 7.2 **Item 22** — `refineFacetIcons` `BY_CONCEPT` base/table/field delegate to `entityIconClass` (`concept-ic-table` on the table glyph). Restore muted-vs-concept-green note still stands as the colour half.
- [ ] 7.3 **Item 31** — the twenty glyph bypasses collapse onto `entityIcon`; the six in-file twins delete.
- [ ] 7.4 **Item 33** — `fmtRelative` adoption, plus `fmtCount` in `lib/` as a sibling of `time.ts`. The locale half is **smaller than it looked**: not a date bug but a thousands separator pinned in 13 places and floating in 45. Sweep the five shared files first — `tablePager.ts` alone (4 calls, 15 importers) corrects the pager total on every paged table. **Do not "fix" the 14 `Intl.*` constructors: all 14 already pin `en-US`.**
- [x] 7.5 **Item 36 — Clear filters colour half** — `text-error` removed from benign Clear controls (Data/Backups/Reports/Restore/…); label/grammar residue still open.
- [ ] 7.6 **Items 32 / 34 / 39 / 40 / 41** — one page name · one narrow tier · `wireViewState` on Schema's nine + Data's three tabs (plus the listSheet's overlay mode) · the pager threshold on **four** of six unbounded tables (**two are inside D15 — do not touch until task 8 is answered**) · the catalog's eight stale facts · `D38`'s remainder: **`registryEditMode.ts` landed** (items 2/23); rename/links modules still open.

## 8. ⛔ HARD GATE — re-open D15 before anything in task 9

- [x] 8.1 Re-open `apps/design/audit/decisions/15-one-table.md`. **Deliverable: ACCEPT 2026-08-21** — decline binding `Table.astro`; the four rows stay D40 class residue, not a new vessel. Grid floors (item 6) unaffected.
- [x] 8.2 Recorded in the decision file (amendment 2026-08-21), not only a commit message.

## 9. Item 30 — review as a design change, not a cleanup

- [x] 9.1 **Already-satisfied** — **0** `btn-md` in apps/web. Decision amend / ConfirmModal ds-ok cleanup can ride a later tidy if desired.

## 11. Early S1s closed this session (ship order 3 / 4)

- [x] **Item 3** — `spaceCategory(!space)` + Create Space `trigger` in SettingsView (`settingsCatalog.ts` / `.test.ts`).
- [x] **Item 4** — BackupsListView + RestoreHistoryView → neutral `metaOf` / `statusUnknown` (no more `?? statusMeta.cancelled`).

## 12. Closed this session (ship order 2 / 7 / 23 + vessel starts)

- [x] **Items 2 / 23** — `lib/registry/registryEditMode.ts` + Source/Destination detail wiring.
- [x] **Item 7** — `?name=` on list hrefs, Connect returnTo, detail page override.
- [x] **Item 13 (start)** — D42 Alert vessel restored; Schema→Data showAlert/banners.
- [x] **Item 14 (Data wins)** — EmptyState on Data gates/tab empties + 46ch.
- [x] **Item 35 (DocsTab)** — `setButtonLoading` on Save/Delete/New.
- [x] **Item 18 (Home glyph)** — `.hm-conn-badge .iconify` → `var(--t-12)`.

## 13. Closed this pass (scope B + toast + Escape)

- [x] **Item 13 scope B** — Alert on registries + backup run banners + BaseSelectionTable + wizard cleanup.
- [x] **Item 14 Backups/Restore** — EmptyState (+ action slot).
- [x] **Item 15 banned-pair batch** — Inbox + Won't retry → `badge-ghost`.
- [x] **Item 16** — cancel failure toast.
- [x] **Item 29 (Drawer + wizard)** — `pushEscape`.
- [x] **Item 21 (partial)** — cleanup + picker; switch-confirm remains.

## 10. Verification

- [ ] 10.1 `pnpm --filter @baseout/web audit:components` exit 0 after **every** phase, not only at the end.
- [ ] 10.2 `typecheck` + `test:unit` + `build` green per phase; no stray `console.*` / `debugger` (§3.5).
- [ ] 10.3 Any phase that changes rendering: <375 / <768 / <1024 plus the specific width the audit names for it (1440 for item 28, ≤964 for item 29, 844×390 for the shell).
- [ ] 10.4 `OUR-TREE-STATUS.md` updated as each item closes — with evidence. This file is the change's real progress record.
- [ ] 10.5 Item 19's spec corrections are pushed UP via `/sync-reconcile`, **not** edited here (they are the designer's docs; editing them locally would make this change multi-app — §3.6).
