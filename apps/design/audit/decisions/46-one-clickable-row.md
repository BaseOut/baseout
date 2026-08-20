# D46 — One clickable row

**Rule:** A whole-row click is a **button**, and the row's lead cell is additionally a **link**: the
row keeps `role="button"` + a keydown for the big target, and the lead cell carries a real
`<a href>` with `onclick="event.stopPropagation()"`, both reaching the same href. A non-table row is
a real `<button type="button">` and carries no keyboard code at all.

## Why this option, and what was rejected

**Twelve list rows navigate by `window.location='…'`** (lead-verified at all twelve exact lines;
`grep -c` tree-wide = 12, no thirteenth). `window.location=` is a same-tab assignment that ignores
modifier keys, so ⌘-click, middle-click, right-click ▸ Copy link address and "open in a background
tab" are unavailable on **every list in the product**. On a utility admin tool whose core job is
comparing runs and bases side by side, that is a real loss, not a purity argument.

**The rule already exists in the tree, implemented once, and it works.**
`BackupRunDetailView.astro:446` puts a real `<a href={baseHref} onclick="event.stopPropagation()">`
on the base-name cell *inside* the row-clickable `<tr>`. The row is a button, the name is a link,
both reach the same href — and it is the only one of the twelve where ⌘-click works. This is not a
compromise between two patterns; it is one pattern that one file already has.

**Rejected: making the row an `<a>`.** A `<tr>` cannot be an anchor, and wrapping cells in anchors
breaks the table layout and the `.row-actions` overlay the file argues for in writing.

**Rejected: adding a twelfth copy of the keyboard block.** The same 3-line "Enter/Space →
`r.click()`" is already copied into **11 files**, and the three places it was *not* copied are
X07-F5 — three tables in the report body that announce `role="button" tabindex="0"`, paint a focus
ring, and do nothing on Enter. **That is the worst affordance failure available, because the row
visibly claims to be actionable.** A twelfth copy makes the twelfth omission inevitable. The argument
is already written in this repo at `global.css:2766-2772`: `.cl-entry`/`.dc-runrow` became real
`<button type="button">`s and need **zero** keyboard code — *"a keyboard contract re-implemented per
feed is the class of bug a real button never has."*

**This decision supersedes register row `X-C`**, which recorded eight sites under D16 and issued no
ruling. Three passes asked for an id and none was issued; the count is twelve and the ruling is here.

## The concrete changes

1. **Every one of the twelve rows gains a lead-cell `<a href>`** with `stopPropagation`, matching
   `BackupRunDetailView.astro:446`: `ReportBodyKpi:229,281,360` · `BackupRunDetailView:436` ·
   `BackupsListView:229` · `DestinationsView:143` · `ReportDefinitionView:232` · `ReportsView:154` ·
   `RestoreHistoryView:196` · `SourceDetailView:182` · `SourcesView:154` · `SpaceHomeView:289`.
2. **One exported `wireRowKeys(root)` in `lib/`**, called once per listing; the 11 copies delete.
3. **The three report-body tables are wired** by the same call — they are the omission, and they stop
   being a special case.
4. **Non-table rows become real `<button>`s**, following `.cl-entry`/`.dc-runrow`, and drop their
   keyboard code entirely.
5. `BackupRunDetailView.astro:731`'s comment is corrected: it claims its rows are "wired the same way
   … the Backups list wire theirs", and the Backups list has no such wiring in its own file — it
   inherits it from `runLog.ts:76`. A future implementer following the comment finds nothing.

## Surfaces changed

`ReportBodyKpi` · `BackupRunDetailView` · `BackupsListView` · `DestinationsView` ·
`ReportDefinitionView` · `ReportsView` · `RestoreHistoryView` · `SourceDetailView` · `SourcesView` ·
`SpaceHomeView` · `ReportDetailView` · `SourceDetailView` · `DestinationDetailView` · `DataMedia` ·
`runLog.ts` · new `lib/wireRowKeys.ts`. **Batch: `wireRowKeys` + the three unwired tables first (that
is the defect a user meets); the lead-cell links second, one PR per section.**

## storybook.ts

`pattern-row-actions`: promote the two-part rule from prose into the entry — the row is a button, the
lead cell is a link, and `wireRowKeys` is the one keyboard implementation. `row-actions.css:1-11`
declares the keyboard half in prose today and nothing enforces it, which is exactly how one file
forgot.

## Not changing

`.row-go`, the persistent quiet chevron (`row-actions.css:22-24`) — **the single best-transferring
affordance in the app**: a user learns "grey chevron on the right = this row opens" once and finds it
identical on eleven surfaces. Every change here must preserve it exactly, including its two opacity
steps. · `.row-actions` being absolutely overlaid: the reason is written down and measured — in-flow
icons widen the trailing column and force a horizontal scrollbar on the whole table. · The ~10
`<div tabindex="0" role="button" class="btn">` dropdown triggers: daisyUI's required idiom, not a
finding. · The 55 `<a class="btn">`: daisyUI's documented spelling for a navigating button, not a
finding. · `cursor: pointer` ×154 is **DEFERRED to D21** — trigger: the next variance census, or this
work opening one of the files.

## Verify

`grep -rn "window.location *=" apps/web/src` returns only sites that also have a lead-cell `<a>` ·
`grep -rn "=== 'Enter'" apps/web/src` collapses to `lib/wireRowKeys.ts` plus the picker ·
⌘-click a row on `/backups`, `/reports`, `/sources` and `/restore` and get a new tab on each · Tab
onto a row in the report body's Backups table and press Enter — today nothing happens.
