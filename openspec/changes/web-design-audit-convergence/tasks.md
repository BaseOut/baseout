## Status

PROPOSED — 0/34. Umbrella over the design audit's 41-item ship order ([`apps/design/audit/SHIP-ORDER.md`](../../../apps/design/audit/SHIP-ORDER.md)) as it applies to **our** tree.

The vessels landed with `2bb5b46a`; the **adoption sweeps did not**. Several S1s also landed independently, so **task 1 is a census, not a fix** — see [`design.md`](./design.md) D1.

**⛔ Task 8 is a hard gate.** Nothing in tasks 9+ starts until `D15` is answered in writing.

Delegated elsewhere (struck here, tracked there): items 1 + 6 → [`web-auth-convergence`](../web-auth-convergence/) · item 11 → [`web-automations-interfaces-tabs`](../web-automations-interfaces-tabs/) · item 20 → [`support`](../support/) · items 12/16 Reports halves → [`web-reports-page`](../web-reports-page/).

---

## 1. Census (blocking — no fix lands before this)

- [ ] 1.1 Produce `apps/design/audit/OUR-TREE-STATUS.md`: one row per S1 and per ship item, verdict ∈ `already-satisfied` / `outstanding` / `never-applied-here` / `owned-by-<change>`, **each with its evidence** (file:line, computed value, or owning change). Struck-without-evidence is the failure mode this file exists to prevent.
- [ ] 1.2 Use the audit's instrument rules: `/usr/bin/grep -a` for every quoted count (the shell's `grep` skips a binary-classified file with **exit code 0** — this produced six drifting counts inside the audit itself); device-metrics emulation for viewport claims, never a window resize.
- [ ] 1.3 Record the already-verified samples so they are not re-litigated: item 3 fixed (`settingsCatalog.ts:166` guards `!space`), item 4 fixed (all four sites carry the corrected map + a note), item 9 fixed (`toneDotOf` static-literal map + the `X08-F7` note, in the in-flight Reports work), item 5 **outstanding** (`PanelHost.astro:623` — no `left`).
- [ ] 1.4 Re-census the counts the audit flags as stale in its own text: item 26's header constructions are **19 of 25 files, not 18 of 24**; item 29's Escape ledger is **8 sites, not 5** (add `collapsingSearch.ts:70`, `entityPanelController.ts:705`, `DataBrowse.astro:1313`; drop `sectionTabs.ts:81` and `EntitySearch.astro:266`, which handle `/`).

## 2. Item 5 — `.ph-panels` gets a width (do this first; it is also the fork delta)

- [ ] 2.1 `components/ui/PanelHost.astro` — sync from `ui-only@252005be` (the **only** web-layer file in the new delta). `.ph-panels` gains `left: 0`; `pointer-events: auto` → `none` (the box now spans the viewport, so the panels re-enable pointer events themselves and the page stays clickable behind).
- [ ] 2.2 **Verify by computed value on all five hosts, not by screenshot.** Today the first panel paints 288.79px at x=101.21 instead of 350 at x=40 — *identically at 390 and 425*, which is the tell. Assert 350/40 after.
- [ ] 2.3 Keep `EntityPanel.astro:307-314`'s comment intact — it is the trap this fix can re-open.
- [ ] 2.4 Confirm the second-panel case still behaves (opening a second panel used to clamp the box to `100vw`, which is why the same declaration was right on `/data` and wrong on `/schema`).

## 3. A11y — the four real defects

- [ ] 3.1 **Item 10a** — focus enters the overlay. `PanelHost` + `panelStack` have **zero** `.focus()` calls, so Tab walks the page behind the panel and Escape closes something the user never reached. Land after task 2 (same file).
- [ ] 3.2 **Item 10b** — `Drawer` stops claiming modality it does not implement: it asserts `aria-modal="true"` twice with no trap, no `inert`, no restore. **Separate PR from 3.1** (the audit is explicit).
- [ ] 3.3 **Item 17** — `lib/wireRowKeys.ts` (already landed) replaces the 3-line keyboard block copied into 11 files, and reaches the **3 tables that paint a focus ring and do nothing on Enter**. Ship before item 24's lead-cell links — this is the half a user meets.
- [ ] 3.4 **Item 29c** — the eight competing `document` Escape listeners become one delegating owner. `stopPropagation` cannot arbitrate: all eight are on `document`, so 24 deliveries occur per press and 13 land *after* the one `stopPropagation()`. Reproduce at a section column ≤964, not 1440 — above that the co-open state does not exist.

