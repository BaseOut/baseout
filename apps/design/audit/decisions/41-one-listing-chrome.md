# D41 — One listing chrome

**Rule:** Everything wrapped around a data table is one chrome — one toolbar container (`.sch-tb`),
one collapsing search, one width answer (`toolbarFit`), one count grammar, one "show more" sentence
— and any list that can grow past a screen carries `TablePager` or `pattern-node-showmore`, at a
threshold the catalog states in rows rather than leaving to judgement.

## Why this option, and what was rejected

`.sch-tb` is on nine surfaces; its three rivals have **one file each and byte-identical CSS**
(`display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:1rem;`, lead-verified at
`BackupsListView.astro:383`, `ReportsView.astro:441`, `RestoreHistoryView.astro:332`). They are
copies, not alternatives, so there is nothing to weigh.

**The reason is VARIANCE, and the measurement this decision originally cited is WRONG — replaced
2026-08-14, on Oleh's ruling 8, and it must not be repeated.** This file used to argue that the three
copies' *"only answer to running out of room is to become two rows."* **Measured at 1100 on all three:
none of them wraps.** They carry two and three controls totalling **~430px in an 1100px column** and
they never run out of room at any width the app is used at. Wrapping is a problem of the **dense**
toolbars, and those are already `.sch-tb`. (Probe caveat, recorded because it produced a wrong reading
first: **toolbar height is the wrap signal; child `top` offsets are not** — a baseline-offset count
label sits 5px below its siblings inside a 28px one-row toolbar and reports a false second row.)

**So the reason to converge is the one that needs no measurement: three byte-identical private rules
for one job.** Three names for one thing is exactly what made them invisible to the width mechanism —
that is the finding, and it is sufficient. **Do not re-cite the wrap, or the next audit will measure
for one, fail to find it, and reverse a correct decision.**

**What the measurement DID find is sharper, and no finding had stated it.** `.sch-tb` is the only
toolbar family with a *width answer* — `toolbarFit.ts` measures `#layout-content`'s `clientWidth`, not
the viewport, and stamps `data-narrow` **below 1440**. But **that column is 1184 at a full-screen 1440
laptop with no split view**, because the sidebar takes 256. **The threshold can therefore never
evaluate false on the hardware this product runs on: `data-narrow` is not a narrow adaptation, it is
the permanent state**, and six `global.css` rules that read as "below 1440 we drop button words and
collapse search to a magnifier" are in fact the only rendering `.sch-tb` has ever had. **A media query
still cannot see split view** — the file's header comment is right about that and about its ~795px
measurement — but the number it compares against is wrong.

**Rejected: deleting `toolbarFit` as dead code.** It is the sole writer of `data-narrow` and six CSS
rules die with it (X02-F9). The open question resolves as **extend its reach, not delete** — and the
mechanism is RATIFIED into the catalog so the question does not get asked a third time.

**Rejected: a per-surface pager judgement.** `pattern-table-toolbar` says "any set that can grow" and
names no row count, so six surfaces answered "no" (X03-F12). A rule with no number is not a rule.

## The concrete changes

0. **Fix `toolbarFit.ts`'s threshold first** (Oleh, ruling 7; register row **X-M17**): make it
   measure what it claims rather than declaring the narrow rendering the default. **Expect a visible
   change to every dense toolbar in the product — at wide widths the button words and the full search
   field come back on nine `.sch-tb` surfaces — and require a screenshot at 1440 before it is called
   done.** This supersedes the framing in `task-responsive-1440-toolbar`. Doing it after step 1 would
   flip nine surfaces and three newcomers in one diff; doing it first isolates the visible half.
1. `.bl-toolbar`, `.rpl-toolbar`, `.rh-toolbar` delete; Backups, Reports and Restore history render
   `.sch-tb` and mount `watchToolbars`. Three copies → one rule.
2. `collapsingSearch`'s `WRAP` stops being `.sch-tb-search`-only in effect: because the three
   surfaces now carry `.sch-tb`, the same field behaves one way at one window width. (No change to
   `collapsingSearch.ts` itself — this is why converging the container is the fix.)
3. `ExportControl`'s word-drop stops being orphaned on Reports: `ReportDetailView` gains `.sch-tb`
   and `watchToolbars`, and `ExportControl.astro:380`'s `|| root.parentElement` fallback can then be
   removed or documented as unreachable.
