# OUR-TREE-STATUS — design audit vs `apps/web`

**Branch:** `autumn/cursor-ui-implementation-test` · **Census date:** 2026-08-20  
**Companion:** [`openspec/changes/web-design-audit-convergence/census.md`](../../../openspec/changes/web-design-audit-convergence/census.md) (ship-order narrative).

**Instrument rules:** `/usr/bin/grep -a` for quoted counts; device-metrics for viewport claims; computed values for responsive fixes.

**Audit source:** restored from commit `32b936e4` (`web-ui-sync-promotion` Stage-1 sync). Was not on this tip until Phase 12 checkout.

---

## Ship-order (41) — verdict counts

| Verdict | N | Items |
|---|---|---|
| already-satisfied | 18 | 1–7, 9, 10b, 15b, 17, 23, 28, 30, 36½ (+ prior auth/focus/wireRowKeys) |
| owned-by-\<change\> / skip | 3 | 11→automations · 19→sync-reconcile · 20→support(Q#6) |
| outstanding | ~20 | 8, 12–16, 18, 21–22, 24–27, 29, 31–35, 37–41 (several partial) |

See `census.md` for per-item evidence (file:line).

---

## Already-verified samples (task 1.3) — re-checked this census

| Claim in proposal | This tree |
|---|---|
| Item 3 fixed at `settingsCatalog.ts:166` | **FALSE** — `:166` is account-email `readOnly`. Space category still always emitted (`:258-328`). **outstanding.** |
| Item 4 fixed (all four sites) | **PARTIAL** — Sources/Dest/Reports/`list-row` fixed; `BackupsListView.astro:217` + `RestoreHistoryView.astro:167` still `?? statusMeta.cancelled`. |
| Item 9 fixed (`toneDotOf`) | **TRUE** — `lib/reports/view.ts:71-73` + `ReportBodyKpi.astro:238`. |
| Item 5 outstanding (no `left`) | **FALSE** — `PanelHost.astro:688` has `left: 0` + `pointer-events: none`. **already-satisfied.** |

---

## Re-census notes (task 1.4)

| Audit claim | Our-tree check |
|---|---|
| Item 26: 19 of 25 header constructions (not 18/24) | Confirmed directionally — vessel path has `aria-sort` (`Table.astro`); hand-built tables still lack it. Full 19/25 file ledger deferred to item-26 PR. |
| Item 29: 8 Escape sites (not 5) | Confirmed: `escapeStack` exists but Drawer (`:84`), SchemaView, inbox-client, IntegrationsSetupWizard, DataBrowse local handlers still compete. |

---

## S1 register (74) — disposition by ship item

Every S1 in `REGISTER.md` / findings rides a ship-order item or a delegated change. Disposition is inherited from the ship-order table in `census.md`. Highlights:

| S1 / cluster | Verdict | Evidence / owner |
|---|---|---|
| S36-F1 / S36-F3 | already-satisfied | auth.css + Layout.astro · `web-auth-convergence` |
| S36-F2 · S24-F9 · X13… | already-satisfied (auth half) | LoginView showFormError · connect deck still open |
| S32-F1 | already-satisfied | settingsCatalog spaceCategory(!space) |
| X08-F5 / X08-F8 | already-satisfied | Backups+RestoreHistory metaOf |
| X-M3 | already-satisfied | PanelHost.astro:688 |
| X08-F7 | already-satisfied | toneDotOf |
| X06-F1 | already-satisfied | panelStack focusPanel |
| X06-F2 | already-satisfied | Drawer aria-modal=false |
| X10-F1/F2/F3 | owned-by-web-automations-interfaces-tabs | no ConfirmModal on delete |
| S32-F2 / S32-F8 | owned-by-support | Q#6 |
| S25-F1 / S25-F2 | already-satisfied | registryEditMode + ?name= |
| X07-F5 / X07-F9 | already-satisfied | wireRowKeys |
| X-M16 | already-satisfied | 0 btn-md |
| X-M17 / toolbarFit | already-satisfied | toolbarFit wrap measurement |
| D15-gated (S25-F4 struct, S25-F12, X01-F2 component, X01-F1/F5 residue) | deferred | `decisions/15-one-table.md` still DEFERRED — task 8 hard gate |

---

## Progress log

| Date | Closed | Notes |
|---|---|---|
| 2026-08-20 | Census | `census.md` + this file. Item 5 struck (already fixed at PanelHost:688). |
| 2026-08-20 | Items 3, 4, 10b, 15b, 36½ | Settings `spaceCategory`; Backups/RestoreHistory `metaOf`; Drawer `aria-modal=false`; Running→primary; Clear filters drop `text-error`. |
| 2026-08-20 | Items 2, 7, 23 + vessel starts | `registryEditMode`; `?name=`; Alert vessel + Schema→Data; EmptyState Data; DocsTab `setButtonLoading`; Home `--t-12` glyph. Outstanding ~20. |
