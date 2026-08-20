# Census — our tree vs design-audit ship order

**Branch:** `autumn/cursor-ui-implementation-test`  
**Date:** 2026-08-20  
**Instrument:** `/usr/bin/grep -a` for all quoted counts. Audit tree restored from `32b936e4` (present on `web-ui-sync-promotion`, absent from this tip until re-checked out for Phase 12).

**Proposal claims corrected:** item 5 is **already-satisfied** (not outstanding). Item 3 is **outstanding** (claimed `settingsCatalog.ts:166` guard does not exist — that line is account-email). Item 4 is **partial** (Sources/Dest/Reports fixed; Backups + RestoreHistory still `?? cancelled`).

---

## Summary

| Bucket | Ship-order items (of 41) |
|---|---|
| already-satisfied (pre-session + this pass) | **18** — #1–#7, #9, #10b, #15b, #17, #23, #28, #30, #36½ + prior auth/focus/wireRowKeys |
| owned elsewhere / skip | **3** — #11 → automations; #20 → support (Q#6); #19 → sync-reconcile |
| outstanding | **~20** — Alert/EmptyState/Badge residue, Escape owner, lead cells, D15 gate, … |

S1 register rows: audit claims **74**. This census tracks them via the 41 ship-order items (each S1 rides an item or a delegated change). Full per-S1 table: [`apps/design/audit/OUR-TREE-STATUS.md`](../../../apps/design/audit/OUR-TREE-STATUS.md).

---

## Ship-order status (41)