4. **One "show more" sentence.** The catalog's shape — *say what is left*, `Show 25 more of 340` —
   applies to all four: `pickerSearch.ts:559`, `SchemaBrowse.astro:841` + `recordReadBody.ts:387`,
   `SchemaRelationships.astro:205`, `inbox.ts:199-203`.
5. **One count grammar.** `SchemaBrowse.astro:906` stops changing shape as you filter; it renders
   `Showing N of M` always, both numbers in `mono-data` so the digits do not jitter (Reports'
   spelling, `ReportsView.astro:110`).
6. **A stated pager threshold**, written into the entry, and applied to the six unbounded tables
   (`SourcesView` · `DestinationsView` · `SourceDetailView` · `DestinationDetailView` ·
   `BackupRunDetailView` · `BackupRunBaseView`). **Two of the six are already inside D15 §3 — do not
   double-count them, and do not fix them here.**

## Surfaces changed

`BackupsListView` · `ReportsView` · `RestoreHistoryView` · `ReportDetailView` · `SchemaBrowse` ·
`SchemaRelationships` · `pickerSearch` · `recordReadBody` · `inbox.ts` · the four registry views.
**Batch: one PR for the three toolbar containers (they are one diff), one for the copy, one for the
pager threshold.**

## storybook.ts

- `pattern-table-toolbar`: name `.sch-tb` as the one container and `toolbarFit` as the width answer,
  with the split-view measurement quoted (**this is the RATIFY record for X02-F9**). State the pager
  threshold as a row count, not as "any set that can grow".
- `pattern-node-showmore`: the "say what is left" rule already exists; add the four call sites as the
  conformance list.
- Correct the entry's own pager example, which hand-types a `Prev`/`Next` `btn-outline` pager the
  entry's usageDont forbids — that is X01-F15, filed under D34.
- §12 still lists Sources/Destinations as "FOLD, still to build". They pan. Correct it.

## Not changing

`FacetFilter` — 13 importers, zero hand-rolled facet dropdowns remaining; X02's filtering half is
converged and must not be reopened. · `mountRefineCollapse` (10 importers, already ruled). ·
`toolbarFit.ts`'s two header comments — extend the file, never rewrite it; a refactor that re-derives
from the viewport reintroduces both bugs. · `runReadBody.ts:126`'s third count form ("Showing the 500
sampled of 12,480 — open the backup for the full list") — it is the only count in the app that says
*why* two numbers differ and must not be flattened into Reports' grammar. · The three distinct
no-matches states on Backups, Reports and Restore history. · `pageSize` persists while `page` resets:
deliberate, correct, stays.

## Verify

`grep -rn 'bl-toolbar\|rpl-toolbar\|rh-toolbar' apps/web/src` → 0 · `grep -c 'sch-tb'` covers all
twelve listing surfaces · resize `#layout-content` below 1440 on Backups and on Schema Browse and
read `getComputedStyle(searchWrap).width` and `toolbar.getBoundingClientRect().height` on **both** —
they must match. ~~This measurement has never been taken by anyone and it is the one that falsifies
this decision.~~ **TAKEN 2026-08-14: it falsified the stated reason and left the conclusion standing.**
Measured — `/schema` at 1440: column **1184**, `data-narrow` **ON**, search collapsed to **32px**,
toolbar one row · `/backups` at 1440: same 1184 column, `data-narrow` **absent tree-wide** ·
`/backups` and `/reports` at 1100: one row each, 28px, search field 986px, three children totalling
427.5px. **The remaining unverified claim in this decision is the pager threshold: real row counts for
the six unbounded tables were never taken by anyone**, so item 6 is still a judgement wearing a
number's clothes.


---

## AMENDMENT 2026-08-14 — one new member, and one rationale deleted

**New member: X-M17 (S2).** `toolbarFit.ts:18` — `const NARROW_AT = 1440` against a column that is
1184 on the target hardware. Item 0 above. **It is the only item in this decision that changes what a
user sees at a normal desktop width, and it entered the audit as an Oleh ruling, not as a finding —
no scout caught it.**

**Deleted, not softened: the wrap rationale.** Recorded here as well as in the body because a deleted
argument tends to come back: **the three private toolbars do not wrap at 1100, and converging them is
still right.** Variance is the whole reason. `X02-F9`'s RATIFY of `toolbarFit` stands unchanged — the
mechanism is right, the constant is wrong, and "delete it as dead code" remains the wrong answer.
