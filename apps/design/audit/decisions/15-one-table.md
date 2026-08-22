# D15 — One table (**DEFERRED, with a HARD GATE — not interim, not rejected**)

**Rule:** Every list in the app is the same table: one `<th>` recipe, click-sort via
`components/schema/tableSort.ts` with the one CSS-caret indicator, `TablePager` wherever a set can
grow, sticky headers on scrolling lists — and **every flexible grid track carries a real
`minmax()` floor**.

## Why this option

The reference exists (`decision-schema-table-pattern`, `tableSort.ts`, `TablePager` in 13 files);
the journeys found the surfaces that opted out are exactly the ones whose job is *finding a row*:
the backup audit log (0 sortable columns), both account registries, Reports' three tables (one
sorter, and it overrides the global caret with a text `↕`), Restore's unbounded step-2, and a
Comments tab of 547 rows with a static `aria-hidden` header. The rejected alternative — letting
X01 handle it all later — would leave five S2s and one S1 open for no reason; the journeys already
settle the direction, X01 will finish the census (19+ files with bespoke `<th>`) and pick the final
`<th>` anatomy.

## The concrete changes

1. Backups list + run detail + base view: `tableSort.ts` headers ("sort by status" is the log's
   whole job). (J02-F9)
2. Reports: one header recipe across list/History/body; History sortable, Period-ordered by
   default; the `↕` override deleted; `TablePager` on both tables. (J07-F9, F10, F13)
3. Registries: shared header + sort (pager when counts warrant). (J08-F20)
4. Restore step 2: `TablePager` + filter field. (J04-F9)
5. Comments: the Attachments engine — real `<table>`, sticky sortable header (D11 context, J06-F9).
6. **Grid floors — fix now, S1**: Health's metric grid gives the name track a real floor and lets
   the `auto` chip track shrink/wrap, so split view stops rendering five nameless rows with the
   score painted under the panel (`SchemaHealth.astro:714,717`, `minmax(0,1fr)` → e.g.
   `minmax(8rem,1fr)`); re-measure at `.sch` ≈ 808px. The rule generalises
   `DataChangelog.astro:260-268`'s written reasoning. (J05-F3)

## Surfaces changed

`BackupsListView` · `BackupRunDetailView` · `BackupRunBaseView` · `ReportsView` ·
`ReportDefinitionView` · `ReportBodyKpi` · `SourcesView` · `DestinationsView` · `RestoreView` ·
`DataComments` · `SchemaHealth`.

## storybook.ts

`table` / `pattern-audit-table`: state the one `<th>` recipe, the one sort indicator, the pager
rule, and the grid-floor rule ("a flexible track is `minmax(<floor>,1fr)`, never bare `1fr`/`minmax(0,…)`
beside fixed tracks"). X01 finalises the anatomy details.

## Not changing

`TablePager` itself · tree "Show N more" (`decision-tree-showmore-not-pager`) · the Attachments
table's documented column budget (its fragility is D21's re-derivation trigger).

## Verify

Every named table sorts on click with the caret indicator; Health's metric names render at split
width 808px; scrolling Comments 600px keeps the header; `git grep data-sort` covers the backup and
report views.

---

## AMENDMENT 2026-08-14 — **DEFERRED, not rejected** (Oleh's vessel ruling)

Three vessels are approved and this one is not, yet. `EmptyState.astro` (D17), an alert vessel and
`Badge.astro` as the only path for a status badge are **BOUND**. **`Table.astro` is DEFERRED** —
revisit after fix waves 1–2.

**Trigger that reopens it:** completion of fix waves 1 and 2. At that point the sweep those waves
perform (frames onto `tbl-frame`, headers onto `tableSort.ts`, pagers onto `TablePager`) will have
established how much of the table job is already shared, and the vessel is designed against the
residue rather than against a guess.

**Disposition of findings whose only structural remedy is `Table.astro`:** they are filed **against
this deferred decision** — not closed, not scheduled into Wave 3, and not converted into a per-file
fix that would have to be undone when the vessel lands. From the S24–S40 wave:

- **S25-F4 (structural half)** — the `In use by` panel is a one-column list of names (measured
  `useHeaders: ["SPACE"]`, `role: null`, `cursor: auto`, one `<td>`) where the Sources twin measures
  seven columns with `role="button"` and a route out. Its *copy* half ("Unlink them first" must name
  where unlinking happens) is ADOPT now under **D38**; the columns wait for `Table.astro` **and** for
  PARKED **P7.1** (`DestinationSummary.inUseBy: string[]` carries no `spaceId`), which is the real
  blocker. **Do not let `specs/16-responsive.md:317`'s "one column by design" harden into a
  decision — it is one column by missing model.** The spec sentence should be annotated now, before
  someone cites it as a blessing.
- **S25-F12 (S4)** — dead keyboard wiring (`root.querySelectorAll('.reg-userow[role="button"]')`
  selects **0** elements) and a sortable `data-sort-col="0"` header over one column. Both lines
  become correct the moment the rows gain ids; deleting and re-adding them is churn. Recorded so the
  next reader does not conclude the keyboard works.

Everything else in D15's original "concrete changes" list stands as written and stays deferred with
it, except item 6 (grid floors, S1) which was always scoped to ship immediately and is unaffected.


---