| # | item | verdict | evidence |
|---|---|---|---|
| 1 | Auth shell scroll (S36-F1) | already-satisfied | `styles/components/auth.css` `.auth-layout` = `flex w-full` + `min-height: 100dvh`; `.auth-card` `margin-block: auto`. `Layout.astro` 390 floor. Via completed `web-auth-convergence` (18/18). |
| 2 | Cancel cancels (S25-F1) | already-satisfied | `lib/registry/registryEditMode.ts` — committed baseline; Cancel/Read/Escape discard. Wired from Source + Destination detail. |
| 3 | Settings invents Space (S32-F1) | already-satisfied | `settingsCatalog.ts` `spaceCategory(!space)` → "No Space yet" + `trigger: 'create-space'`; `SettingsView.astro` stamps `data-create-space`. |
| 4 | statusMeta fallbacks (X08-F5) | already-satisfied | All live sites use neutral unknown: Sources/Dest/Reports/`list-row` + `BackupsListView`/`RestoreHistoryView` `metaOf`. **0** `?? statusMeta.cancelled` left. |
| 5 | `.ph-panels` width (X-M3) | already-satisfied | `PanelHost.astro:668-689` — `left: 0` + `pointer-events: none`; children `pointer-events: auto`. Comment documents X-M3/D45. **Do not re-fix.** |
| 6 | Auth refusals (S36-F2…) | already-satisfied | `LoginView.astro:155,244-250` `showFormError`; Welcome via `welcomeForm.ts`. Connect 19-code deck remains separate residue. Via `web-auth-convergence`. |
| 7 | Rename after create (S25-F2) | already-satisfied | List `detailHref` + Connect `returnTo` carry `&name=`; detail pages prefer `?name=` override. |
| 8 | Gate walks states + NUL | outstanding (partial) | NUL: **fixed** (0 NUL bytes in `DataBrowse.astro`). `smoke.mjs` fixture gate: **absent** from apps/web — never-applied-here for the smoke half. |
| 9 | Neutral KPI dot (X08-F7) | already-satisfied | `lib/reports/view.ts:45-73` `toneDotOf`; `ReportBodyKpi.astro:223-238`. |
| 10 | Overlay focus + Drawer modality | already-satisfied (10a+10b) | Focus: `panelStack.ts` `focusPanel`. Drawer: `aria-modal="false"` (`Drawer.astro`). Escape ownership still item 29. |
| 11 | Automations/Interfaces confirm | owned-by-web-automations-interfaces-tabs | Delete fetch without `ConfirmModal` in `SchemaAutomations.astro` / `SchemaInterfaces.astro`. |
| 12 | Docs save + report exitGuard | outstanding (partial) | Report: `lib/exitGuard.ts` + `ReportDefinitionView` wired. Docs: Save exists; no `exitGuard`/`beforeunload`. |
| 13 | Alert vessel adoption | outstanding (partial) | D42 vessel restored (`Alert.astro` + `alert.ts` `showAlert`). Schema→Data: DataBrowse load error, BrowseTab gone, mediaReadBody, Retention/SourceAdd. ~92 `role="alert"` remain; registries/Backups/Reports still hand-rolled. |
| 14 | EmptyState vessel adoption | outstanding (partial) | `max-w-[46ch]` on vessel. DataView gates + DataChangelog/Comments/Media + SoonTab on EmptyState. Other families still open. |
| 15 | Badge only path + Running primary | outstanding (15b done) | Vessel exists. **15b Running→primary landed** (`list-row.ts` + Backups/Restore/Run views). Raw badge class sweep still open. |
| 16 | Double-submit + failed-action toast | outstanding | Cancel swallows errors (`lib/backups/cancel-button.ts:85-88`). `undoToast` exists, not wired. |
| 17 | wireRowKeys | already-satisfied | `lib/wireRowKeys.ts` + importers incl. `Table.astro`. **D15 hard gate still unanswered** in writing. |
| 18 | Sub-12px icons | outstanding (partial) | `.hm-conn-badge .iconify` → `var(--t-12)` (badge box stays 1rem — open Q2). Wizard / global residual rem sizes remain. |
| 19 | Spec doc corrections | owned-by-sync-reconcile | Designer's docs; push UP via `/sync-reconcile`, not edit here (§3.6). |
| 20 | Support dead end | owned-by-support | Q#6 skip. CTAs → `/help`. Change PROPOSED 0/32. |
| 21 | Connect wizard → Alert | outstanding | Hand-rolled alerts in wizard / `BaseSelectionTable`. |
| 22 | refineFacetIcons + concept colour | outstanding | `refineFacetIcons.ts` still hardcodes `lucide--table-2`. |
| 23 | Remaining exitEdit (C4/C7) | already-satisfied | Same `registryEditMode` as #2. |
| 24 | Lead cell `<a href>` | outstanding | Rows still `onclick`/`location=` on Sources/Dest/Reports/Backups. |
| 25 | Breadcrumb consumer | outstanding | `Breadcrumbs.astro` unused by views; Record crumbs are spans. |
| 26 | aria-sort + header buttons | outstanding (partial) | Present on `Table.astro` / some Data; many hand-built `<th data-sort-col>` lack `aria-sort`. |
| 27 | data-sort-col off element name | outstanding | Still on `<th>` widely. |
| 28 | toolbarFit NARROW_AT | already-satisfied | `toolbarFit.ts` uses content-wrap measurement; permanent-narrow threshold fixed. |
| 29 | One Escape owner | outstanding | `escapeStack.ts` exists + PanelHost uses it; ~10 non-legacy `document` keydown Escape sites remain (Drawer, SchemaView, inbox, wizard…). |
| 30 | btn-md carve-out | already-satisfied | **0** `btn-md` in apps/web. |
| 31 | entityIcon bypasses | outstanding | Bypass glyphs remain (Restore, refine, …). |
| 32 | One page name · one narrow tier | outstanding | Sweep not complete. |
| 33 | fmtRelative + fmtCount | outstanding | `fmtRelative` in `time.ts`; **no** `fmtCount`; `tablePager` still bare `toLocaleString()`. |
| 34 | wireViewState Schema/Data | outstanding | Module exists; not on Schema’s nine / DataBrowse. |
| 35 | setButtonLoading convergence | outstanding (partial) | DocsTab Save/Delete/New → `setButtonLoading`. Other one-offs (StaticImport, BaseSelectionTable, ReportDefinition, …) remain. |
| 36 | text-error Clear filters | already-satisfied (colour half) | `text-error` removed from Clear controls. Label/grammar residue still open. |
| 37 | Vessel residue | outstanding | Blocked on incomplete #13–15. |
| 38 | Drawer/panel width contract | outstanding | Drawer still `w-[min(92vw,28rem)]` (`Drawer.astro:31`). Item 5 prerequisite **met**. |
| 39 | Pager threshold | outstanding | Blocked in part on D15 gate (task 8). |
| 40 | Catalog stale facts | outstanding | Doc-only; can run parallel. |
| 41 | lib/registry/ module | outstanding (partial) | `removal.ts` + **`registryEditMode.ts`** landed; rename/links modules still open. |

---

## Session worklist (priority)

1. ~~Item 5~~ — already satisfied.
2. ~~Item 3~~ — closed earlier session.
3. ~~Item 4 remainder~~ — closed earlier session.
4. ~~Item 10b~~ — closed earlier session.
5. ~~Item 15b + 36 colour~~ — closed earlier session.
6. ~~Items 2 / 7 / 23~~ — closed this session (`registryEditMode` + `?name=`).
7. ~~Item 13 vessel restore + Schema→Data start~~ — this session (sweep continues).
8. ~~Item 14 Data EmptyState + 46ch~~ — this session (sweep continues).
9. ~~Item 35 DocsTab~~ — this session (other idioms remain).
10. ~~Item 18 Home badge glyph~~ — this session (wizard/global remain).
11. Next: Alert scope B / registries, Badge sweep, Escape owner (29), D15 gate.

**Phase 13:** Yes in parallel — census complete; item 5 satisfied; solid early-S1 chunk landed. Schema re-arch does not depend on finishing all 41.
