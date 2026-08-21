# D47 — One breadcrumb

**Rule:** There is one page breadcrumb component and one drawer location trail, and every crumb whose
ancestor is reachable is a control; a breadcrumb that is computed is rendered, or it is deleted.

## Why this option, and what was rejected

**The app has three page-breadcrumb systems and only one of them is alive.**

1. `components/ui/Breadcrumbs.astro` — the catalog's **named reference**, with **zero importers
   anywhere in `apps/web`** (lead-verified: `git grep -a -l "ui/Breadcrumbs" -- 'apps/**'` returns
   only `apps/design/src/lib/storybook.ts`). No screen has ever rendered it. It escaped the repo's
   dead-view sweep because that check only walks `views/*.astro` — which is itself worth recording.
2. `getBreadcrumbs()` — computed by **25 harness pages**, passed into `SidebarLayout`, JSON-serialised
   into `#page-header-state`, parsed into a nanostore by `Header.astro` — **and painted by nothing.**
   `Header.astro:83-92` paints `title` only. `global.css:480` says it out loud. A whole data pipeline
   exists for a UI that does not.
3. The live one: `<div class="breadcrumbs text-sm py-0">` hand-rolled in **six places**, twice in one
   file — and **four of them carry a comment calling it "daisyUI primitive (catalog)"**, naming the
   entry that points at the dead component.

**And the drawer trail forks behaviourally, not cosmetically.** `locationCrumbs.ts:7` says *"Every
drawer uses this — never hand-roll a breadcrumb"*; `recordReadBody.ts:338-343` hand-rolls one anyway
and has **no clickable branch at all** — every segment is a plain `<span>`. `locationCrumbs.ts:30-32`
renders an ancestor with `openAttrs` as a `<button class="sb-crumb-link">`. So the Base ▸ Table trail
is **clickable in the Attachments panel and dead text in the Record panel** — two panels of the same
Data section, styled identically. A user learns the trail is navigable and then finds it is not.

**Rejected: deleting `Breadcrumbs.astro` and blessing the six hand-rolls.** RATIFY was a live option
here and it loses on one fact: the six hand-rolls are not one thing. One file carries two of them,
and their markup diverges. Blessing them makes the divergence the rule. The extraction is small — the
living markup is six lines — and the component then has, for the first time, a consumer.

**Rejected: leaving the `getBreadcrumbs()` pipeline in place "in case".** It has been computed,
serialised and parsed for long enough that a stylesheet comment complains about it. Either the
extracted component consumes the store — which is the cheap, correct outcome and makes 25 pages'
work start paying — or the pipe is deleted. It must not be left as it is.

## The concrete changes

1. **Extract the living `div.breadcrumbs` markup into `components/ui/Breadcrumbs.astro`** and repoint
   the six views: `BackupRunBaseView:132` · `BackupRunDetailView:219` **and** `:234` ·
   `ReportDefinitionView:115` · `ReportDetailView:72` · `RestoreView:209`.
2. **`Header.astro` paints the crumbs from `$pageHeader`**, which it has always parsed — or
   `getBreadcrumbs()`, `SidebarLayout.astro:136`'s serialisation and `stores/pageHeader.ts`'s crumb
   field are deleted together. **One or the other, in this PR.** (X12-F5)
3. **`recordReadBody` calls `locationCrumbs`** with `openAttrs`, and its hand-rolled trail deletes.
   The Record panel's Base ▸ Table crumbs become clickable, matching every other drawer.
4. The four misleading "daisyUI primitive (catalog)" comments are corrected or removed.

## Surfaces changed

`Header.astro` · `SidebarLayout.astro` · `lib/config.ts` · `stores/pageHeader.ts` ·
`components/ui/Breadcrumbs.astro` · `BackupRunBaseView` · `BackupRunDetailView` ·
`ReportDefinitionView` · `ReportDetailView` · `RestoreView` · `recordReadBody.ts`. **Batch: the
drawer trail (item 3) is one file and independent — ship it first.**

## storybook.ts

`breadcrumbs`: the `reference:` key currently names a component with no callers. Once the extraction
lands it becomes true for the first time; state the rule that a crumb whose ancestor is reachable is
a control, and cite `locationCrumbs.ts:30-32` as the drawer half. Add a note that the repo's dead-view
census walks `views/*.astro` only, so a dead `components/ui/*` file is invisible to it — that is how
this survived.

## Not changing

`locationCrumbs.ts` — one builder, escaped, with the current entity deliberately living in the header
rather than as a tail crumb. **The fix for X12-F2 is to *use* it, not to change it.** ·
`sectionNavFit.ts`'s whole-group overflow (clusters move entire, never single tabs, because a
half-emptied cluster label tells the same lie more quietly) — correct and hard to re-derive.

## Verify

`git grep -a -l "ui/Breadcrumbs" -- 'apps/**'` returns the six views (or the component is gone and
`grep -rn 'class="breadcrumbs' apps/web/src` returns only the component) · `grep -rn 'getBreadcrumbs'
apps/web/src apps/design/src` → either every hit reaches a paint, or 0 · open a record in the Record
panel and click its Base crumb: it opens the base, as it already does in Attachments.