## 4. Item 8 — the gate walks states, not labels

- [ ] 4.1 `smoke.mjs` only, no client PR: `/settings` declares six variants and no fixture variant · `bases.astro` has no `empty` branch · `/login` and `/register` declare zero variants · **eight of Schema's nine tabs are requested by nothing** · `/reports/[id]` reads no `?fixture=`.
- [ ] 4.2 Take the 2-character `DataBrowse.astro:936` NUL-byte fix (`'\0'` for the literal) **in the same PR** — until it lands, every census silently omits one file.
- [ ] 4.3 This unblocks verifying `D17`: three of the 28 empty-state families have never been seen empty by anyone, so item 6 below cannot be verified without it.

## 5. Vessel adoption — batched by surface family (Schema → Data → Backups/Restore → Reports → registries)

- [ ] 5.1 **Item 13 — `Alert` adoption, scope A**: the 58 of 79 `role="alert"` sites the vessel can own. The vessel must own the write/reveal **order** (un-hide, then write), write only on change, and refuse a live role to a banner present at first paint or inside a focus-taking modal. 13 of 17 written sites currently write while `hidden` then reveal — the order that suppresses the announcement.
- [ ] 5.2 **Item 13 — scope B (the smaller answer)**: the other 21 sites are **not** alert vessels. `TextInput`/`Select` already own an `error` prop; the five `.reg-err` boxes should *be* that prop. Do not force them into `Alert`.
- [ ] 5.3 **Item 14 — `EmptyState` adoption**: retires 26 of 28 families, makes 15 tile declarations one. Sentence cap bound to 46ch. **Expect zero rendering change from the cap** — measured, it changes none at any width; it is the vessel's spec, not a fix. Ship it as a tidy and never bundle it with work claiming a visual difference.
- [ ] 5.4 **Item 15 — `Badge` as the only path**: 10 call sites vs 243 raw class strings. First PR = the three banned-pair sites + switch on the two badge regexes in `ds-checks.mjs` + **fix** the three files it reddens (do not `ds-ok` them). Amend the catalog entry with the light-theme numbers (4.35 text / 1.11 pill) — the pair fails in **both** themes and the entry documents only dark. Then migrate batched by surface. **Largest diff in the audit — must not land as one PR.**
- [ ] 5.5 **Item 15b — `Running` is PRIMARY (blue)**, bound by Oleh's ruling 5. Eight live sites change: seven `Running` and one `Generating`. Ships as a visible product change with screenshots, not a quiet sweep.
- [ ] 5.6 **Item 35 — `setButtonLoading`**: the six divergent busy idioms converge; the catalog's `button` entry is ratified to describe it.
- [ ] 5.7 **Item 21** — the three hand-rolled tinted boxes in the connect wizard become `Alert` (three vessels → one).

## 6. Tables, toolbars and headers

- [ ] 6.1 **Item 26** — nine header constructions become one; sortable cells become real `<button>`s with `aria-sort` (**both are 0 tree-wide today**); Schema Health drops `aria-hidden` from its column band. Batch: Schema (six of twelve files) → Data → Home. Use the re-censused 19-of-25 figure.
- [ ] 6.2 **Item 27** — `[data-sort-col]` moves off the element name so a grid head can carry it; Health, Docs and Interfaces sort by header and their toolbar sort menus delete.
- [ ] 6.3 **Item 28** — **fix `toolbarFit`'s threshold first**: `NARROW_AT = 1440` against a column that is 1184 on target hardware means `data-narrow` is permanently on and the nine `.sch-tb` surfaces have only ever had one rendering. Then converge the three byte-identical private toolbars onto `.sch-tb`. Converge for **variance, not wrapping** — measured at 1100, none of the three wraps. **Screenshot every dense toolbar at 1440 after: button words and the full search field come back, product-wide.**
- [ ] 6.4 **Item 24** — the lead cell of all twelve clickable rows gains a real `<a href>`, restoring ⌘-click and new-tab on every list.
- [ ] 6.5 **Item 25** — the Record panel's trail becomes clickable (one file, independent); then the breadcrumb component gains its first consumer and the 25-page `getBreadcrumbs()` pipeline is either painted or deleted.