## AMENDMENT 2026-08-14 (second) — one further member from the X-lens wave

**X01-F2's component half.** The lens found the *cause* of the nine table-header constructions and it
is falsifiable: **the lens with a component has 1 implementation, the lens with a class has 9.**
Pagination was in exactly the same state — `TablePager.astro:4-11` records it: *"hand-copied into four
surfaces before Schema needed it on five more; it is a component now… there is no second pager left
to drift from."* Same repo, same period, same authors. `apps/web/src/components/ui/` contains
`TablePager.astro` and **no** `Table.astro` / `TableHead.astro` (lead-verified).

**Filed against this deferred decision, not scheduled.** D40 converges the nine constructions onto the
`.tbl-colhead` class that already exists — work that must happen either way and that a later vessel
does not undo. **The vessel itself stays deferred**, and the trigger is unchanged: completion of fix
waves 1–2.

**Standing count of rows filed against deferred D15: four.** S25-F4 (structural half) · S25-F12 ·
X01-F2 (component half) · and the residue of X01-F1/X01-F5 that a class cannot reach. **If waves 1–2
complete and nobody re-opens D15, those four are silently dropped** — that risk is recorded in the
register's under-audited list, item 12.


---

## AMENDMENT 2026-08-14 — **DEFERRED behind a hard gate. Oleh, ruling 9.**

**Ruling, verbatim in substance:** *"yes — put a hard stop in the ship order. D15 must be re-opened
after item 16 and must not be allowed to remain deferred by default."*

**The stop is now `audit/SHIP-ORDER.md`'s gate between item 17 and item 18** — a blocking section, not
a bullet in a reopen list, because a bullet in a reopen list is exactly how these four rows get lost.
(Item 16 in the order Oleh ruled on is item 17 in the revised order; the content of the vessel wave is
unchanged, one S1 was inserted at position 5.)

**The four rows waiting on this decision. None is rejected; each is filed and undisposed-by-schedule
only:**

| row | what waits on D15 |
|---|---|
| **S25-F4** | its structural half |
| **S25-F12** | all of it |
| **X01-F2** | its component half — the catalog half ships now under D34/D40 |
| **X01-F1 / X01-F5** | the residue left after D40's header and sort work lands |

**Why the trigger is the vessel wave and not a date.** Oleh's stated reason for deferring was that the
9-class / 23-file migration's size *"is not yet knowable"*. By item 17 it is: ship items 26–28 and 39
will have established how much of the table job is already shared, so the vessel can be designed
against the residue rather than against a guess. **Re-census before designing** — the tree-wide figures
are **25 `<th`-declaring files and 19 `.tbl-colhead` files**, not the 24/18 recorded here (the
difference is `DataBrowse.astro`, which every binary-classifying grep in this audit skipped; register
row X-M19).

**The deliverable of the re-open, so that "we looked at it" cannot satisfy the gate:** either an
amended version of this file that binds a vessel, **or a written ACCEPT declining the four rows with
the reason.** Either is acceptable. Silence is not, and silence is the default this gate exists to
prevent.

**Two of the six unbounded tables in D41 item 6 are inside this decision's §3** — do not touch them
until the gate is answered, and do not double-count them.

---

## AMENDMENT 2026-08-21 — **ACCEPT: decline binding `Table.astro` as a vessel**

The hard gate required a written answer. Silence is no longer the default.

**Disposition: ACCEPT — decline the four filed rows as a reason to bind a new `Table.astro` vessel.** They stay as class-level residue under D40 (`.tbl-colhead` / `tableSort.ts` / `TablePager`), not as a cataloged table component that every list must mount.

**Why (evidence, not taste):**

1. **Runtime headers cannot be a static vessel.** Data Browse (and Schema Health's metric band) build `<th>` sets from the live schema. A Storybook `Table.astro` with a fixed column recipe cannot express that without becoming a passthrough wrapper — the audit already recorded this as X-M19 / DataBrowse being skipped by binary greps.
2. **Waves 1–2 already shared the table job.** `tableSort.ts`, `TablePager`, `.tbl-frame`, `.tbl-colhead`, and `wireRowKeys` are the shared anatomy. Item 26/27 remaining work is adoption of those classes, which D40 said must happen either way and a later vessel does not undo.
3. **The four rows do not need a new component to close honestly:**
   - **S25-F4 structural half** — still blocked on `DestinationSummary.inUseBy` lacking `spaceId` (P7.1). A vessel would not grow the model.
   - **S25-F12** — dead keyboard wiring over a one-column list; correct when rows have ids (same P7.1), not when the markup is wrapped.
   - **X01-F2 component half** — the 9-class / 1-component observation is real; the remedy in this tree is D40 class convergence, not a second pager-shaped extraction.
   - **X01-F1 / X01-F5 residue** — header/sort work that class adoption covers; leftover after D40 is follow-up, not a vessel trigger.

**What this ACCEPT does not do:** it does not cancel item 6 (Health grid floors — still ship). It does not cancel pager adoption on unbounded tables that are *outside* this decision's §3. It does not forbid a future `Table.astro` if a second identical static-header call site appears (YAGNI until then).

**Who can reopen:** a design ruling that binds a vessel against the residue after items 26–28 land. Until then the four rows are **declined as vessel-blockers**, not silently dropped.