## 7. Sweeps with no vessel

- [ ] 7.1 **Item 18** — the three sub-12px icon rules (`global.css:1902` · `SpaceHomeView.astro:726` · `IntegrationsSetupWizard.astro:591`) → `var(--t-12)`, or a `ds-ok` with a stated reason. **Decide `.hm-conn-badge` at the element** — it is `1rem` square, so this may be a badge-size call (proposal open question 2). Two of the three are visible on Home.
- [ ] 7.2 **Item 22** — `refineFacetIcons` delegates to `entityIconClass`; the concept colour moves off `.lucide--table-2` onto `.concept-ic-table`. Confirmed **whole, not half**: `text-base-content/45` on `RestoreView.astro:345,643` computes *identically* to the bare global rule, because the global selector is (0,2,0) and the utility is (0,1,0) — Restore asks for muted and gets concept-green.
- [ ] 7.3 **Item 31** — the twenty glyph bypasses collapse onto `entityIcon`; the six in-file twins delete.
- [ ] 7.4 **Item 33** — `fmtRelative` adoption, plus `fmtCount` in `lib/` as a sibling of `time.ts`. The locale half is **smaller than it looked**: not a date bug but a thousands separator pinned in 13 places and floating in 45. Sweep the five shared files first — `tablePager.ts` alone (4 calls, 15 importers) corrects the pager total on every paged table. **Do not "fix" the 14 `Intl.*` constructors: all 14 already pin `en-US`.**
- [ ] 7.5 **Item 36** — the copy/colour sweep: `text-error` off 13 benign `Clear filters`, one label for one control, one count grammar, one "show more" sentence.
- [ ] 7.6 **Items 32 / 34 / 39 / 40 / 41** — one page name · one narrow tier · `wireViewState` on Schema's nine + Data's three tabs (plus the listSheet's overlay mode) · the pager threshold on **four** of six unbounded tables (**two are inside D15 — do not touch until task 8 is answered**) · the catalog's eight stale facts · `D38`'s remainder as **one `lib/registry/` module, not eighteen edits**.

## 8. ⛔ HARD GATE — re-open D15 before anything in task 9

- [ ] 8.1 Re-open `apps/design/audit/decisions/15-one-table.md`. **Deliverable: either an amended decision binding a `Table.astro` vessel, or a written ACCEPT declining the four rows filed against it — naming them** (`S25-F4`'s structural half · `S25-F12` · `X01-F2`'s component half · the `X01-F1/F5` residue). Either is acceptable. **Silence is not** — those four rows are dropped silently if nobody answers.
- [ ] 8.2 Oleh's ruling 9 requires this in writing. Record the answer in the decision file, not in a commit message.

## 9. Item 30 — review as a design change, not a cleanup

- [ ] 9.1 The 40px `md` carve-out deletes from the 17 views holding it, and `decision-density-sm-is-default`'s "md = page-header CTA only" is amended in the same PR. It takes `ds-audit` to exit 0. **Zero off-tier buttons were measured** — this fixes no defect. The page CTA thereafter carries emphasis by colour and position alone. **Get an explicit yes before sweeping** (proposal open question 3). `ConfirmModal`'s `ds-ok`'d md footer pair closes with it.

## 10. Verification

- [ ] 10.1 `pnpm --filter @baseout/web audit:components` exit 0 after **every** phase, not only at the end.
- [ ] 10.2 `typecheck` + `test:unit` + `build` green per phase; no stray `console.*` / `debugger` (§3.5).
- [ ] 10.3 Any phase that changes rendering: <375 / <768 / <1024 plus the specific width the audit names for it (1440 for item 28, ≤964 for item 29, 844×390 for the shell).
- [ ] 10.4 `OUR-TREE-STATUS.md` updated as each item closes — with evidence. This file is the change's real progress record.
- [ ] 10.5 Item 19's spec corrections are pushed UP via `/sync-reconcile`, **not** edited here (they are the designer's docs; editing them locally would make this change multi-app — §3.6).
